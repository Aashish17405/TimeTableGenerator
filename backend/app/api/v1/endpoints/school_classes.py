from app.schemas.pagination import PaginatedResponse
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.db.deps import get_db
from app.crud import school_class as crud
from app.schemas.school_class import SchoolClassCreate, SchoolClassUpdate, SchoolClassRead

router = APIRouter(prefix="/classes", tags=["School Classes"])


@router.get("/", response_model=PaginatedResponse[SchoolClassRead])
def list_classes(
    school_id: int | None = None,
    page: int = 1, size: int = 20,
    db: Session = Depends(get_db),
):
    """List school classes, filtered by school_id when provided."""
    total, items = crud.get_paginated(db, school_id=school_id, page=page, size=size)
    return {
        "items": items,
        "total": total,
        "page": page,
        "size": size,
        "pages": (total + size - 1) // size if size > 0 else 0
    }


@router.post("/", response_model=SchoolClassRead, status_code=status.HTTP_201_CREATED)
def create_class(
    data: SchoolClassCreate,
    db: Session = Depends(get_db),
):
    """Create a new school class (name must be unique within the school)."""
    if crud.get_by_name(db, data.name, data.school_id):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"School class '{data.name}' already exists in this school.",
        )
    return crud.create(db, data)


@router.get("/{class_id}", response_model=SchoolClassRead)
def get_class(class_id: int, db: Session = Depends(get_db)):
    school_class = crud.get(db, class_id)
    if not school_class:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Class not found.")
    return school_class


@router.put("/{class_id}", response_model=SchoolClassRead)
def update_class(
    class_id: int,
    data: SchoolClassUpdate,
    db: Session = Depends(get_db),
):
    school_class = crud.get(db, class_id)
    if not school_class:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Class not found.")
    if data.name and data.name != school_class.name:
        if crud.get_by_name(db, data.name, school_class.school_id):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"School class '{data.name}' already exists in this school.",
            )
    return crud.update(db, school_class, data)


@router.delete("/{class_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_class(class_id: int, db: Session = Depends(get_db)):
    school_class = crud.get(db, class_id)
    if not school_class:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Class not found.")
    crud.delete(db, school_class)
