from sqlalchemy import ForeignKey, Integer, UniqueConstraint, CheckConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base


class SubjectRequirement(Base):
    """How many periods per week a subject must be taught to a class.

    This is the *class-level* requirement, independent of sections.
    For example: Class VI requires FL for 12 periods/week.

    Business rule: the sum of periods_per_week for all subjects in a class
    should equal 54 (total weekly periods). This is validated at the API layer.
    """

    __tablename__ = "subject_requirements"
    __table_args__ = (
        UniqueConstraint(
            "school_class_id", "subject_id", name="uq_requirement_class_subject"
        ),
        CheckConstraint("periods_per_week >= 1", name="ck_requirement_periods_positive"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    school_class_id: Mapped[int] = mapped_column(
        ForeignKey("school_classes.id", ondelete="CASCADE"), nullable=False, index=True
    )
    subject_id: Mapped[int] = mapped_column(
        ForeignKey("subjects.id", ondelete="CASCADE"), nullable=False, index=True
    )
    periods_per_week: Mapped[int] = mapped_column(Integer, nullable=False)

    # Relationships
    school_class: Mapped["SchoolClass"] = relationship(back_populates="subject_requirements")
    subject: Mapped["Subject"] = relationship(back_populates="subject_requirements")
