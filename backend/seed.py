import os
import sys

# Ensure app is in path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from sqlalchemy.orm import Session
from app.db.session import SessionLocal
from app.models.school import School
from app.models.subject import Subject
from app.models.school_class import SchoolClass
from app.models.section import Section
from app.models.teacher import Teacher
from app.models.teacher_class_mapping import TeacherClassMapping
from app.models.subject_requirement import SubjectRequirement
from app.models.teacher_allocation import TeacherAllocation

# Helper function to generate clean database state
def clear_data(db: Session):
    print("Clearing existing data...")
    db.query(TeacherAllocation).delete()
    db.query(SubjectRequirement).delete()
    db.query(TeacherClassMapping).delete()
    db.query(Section).delete()
    db.query(SchoolClass).delete()
    db.query(Teacher).delete()
    db.query(Subject).delete()
    db.query(School).delete()
    db.commit()

def create_global_subjects(db: Session):
    print("Creating subjects...")
    subjects_data = [
        {"name": "First Language", "code": "FL"},
        {"name": "Second Language", "code": "SL"},
        {"name": "English", "code": "ENG"},
        {"name": "Mathematics", "code": "MATH"},
        {"name": "Physical Education", "code": "PET"},
        {"name": "Handwriting", "code": "HW"},
    ]
    
    subjects = []
    for s_data in subjects_data:
        s = Subject(**s_data)
        db.add(s)
        subjects.append(s)
    
    db.commit()
    for s in subjects:
        db.refresh(s)
    
    return {s.code: s for s in subjects}

def seed_school_data(db: Session, school: School, subjects_map: dict, prefix: str, complete: bool = True):
    print(f"Seeding {school.name}...")
    
    # Create classes I to VIII (for incomplete, we can create I to III)
    class_names = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII"] if complete else ["I", "II", "III"]
    classes = []
    for idx, name in enumerate(class_names):
        c = SchoolClass(name=name, display_order=idx + 1, school_id=school.id)
        db.add(c)
        classes.append(c)
    db.commit()
    for c in classes:
        db.refresh(c)
        
    # Create sections
    sections = []
    for c in classes:
        # Campus A gets sections A and B, Campus B only gets A
        sec_names = ["A", "B"] if complete else ["A"]
        for sec_name in sec_names:
            sec = Section(name=sec_name, school_class_id=c.id)
            db.add(sec)
            sections.append(sec)
    db.commit()
    for sec in sections:
        db.refresh(sec)

    # Subject Requirements (Must add up to 54)
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

    # Seed subject requirements
    for c in classes:
        c_reqs = req_blueprint[c.name]
        for code, periods in c_reqs.items():
            # For incomplete school, skip HW and SL to make it incomplete
            if not complete and code in ["HW", "SL"]:
                continue
            if periods > 0:
                req = SubjectRequirement(
                    school_class_id=c.id,
                    subject_id=subjects_map[code].id,
                    periods_per_week=periods
                )
                db.add(req)
    db.commit()

    # Dynamic teacher allocation algorithm
    teachers = []
    teacher_counter = 1
    
    def get_or_create_teacher(subject_code, periods_needed):
        # Find a teacher of this subject who has enough remaining workload (54 - workload >= periods_needed)
        for t in teachers:
            if t["subject"] == subject_code and (54 - t["workload"]) >= periods_needed:
                t["workload"] += periods_needed
                return t["obj"]
        # Otherwise, create a new teacher
        nonlocal teacher_counter
        t_name = f"{prefix} Teacher {teacher_counter} ({subject_code})"
        teacher_counter += 1
        email_prefix = t_name.lower().replace(' ', '_').replace('(', '').replace(')', '')
        t_obj = Teacher(name=t_name, email=f"{email_prefix}@school.com", school_id=school.id)
        db.add(t_obj)
        db.commit()
        db.refresh(t_obj)
        
        t_info = {"name": t_name, "subject": subject_code, "workload": periods_needed, "obj": t_obj}
        teachers.append(t_info)
        return t_obj

    # Map teachers to classes and create allocations
    mapped_pairs = set() # (teacher_id, class_id)
    
    for sec in sections:
        c = sec.school_class
        c_reqs = req_blueprint[c.name]
        for code, periods in c_reqs.items():
            if periods == 0:
                continue
            
            # If incomplete, skip HW and PET allocations to make it incomplete
            if not complete and code in ["HW", "PET"]:
                continue

            teacher_obj = get_or_create_teacher(code, periods)
            
            # Map teacher to class if not done
            if (teacher_obj.id, c.id) not in mapped_pairs:
                m = TeacherClassMapping(teacher_id=teacher_obj.id, class_id=c.id)
                db.add(m)
                mapped_pairs.add((teacher_obj.id, c.id))
                
            # Create allocation
            alloc = TeacherAllocation(
                teacher_id=teacher_obj.id,
                section_id=sec.id,
                subject_id=subjects_map[code].id,
                periods_per_week=periods
            )
            db.add(alloc)
            
    db.commit()
    print(f"School {school.name} seeded successfully.")

def run_seed():
    db = SessionLocal()
    try:
        clear_data(db)
        subjects_map = create_global_subjects(db)
        
        # Complete School
        school_a = School(name="Springfield High (Campus A)", address="123 Main St, Springfield")
        db.add(school_a)
        db.commit()
        db.refresh(school_a)
        seed_school_data(db, school_a, subjects_map, prefix="Campus A", complete=True)
        
        # Incomplete School
        school_b = School(name="Shelbyville Elementary (Campus B)", address="456 Oak St, Shelbyville")
        db.add(school_b)
        db.commit()
        db.refresh(school_b)
        seed_school_data(db, school_b, subjects_map, prefix="Campus B", complete=False)
        
        print("Seeding complete!")
    except Exception as e:
        print(f"Error during seeding: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    run_seed()
