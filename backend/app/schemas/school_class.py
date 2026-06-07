from pydantic import BaseModel, Field


class SchoolClassBase(BaseModel):
    name: str = Field(..., max_length=20, examples=["VI"])
    display_order: int = Field(..., ge=1, examples=[6])


class SchoolClassCreate(SchoolClassBase):
    school_id: int


class SchoolClassUpdate(BaseModel):
    name: str | None = Field(None, max_length=20)
    display_order: int | None = Field(None, ge=1)


class SchoolClassRead(SchoolClassBase):
    id: int
    school_id: int

    model_config = {"from_attributes": True}
