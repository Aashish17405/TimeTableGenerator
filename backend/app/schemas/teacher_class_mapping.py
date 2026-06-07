from pydantic import BaseModel


class TeacherClassMappingCreate(BaseModel):
    teacher_id: int
    class_id: int


class TeacherClassMappingRead(BaseModel):
    id: int
    teacher_id: int
    class_id: int

    model_config = {"from_attributes": True}


class TeacherClassMappingReadDetailed(BaseModel):
    """Extended read with nested teacher and class info."""
    id: int
    teacher_id: int
    class_id: int
    teacher_name: str
    class_name: str

    model_config = {"from_attributes": True}
