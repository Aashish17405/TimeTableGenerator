from datetime import datetime
from sqlalchemy import ForeignKey, UniqueConstraint, DateTime, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base


class TimetableEntry(Base):
    """A single assigned slot in a generated timetable.

    A schedule consists of slots for a combination of section, day, and period.
    The combination (section_id, day_index, period_index) must be unique.
    """

    __tablename__ = "timetable_entries"
    __table_args__ = (
        UniqueConstraint(
            "section_id", "day_index", "period_index", name="uq_timetable_entry_slot"
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    school_id: Mapped[int] = mapped_column(
        ForeignKey("schools.id", ondelete="CASCADE"), nullable=False, index=True
    )
    section_id: Mapped[int] = mapped_column(
        ForeignKey("sections.id", ondelete="CASCADE"), nullable=False, index=True
    )
    day_index: Mapped[int] = mapped_column(nullable=False)  # 0=Monday..5=Saturday
    period_index: Mapped[int] = mapped_column(nullable=False)  # 0..8
    subject_id: Mapped[int] = mapped_column(
        ForeignKey("subjects.id", ondelete="CASCADE"), nullable=False, index=True
    )
    teacher_id: Mapped[int] = mapped_column(
        ForeignKey("teachers.id", ondelete="CASCADE"), nullable=False, index=True
    )
    generated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    # Relationships
    school: Mapped["School"] = relationship()
    section: Mapped["Section"] = relationship()
    subject: Mapped["Subject"] = relationship()
    teacher: Mapped["Teacher"] = relationship()
