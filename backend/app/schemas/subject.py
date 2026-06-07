from pydantic import BaseModel, Field


class SubjectBase(BaseModel):
    code: str = Field(..., max_length=20, examples=["FL"])
    name: str = Field(..., max_length=100, examples=["First Language"])


class SubjectCreate(SubjectBase):
    pass


class SubjectUpdate(BaseModel):
    code: str | None = Field(None, max_length=20)
    name: str | None = Field(None, max_length=100)


class SubjectRead(SubjectBase):
    id: int

    model_config = {"from_attributes": True}
