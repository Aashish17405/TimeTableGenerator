import urllib.request
import urllib.error
import json

def test_generation():
    url = "http://127.0.0.1:8000/api/v1/timetable/generate-all"
    data = {"school_id": 13}
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

if __name__ == "__main__":
    test_generation()
