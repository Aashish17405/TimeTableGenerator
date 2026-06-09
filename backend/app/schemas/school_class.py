from pydantic import BaseModel, Field, field_validator


class SchoolClassBase(BaseModel):
    name: str = Field(..., max_length=20, examples=["VI"])
    display_order: int = Field(..., ge=1, examples=[6])


class SchoolClassCreate(SchoolClassBase):
    school_id: int
    sections: list[str] | None = None


class SchoolClassUpdate(BaseModel):
    name: str | None = Field(None, max_length=20)
    display_order: int | None = Field(None, ge=1)
    sections: list[str] | None = None


class SchoolClassRead(SchoolClassBase):
    id: int
    school_id: int
    sections: list[str] | None = None

    model_config = {"from_attributes": True}

    @field_validator("sections", mode="before")
    @classmethod
    def serialize_sections(cls, v):
        if isinstance(v, list) and len(v) > 0 and not isinstance(v[0], str):
            return [s.name for s in v]
        return v
