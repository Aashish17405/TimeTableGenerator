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
    class_id = data.class_id
    subject_id = data.subject_id
    
    teacher_data = data.model_dump(exclude={"class_id", "subject_id"})
    teacher = Teacher(**teacher_data)
    db.add(teacher)
    db.commit()
    db.refresh(teacher)
    
    _handle_class_subject_assignment(db, teacher, class_id, subject_id)
    return teacher


def update(db: Session, teacher: Teacher, data: TeacherUpdate) -> Teacher:
    class_id = data.class_id
    subject_id = data.subject_id
    
    patch = data.model_dump(exclude_unset=True, exclude={"class_id", "subject_id"})
    for field, value in patch.items():
        setattr(teacher, field, value)
    db.commit()
    db.refresh(teacher)
    
    _handle_class_subject_assignment(db, teacher, class_id, subject_id)
    return teacher


def _handle_class_subject_assignment(db: Session, teacher: Teacher, class_id: int | None, subject_id: int | None):
    if not class_id:
        return
        
    from app.models.teacher_class_mapping import TeacherClassMapping
    from app.models.teacher_allocation import TeacherAllocation
    from app.models.section import Section
    from app.models.school_class import SchoolClass
    from app.crud import subject_requirement as sr_crud
    
    # 1. Map teacher to class
    mapping = db.query(TeacherClassMapping).filter(
        TeacherClassMapping.teacher_id == teacher.id,
        TeacherClassMapping.class_id == class_id
    ).first()
    if not mapping:
        mapping = TeacherClassMapping(teacher_id=teacher.id, class_id=class_id)
        db.add(mapping)
        db.commit()
        
    # 2. Map teacher to sections for this subject if provided
    if subject_id:
        # Determine periods count from class requirements
        cls = db.get(SchoolClass, class_id)
        periods = 0
        if cls:
            reqs = sr_crud.get_all(db, class_id=class_id, limit=500)
            for r in reqs:
                if r.subject_id == subject_id:
                    periods = r.periods_per_week
                    break
        
        # Fetch sections for this class
        sections = db.query(Section).filter(Section.school_class_id == class_id).all()
        for sec in sections:
            alloc = db.query(TeacherAllocation).filter(
                TeacherAllocation.section_id == sec.id,
                TeacherAllocation.subject_id == subject_id
            ).first()
            
            if alloc:
                alloc.teacher_id = teacher.id
                if periods > 0:
                    alloc.periods_per_week = periods
            else:
                alloc = TeacherAllocation(
                    teacher_id=teacher.id,
                    section_id=sec.id,
                    subject_id=subject_id,
                    periods_per_week=periods if periods > 0 else 2 # Fallback
                )
                db.add(alloc)
        db.commit()


def delete(db: Session, teacher: Teacher) -> None:
    db.delete(teacher)
    db.commit()
