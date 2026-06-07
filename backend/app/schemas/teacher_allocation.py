from pydantic import BaseModel, Field

from app.schemas.teacher import TeacherRead
from app.schemas.section import SectionReadWithClass
from app.schemas.subject import SubjectRead


class TeacherAllocationBase(BaseModel):
    teacher_id: int = Field(..., examples=[1])
    section_id: int = Field(..., examples=[3])
    subject_id: int = Field(..., examples=[1])
    periods_per_week: int = Field(..., ge=1, examples=[12])


class TeacherAllocationCreate(TeacherAllocationBase):
    pass


class TeacherAllocationUpdate(BaseModel):
    periods_per_week: int | None = Field(None, ge=1)


class TeacherAllocationRead(TeacherAllocationBase):
    id: int

    model_config = {"from_attributes": True}


class TeacherAllocationReadDetailed(TeacherAllocationRead):
    """Read response with embedded teacher, section (+ class), and subject."""

    teacher: TeacherRead
    section: SectionReadWithClass
    subject: SubjectRead

    model_config = {"from_attributes": True}
