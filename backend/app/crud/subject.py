from sqlalchemy import select, func
from sqlalchemy.orm import Session

from app.models.subject import Subject
from app.schemas.subject import SubjectCreate, SubjectUpdate


def get(db: Session, subject_id: int) -> Subject | None:
    return db.get(Subject, subject_id)


def get_by_code(db: Session, code: str) -> Subject | None:
    stmt = select(Subject).where(Subject.code == code)
    return db.scalar(stmt)


def get_all(db: Session, skip: int = 0, limit: int = 100) -> list[Subject]:
    stmt = select(Subject).order_by(Subject.code).offset(skip).limit(limit)
    return list(db.scalars(stmt))

def get_paginated(db: Session, page: int = 1, size: int = 20) -> tuple[int, list[Subject]]:
    skip = (page - 1) * size
    base_stmt = select(Subject)

    total = db.scalar(select(func.count()).select_from(base_stmt.subquery())) or 0
    items = list(db.scalars(base_stmt.order_by(Subject.code).offset(skip).limit(size)))
    
    return total, items


def create(db: Session, data: SubjectCreate) -> Subject:
    subject = Subject(**data.model_dump())
    db.add(subject)
    db.commit()
    db.refresh(subject)
    return subject


def update(db: Session, subject: Subject, data: SubjectUpdate) -> Subject:
    patch = data.model_dump(exclude_unset=True)
    for field, value in patch.items():
        setattr(subject, field, value)
    db.commit()
    db.refresh(subject)
    return subject


def delete(db: Session, subject: Subject) -> None:
    db.delete(subject)
    db.commit()
