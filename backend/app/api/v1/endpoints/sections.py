from app.schemas.pagination import PaginatedResponse
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.db.deps import get_db
from app.crud import section as crud
from app.crud import school_class as class_crud
from app.schemas.section import SectionCreate, SectionUpdate, SectionRead, SectionReadWithClass

router = APIRouter(prefix="/sections", tags=["Sections"])


@router.get("/", response_model=PaginatedResponse[SectionReadWithClass])
def list_sections(
    class_id: int | None = Query(None, description="Filter by school class ID"),
    school_id: int | None = Query(None, description="Filter by school ID"),
    page: int = 1, size: int = 20,
    db: Session = Depends(get_db),
):
    """List all sections, optionally filtered by class ID or school ID."""
    total, items = crud.get_paginated(db, class_id=class_id, school_id=school_id, page=page, size=size)
    return {
        "items": items,
        "total": total,
        "page": page,
        "size": size,
        "pages": (total + size - 1) // size if size > 0 else 0
    }


@router.post("/", response_model=SectionRead, status_code=status.HTTP_201_CREATED)
def create_section(
    data: SectionCreate,
    db: Session = Depends(get_db),
):
    """Create a new section (e.g. A, B) for a school class."""
    if not class_crud.get(db, data.school_class_id):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"School class with id {data.school_class_id} not found.",
        )
    if crud.get_by_class_and_name(db, data.school_class_id, data.name):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Section '{data.name}' already exists for class {data.school_class_id}.",
        )
    return crud.create(db, data)


@router.get("/{section_id}", response_model=SectionReadWithClass)
def get_section(section_id: int, db: Session = Depends(get_db)):
    section = crud.get_with_class(db, section_id)
    if not section:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Section not found.")
    return section


@router.put("/{section_id}", response_model=SectionRead)
def update_section(
    section_id: int,
    data: SectionUpdate,
    db: Session = Depends(get_db),
):
    section = crud.get(db, section_id)
    if not section:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Section not found.")
    if data.name and data.name != section.name:
        if crud.get_by_class_and_name(db, section.school_class_id, data.name):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Section '{data.name}' already exists for this class.",
            )
    return crud.update(db, section, data)


@router.delete("/{section_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_section(section_id: int, db: Session = Depends(get_db)):
    section = crud.get(db, section_id)
    if not section:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Section not found.")
    crud.delete(db, section)
