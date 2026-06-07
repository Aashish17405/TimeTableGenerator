from sqlalchemy import select, func
from sqlalchemy.orm import Session, selectinload

from app.models.subject_requirement import SubjectRequirement
from app.models.school_class import SchoolClass
from app.schemas.subject_requirement import SubjectRequirementCreate, SubjectRequirementUpdate

TOTAL_WEEKLY_PERIODS = 54


def get(db: Session, req_id: int) -> SubjectRequirement | None:
    return db.get(SubjectRequirement, req_id)


def get_with_details(db: Session, req_id: int) -> SubjectRequirement | None:
    stmt = (
        select(SubjectRequirement)
        .options(
            selectinload(SubjectRequirement.school_class),
            selectinload(SubjectRequirement.subject),
        )
        .where(SubjectRequirement.id == req_id)
    )
    return db.scalar(stmt)


def get_all(
    db: Session,
    class_id: int | None = None,
    school_id: int | None = None,
    skip: int = 0,
    limit: int = 200,
) -> list[SubjectRequirement]:
    stmt = select(SubjectRequirement).options(
        selectinload(SubjectRequirement.school_class),
        selectinload(SubjectRequirement.subject),
    )
    if class_id is not None:
        stmt = stmt.where(SubjectRequirement.school_class_id == class_id)
    if school_id is not None:
        stmt = stmt.join(
            SchoolClass, SubjectRequirement.school_class_id == SchoolClass.id
        ).where(SchoolClass.school_id == school_id)
    stmt = stmt.order_by(
        SubjectRequirement.school_class_id, SubjectRequirement.subject_id
    ).offset(skip).limit(limit)
    return list(db.scalars(stmt))

def get_paginated(
    db: Session,
    class_id: int | None = None,
    school_id: int | None = None,
    page: int = 1,
    size: int = 20,
) -> tuple[int, list[SubjectRequirement]]:
    skip = (page - 1) * size
    base_stmt = select(SubjectRequirement)
    if class_id is not None:
        base_stmt = base_stmt.where(SubjectRequirement.school_class_id == class_id)

    total = db.scalar(select(func.count()).select_from(base_stmt.subquery())) or 0
    items = list(db.scalars(base_stmt.offset(skip).limit(size)))
    
    return total, items


def get_by_class_and_subject(
    db: Session, class_id: int, subject_id: int
) -> SubjectRequirement | None:
    stmt = select(SubjectRequirement).where(
        SubjectRequirement.school_class_id == class_id,
        SubjectRequirement.subject_id == subject_id,
    )
    return db.scalar(stmt)


def get_class_total_periods(db: Session, class_id: int) -> int:
    """Return the sum of periods_per_week already assigned to a class."""
    stmt = select(func.coalesce(func.sum(SubjectRequirement.periods_per_week), 0)).where(
        SubjectRequirement.school_class_id == class_id
    )
    return db.scalar(stmt) or 0


def create(db: Session, data: SubjectRequirementCreate) -> SubjectRequirement:
    req = SubjectRequirement(**data.model_dump())
    db.add(req)
    db.commit()
    db.refresh(req)
    return req


def update(
    db: Session, req: SubjectRequirement, data: SubjectRequirementUpdate
) -> SubjectRequirement:
    patch = data.model_dump(exclude_unset=True)
    for field, value in patch.items():
        setattr(req, field, value)
    db.commit()
    db.refresh(req)
    return req


def delete(db: Session, req: SubjectRequirement) -> None:
    db.delete(req)
    db.commit()
