# Import all models here so that:
# 1. Alembic autogenerate can discover every table via Base.metadata
# 2. SQLAlchemy can resolve all forward-reference relationships

from app.models.school import School
from app.models.subject import Subject
from app.models.school_class import SchoolClass
from app.models.section import Section
from app.models.teacher import Teacher
from app.models.subject_requirement import SubjectRequirement
from app.models.teacher_allocation import TeacherAllocation
from app.models.teacher_class_mapping import TeacherClassMapping

__all__ = [
    "School",
    "Subject",
    "SchoolClass",
    "Section",
    "Teacher",
    "SubjectRequirement",
    "TeacherAllocation",
    "TeacherClassMapping",
]
