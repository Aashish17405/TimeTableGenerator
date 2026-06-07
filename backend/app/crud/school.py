from sqlalchemy import select, func
from sqlalchemy.orm import Session

from app.models.school import School
from app.models.school_class import SchoolClass
from app.models.section import Section
from app.models.teacher import Teacher
from app.models.subject_requirement import SubjectRequirement
from app.models.teacher_allocation import TeacherAllocation
from app.schemas.school import SchoolCreate, SchoolUpdate, SchoolStats


def get(db: Session, school_id: int) -> School | None:
    return db.get(School, school_id)


def get_by_name(db: Session, name: str) -> School | None:
    stmt = select(School).where(School.name == name)
    return db.scalar(stmt)


def get_all(db: Session, skip: int = 0, limit: int = 100) -> list[School]:
    stmt = select(School).order_by(School.name).offset(skip).limit(limit)
    return list(db.scalars(stmt))


def get_paginated(db: Session, page: int = 1, size: int = 20) -> tuple[int, list[School]]:
    skip = (page - 1) * size
    base_stmt = select(School)
    
    total = db.scalar(select(func.count()).select_from(base_stmt.subquery())) or 0
    items = list(db.scalars(base_stmt.order_by(School.name).offset(skip).limit(size)))
    
    return total, items


def create(db: Session, data: SchoolCreate) -> School:
    school = School(**data.model_dump())
    db.add(school)
    db.commit()
    db.refresh(school)
    return school


def update(db: Session, school: School, data: SchoolUpdate) -> School:
    patch = data.model_dump(exclude_unset=True)
    for field, value in patch.items():
        setattr(school, field, value)
    db.commit()
    db.refresh(school)
    return school


def delete(db: Session, school: School) -> None:
    db.delete(school)
    db.commit()


def get_stats(db: Session, school_id: int) -> SchoolStats:
    classes_count = db.scalar(
        select(func.count()).select_from(SchoolClass).where(SchoolClass.school_id == school_id)
    ) or 0
    sections_count = db.scalar(
        select(func.count())
        .select_from(Section)
        .join(SchoolClass, Section.school_class_id == SchoolClass.id)
        .where(SchoolClass.school_id == school_id)
    ) or 0
    teachers_count = db.scalar(
        select(func.count()).select_from(Teacher).where(Teacher.school_id == school_id)
    ) or 0
    requirements_count = db.scalar(
        select(func.count())
        .select_from(SubjectRequirement)
        .join(SchoolClass, SubjectRequirement.school_class_id == SchoolClass.id)
        .where(SchoolClass.school_id == school_id)
    ) or 0
    allocations_count = db.scalar(
        select(func.count())
        .select_from(TeacherAllocation)
        .join(Section, TeacherAllocation.section_id == Section.id)
        .join(SchoolClass, Section.school_class_id == SchoolClass.id)
        .where(SchoolClass.school_id == school_id)
    ) or 0
    return SchoolStats(
        school_id=school_id,
        classes_count=classes_count,
        sections_count=sections_count,
        teachers_count=teachers_count,
        requirements_count=requirements_count,
        allocations_count=allocations_count,
    )
