from pydantic import BaseModel, EmailStr, Field


class TeacherBase(BaseModel):
    name: str = Field(..., max_length=100, examples=["Archana"])
    email: EmailStr | None = Field(None, examples=["archana@school.edu"])


class TeacherCreate(TeacherBase):
    school_id: int
    class_id: int | None = None
    subject_id: int | None = None


class TeacherUpdate(BaseModel):
    name: str | None = Field(None, max_length=100)
    email: EmailStr | None = None
    class_id: int | None = None
    subject_id: int | None = None


class TeacherRead(TeacherBase):
    id: int
    school_id: int

    model_config = {"from_attributes": True}
