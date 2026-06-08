import os
import sys

# Ensure app is in path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from sqlalchemy import select
from app.db.session import SessionLocal
from app.models.timetable_entry import TimetableEntry
from app.models.section import Section
from app.models.school_class import SchoolClass
from app.models.teacher import Teacher
from app.models.subject import Subject

def validate_timetable():
    db = SessionLocal()
    try:
        school_id = 13 # Gowtham Model School
        
        # Load all entries
        entries = db.query(TimetableEntry).filter(TimetableEntry.school_id == school_id).all()
        print(f"Total stored timetable entries: {len(entries)}")
        
        # Get sections of Gowtham Model School
        sections = db.query(Section).join(SchoolClass).filter(SchoolClass.school_id == school_id).all()
        section_ids = [s.id for s in sections]
        print(f"Total sections: {len(sections)}")
        
        # Verify 54 entries per section
        section_entry_count = {}
        for entry in entries:
            section_entry_count[entry.section_id] = section_entry_count.get(entry.section_id, 0) + 1
            
        for sec in sections:
            count = section_entry_count.get(sec.id, 0)
            print(f"Section {sec.school_class.name}-{sec.name}: {count} entries")
            if count != 54:
                print(f"ERROR: Section {sec.school_class.name}-{sec.name} has {count} entries, expected 54!")

        # Verify no teacher double booking
        # Group by day, period, teacher
        teacher_busy_slots = {}
        for entry in entries:
            key = (entry.day_index, entry.period_index, entry.teacher_id)
            if key in teacher_busy_slots:
                other_entry = teacher_busy_slots[key]
                print(f"ERROR: Double Booking for Teacher ID {entry.teacher_id} on day {entry.day_index}, period {entry.period_index} between Section {entry.section_id} and Section {other_entry.section_id}!")
            else:
                teacher_busy_slots[key] = entry

        # Verify consecutive subject limits: max 2 consecutive
        # Group by section, day
        section_day_slots = {}
        # Group by section, subject
        section_subject_counts = {}
        for entry in entries:
            key = (entry.section_id, entry.day_index)
            if key not in section_day_slots:
                section_day_slots[key] = [None] * 9
            section_day_slots[key][entry.period_index] = entry.subject_id
            
            section_subject_counts[entry.section_id] = section_subject_counts.get(entry.section_id, {})
            section_subject_counts[entry.section_id][entry.subject_id] = section_subject_counts[entry.section_id].get(entry.subject_id, 0) + 1

        for (sec_id, day_idx), slots in section_day_slots.items():
            sec = db.query(Section).filter(Section.id == sec_id).first()
            sec_name = f"{sec.school_class.name}-{sec.name}" if sec else str(sec_id)
            for i in range(len(slots) - 2):
                if slots[i] is not None and slots[i] == slots[i+1] and slots[i] == slots[i+2]:
                    # Find subject code
                    subj = db.query(Subject).filter(Subject.id == slots[i]).first()
                    subj_code = subj.code if subj else str(slots[i])
                    print(f"ERROR: Section {sec_name} has consecutive lessons of subject {subj_code} in periods {i+1}, {i+2}, {i+3} on day {day_idx}!")

        # Verify subject counts match requirements
        req_blueprint = {
            "I":    {"ENG": 15, "MATH": 16, "FL": 15, "SL": 0, "PET": 2, "HW": 6},
            "II":   {"ENG": 15, "MATH": 16, "FL": 15, "SL": 0, "PET": 2, "HW": 6},
            "III":  {"ENG": 15, "MATH": 16, "FL": 15, "SL": 0, "PET": 2, "HW": 6},
            "IV":   {"ENG": 11, "MATH": 16, "FL": 11, "SL": 8, "PET": 2, "HW": 6},
            "V":    {"ENG": 11, "MATH": 16, "FL": 11, "SL": 8, "PET": 2, "HW": 6},
            "VI":   {"ENG": 12, "MATH": 14, "FL": 12, "SL": 8, "PET": 2, "HW": 6},
            "VII":  {"ENG": 12, "MATH": 14, "FL": 12, "SL": 8, "PET": 2, "HW": 6},
            "VIII": {"ENG": 12, "MATH": 14, "FL": 12, "SL": 8, "PET": 2, "HW": 6},
        }
        
        subjects_in_db = db.query(Subject).all()
        id_to_code = {s.id: s.code for s in subjects_in_db}
        
        for sec in sections:
            sec_name = f"{sec.school_class.name}-{sec.name}"
            class_name = sec.school_class.name
            expected_counts = req_blueprint[class_name]
            
            actual_counts = section_subject_counts.get(sec.id, {})
            # Translate to codes
            actual_by_code = {id_to_code[subj_id]: count for subj_id, count in actual_counts.items()}
            
            for code, expected in expected_counts.items():
                actual = actual_by_code.get(code, 0)
                if actual != expected:
                    print(f"ERROR: Section {sec_name} subject {code} count is {actual}, expected {expected}!")

        # Verify consecutive Handwriting limits: no consecutive HW
        # Find HW subject ID
        hw_subject = db.query(Subject).filter(Subject.code == "HW").first()
        if hw_subject:
            hw_id = hw_subject.id
            for (sec_id, day_idx), slots in section_day_slots.items():
                sec = db.query(Section).filter(Section.id == sec_id).first()
                sec_name = f"{sec.school_class.name}-{sec.name}" if sec else str(sec_id)
                for i in range(len(slots) - 1):
                    if slots[i] == hw_id and slots[i+1] == hw_id:
                        print(f"ERROR: Section {sec_name} has consecutive Handwriting (HW) on day {day_idx} periods {i+1}, {i+2}!")

        print("Validation checks complete!")
    except Exception as e:
        print(f"Error: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    validate_timetable()
