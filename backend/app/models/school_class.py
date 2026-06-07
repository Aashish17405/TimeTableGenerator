from sqlalchemy import String, Integer, ForeignKey, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base


class SchoolClass(Base):
    """A school class, e.g. I, II, III, ... VIII, scoped to a School.

    ``display_order`` drives sorting (1–8) so that class I appears before II, etc.
    The combination (school_id, name) is unique — two different schools can both
    have a 'Class VI', but within one school the name must be unique.
    """

    __tablename__ = "school_classes"
    __table_args__ = (
        UniqueConstraint("school_id", "name", name="uq_school_class_school_name"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    school_id: Mapped[int] = mapped_column(
        ForeignKey("schools.id", ondelete="CASCADE"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(20), nullable=False, index=True)
    display_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    # Relationships
    school: Mapped["School"] = relationship(back_populates="school_classes")
    sections: Mapped[list["Section"]] = relationship(
        back_populates="school_class", cascade="all, delete-orphan"
    )
    subject_requirements: Mapped[list["SubjectRequirement"]] = relationship(
        back_populates="school_class", cascade="all, delete-orphan"
    )
    teacher_mappings: Mapped[list["TeacherClassMapping"]] = relationship(
        back_populates="school_class", cascade="all, delete-orphan"
    )
