from app.schemas.pagination import PaginatedResponse
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.db.deps import get_db
from app.crud import teacher_allocation as crud
from app.crud import teacher as teacher_crud
from app.crud import section as section_crud
from app.crud import subject as subject_crud
from app.crud import subject_requirement as req_crud
from app.models.section import Section
from app.schemas.teacher_allocation import (
    TeacherAllocationCreate,
    TeacherAllocationUpdate,
    TeacherAllocationRead,
    TeacherAllocationReadDetailed,
)

router = APIRouter(prefix="/teacher-allocations", tags=["Teacher Allocations"])


def _resolve_class_id(db: Session, section_id: int) -> int:
    """Return the school_class_id for a section (used to validate allocation periods)."""
    section = section_crud.get(db, section_id)
    if not section:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Section not found.")
    return section.school_class_id


@router.get("/", response_model=PaginatedResponse[TeacherAllocationReadDetailed])
def list_allocations(
    teacher_id: int | None = Query(None, description="Filter by teacher ID"),
    section_id: int | None = Query(None, description="Filter by section ID"),
    school_id: int | None = Query(None, description="Filter by school ID"),
    page: int = 1, size: int = 20,
    db: Session = Depends(get_db),
):
    """List teacher allocations with optional filters."""
    total, items = crud.get_paginated(db, teacher_id=teacher_id, section_id=section_id, school_id=school_id, page=page, size=size)
    return {
        "items": items,
        "total": total,
        "page": page,
        "size": size,
        "pages": (total + size - 1) // size if size > 0 else 0
    }


@router.post("/", response_model=TeacherAllocationRead, status_code=status.HTTP_201_CREATED)
def create_allocation(
    data: TeacherAllocationCreate,
    db: Session = Depends(get_db),
):
    """Create a teacher allocation.

    Hard validation: periods_per_week must not exceed the SubjectRequirement
    for (class, subject). This keeps allocations consistent with class-level
    requirements so the timetable solver can rely on this invariant.
    """
    # Validate foreign keys
    if not teacher_crud.get(db, data.teacher_id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Teacher not found.")
    if not subject_crud.get(db, data.subject_id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Subject not found.")

    class_id = _resolve_class_id(db, data.section_id)

    # Duplicate allocation check
    if crud.get_by_teacher_section_subject(db, data.teacher_id, data.section_id, data.subject_id):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An allocation for this teacher + section + subject already exists.",
        )

    # Hard cap: periods must not exceed the class-level subject requirement
    req = req_crud.get_by_class_and_subject(db, class_id, data.subject_id)
    if req is None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=(
                f"No SubjectRequirement found for class {class_id} and subject "
                f"{data.subject_id}. Create it first."
            ),
        )
    if data.periods_per_week > req.periods_per_week:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=(
                f"periods_per_week ({data.periods_per_week}) exceeds the class-level "
                f"requirement ({req.periods_per_week}) for this subject."
            ),
        )

    return crud.create(db, data)


@router.get("/{alloc_id}", response_model=TeacherAllocationReadDetailed)
def get_allocation(alloc_id: int, db: Session = Depends(get_db)):
    alloc = crud.get_with_details(db, alloc_id)
    if not alloc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Allocation not found."
        )
    return alloc


@router.put("/{alloc_id}", response_model=TeacherAllocationRead)
def update_allocation(
    alloc_id: int,
    data: TeacherAllocationUpdate,
    db: Session = Depends(get_db),
):
    """Update periods_per_week for an allocation.

    Hard cap still applies: new value must not exceed the class requirement.
    """
    alloc = crud.get(db, alloc_id)
    if not alloc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Allocation not found."
        )
    if data.periods_per_week is not None:
        class_id = _resolve_class_id(db, alloc.section_id)
        req = req_crud.get_by_class_and_subject(db, class_id, alloc.subject_id)
        if req and data.periods_per_week > req.periods_per_week:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=(
                    f"periods_per_week ({data.periods_per_week}) exceeds the class-level "
                    f"requirement ({req.periods_per_week}) for this subject."
                ),
            )
    return crud.update(db, alloc, data)


@router.delete("/{alloc_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_allocation(alloc_id: int, db: Session = Depends(get_db)):
    alloc = crud.get(db, alloc_id)
    if not alloc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Allocation not found."
        )
    crud.delete(db, alloc)
