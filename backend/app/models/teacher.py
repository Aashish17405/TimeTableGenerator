from sqlalchemy import String, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base


class Teacher(Base):
    """A teacher in a school (school-scoped)."""

    __tablename__ = "teachers"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    school_id: Mapped[int] = mapped_column(
        ForeignKey("schools.id", ondelete="CASCADE"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    # Email remains globally unique per the design decision
    email: Mapped[str | None] = mapped_column(String(200), unique=True, nullable=True)

    # Relationships
    school: Mapped["School"] = relationship(back_populates="teachers")
    teacher_allocations: Mapped[list["TeacherAllocation"]] = relationship(
        back_populates="teacher", cascade="all, delete-orphan"
    )
    class_mappings: Mapped[list["TeacherClassMapping"]] = relationship(
        back_populates="teacher", cascade="all, delete-orphan"
    )