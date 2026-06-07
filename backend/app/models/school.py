from sqlalchemy import String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base


class School(Base):
    """A school / campus.

    All classes, sections, teachers, requirements, and allocations belong to
    exactly one school.  Subjects are global (school-agnostic).
    """

    __tablename__ = "schools"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(150), unique=True, nullable=False, index=True)
    address: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Relationships
    school_classes: Mapped[list["SchoolClass"]] = relationship(
        back_populates="school", cascade="all, delete-orphan"
    )
    teachers: Mapped[list["Teacher"]] = relationship(
        back_populates="school", cascade="all, delete-orphan"
    )
