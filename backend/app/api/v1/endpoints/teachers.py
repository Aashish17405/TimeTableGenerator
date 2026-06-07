from app.schemas.pagination import PaginatedResponse
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.db.deps import get_db
from app.crud import teacher as crud
from app.schemas.teacher import TeacherCreate, TeacherUpdate, TeacherRead

router = APIRouter(prefix="/teachers", tags=["Teachers"])


@router.get("/", response_model=PaginatedResponse[TeacherRead])
def list_teachers(
    school_id: int | None = None,
    page: int = 1, size: int = 20,
    db: Session = Depends(get_db),
):
    """List all teachers, filtered by school_id when provided."""
    total, items = crud.get_paginated(db, school_id=school_id, page=page, size=size)
    return {
        "items": items,
        "total": total,
        "page": page,
        "size": size,
        "pages": (total + size - 1) // size if size > 0 else 0
    }


@router.post("/", response_model=TeacherRead, status_code=status.HTTP_201_CREATED)
def create_teacher(
    data: TeacherCreate,
    db: Session = Depends(get_db),
):
    """Create a new teacher. Email (if provided) must be globally unique."""
    if data.email and crud.get_by_email(db, data.email):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Teacher with email '{data.email}' already exists.",
        )
    return crud.create(db, data)


@router.get("/{teacher_id}", response_model=TeacherRead)
def get_teacher(teacher_id: int, db: Session = Depends(get_db)):
    teacher = crud.get(db, teacher_id)
    if not teacher:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Teacher not found.")
    return teacher


@router.put("/{teacher_id}", response_model=TeacherRead)
def update_teacher(
    teacher_id: int,
    data: TeacherUpdate,
    db: Session = Depends(get_db),
):
    teacher = crud.get(db, teacher_id)
    if not teacher:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Teacher not found.")
    if data.email and data.email != teacher.email:
        if crud.get_by_email(db, data.email):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Teacher with email '{data.email}' already exists.",
            )
    return crud.update(db, teacher, data)


@router.delete("/{teacher_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_teacher(teacher_id: int, db: Session = Depends(get_db)):
    teacher = crud.get(db, teacher_id)
    if not teacher:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Teacher not found.")
    crud.delete(db, teacher)
