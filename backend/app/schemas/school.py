from pydantic import BaseModel, Field


class SchoolBase(BaseModel):
    name: str = Field(..., max_length=150, examples=["Springfield High School"])
    address: str | None = Field(None, examples=["123 Main St, Springfield"])


class SchoolCreate(SchoolBase):
    pass


class SchoolUpdate(BaseModel):
    name: str | None = Field(None, max_length=150)
    address: str | None = None


class SchoolRead(SchoolBase):
    id: int

    model_config = {"from_attributes": True}


class SchoolStats(BaseModel):
    school_id: int
    classes_count: int
    sections_count: int
    teachers_count: int
    requirements_count: int
    allocations_count: int
