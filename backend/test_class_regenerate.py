import urllib.request
import urllib.error
import json
from app.db.session import SessionLocal
from app.models.school import School
from app.models.school_class import SchoolClass

def test_regenerate():
    db = SessionLocal()
    try:
        school = db.query(School).filter(School.name == "Gowtham Model School").first()
        if not school:
            print("Gowtham Model School not found!")
            return
            
        c_i = db.query(SchoolClass).filter(SchoolClass.school_id == school.id, SchoolClass.name == "I").first()
        if not c_i:
            print("Class I not found!")
            return
            
        print(f"Testing Class Regeneration for Class {c_i.name} (ID: {c_i.id}) in School {school.name} (ID: {school.id})...")
        
        url = "http://127.0.0.1:8000/api/v1/timetable/regenerate-class"
        data = {"school_id": school.id, "class_id": c_i.id}
        headers = {"Content-Type": "application/json"}
        
        req = urllib.request.Request(
            url,
            data=json.dumps(data).encode('utf-8'),
            headers=headers,
            method="POST"
        )
        
        try:
            with urllib.request.urlopen(req) as response:
                res_body = response.read().decode('utf-8')
                print("SUCCESS:")
                print(json.dumps(json.loads(res_body), indent=2))
        except urllib.error.HTTPError as e:
            print(f"FAILED WITH HTTP ERROR {e.code}:")
            err_body = e.read().decode('utf-8')
            try:
                print(json.dumps(json.loads(err_body), indent=2))
            except Exception:
                print(err_body)
        except Exception as e:
            print(f"FAILED WITH EXCEPTION: {e}")
            
    finally:
        db.close()

if __name__ == "__main__":
    test_regenerate()
