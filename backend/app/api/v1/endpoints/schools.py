from app.schemas.pagination import PaginatedResponse
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.db.deps import get_db
from app.crud import school as crud
from app.schemas.school import SchoolCreate, SchoolUpdate, SchoolRead, SchoolStats

router = APIRouter(prefix="/schools", tags=["Schools"])


@router.get("/", response_model=PaginatedResponse[SchoolRead])
def list_schools(page: int = 1, size: int = 20, db: Session = Depends(get_db)):
    """List all schools ordered by name."""
    total, items = crud.get_paginated(db, page=page, size=size)
    return {
        "items": items,
        "total": total,
        "page": page,
        "size": size,
        "pages": (total + size - 1) // size if size > 0 else 0
    }


@router.post("/", response_model=SchoolRead, status_code=status.HTTP_201_CREATED)
def create_school(data: SchoolCreate, db: Session = Depends(get_db)):
    """Create a new school. Name must be unique."""
    if crud.get_by_name(db, data.name):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"School '{data.name}' already exists.",
        )
    return crud.create(db, data)


@router.get("/{school_id}", response_model=SchoolRead)
def get_school(school_id: int, db: Session = Depends(get_db)):
    school = crud.get(db, school_id)
    if not school:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="School not found.")
    return school


@router.get("/{school_id}/stats", response_model=SchoolStats)
def get_school_stats(school_id: int, db: Session = Depends(get_db)):
    """Return aggregate counts (classes, sections, teachers, etc.) for a school."""
    school = crud.get(db, school_id)
    if not school:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="School not found.")
    return crud.get_stats(db, school_id)


@router.put("/{school_id}", response_model=SchoolRead)
def update_school(school_id: int, data: SchoolUpdate, db: Session = Depends(get_db)):
    school = crud.get(db, school_id)
    if not school:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="School not found.")
    if data.name and data.name != school.name:
        if crud.get_by_name(db, data.name):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"School '{data.name}' already exists.",
            )
    return crud.update(db, school, data)


@router.delete("/{school_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_school(school_id: int, db: Session = Depends(get_db)):
    school = crud.get(db, school_id)
    if not school:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="School not found.")
    crud.delete(db, school)
