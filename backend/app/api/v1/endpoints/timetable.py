from collections import defaultdict
from io import BytesIO

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.db.deps import get_db
from app.crud import timetable as crud_timetable
from app.models.section import Section
from app.models.school_class import SchoolClass
from app.models.subject_requirement import SubjectRequirement
from app.models.teacher_allocation import TeacherAllocation
from app.models.timetable_entry import TimetableEntry
from app.schemas.timetable import (
    TimetableGenerateAllRequest,
    TimetableRegenerateClassRequest,
    TimetableGenerateResponse,
    StoredTimetableResponse,
)
from app.solver.timetable_solver import TimetableGenerationError, generate_timetables

router = APIRouter(prefix="/timetable", tags=["Timetable"])


@router.post("/generate-all", response_model=TimetableGenerateResponse)
def generate_all(
    payload: TimetableGenerateAllRequest,
    db: Session = Depends(get_db),
):
    """Generates timetables for all classes and sections in a school at once."""
    # 1. Fetch all sections for the school
    sections_stmt = (
        select(Section)
        .join(SchoolClass, Section.school_class_id == SchoolClass.id)
        .options(selectinload(Section.school_class))
        .where(SchoolClass.school_id == payload.school_id)
        .order_by(Section.school_class_id, Section.name)
    )
    sections = list(db.scalars(sections_stmt))
    if not sections:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No classes/sections found for this school to generate timetables.",
        )

    section_ids = [section.id for section in sections]

    # 2. Fetch all teacher allocations for these sections
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

    # 3. Fetch all subject requirements for classes of these sections
    requirements_stmt = (
        select(SubjectRequirement)
        .options(selectinload(SubjectRequirement.subject))
        .where(
            SubjectRequirement.school_class_id.in_(
                {section.school_class_id for section in sections}
            )
        )
    )
    requirements = list(db.scalars(requirements_stmt))

    # 4. Map requirements by class & subject
    requirements_by_class: dict[int, dict[int, SubjectRequirement]] = defaultdict(dict)
    for requirement in requirements:
        requirements_by_class[requirement.school_class_id][requirement.subject_id] = requirement

    # 5. Group allocations by section
    section_allocations: dict[int, list[TeacherAllocation]] = {
        section_id: [] for section_id in section_ids
    }
    for allocation in allocations:
        class_id = allocation.section.school_class_id
        req = requirements_by_class[class_id].get(allocation.subject_id)
        allocation.periods_per_week = req.periods_per_week if req else 0
        section_allocations[allocation.section_id].append(allocation)

    # 6. Validate inputs
    validation_errors = _validate_inputs(sections, section_allocations, requirements_by_class)
    if validation_errors:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"errors": validation_errors},
        )

    # 7. Prep input for solver
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

    # 8. Generate and save
    try:
        solver_result = generate_timetables(sections_input)
        generated_at = crud_timetable.save_timetable_all(
            db, school_id=payload.school_id, solver_result=solver_result
        )
        return {
            "success": True,
            "generated_at": generated_at,
            "section_count": len(sections),
        }
    except TimetableGenerationError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc


@router.post("/regenerate-class", response_model=TimetableGenerateResponse)
def regenerate_class(
    payload: TimetableRegenerateClassRequest,
    db: Session = Depends(get_db),
):
    """Regenerates the timetable for a specific class (and all its sections)

    while keeping other classes' schedules intact.
    """
    # 1. Verify that stored timetables already exist for the school
    stmt = (
        select(TimetableEntry.id)
        .where(TimetableEntry.school_id == payload.school_id)
        .limit(1)
    )
    has_stored = db.scalar(stmt) is not None
    if not has_stored:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No stored timetables found for this school. Please generate all timetables first.",
        )

    # 2. Fetch all sections for the target class
    sections_stmt = (
        select(Section)
        .options(selectinload(Section.school_class))
        .where(Section.school_class_id == payload.class_id)
        .order_by(Section.name)
    )
    sections = list(db.scalars(sections_stmt))
    if not sections:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No sections found for the specified class.",
        )

    target_section_ids = [section.id for section in sections]

    # 3. Fetch allocations for these sections
    allocations_stmt = (
        select(TeacherAllocation)
        .options(
            selectinload(TeacherAllocation.teacher),
            selectinload(TeacherAllocation.subject),
            selectinload(TeacherAllocation.section).selectinload(Section.school_class),
        )
        .where(TeacherAllocation.section_id.in_(target_section_ids))
    )
    allocations = list(db.scalars(allocations_stmt))

    # 4. Fetch subject requirements for this class
    requirements_stmt = (
        select(SubjectRequirement)
        .options(selectinload(SubjectRequirement.subject))
        .where(SubjectRequirement.school_class_id == payload.class_id)
    )
    requirements = list(db.scalars(requirements_stmt))

    # 5. Map requirements
    requirements_by_class: dict[int, dict[int, SubjectRequirement]] = defaultdict(dict)
    for requirement in requirements:
        requirements_by_class[requirement.school_class_id][requirement.subject_id] = requirement

    # 6. Group allocations
    section_allocations: dict[int, list[TeacherAllocation]] = {
        section_id: [] for section_id in target_section_ids
    }
    for allocation in allocations:
        class_id = allocation.section.school_class_id
        req = requirements_by_class[class_id].get(allocation.subject_id)
        allocation.periods_per_week = req.periods_per_week if req else 0
        section_allocations[allocation.section_id].append(allocation)

    # 7. Validate inputs for the class sections
    validation_errors = _validate_inputs(sections, section_allocations, requirements_by_class)
    if validation_errors:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"errors": validation_errors},
        )

    # 8. Prep input for solver
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

    # 9. Get existing teacher slots (locked slots from all other sections)
    occupied_slots = crud_timetable.get_existing_teacher_slots(
        db, school_id=payload.school_id, exclude_section_ids=target_section_ids
    )

    # 10. Generate and save
    try:
        solver_result = generate_timetables(
            sections_input, locked_teacher_slots=occupied_slots
        )
        generated_at = crud_timetable.save_timetable_for_class(
            db,
            school_id=payload.school_id,
            section_ids=target_section_ids,
            solver_result=solver_result,
        )
        return {
            "success": True,
            "generated_at": generated_at,
            "section_count": len(sections),
        }
    except TimetableGenerationError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc


@router.get("/stored/{school_id}", response_model=StoredTimetableResponse)
def get_stored(
    school_id: int,
    db: Session = Depends(get_db),
):
    """Retrieves the stored timetable entries for a school."""
    return crud_timetable.get_stored_timetable(db, school_id=school_id)


@router.get("/export-pdf/{school_id}")
def export_pdf(
    school_id: int,
    db: Session = Depends(get_db),
):
    """Generates a high-quality single PDF file containing all school timetables."""
    from reportlab.lib.pagesizes import A4, landscape
    from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, PageBreak
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib import colors
    
    # 1. Fetch stored timetables data
    data = crud_timetable.get_stored_timetable(db, school_id=school_id)
    timetables = data.get("timetables", {})
    if not timetables:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No generated timetables found to export."
        )
        
    buffer = BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=landscape(A4),
        leftMargin=36,
        rightMargin=36,
        topMargin=36,
        bottomMargin=36
    )
    
    styles = getSampleStyleSheet()
    
    title_style = ParagraphStyle(
        name="PDFTitle",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=18,
        leading=22,
        alignment=1, # Center
        textColor=colors.HexColor("#0d0f1a"),
        spaceAfter=15
    )
    
    section_title_style = ParagraphStyle(
        name="SectionTitle",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=14,
        leading=18,
        alignment=0, # Left
        textColor=colors.HexColor("#111111"),
        spaceAfter=8
    )
    
    header_style = ParagraphStyle(
        name="HeaderStyle",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=8,
        leading=10,
        alignment=1,
        textColor=colors.whitesmoke
    )
    
    body_style = ParagraphStyle(
        name="BodyStyle",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=8,
        leading=10,
        alignment=1
    )
    
    day_style = ParagraphStyle(
        name="DayStyle",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=8,
        leading=10,
        alignment=0
    )
    
    story = []
    
    # PDF Title page / header
    story.append(Paragraph("School Timetables Export", title_style))
    story.append(Spacer(1, 15))
    
    # Period columns spec matching the frontend transposing
    rows_spec = [
        {"type": "period", "index": 0, "label": "Period 1", "time": "09:00 - 09:40"},
        {"type": "period", "index": 1, "label": "Period 2", "time": "09:40 - 10:20"},
        {"type": "break", "label": "BREAK", "time": "10:20 - 10:35"},
        {"type": "period", "index": 2, "label": "Period 3", "time": "10:35 - 11:15"},
        {"type": "period", "index": 3, "label": "Period 4", "time": "11:15 - 11:55"},
        {"type": "period", "index": 4, "label": "Period 5", "time": "11:55 - 12:35"},
        {"type": "lunch", "label": "LUNCH", "time": "12:35 - 01:20"},
        {"type": "period", "index": 5, "label": "Period 6", "time": "01:20 - 02:00"},
        {"type": "period", "index": 6, "label": "Period 7", "time": "02:00 - 02:40"},
        {"type": "break", "label": "BREAK", "time": "02:40 - 02:55"},
        {"type": "period", "index": 7, "label": "Period 8", "time": "02:55 - 03:35"},
        {"type": "period", "index": 8, "label": "Period 9", "time": "03:35 - 04:15"}
    ]
    
    days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]
    col_widths = [70, 65, 65, 40, 65, 65, 65, 40, 65, 65, 40, 65, 65]
    
    # Sort timetables alphabetically/numerically by class name and section name
    sorted_tt = sorted(
        timetables.values(),
        key=lambda x: (x.get("class_name", ""), x.get("section_name", ""))
    )
    
    for i, tt in enumerate(sorted_tt):
        class_name = tt.get("class_name", "")
        section_name = tt.get("section_name", "")
        tt_schedule = tt.get("schedule", {})
        
        # Section Heading
        story.append(Paragraph(f"Class {class_name} - Section {section_name}", section_title_style))
        
        # Table data construction
        table_data = []
        
        # Header Row
        header_row = [Paragraph("<b>Day / Period</b>", header_style)]
        for spec in rows_spec:
            label = spec["label"]
            time = spec["time"]
            header_row.append(Paragraph(f"<b>{label}</b><br/>{time}", header_style))
        table_data.append(header_row)
        
        # Data Rows per Day
        for day in days:
            row_cells = [Paragraph(day, day_style)]
            for spec in rows_spec:
                if spec["type"] in ("break", "lunch"):
                    row_cells.append(Paragraph(f"<b>{spec['label']}</b>", body_style))
                else:
                    period_idx = spec["index"]
                    period = tt_schedule.get(day, [None]*9)[period_idx]
                    if period and period.get("subject_code") != "-":
                        subj = period.get("subject_code")
                        teacher = period.get("teacher_name")
                        cell_text = f"<b>{subj}</b><br/>{teacher}"
                        row_cells.append(Paragraph(cell_text, body_style))
                    else:
                        row_cells.append(Paragraph("-", body_style))
            table_data.append(row_cells)
            
        t = Table(table_data, colWidths=col_widths)
        t_style = TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor("#3538cd")),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
            ('TOPPADDING', (0, 0), (-1, -1), 6),
            ('LEFTPADDING', (0, 0), (-1, -1), 4),
            ('RIGHTPADDING', (0, 0), (-1, -1), 4),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor("#cccccc")),
        ])
        
        # Add shading for breaks & lunch columns dynamically
        for col_idx, spec in enumerate(rows_spec):
            if spec["type"] in ("break", "lunch"):
                # column index in table is col_idx + 1 because Day is col 0
                t_style.add('BACKGROUND', (col_idx + 1, 1), (col_idx + 1, -1), colors.HexColor("#f5f5f5"))
                t_style.add('TEXTCOLOR', (col_idx + 1, 1), (col_idx + 1, -1), colors.HexColor("#777777"))
                
        t.setStyle(t_style)
        story.append(t)
        
        # Spacer or PageBreak
        if i < len(sorted_tt) - 1:
            story.append(PageBreak())
            
    doc.build(story)
    buffer.seek(0)
    
    return StreamingResponse(
        buffer,
        media_type="application/pdf",
        headers={"Content-Disposition": "attachment; filename=school_timetables.pdf"}
    )


@router.delete("/stored/{school_id}")
def delete_stored(
    school_id: int,
    db: Session = Depends(get_db),
):
    """Deletes all stored timetables for a school."""
    crud_timetable.delete_stored_timetable(db, school_id=school_id)
    return {"detail": "Timetable entries deleted successfully."}


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
