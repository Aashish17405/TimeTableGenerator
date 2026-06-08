from datetime import datetime, timezone
from sqlalchemy import select, delete
from sqlalchemy.orm import Session, selectinload

from app.models.timetable_entry import TimetableEntry
from app.models.teacher import Teacher
from app.models.subject import Subject
from app.models.section import Section

DAYS = ("Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday")


def save_timetable_all(db: Session, school_id: int, solver_result: dict) -> datetime:
    """Deletes all existing timetable entries for a school and saves the newly generated ones."""
    # 1. Delete all existing entries for this school
    delete_stmt = delete(TimetableEntry).where(TimetableEntry.school_id == school_id)
    db.execute(delete_stmt)

    # 2. Get teachers map (name -> id)
    teachers_stmt = select(Teacher).where(Teacher.school_id == school_id)
    teachers = db.scalars(teachers_stmt).all()
    teacher_map = {t.name: t.id for t in teachers}

    # 3. Get subjects map (code -> id)
    subjects_stmt = select(Subject)
    subjects = db.scalars(subjects_stmt).all()
    subject_map = {s.code: s.id for s in subjects}

    generated_at = datetime.now(timezone.utc)

    # 4. Insert new entries
    # solver_result["timetables"] has keys as section IDs
    for sec_id_str, sec_data in solver_result.get("timetables", {}).items():
        section_id = int(sec_id_str)
        schedule = sec_data.get("schedule", {})
        for day_idx, day_name in enumerate(DAYS):
            periods = schedule.get(day_name, [])
            for period_idx, period in enumerate(periods):
                if not period:
                    continue
                
                teacher_name = period["teacher_name"]
                subject_code = period["subject_code"]

                teacher_id = teacher_map.get(teacher_name)
                subject_id = subject_map.get(subject_code)

                if not teacher_id or not subject_id:
                    raise ValueError(
                        f"Missing teacher ID for '{teacher_name}' or subject ID for '{subject_code}'"
                    )

                entry = TimetableEntry(
                    school_id=school_id,
                    section_id=section_id,
                    day_index=day_idx,
                    period_index=period_idx,
                    subject_id=subject_id,
                    teacher_id=teacher_id,
                    generated_at=generated_at,
                )
                db.add(entry)

    db.commit()
    return generated_at


def save_timetable_for_class(
    db: Session, school_id: int, section_ids: list[int], solver_result: dict
) -> datetime:
    """Deletes existing timetable entries for specific class sections and saves the new ones."""
    if not section_ids:
        raise ValueError("No section IDs provided to save.")

    # 1. Delete entries for the target sections
    delete_stmt = delete(TimetableEntry).where(
        TimetableEntry.school_id == school_id, TimetableEntry.section_id.in_(section_ids)
    )
    db.execute(delete_stmt)

    # 2. Get teachers map (name -> id)
    teachers_stmt = select(Teacher).where(Teacher.school_id == school_id)
    teachers = db.scalars(teachers_stmt).all()
    teacher_map = {t.name: t.id for t in teachers}

    # 3. Get subjects map (code -> id)
    subjects_stmt = select(Subject)
    subjects = db.scalars(subjects_stmt).all()
    subject_map = {s.code: s.id for s in subjects}

    generated_at = datetime.now(timezone.utc)

    # 4. Insert new entries
    for sec_id_str, sec_data in solver_result.get("timetables", {}).items():
        section_id = int(sec_id_str)
        if section_id not in section_ids:
            continue

        schedule = sec_data.get("schedule", {})
        for day_idx, day_name in enumerate(DAYS):
            periods = schedule.get(day_name, [])
            for period_idx, period in enumerate(periods):
                if not period:
                    continue

                teacher_name = period["teacher_name"]
                subject_code = period["subject_code"]

                teacher_id = teacher_map.get(teacher_name)
                subject_id = subject_map.get(subject_code)

                if not teacher_id or not subject_id:
                    raise ValueError(
                        f"Missing teacher ID for '{teacher_name}' or subject ID for '{subject_code}'"
                    )

                entry = TimetableEntry(
                    school_id=school_id,
                    section_id=section_id,
                    day_index=day_idx,
                    period_index=period_idx,
                    subject_id=subject_id,
                    teacher_id=teacher_id,
                    generated_at=generated_at,
                )
                db.add(entry)

    db.commit()
    return generated_at


def get_stored_timetable(db: Session, school_id: int) -> dict:
    """Retrieves all stored timetable entries for a school and groups them by class and section."""
    stmt = (
        select(TimetableEntry)
        .options(
            selectinload(TimetableEntry.section).selectinload(Section.school_class),
            selectinload(TimetableEntry.subject),
            selectinload(TimetableEntry.teacher),
        )
        .where(TimetableEntry.school_id == school_id)
        .order_by(TimetableEntry.section_id, TimetableEntry.day_index, TimetableEntry.period_index)
    )
    entries = db.scalars(stmt).all()

    if not entries:
        return {"generated_at": None, "timetables": {}}

    # The generated_at can be taken from the first entry as all are generated together
    generated_at = entries[0].generated_at

    timetables = {}
    for entry in entries:
        sec_id_str = str(entry.section_id)
        if sec_id_str not in timetables:
            timetables[sec_id_str] = {
                "section_name": entry.section.name,
                "class_name": entry.section.school_class.name,
                "class_id": entry.section.school_class_id,
                "schedule": {day: [None] * 9 for day in DAYS},
            }

        day_name = DAYS[entry.day_index]
        timetables[sec_id_str]["schedule"][day_name][entry.period_index] = {
            "subject_code": entry.subject.code,
            "subject_name": entry.subject.name,
            "teacher_name": entry.teacher.name,
        }

    # Clean up any None periods to make sure they validate correctly on frontend/schemas (fill with placeholder if any)
    for sec_id_str, sec_data in timetables.items():
        for day_name in DAYS:
            periods = sec_data["schedule"][day_name]
            for idx in range(len(periods)):
                if periods[idx] is None:
                    periods[idx] = {
                        "subject_code": "-",
                        "subject_name": "Free Period",
                        "teacher_name": "-",
                    }

    return {"generated_at": generated_at, "timetables": timetables}


def delete_stored_timetable(db: Session, school_id: int) -> None:
    """Deletes all stored timetable entries for a school."""
    delete_stmt = delete(TimetableEntry).where(TimetableEntry.school_id == school_id)
    db.execute(delete_stmt)
    db.commit()


def get_existing_teacher_slots(
    db: Session, school_id: int, exclude_section_ids: list[int]
) -> dict[str, set[int]]:
    """Gathers locked teacher slots across all sections of the school, excluding the specified sections."""
    stmt = (
        select(TimetableEntry)
        .join(Teacher, TimetableEntry.teacher_id == Teacher.id)
        .where(TimetableEntry.school_id == school_id)
    )

    if exclude_section_ids:
        stmt = stmt.where(TimetableEntry.section_id.not_in(exclude_section_ids))

    entries = db.scalars(stmt).all()

    locked = {}
    for entry in entries:
        t_name = entry.teacher.name
        slot = entry.day_index * 9 + entry.period_index
        if t_name not in locked:
            locked[t_name] = set()
        locked[t_name].add(slot)

    return locked
