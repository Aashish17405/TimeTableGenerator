from pydantic import BaseModel, Field

from app.schemas.school_class import SchoolClassRead
from app.schemas.subject import SubjectRead

TOTAL_WEEKLY_PERIODS = 54


class SubjectRequirementBase(BaseModel):
    school_class_id: int = Field(..., examples=[6])
    subject_id: int = Field(..., examples=[1])
    periods_per_week: int = Field(..., ge=1, examples=[12])


class SubjectRequirementCreate(SubjectRequirementBase):
    pass


class SubjectRequirementUpdate(BaseModel):
    periods_per_week: int | None = Field(None, ge=1)


class SubjectRequirementRead(SubjectRequirementBase):
    id: int

    model_config = {"from_attributes": True}


class SubjectRequirementReadDetailed(SubjectRequirementRead):
    """Read response that embeds class and subject details."""

    school_class: SchoolClassRead
    subject: SubjectRead

    model_config = {"from_attributes": True}


class ClassRequirementSummary(BaseModel):
    """Summary of all subject requirements for a class.

    Includes total_periods so the frontend can show allocation progress.
    """

    school_class_id: int
    total_periods: int
    remaining_periods: int
    requirements: list[SubjectRequirementReadDetailed]
