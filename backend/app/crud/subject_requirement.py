from sqlalchemy import select
from sqlalchemy.sql import func
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


def get_default_requirements(db: Session, school_class: SchoolClass) -> list[SubjectRequirement]:
    """Generate standard global default requirements for classes I-VIII."""
    from app.models.subject import Subject
    
    blueprint = {
        "I":    {"ENG": 15, "MATH": 16, "FL": 15, "SL": 0, "PET": 2, "HW": 6},
        "II":   {"ENG": 15, "MATH": 16, "FL": 15, "SL": 0, "PET": 2, "HW": 6},
        "III":  {"ENG": 15, "MATH": 16, "FL": 15, "SL": 0, "PET": 2, "HW": 6},
        "IV":   {"ENG": 11, "MATH": 16, "FL": 11, "SL": 8, "PET": 2, "HW": 6},
        "V":    {"ENG": 11, "MATH": 16, "FL": 11, "SL": 8, "PET": 2, "HW": 6},
        "VI":   {"ENG": 12, "MATH": 14, "FL": 12, "SL": 8, "PET": 2, "HW": 6},
        "VII":  {"ENG": 12, "MATH": 14, "FL": 12, "SL": 8, "PET": 2, "HW": 6},
        "VIII": {"ENG": 12, "MATH": 14, "FL": 12, "SL": 8, "PET": 2, "HW": 6},
    }
    
    class_name = school_class.name.upper().strip()
    if class_name not in blueprint:
        return []
        
    subjects = db.scalars(select(Subject)).all()
    subj_map = {s.code: s for s in subjects}
    
    reqs = []
    for code, periods in blueprint[class_name].items():
        if periods > 0 and code in subj_map:
            req = SubjectRequirement(
                school_class_id=school_class.id,
                subject_id=subj_map[code].id,
                periods_per_week=periods,
                school_class=school_class,
                subject=subj_map[code]
            )
            reqs.append(req)
    return reqs


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
    res = list(db.scalars(stmt))
    
    if not res:
        if class_id is not None:
            cls = db.get(SchoolClass, class_id)
            if cls:
                return get_default_requirements(db, cls)
        elif school_id is not None:
            classes = db.scalars(select(SchoolClass).where(SchoolClass.school_id == school_id)).all()
            all_defaults = []
            for cls in classes:
                all_defaults.extend(get_default_requirements(db, cls))
            return all_defaults[skip:skip+limit]
            
    return res

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
    if school_id is not None:
        base_stmt = base_stmt.join(
            SchoolClass, SubjectRequirement.school_class_id == SchoolClass.id
        ).where(SchoolClass.school_id == school_id)

    total = db.scalar(select(func.count()).select_from(base_stmt.subquery())) or 0
    items = list(db.scalars(base_stmt.offset(skip).limit(size).options(
        selectinload(SubjectRequirement.school_class),
        selectinload(SubjectRequirement.subject)
    )))
    
    if total == 0:
        # Generate default items
        if class_id is not None:
            cls = db.get(SchoolClass, class_id)
            if cls:
                defaults = get_default_requirements(db, cls)
                return len(defaults), defaults[skip:skip+size]
        elif school_id is not None:
            classes = db.scalars(select(SchoolClass).where(SchoolClass.school_id == school_id)).all()
            all_defaults = []
            for cls in classes:
                all_defaults.extend(get_default_requirements(db, cls))
            return len(all_defaults), all_defaults[skip:skip+size]
            
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
