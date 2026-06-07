from sqlalchemy import select, func
from sqlalchemy.orm import Session

from app.models.school_class import SchoolClass
from app.schemas.school_class import SchoolClassCreate, SchoolClassUpdate


def get(db: Session, class_id: int) -> SchoolClass | None:
    return db.get(SchoolClass, class_id)


def get_by_name(db: Session, name: str, school_id: int) -> SchoolClass | None:
    stmt = select(SchoolClass).where(
        SchoolClass.name == name, SchoolClass.school_id == school_id
    )
    return db.scalar(stmt)


def get_all(
    db: Session, school_id: int | None = None, skip: int = 0, limit: int = 100
) -> list[SchoolClass]:
    stmt = select(SchoolClass).order_by(SchoolClass.display_order)
    if school_id is not None:
        stmt = stmt.where(SchoolClass.school_id == school_id)
    stmt = stmt.offset(skip).limit(limit)
    return list(db.scalars(stmt))

def get_paginated(
    db: Session, school_id: int | None = None, page: int = 1, size: int = 20
) -> tuple[int, list[SchoolClass]]:
    skip = (page - 1) * size
    base_stmt = select(SchoolClass)
    if school_id is not None:
        base_stmt = base_stmt.where(SchoolClass.school_id == school_id)

    total = db.scalar(select(func.count()).select_from(base_stmt.subquery())) or 0
    items = list(db.scalars(base_stmt.order_by(SchoolClass.display_order).offset(skip).limit(size)))
    
    return total, items


def create(db: Session, data: SchoolClassCreate) -> SchoolClass:
    school_class = SchoolClass(**data.model_dump())
    db.add(school_class)
    db.commit()
    db.refresh(school_class)
    return school_class


def update(db: Session, school_class: SchoolClass, data: SchoolClassUpdate) -> SchoolClass:
    patch = data.model_dump(exclude_unset=True)
    for field, value in patch.items():
        setattr(school_class, field, value)
    db.commit()
    db.refresh(school_class)
    return school_class


def delete(db: Session, school_class: SchoolClass) -> None:
    db.delete(school_class)
    db.commit()
