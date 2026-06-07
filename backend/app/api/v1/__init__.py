from fastapi import APIRouter

from app.api.v1.endpoints import (
    schools,
    subjects,
    school_classes,
    sections,
    teachers,
    subject_requirements,
    teacher_allocations,
    teacher_class_mappings,
    timetable,
    ai_timetable,
)

api_router = APIRouter()

api_router.include_router(schools.router)
api_router.include_router(subjects.router)
api_router.include_router(school_classes.router)
api_router.include_router(sections.router)
api_router.include_router(teachers.router)
api_router.include_router(subject_requirements.router)
api_router.include_router(teacher_allocations.router)
api_router.include_router(teacher_class_mappings.router)
api_router.include_router(timetable.router)
api_router.include_router(ai_timetable.router)
