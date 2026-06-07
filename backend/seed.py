import os
import sys

# Ensure app is in path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from sqlalchemy.orm import Session
from app.db.session import engine, SessionLocal
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
        {"name": "English", "code": "ENG"},
        {"name": "Mathematics", "code": "MATH"},
        {"name": "Science", "code": "SCI"},
        {"name": "Social Studies", "code": "SST"},
        {"name": "First Language", "code": "FL"},
        {"name": "Second Language", "code": "SL"},
        {"name": "Physical Education", "code": "PET"},
        {"name": "Art & Craft", "code": "ART"},
        {"name": "Computer Science", "code": "CS"},
        {"name": "Value Education", "code": "VED"},
        {"name": "Library", "code": "LIB"},
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

def seed_complete_school(db: Session, subjects_map: dict):
    print("Seeding Complete School (Campus A)...")
    school = School(name="Springfield High (Campus A)", address="123 Main St, Springfield")
    db.add(school)
    db.commit()
    db.refresh(school)

    # Create Classes I to V
    classes_data = [
        {"name": "I", "display_order": 1},
        {"name": "II", "display_order": 2},
        {"name": "III", "display_order": 3},
        {"name": "IV", "display_order": 4},
        {"name": "V", "display_order": 5},
    ]

    classes = []
    for c_data in classes_data:
        c = SchoolClass(**c_data, school_id=school.id)
        db.add(c)
        classes.append(c)
    
    db.commit()
    for c in classes:
        db.refresh(c)

    # Create Sections A and B for each class
    sections = []
    for c in classes:
        for sec_name in ["A", "B"]:
            sec = Section(name=sec_name, school_class_id=c.id)
            db.add(sec)
            sections.append(sec)
    
    db.commit()
    for sec in sections:
        db.refresh(sec)

    # Subject Requirements (Must add up to 54)
    # ENG: 8, MATH: 8, SCI: 7, SST: 7, FL: 6, SL: 5, CS: 4, PET: 4, ART: 3, VED: 1, LIB: 1 = 54
    req_blueprint = [
        ("ENG", 8),
        ("MATH", 8),
        ("SCI", 7),
        ("SST", 7),
        ("FL", 6),
        ("SL", 5),
        ("CS", 4),
        ("PET", 4),
        ("ART", 3),
        ("VED", 1),
        ("LIB", 1),
    ]

    requirements = []
    for c in classes:
        for code, periods in req_blueprint:
            req = SubjectRequirement(
                school_class_id=c.id,
                subject_id=subjects_map[code].id,
                periods_per_week=periods
            )
            db.add(req)
            requirements.append(req)
    
    db.commit()

    # Teachers and their mappings
    # We will create dedicated teachers for each subject cluster to make it easier to map and allocate
    teacher_profiles = [
        {"name": "Alice (Eng/FL)", "email": "alice@school.com", "subjects": ["ENG", "FL"]},
        {"name": "Bob (Math/Sci)", "email": "bob@school.com", "subjects": ["MATH", "SCI"]},
        {"name": "Charlie (SST/SL)", "email": "charlie@school.com", "subjects": ["SST", "SL"]},
        {"name": "Diana (CS/VED)", "email": "diana@school.com", "subjects": ["CS", "VED"]},
        {"name": "Eve (PET/ART/LIB)", "email": "eve@school.com", "subjects": ["PET", "ART", "LIB"]},
        
        # Second set of teachers
        {"name": "Frank (Eng/FL)", "email": "frank@school.com", "subjects": ["ENG", "FL"]},
        {"name": "Grace (Math/Sci)", "email": "grace@school.com", "subjects": ["MATH", "SCI"]},
        {"name": "Hank (SST/SL)", "email": "hank@school.com", "subjects": ["SST", "SL"]},
        {"name": "Ivy (CS/VED)", "email": "ivy@school.com", "subjects": ["CS", "VED"]},
        {"name": "Jack (PET/ART/LIB)", "email": "jack@school.com", "subjects": ["PET", "ART", "LIB"]},
    ]

    teachers = []
    for p in teacher_profiles:
        t = Teacher(name=p["name"], email=p["email"], school_id=school.id)
        db.add(t)
        teachers.append((t, p["subjects"]))
    
    db.commit()
    for t, _ in teachers:
        db.refresh(t)

    # Teacher Class Mappings (Assign half classes to first group, half to second group)
    # Alice, Bob... teach classes I, II, III. Frank, Grace... teach classes IV, V.
    mappings = []
    for idx, (t, _) in enumerate(teachers):
        assigned_classes = classes[:3] if idx < 5 else classes[3:]
        for c in assigned_classes:
            m = TeacherClassMapping(teacher_id=t.id, class_id=c.id)
            db.add(m)
            mappings.append(m)
    
    db.commit()

    # Allocations
    for sec in sections:
        c_idx = next(i for i, c in enumerate(classes) if c.id == sec.school_class_id)
        # Choose teacher group based on class
        group_idx = 0 if c_idx < 3 else 5
        
        for code, periods in req_blueprint:
            # Find the right teacher for the subject
            allocated_teacher = None
            for offset in range(5):
                t, t_subs = teachers[group_idx + offset]
                if code in t_subs:
                    allocated_teacher = t
                    break
            
            if allocated_teacher:
                alloc = TeacherAllocation(
                    teacher_id=allocated_teacher.id,
                    section_id=sec.id,
                    subject_id=subjects_map[code].id,
                    periods_per_week=periods
                )
                db.add(alloc)
            else:
                print(f"Warning: No teacher found for {code} in {sec.school_class.name}{sec.name}")

    db.commit()
    print("Complete School seeded successfully.")


def seed_incomplete_school(db: Session, subjects_map: dict):
    print("Seeding Incomplete School (Campus B)...")
    school = School(name="Shelbyville Elementary (Campus B)", address="456 Oak St, Shelbyville")
    db.add(school)
    db.commit()
    db.refresh(school)

    # Create Classes I to III
    classes_data = [
        {"name": "I", "display_order": 1},
        {"name": "II", "display_order": 2},
        {"name": "III", "display_order": 3},
    ]

    classes = []
    for c_data in classes_data:
        c = SchoolClass(**c_data, school_id=school.id)
        db.add(c)
        classes.append(c)
    
    db.commit()
    for c in classes:
        db.refresh(c)

    # Create Sections A only
    sections = []
    for c in classes:
        sec = Section(name="A", school_class_id=c.id)
        db.add(sec)
        sections.append(sec)
    
    db.commit()
    for sec in sections:
        db.refresh(sec)

    # Subject Requirements (Missing some to make it incomplete, e.g. sums up to 40 instead of 54)
    req_blueprint = [
        ("ENG", 8),
        ("MATH", 8),
        ("SCI", 8),
        ("SST", 8),
        ("PET", 8),
    ]

    for c in classes:
        for code, periods in req_blueprint:
            req = SubjectRequirement(
                school_class_id=c.id,
                subject_id=subjects_map[code].id,
                periods_per_week=periods
            )
            db.add(req)
    
    db.commit()

    # Teachers and their mappings
    teacher_profiles = [
        {"name": "Kevin (Eng)", "email": "kevin@school.com", "subjects": ["ENG"]},
        {"name": "Laura (Math)", "email": "laura@school.com", "subjects": ["MATH"]},
        {"name": "Mike (Sci/SST)", "email": "mike@school.com", "subjects": ["SCI", "SST"]},
    ]

    teachers = []
    for p in teacher_profiles:
        t = Teacher(name=p["name"], email=p["email"], school_id=school.id)
        db.add(t)
        teachers.append((t, p["subjects"]))
    
    db.commit()
    for t, _ in teachers:
        db.refresh(t)

    # Mappings - Only mapping to Class I and II
    for t, _ in teachers:
        for c in classes[:2]:
            m = TeacherClassMapping(teacher_id=t.id, class_id=c.id)
            db.add(m)
    
    db.commit()

    # Allocations - Missing PET entirely, and only allocating to Class I and II
    for sec in sections[:2]:
        for code, periods in req_blueprint:
            if code == "PET":
                continue # Skip PET to leave it incomplete
            
            # Find the right teacher for the subject
            allocated_teacher = None
            for t, t_subs in teachers:
                if code in t_subs:
                    allocated_teacher = t
                    break
            
            if allocated_teacher:
                alloc = TeacherAllocation(
                    teacher_id=allocated_teacher.id,
                    section_id=sec.id,
                    subject_id=subjects_map[code].id,
                    periods_per_week=periods
                )
                db.add(alloc)

    db.commit()
    print("Incomplete School seeded successfully.")


def run_seed():
    db = SessionLocal()
    try:
        clear_data(db)
        subjects_map = create_global_subjects(db)
        seed_complete_school(db, subjects_map)
        seed_incomplete_school(db, subjects_map)
        print("Seeding complete!")
    except Exception as e:
        print(f"Error during seeding: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    run_seed()
