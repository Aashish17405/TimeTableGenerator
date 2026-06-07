from app.schemas.pagination import PaginatedResponse
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.db.deps import get_db
from app.crud import subject_requirement as crud
from app.crud import school_class as class_crud
from app.crud import subject as subject_crud
from app.schemas.subject_requirement import (
    SubjectRequirementCreate,
    SubjectRequirementUpdate,
    SubjectRequirementRead,
    SubjectRequirementReadDetailed,
    ClassRequirementSummary,
    TOTAL_WEEKLY_PERIODS,
)

router = APIRouter(prefix="/subject-requirements", tags=["Subject Requirements"])


@router.get("/", response_model=PaginatedResponse[SubjectRequirementReadDetailed])
def list_requirements(
    class_id: int | None = Query(None, description="Filter by school class ID"),
    school_id: int | None = Query(None, description="Filter by school ID"),
    page: int = 1, size: int = 20,
    db: Session = Depends(get_db),
):
    """List all subject requirements, optionally filtered by class or school."""
    total, items = crud.get_paginated(db, class_id=class_id, school_id=school_id, page=page, size=size)
    return {
        "items": items,
        "total": total,
        "page": page,
        "size": size,
        "pages": (total + size - 1) // size if size > 0 else 0
    }


@router.get("/summary/{class_id}", response_model=ClassRequirementSummary)
def class_requirement_summary(class_id: int, db: Session = Depends(get_db)):
    """Return all requirements for a class plus total/remaining period counts.

    Useful for the frontend to show progress toward the 54-period target.
    """
    if not class_crud.get(db, class_id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Class not found.")
    reqs = crud.get_all(db, class_id=class_id, limit=500)
    total = sum(r.periods_per_week for r in reqs)
    return ClassRequirementSummary(
        school_class_id=class_id,
        total_periods=total,
        remaining_periods=TOTAL_WEEKLY_PERIODS - total,
        requirements=reqs,  # type: ignore[arg-type]
    )


@router.post("/", response_model=SubjectRequirementRead, status_code=status.HTTP_201_CREATED)
def create_requirement(
    data: SubjectRequirementCreate,
    db: Session = Depends(get_db),
):
    """Create a subject requirement for a class.

    Returns a soft warning in the response body when total periods ≠ 54.
    Does NOT block the request — requirements can be entered incrementally.
    """
    if not class_crud.get(db, data.school_class_id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Class not found.")
    if not subject_crud.get(db, data.subject_id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Subject not found.")
    if crud.get_by_class_and_subject(db, data.school_class_id, data.subject_id):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A requirement for this class + subject already exists.",
        )
    return crud.create(db, data)


@router.get("/{req_id}", response_model=SubjectRequirementReadDetailed)
def get_requirement(req_id: int, db: Session = Depends(get_db)):
    req = crud.get_with_details(db, req_id)
    if not req:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Requirement not found."
        )
    return req


@router.put("/{req_id}", response_model=SubjectRequirementRead)
def update_requirement(
    req_id: int,
    data: SubjectRequirementUpdate,
    db: Session = Depends(get_db),
):
    req = crud.get(db, req_id)
    if not req:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Requirement not found."
        )
    return crud.update(db, req, data)


@router.delete("/{req_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_requirement(req_id: int, db: Session = Depends(get_db)):
    req = crud.get(db, req_id)
    if not req:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Requirement not found."
        )
    crud.delete(db, req)
