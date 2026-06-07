from sqlalchemy import ForeignKey, Integer, UniqueConstraint, CheckConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base


class TeacherAllocation(Base):
    """How many periods per week a teacher teaches a subject to a section.

    This is the source of truth for the timetable solver.
    For example: Archana teaches FL to VIA for 12 periods/week.

    Business rules enforced at the API layer:
    - periods_per_week must not exceed the SubjectRequirement for (class, subject).
    - A teacher cannot be double-allocated to two sections in the same period
      (enforced by the solver, not the data layer).
    """

    __tablename__ = "teacher_allocations"
    __table_args__ = (
        UniqueConstraint(
            "teacher_id",
            "section_id",
            "subject_id",
            name="uq_allocation_teacher_section_subject",
        ),
        CheckConstraint(
            "periods_per_week >= 1", name="ck_allocation_periods_positive"
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    teacher_id: Mapped[int] = mapped_column(
        ForeignKey("teachers.id", ondelete="CASCADE"), nullable=False, index=True
    )
    section_id: Mapped[int] = mapped_column(
        ForeignKey("sections.id", ondelete="CASCADE"), nullable=False, index=True
    )
    subject_id: Mapped[int] = mapped_column(
        ForeignKey("subjects.id", ondelete="CASCADE"), nullable=False, index=True
    )
    periods_per_week: Mapped[int] = mapped_column(Integer, nullable=False)

    # Relationships
    teacher: Mapped["Teacher"] = relationship(back_populates="teacher_allocations")
    section: Mapped["Section"] = relationship(back_populates="teacher_allocations")
    subject: Mapped["Subject"] = relationship(back_populates="teacher_allocations")
