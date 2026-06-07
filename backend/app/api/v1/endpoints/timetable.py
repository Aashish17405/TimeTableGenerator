from collections import defaultdict

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.db.deps import get_db
from app.models.section import Section
from app.models.subject_requirement import SubjectRequirement
from app.models.teacher_allocation import TeacherAllocation
from app.solver.timetable_solver import TimetableGenerationError, generate_timetables

router = APIRouter(prefix="/timetable", tags=["Timetable"])


class TimetableGenerateRequest(BaseModel):
    section_ids: list[int] = []
    class_ids: list[int] = []


@router.post("/generate")
def generate_timetable(
    payload: TimetableGenerateRequest,
    db: Session = Depends(get_db),
):
    section_ids = _resolve_section_ids(payload, db)

    sections_stmt = (
        select(Section)
        .options(selectinload(Section.school_class))
        .where(Section.id.in_(section_ids))
        .order_by(Section.school_class_id, Section.name)
    )
    sections = list(db.scalars(sections_stmt))
    if len(sections) != len(section_ids):
        found_ids = {section.id for section in sections}
        missing_ids = sorted(set(section_ids) - found_ids)
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Sections not found with IDs: {missing_ids}",
        )

    allocations_stmt = (
        select(TeacherAllocation)
        .options(
            selectinload(TeacherAllocation.teacher),
            selectinload(TeacherAllocation.subject),
            selectinload(TeacherAllocation.section).selectinload(Section.school_class),
        )
        .where(TeacherAllocation.section_id.in_(section_ids))
    )
    allocations = list(db.scalars(allocations_stmt))

    requirements_stmt = (
        select(SubjectRequirement)
        .options(selectinload(SubjectRequirement.subject))
        .where(SubjectRequirement.school_class_id.in_({section.school_class_id for section in sections}))
    )
    requirements = list(db.scalars(requirements_stmt))

    requirements_by_class: dict[int, dict[int, SubjectRequirement]] = defaultdict(dict)
    for requirement in requirements:
        requirements_by_class[requirement.school_class_id][requirement.subject_id] = requirement

    section_allocations: dict[int, list[TeacherAllocation]] = {section_id: [] for section_id in section_ids}
    for allocation in allocations:
        class_id = allocation.section.school_class_id
        req = requirements_by_class[class_id].get(allocation.subject_id)
        allocation.periods_per_week = req.periods_per_week if req else 0
        section_allocations[allocation.section_id].append(allocation)

    validation_errors = _validate_inputs(sections, section_allocations, requirements_by_class)
    if validation_errors:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"errors": validation_errors},
        )

    sections_input = []
    for section in sections:
        sections_input.append(
            {
                "section_id": section.id,
                "section_name": f"{section.school_class.name}-{section.name}",
                "allocations": [
                    {
                        "subject_code": allocation.subject.code,
                        "subject_name": allocation.subject.name,
                        "teacher_name": allocation.teacher.name,
                        "periods_per_week": allocation.periods_per_week,
                    }
                    for allocation in section_allocations[section.id]
                ],
            }
        )

    try:
        return generate_timetables(sections_input)
    except TimetableGenerationError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc


def _resolve_section_ids(payload: TimetableGenerateRequest, db: Session) -> list[int]:
    section_ids = set(payload.section_ids)

    if payload.class_ids:
        class_sections_stmt = select(Section.id).where(Section.school_class_id.in_(payload.class_ids))
        section_ids.update(db.scalars(class_sections_stmt))

    if not section_ids:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Provide at least one class_id or section_id.",
        )

    return sorted(section_ids)


def _validate_inputs(
    sections: list[Section],
    section_allocations: dict[int, list[TeacherAllocation]],
    requirements_by_class: dict[int, dict[int, SubjectRequirement]],
) -> list[str]:
    validation_errors: list[str] = []
    teacher_loads: dict[str, int] = defaultdict(int)

    for section in sections:
        section_name = f"{section.school_class.name}-{section.name}"
        allocations = section_allocations[section.id]
        total_periods = sum(allocation.periods_per_week for allocation in allocations)
        if total_periods != 54:
            validation_errors.append(
                f"Section {section_name} has {total_periods} allocated periods. It must have exactly 54."
            )

        per_subject_allocations: dict[int, int] = defaultdict(int)
        class_requirements = requirements_by_class.get(section.school_class_id, {})
        if not class_requirements:
            validation_errors.append(
                f"Class {section.school_class.name} is missing subject requirements."
            )
            continue

        for allocation in allocations:
            per_subject_allocations[allocation.subject_id] += allocation.periods_per_week
            teacher_loads[allocation.teacher.name] += allocation.periods_per_week

        missing_subjects = []
        for subject_id, requirement in class_requirements.items():
            allocated_periods = per_subject_allocations.get(subject_id, 0)
            if allocated_periods != requirement.periods_per_week:
                missing_subjects.append(
                    f"{requirement.subject.code}: expected {requirement.periods_per_week}, found {allocated_periods}"
                )

        if missing_subjects:
            validation_errors.append(
                f"Section {section_name} does not match class requirements ({'; '.join(missing_subjects)})."
            )

    overloaded_teachers = [
        f"{teacher_name} ({periods} periods)"
        for teacher_name, periods in sorted(teacher_loads.items())
        if periods > 54
    ]
    if overloaded_teachers:
        validation_errors.append(
            "Teacher weekly load exceeds 54 periods: " + ", ".join(overloaded_teachers)
        )

    return validation_errors
