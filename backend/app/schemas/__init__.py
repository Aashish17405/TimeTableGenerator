from app.schemas.subject import SubjectBase, SubjectCreate, SubjectUpdate, SubjectRead
from app.schemas.school import SchoolBase, SchoolCreate, SchoolUpdate, SchoolRead, SchoolStats
from app.schemas.school_class import (
    SchoolClassBase,
    SchoolClassCreate,
    SchoolClassUpdate,
    SchoolClassRead,
)
from app.schemas.section import (
    SectionBase,
    SectionCreate,
    SectionUpdate,
    SectionRead,
    SectionReadWithClass,
)
from app.schemas.teacher import TeacherBase, TeacherCreate, TeacherUpdate, TeacherRead
from app.schemas.subject_requirement import (
    SubjectRequirementBase,
    SubjectRequirementCreate,
    SubjectRequirementUpdate,
    SubjectRequirementRead,
    SubjectRequirementReadDetailed,
    ClassRequirementSummary,
)
from app.schemas.teacher_allocation import (
    TeacherAllocationBase,
    TeacherAllocationCreate,
    TeacherAllocationUpdate,
    TeacherAllocationRead,
    TeacherAllocationReadDetailed,
)
from app.schemas.teacher_class_mapping import (
    TeacherClassMappingCreate,
    TeacherClassMappingRead,
    TeacherClassMappingReadDetailed,
)

__all__ = [
    "SubjectBase", "SubjectCreate", "SubjectUpdate", "SubjectRead",
    "SchoolBase", "SchoolCreate", "SchoolUpdate", "SchoolRead", "SchoolStats",
    "SchoolClassBase", "SchoolClassCreate", "SchoolClassUpdate", "SchoolClassRead",
    "SectionBase", "SectionCreate", "SectionUpdate", "SectionRead", "SectionReadWithClass",
    "TeacherBase", "TeacherCreate", "TeacherUpdate", "TeacherRead",
    "SubjectRequirementBase", "SubjectRequirementCreate", "SubjectRequirementUpdate",
    "SubjectRequirementRead", "SubjectRequirementReadDetailed", "ClassRequirementSummary",
    "TeacherAllocationBase", "TeacherAllocationCreate", "TeacherAllocationUpdate",
    "TeacherAllocationRead", "TeacherAllocationReadDetailed",
    "TeacherClassMappingCreate", "TeacherClassMappingRead", "TeacherClassMappingReadDetailed",
]
