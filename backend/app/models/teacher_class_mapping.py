from sqlalchemy import ForeignKey, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base


class TeacherClassMapping(Base):
    """Maps a teacher to a class they are authorised to teach.

    A teacher can be mapped to many classes; a class can have many teachers.
    This is a *prerequisite* mapping — only mapped teachers are selectable when
    creating allocations for sections of a given class.
    """

    __tablename__ = "teacher_class_mappings"
    __table_args__ = (
        UniqueConstraint("teacher_id", "class_id", name="uq_tcm_teacher_class"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    teacher_id: Mapped[int] = mapped_column(
        ForeignKey("teachers.id", ondelete="CASCADE"), nullable=False, index=True
    )
    class_id: Mapped[int] = mapped_column(
        ForeignKey("school_classes.id", ondelete="CASCADE"), nullable=False, index=True
    )

    # Relationships
    teacher: Mapped["Teacher"] = relationship(back_populates="class_mappings")
    school_class: Mapped["SchoolClass"] = relationship(back_populates="teacher_mappings")
