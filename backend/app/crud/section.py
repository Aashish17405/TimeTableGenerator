from sqlalchemy import select, func
from sqlalchemy.orm import Session, selectinload

from app.models.section import Section
from app.models.school_class import SchoolClass
from app.schemas.section import SectionCreate, SectionUpdate


def get(db: Session, section_id: int) -> Section | None:
    return db.get(Section, section_id)


def get_with_class(db: Session, section_id: int) -> Section | None:
    stmt = (
        select(Section)
        .options(selectinload(Section.school_class))
        .where(Section.id == section_id)
    )
    return db.scalar(stmt)


def get_all(
    db: Session,
    class_id: int | None = None,
    school_id: int | None = None,
    skip: int = 0,
    limit: int = 100,
) -> list[Section]:
    stmt = select(Section).options(selectinload(Section.school_class))
    if class_id is not None:
        stmt = stmt.where(Section.school_class_id == class_id)
    if school_id is not None:
        stmt = stmt.join(SchoolClass, Section.school_class_id == SchoolClass.id).where(
            SchoolClass.school_id == school_id
        )
    stmt = stmt.order_by(Section.school_class_id, Section.name).offset(skip).limit(limit)
    return list(db.scalars(stmt))

def get_paginated(
    db: Session,
    class_id: int | None = None,
    school_id: int | None = None,
    page: int = 1,
    size: int = 20,
) -> tuple[int, list[Section]]:
    skip = (page - 1) * size
    base_stmt = select(Section).options(selectinload(Section.school_class))
    if class_id is not None:
        base_stmt = base_stmt.where(Section.school_class_id == class_id)

    total = db.scalar(select(func.count()).select_from(base_stmt.subquery())) or 0
    items = list(db.scalars(base_stmt.order_by(Section.school_class_id, Section.name).offset(skip).limit(size)))
    
    return total, items


def get_by_class_and_name(db: Session, class_id: int, name: str) -> Section | None:
    stmt = select(Section).where(
        Section.school_class_id == class_id,
        Section.name == name,
    )
    return db.scalar(stmt)


def create(db: Session, data: SectionCreate) -> Section:
    section = Section(**data.model_dump())
    db.add(section)
    db.commit()
    db.refresh(section)
    return section


def update(db: Session, section: Section, data: SectionUpdate) -> Section:
    patch = data.model_dump(exclude_unset=True)
    for field, value in patch.items():
        setattr(section, field, value)
    db.commit()
    db.refresh(section)
    return section


def delete(db: Session, section: Section) -> None:
    db.delete(section)
    db.commit()
