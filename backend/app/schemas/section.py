from pydantic import BaseModel, Field

from app.schemas.school_class import SchoolClassRead


class SectionBase(BaseModel):
    school_class_id: int = Field(..., examples=[6])
    name: str = Field(..., max_length=5, examples=["A"])


class SectionCreate(SectionBase):
    pass


class SectionUpdate(BaseModel):
    name: str | None = Field(None, max_length=5)


class SectionRead(SectionBase):
    id: int

    model_config = {"from_attributes": True}


class SectionReadWithClass(SectionRead):
    """Section response that embeds the parent class details."""

    school_class: SchoolClassRead

    model_config = {"from_attributes": True}
