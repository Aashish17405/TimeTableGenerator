from app.schemas.pagination import PaginatedResponse
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.db.deps import get_db
from app.crud import teacher_class_mapping as crud
from app.crud import teacher as teacher_crud
from app.crud import school_class as class_crud
from app.schemas.teacher_class_mapping import TeacherClassMappingCreate, TeacherClassMappingRead
from app.schemas.teacher import TeacherRead

router = APIRouter(prefix="/teacher-class-mappings", tags=["Teacher-Class Mappings"])


@router.get("/", response_model=PaginatedResponse[TeacherClassMappingRead])
def list_mappings(
    teacher_id: int | None = None,
    class_id: int | None = None,
    db: Session = Depends(get_db),
):
    """List all teacher-class mappings, optionally filtered."""
    total, items = crud.get_paginated(db, teacher_id=teacher_id, class_id=class_id)
    return {
        "items": items,
        "total": total,
        "page": page,
        "size": size,
        "pages": (total + size - 1) // size if size > 0 else 0
    }


@router.post("/", response_model=TeacherClassMappingRead, status_code=status.HTTP_201_CREATED)
def create_mapping(data: TeacherClassMappingCreate, db: Session = Depends(get_db)):
    """Map a teacher to a class (many-to-many)."""
    teacher = teacher_crud.get(db, data.teacher_id)
    if not teacher:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Teacher not found.")
    school_class = class_crud.get(db, data.class_id)
    if not school_class:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Class not found.")
    if crud.get_by_teacher_and_class(db, data.teacher_id, data.class_id):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This teacher is already mapped to this class.",
        )
    return crud.create(db, data)


@router.delete("/{mapping_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_mapping(mapping_id: int, db: Session = Depends(get_db)):
    """Remove a teacher-class mapping."""
    mapping = crud.get(db, mapping_id)
    if not mapping:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Mapping not found.")
    crud.delete(db, mapping)


@router.get("/teachers-for-class/{class_id}", response_model=PaginatedResponse[TeacherRead])
def teachers_for_class(class_id: int, db: Session = Depends(get_db)):
    """Return all teachers mapped to the given class (used in allocation dropdowns)."""
    school_class = class_crud.get(db, class_id)
    if not school_class:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Class not found.")
    return crud.get_teachers_for_class(db, class_id)
