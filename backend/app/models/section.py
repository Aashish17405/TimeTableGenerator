from sqlalchemy import String, ForeignKey, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base


class Section(Base):
    """A section of a school class, e.g. A, B.

    The combination (school_class_id, name) is unique — you can't have two 'A'
    sections in the same class.
    """

    __tablename__ = "sections"
    __table_args__ = (
        UniqueConstraint("school_class_id", "name", name="uq_section_class_name"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    school_class_id: Mapped[int] = mapped_column(
        ForeignKey("school_classes.id", ondelete="CASCADE"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(5), nullable=False)

    # Relationships
    school_class: Mapped["SchoolClass"] = relationship(back_populates="sections")
    teacher_allocations: Mapped[list["TeacherAllocation"]] = relationship(
        back_populates="section", cascade="all, delete-orphan"
    )
