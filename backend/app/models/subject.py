from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base


class Subject(Base):
    """A school subject, e.g. FL (First Language), MATH, ENG."""

    __tablename__ = "subjects"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    code: Mapped[str] = mapped_column(String(20), unique=True, nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)

    # Relationships
    subject_requirements: Mapped[list["SubjectRequirement"]] = relationship(
        back_populates="subject", cascade="all, delete-orphan"
    )
    teacher_allocations: Mapped[list["TeacherAllocation"]] = relationship(
        back_populates="subject", cascade="all, delete-orphan"
    )
