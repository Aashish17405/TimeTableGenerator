from datetime import datetime
from pydantic import BaseModel, Field


class TimetableGenerateAllRequest(BaseModel):
    school_id: int = Field(..., description="ID of the school to generate all timetables for")


class TimetableRegenerateClassRequest(BaseModel):
    school_id: int = Field(..., description="ID of the school")
    class_id: int = Field(..., description="ID of the class to regenerate")


class TimetableGenerateResponse(BaseModel):
    success: bool
    generated_at: datetime
    section_count: int


class TimetablePeriodSchema(BaseModel):
    subject_code: str
    subject_name: str
    teacher_name: str


class SectionTimetableSchema(BaseModel):
    section_name: str
    class_name: str
    class_id: int
    schedule: dict[str, list[TimetablePeriodSchema]]  # Day name -> list of periods


class StoredTimetableResponse(BaseModel):
    generated_at: datetime | None = None
    timetables: dict[str, SectionTimetableSchema]  # Keyed by section_id string
