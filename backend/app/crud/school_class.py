from sqlalchemy import select, func
from sqlalchemy.orm import Session, selectinload

from app.models.school_class import SchoolClass
from app.schemas.school_class import SchoolClassCreate, SchoolClassUpdate


def get(db: Session, class_id: int) -> SchoolClass | None:
    stmt = select(SchoolClass).options(selectinload(SchoolClass.sections)).where(SchoolClass.id == class_id)
    return db.scalar(stmt)


def get_by_name(db: Session, name: str, school_id: int) -> SchoolClass | None:
    stmt = select(SchoolClass).options(selectinload(SchoolClass.sections)).where(
        SchoolClass.name == name, SchoolClass.school_id == school_id
    )
    return db.scalar(stmt)


def get_all(
    db: Session, school_id: int | None = None, skip: int = 0, limit: int = 100
) -> list[SchoolClass]:
    stmt = select(SchoolClass).options(selectinload(SchoolClass.sections)).order_by(SchoolClass.display_order)
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
    items = list(db.scalars(base_stmt.options(selectinload(SchoolClass.sections)).order_by(SchoolClass.display_order).offset(skip).limit(size)))
    
    return total, items


def create(db: Session, data: SchoolClassCreate) -> SchoolClass:
    sections_list = data.sections
    school_class_data = data.model_dump(exclude={"sections"})
    school_class = SchoolClass(**school_class_data)
    db.add(school_class)
    db.commit()
    db.refresh(school_class)
    
    if sections_list:
        from app.models.section import Section
        for sec_name in sections_list:
            sec_name_clean = sec_name.strip()
            if sec_name_clean:
                sec = Section(name=sec_name_clean, school_class_id=school_class.id)
                db.add(sec)
        db.commit()
        db.refresh(school_class)
        
    return school_class


def update(db: Session, school_class: SchoolClass, data: SchoolClassUpdate) -> SchoolClass:
    sections_list = data.sections
    patch = data.model_dump(exclude_unset=True, exclude={"sections"})
    for field, value in patch.items():
        setattr(school_class, field, value)
    db.commit()
    db.refresh(school_class)
    
    if sections_list is not None:
        from app.models.section import Section
        # Fetch existing sections for this class
        existing_sections = db.query(Section).filter(Section.school_class_id == school_class.id).all()
        existing_names = {s.name for s in existing_sections}
        new_names = {name.strip() for name in sections_list if name.strip()}
        
        # Delete sections that are not in new_names
        for sec in existing_sections:
            if sec.name not in new_names:
                db.delete(sec)
                
        # Create sections that are in new_names but not in existing_names
        for name in new_names:
            if name not in existing_names:
                sec = Section(name=name, school_class_id=school_class.id)
                db.add(sec)
                
        db.commit()
        db.refresh(school_class)
        
    return school_class


def delete(db: Session, school_class: SchoolClass) -> None:
    db.delete(school_class)
    db.commit()
