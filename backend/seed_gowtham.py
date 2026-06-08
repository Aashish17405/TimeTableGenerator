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

def seed_gowtham():
    db = SessionLocal()
    try:
        # Check if subjects exist, otherwise create them
        subjects_in_db = db.query(Subject).all()
        subjects_map = {s.code: s for s in subjects_in_db}
        
        required_subjects = [
            {"name": "First Language", "code": "FL"},
            {"name": "Second Language", "code": "SL"},
            {"name": "English", "code": "ENG"},
            {"name": "Mathematics", "code": "MATH"},
            {"name": "Physical Education", "code": "PET"},
            {"name": "Handwriting", "code": "HW"},
        ]
        
        for s_data in required_subjects:
            if s_data["code"] not in subjects_map:
                s = Subject(**s_data)
                db.add(s)
                db.commit()
                db.refresh(s)
                subjects_map[s.code] = s

        # Create Gowtham Model School
        school = db.query(School).filter(School.name == "Gowtham Model School").first()
        if school:
            print("Gowtham Model School already exists! Removing it to re-seed cleanly...")
            # Delete entries related to this school's sections/classes/teachers
            teacher_ids = [t.id for t in db.query(Teacher).filter(Teacher.school_id == school.id).all()]
            class_ids = [c.id for c in db.query(SchoolClass).filter(SchoolClass.school_id == school.id).all()]
            section_ids = [s.id for s in db.query(Section).filter(Section.school_class_id.in_(class_ids)).all()] if class_ids else []
            
            if section_ids:
                db.query(TeacherAllocation).filter(TeacherAllocation.section_id.in_(section_ids)).delete(synchronize_session=False)
                db.query(Section).filter(Section.id.in_(section_ids)).delete(synchronize_session=False)
            if class_ids:
                db.query(SubjectRequirement).filter(SubjectRequirement.school_class_id.in_(class_ids)).delete(synchronize_session=False)
                db.query(TeacherClassMapping).filter(TeacherClassMapping.class_id.in_(class_ids)).delete(synchronize_session=False)
                db.query(SchoolClass).filter(SchoolClass.id.in_(class_ids)).delete(synchronize_session=False)
            if teacher_ids:
                db.query(TeacherClassMapping).filter(TeacherClassMapping.teacher_id.in_(teacher_ids)).delete(synchronize_session=False)
                db.query(Teacher).filter(Teacher.id.in_(teacher_ids)).delete(synchronize_session=False)
            
            db.query(School).filter(School.id == school.id).delete()
            db.commit()

        print("Creating Gowtham Model School...")
        school = School(name="Gowtham Model School", address="Gowtham Model School Road, Hyderabad")
        db.add(school)
        db.commit()
        db.refresh(school)
        
        # Create classes I to VIII
        class_names = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII"]
        classes = []
        for idx, name in enumerate(class_names):
            c = SchoolClass(name=name, display_order=idx + 1, school_id=school.id)
            db.add(c)
            classes.append(c)
        db.commit()
        for c in classes:
            db.refresh(c)
            
        # Create sections A and B for each class
        sections = []
        for c in classes:
            for sec_name in ["A", "B"]:
                sec = Section(name=sec_name, school_class_id=c.id)
                db.add(sec)
                sections.append(sec)
        db.commit()
        for sec in sections:
            db.refresh(sec)

        # Subject Requirements mapping (from user image)
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
                if periods > 0:
                    req = SubjectRequirement(
                        school_class_id=c.id,
                        subject_id=subjects_map[code].id,
                        periods_per_week=periods
                    )
                    db.add(req)
        db.commit()

        # Dynamic teacher allocation
        teachers = []
        teacher_counter = 1
        
        def get_or_create_teacher(subject_code, periods_needed):
            for t in teachers:
                if t["subject"] == subject_code and (54 - t["workload"]) >= periods_needed:
                    t["workload"] += periods_needed
                    return t["obj"]
            nonlocal teacher_counter
            t_name = f"Gowtham Teacher {teacher_counter} ({subject_code})"
            teacher_counter += 1
            email_prefix = t_name.lower().replace(' ', '_').replace('(', '').replace(')', '')
            t_obj = Teacher(name=t_name, email=f"{email_prefix}@gowtham.com", school_id=school.id)
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
        print(f"School {school.name} seeded successfully with ID {school.id}.")
        return school.id
    except Exception as e:
        print(f"Error during seeding: {e}")
        db.rollback()
        raise e
    finally:
        db.close()

if __name__ == "__main__":
    seed_gowtham()
