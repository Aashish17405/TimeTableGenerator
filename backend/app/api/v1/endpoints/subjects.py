from app.schemas.pagination import PaginatedResponse
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.db.deps import get_db
from app.crud import subject as crud
from app.schemas.subject import SubjectCreate, SubjectUpdate, SubjectRead

router = APIRouter(prefix="/subjects", tags=["Subjects"])


@router.get("/", response_model=PaginatedResponse[SubjectRead])
def list_subjects(
    page: int = 1, size: int = 20,
    db: Session = Depends(get_db),
):
    """List all subjects ordered by code."""
    total, items = crud.get_paginated(db, page=page, size=size)
    return {
        "items": items,
        "total": total,
        "page": page,
        "size": size,
        "pages": (total + size - 1) // size if size > 0 else 0
    }


@router.post("/", response_model=SubjectRead, status_code=status.HTTP_201_CREATED)
def create_subject(
    data: SubjectCreate,
    db: Session = Depends(get_db),
):
    """Create a new subject. Code must be unique."""
    if crud.get_by_code(db, data.code):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Subject with code '{data.code}' already exists.",
        )
    return crud.create(db, data)


@router.get("/{subject_id}", response_model=SubjectRead)
def get_subject(subject_id: int, db: Session = Depends(get_db)):
    subject = crud.get(db, subject_id)
    if not subject:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Subject not found.")
    return subject


@router.put("/{subject_id}", response_model=SubjectRead)
def update_subject(
    subject_id: int,
    data: SubjectUpdate,
    db: Session = Depends(get_db),
):
    subject = crud.get(db, subject_id)
    if not subject:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Subject not found.")
    if data.code and data.code != subject.code:
        if crud.get_by_code(db, data.code):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Subject with code '{data.code}' already exists.",
            )
    return crud.update(db, subject, data)


@router.delete("/{subject_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_subject(subject_id: int, db: Session = Depends(get_db)):
    subject = crud.get(db, subject_id)
    if not subject:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Subject not found.")
    crud.delete(db, subject)
