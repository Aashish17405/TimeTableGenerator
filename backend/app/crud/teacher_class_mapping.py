from sqlalchemy import select, func
from sqlalchemy.orm import Session, selectinload

from app.models.teacher_class_mapping import TeacherClassMapping
from app.models.teacher import Teacher
from app.models.school_class import SchoolClass
from app.schemas.teacher_class_mapping import TeacherClassMappingCreate


def get(db: Session, mapping_id: int) -> TeacherClassMapping | None:
    return db.get(TeacherClassMapping, mapping_id)


def get_by_teacher_and_class(
    db: Session, teacher_id: int, class_id: int
) -> TeacherClassMapping | None:
    stmt = select(TeacherClassMapping).where(
        TeacherClassMapping.teacher_id == teacher_id,
        TeacherClassMapping.class_id == class_id,
    )
    return db.scalar(stmt)


def get_all(
    db: Session,
    teacher_id: int | None = None,
    class_id: int | None = None,
    skip: int = 0,
    limit: int = 200,
) -> list[TeacherClassMapping]:
    stmt = select(TeacherClassMapping).options(
        selectinload(TeacherClassMapping.teacher),
        selectinload(TeacherClassMapping.school_class),
    )
    if teacher_id is not None:
        stmt = stmt.where(TeacherClassMapping.teacher_id == teacher_id)
    if class_id is not None:
        stmt = stmt.where(TeacherClassMapping.class_id == class_id)
    stmt = stmt.offset(skip).limit(limit)
    return list(db.scalars(stmt))

def get_paginated(
    db: Session,
    teacher_id: int | None = None,
    class_id: int | None = None,
    page: int = 1,
    size: int = 20,
) -> tuple[int, list[TeacherClassMapping]]:
    skip = (page - 1) * size
    base_stmt = select(TeacherClassMapping)
    if teacher_id is not None:
        base_stmt = base_stmt.where(TeacherClassMapping.teacher_id == teacher_id)
    if class_id is not None:
        base_stmt = base_stmt.where(TeacherClassMapping.class_id == class_id)

    total = db.scalar(select(func.count()).select_from(base_stmt.subquery())) or 0
    items = list(db.scalars(base_stmt.offset(skip).limit(size)))
    
    return total, items


def get_teachers_for_class(db: Session, class_id: int) -> list[Teacher]:
    """Return Teacher objects mapped to the given class."""
    stmt = (
        select(Teacher)
        .join(TeacherClassMapping, TeacherClassMapping.teacher_id == Teacher.id)
        .where(TeacherClassMapping.class_id == class_id)
        .order_by(Teacher.name)
    )
    return list(db.scalars(stmt))


def get_classes_for_teacher(db: Session, teacher_id: int) -> list[SchoolClass]:
    """Return SchoolClass objects the teacher is mapped to."""
    stmt = (
        select(SchoolClass)
        .join(TeacherClassMapping, TeacherClassMapping.class_id == SchoolClass.id)
        .where(TeacherClassMapping.teacher_id == teacher_id)
        .order_by(SchoolClass.display_order)
    )
    return list(db.scalars(stmt))


def create(db: Session, data: TeacherClassMappingCreate) -> TeacherClassMapping:
    mapping = TeacherClassMapping(teacher_id=data.teacher_id, class_id=data.class_id)
    db.add(mapping)
    db.commit()
    db.refresh(mapping)
    return mapping


def delete(db: Session, mapping: TeacherClassMapping) -> None:
    db.delete(mapping)
    db.commit()
