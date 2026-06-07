from sqlalchemy import select, func
from sqlalchemy.orm import Session

from app.models.teacher import Teacher
from app.schemas.teacher import TeacherCreate, TeacherUpdate


def get(db: Session, teacher_id: int) -> Teacher | None:
    return db.get(Teacher, teacher_id)


def get_by_email(db: Session, email: str) -> Teacher | None:
    stmt = select(Teacher).where(Teacher.email == email)
    return db.scalar(stmt)


def get_all(
    db: Session, school_id: int | None = None, skip: int = 0, limit: int = 100
) -> list[Teacher]:
    stmt = select(Teacher).order_by(Teacher.name)
    if school_id is not None:
        stmt = stmt.where(Teacher.school_id == school_id)
    stmt = stmt.offset(skip).limit(limit)
    return list(db.scalars(stmt))

def get_paginated(
    db: Session, school_id: int | None = None, page: int = 1, size: int = 20
) -> tuple[int, list[Teacher]]:
    skip = (page - 1) * size
    base_stmt = select(Teacher)
    if school_id is not None:
        base_stmt = base_stmt.where(Teacher.school_id == school_id)

    total = db.scalar(select(func.count()).select_from(base_stmt.subquery())) or 0
    items = list(db.scalars(base_stmt.order_by(Teacher.name).offset(skip).limit(size)))
    
    return total, items


def create(db: Session, data: TeacherCreate) -> Teacher:
    teacher = Teacher(**data.model_dump())
    db.add(teacher)
    db.commit()
    db.refresh(teacher)
    return teacher


def update(db: Session, teacher: Teacher, data: TeacherUpdate) -> Teacher:
    patch = data.model_dump(exclude_unset=True)
    for field, value in patch.items():
        setattr(teacher, field, value)
    db.commit()
    db.refresh(teacher)
    return teacher


def delete(db: Session, teacher: Teacher) -> None:
    db.delete(teacher)
    db.commit()
