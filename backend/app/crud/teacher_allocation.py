from sqlalchemy import select, func
from sqlalchemy.orm import Session, selectinload

from app.models.teacher_allocation import TeacherAllocation
from app.models.section import Section
from app.models.school_class import SchoolClass
from app.schemas.teacher_allocation import TeacherAllocationCreate, TeacherAllocationUpdate


def get(db: Session, alloc_id: int) -> TeacherAllocation | None:
    return db.get(TeacherAllocation, alloc_id)


def get_with_details(db: Session, alloc_id: int) -> TeacherAllocation | None:
    stmt = (
        select(TeacherAllocation)
        .options(
            selectinload(TeacherAllocation.teacher),
            selectinload(TeacherAllocation.section).selectinload(Section.school_class),
            selectinload(TeacherAllocation.subject),
        )
        .where(TeacherAllocation.id == alloc_id)
    )
    return db.scalar(stmt)


def get_all(
    db: Session,
    teacher_id: int | None = None,
    section_id: int | None = None,
    school_id: int | None = None,
    skip: int = 0,
    limit: int = 200,
) -> list[TeacherAllocation]:
    stmt = select(TeacherAllocation).options(
        selectinload(TeacherAllocation.teacher),
        selectinload(TeacherAllocation.section).selectinload(Section.school_class),
        selectinload(TeacherAllocation.subject),
    )
    if teacher_id is not None:
        stmt = stmt.where(TeacherAllocation.teacher_id == teacher_id)
    if section_id is not None:
        stmt = stmt.where(TeacherAllocation.section_id == section_id)
    if school_id is not None:
        stmt = (
            stmt.join(Section, TeacherAllocation.section_id == Section.id)
            .join(SchoolClass, Section.school_class_id == SchoolClass.id)
            .where(SchoolClass.school_id == school_id)
        )
    stmt = stmt.order_by(
        TeacherAllocation.teacher_id, TeacherAllocation.section_id
    ).offset(skip).limit(limit)
    return list(db.scalars(stmt))

def get_paginated(
    db: Session,
    teacher_id: int | None = None,
    section_id: int | None = None,
    school_id: int | None = None,
    page: int = 1,
    size: int = 20,
) -> tuple[int, list[TeacherAllocation]]:
    skip = (page - 1) * size
    base_stmt = select(TeacherAllocation).options(
        selectinload(TeacherAllocation.teacher),
        selectinload(TeacherAllocation.section).selectinload(Section.school_class),
        selectinload(TeacherAllocation.subject),
    )
    if teacher_id is not None:
        base_stmt = base_stmt.where(TeacherAllocation.teacher_id == teacher_id)
    if section_id is not None:
        base_stmt = base_stmt.where(TeacherAllocation.section_id == section_id)
    if school_id is not None:
        base_stmt = (
            base_stmt.join(Section, TeacherAllocation.section_id == Section.id)
            .join(SchoolClass, Section.school_class_id == SchoolClass.id)
            .where(SchoolClass.school_id == school_id)
        )

    total = db.scalar(select(func.count()).select_from(base_stmt.subquery())) or 0
    items = list(db.scalars(base_stmt.offset(skip).limit(size)))
    
    return total, items


def get_by_teacher_section_subject(
    db: Session, teacher_id: int, section_id: int, subject_id: int
) -> TeacherAllocation | None:
    stmt = select(TeacherAllocation).where(
        TeacherAllocation.teacher_id == teacher_id,
        TeacherAllocation.section_id == section_id,
        TeacherAllocation.subject_id == subject_id,
    )
    return db.scalar(stmt)


def create(db: Session, data: TeacherAllocationCreate) -> TeacherAllocation:
    alloc = TeacherAllocation(**data.model_dump())
    db.add(alloc)
    db.commit()
    db.refresh(alloc)
    return alloc


def update(
    db: Session, alloc: TeacherAllocation, data: TeacherAllocationUpdate
) -> TeacherAllocation:
    patch = data.model_dump(exclude_unset=True)
    for field, value in patch.items():
        setattr(alloc, field, value)
    db.commit()
    db.refresh(alloc)
    return alloc


def delete(db: Session, alloc: TeacherAllocation) -> None:
    db.delete(alloc)
    db.commit()
