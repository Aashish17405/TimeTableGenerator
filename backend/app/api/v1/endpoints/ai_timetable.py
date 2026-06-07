from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
import json
import logging
from sqlalchemy.orm import Session
from app.db.deps import get_db
from app.config.config import settings

# Attempt to import groq
try:
    from groq import Groq
except ImportError:
    Groq = None

router = APIRouter(prefix="/ai-timetable", tags=["AI Timetable Generator"])
logger = logging.getLogger("app.ai_timetable")

class AITimetableRequest(BaseModel):
    class_ids: list[int]
    school_id: int | None = None

class AITimetableResponse(BaseModel):
    timetables: dict | None = None
    agent_logs: list[str] = []
    error: str | None = None

def get_allocations_tool(db: Session, class_ids: list[int], school_id: int | None):
    # This function represents the "get_allocations" tool for the AI
    from app.models.section import Section
    from app.models.teacher_allocation import TeacherAllocation
    
    query = db.query(Section).filter(Section.school_class_id.in_(class_ids))
    sections = query.all()
    
    allocations_data = []
    for sec in sections:
        sec_allocs = db.query(TeacherAllocation).filter(TeacherAllocation.section_id == sec.id).all()
        allocs = []
        for a in sec_allocs:
            allocs.append({
                "subject_code": a.subject.code,
                "teacher_name": a.teacher.name,
                "periods": a.periods_per_week
            })
        allocations_data.append({
            "section_id": sec.id,
            "section_name": sec.name,
            "class_name": sec.school_class.name,
            "allocations": allocs
        })
    return allocations_data

def validate_timetable_tool(draft_schedule: list[dict]):
    # Tool for AI to validate its generated timetable draft against hard rules
    errors = []
    teacher_slots = {}
    
    for entry in draft_schedule:
        if not isinstance(entry, dict):
            continue
            
        sec_id = entry.get("section_id")
        slot_idx = entry.get("slot")
        subject = entry.get("subject_code")
        teacher = entry.get("teacher_name")
        
        if sec_id is None or slot_idx is None or not subject or not teacher:
            errors.append(f"Missing required fields in entry: {entry}")
            continue
            
        try:
            slot_idx = int(slot_idx)
        except ValueError:
            errors.append(f"Invalid slot index in: {entry}")
            continue
            
        if slot_idx not in teacher_slots:
            teacher_slots[slot_idx] = set()
            
        if teacher in teacher_slots[slot_idx]:
            errors.append(f"Double booking: Teacher {teacher} is booked multiple times in slot {slot_idx}")
        else:
            teacher_slots[slot_idx].add(teacher)
            
    if errors:
        return {"valid": False, "errors": errors}
    return {"valid": True, "message": "Draft passed basic validation (no double booking)."}

@router.post("/generate", response_model=AITimetableResponse)
def generate_ai_timetable(request: AITimetableRequest, db: Session = Depends(get_db)):
    if not Groq:
        raise HTTPException(status_code=500, detail="Groq library not installed")
    if not settings.GROQ_API_KEY:
        raise HTTPException(status_code=500, detail="GROQ_API_KEY is not set")
        
    client = Groq(api_key=settings.GROQ_API_KEY)
    agent_logs = []
    
    # Define the tools for Groq
    tools = [
        {
            "type": "function",
            "function": {
                "name": "get_allocations",
                "description": "Get the required period allocations for the requested classes. You must fulfill all periods exactly.",
                "parameters": {
                    "type": "object",
                    "properties": {},
                    "required": []
                }
            }
        },
        {
            "type": "function",
            "function": {
                "name": "validate_draft",
                "description": "Validate a draft timetable to check for double-booking or slot conflicts.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "draft": {
                            "type": "array",
                            "description": "An array of objects representing the assignments. Omit unassigned slots.",
                            "items": {
                                "type": "object",
                                "properties": {
                                    "section_id": {"type": "integer"},
                                    "slot": {"type": "integer", "description": "0 to 53"},
                                    "subject_code": {"type": "string"},
                                    "teacher_name": {"type": "string"}
                                },
                                "required": ["section_id", "slot", "subject_code", "teacher_name"]
                            }
                        }
                    },
                    "required": ["draft"]
                }
            }
        },
        {
            "type": "function",
            "function": {
                "name": "submit_timetable",
                "description": "Submit the finalized valid timetable.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "final_schedule": {
                            "type": "array",
                            "description": "An array of objects representing the final schedule.",
                            "items": {
                                "type": "object",
                                "properties": {
                                    "section_id": {"type": "integer"},
                                    "slot": {"type": "integer", "description": "0 to 53"},
                                    "subject_code": {"type": "string"},
                                    "teacher_name": {"type": "string"}
                                },
                                "required": ["section_id", "slot", "subject_code", "teacher_name"]
                            }
                        }
                    },
                    "required": ["final_schedule"]
                }
            }
        }
    ]
    
    messages = [
        {
            "role": "system",
            "content": "You are an AI Timetable Generator. Your job is to create a conflict-free timetable. A week has 6 days, 9 periods a day = 54 total slots (indexed 0 to 53). You MUST assign exactly the number of periods specified in get_allocations to each section, no more, no less. Ensure no teacher is assigned to two different sections in the same slot. Use validate_draft to check your work, and submit_timetable when done. If the required allocations are mathematically impossible to schedule (e.g. any single teacher is required to teach more than 54 periods across all their assigned sections), you cannot create a conflict-free timetable. Instead of failing silently, explicitly state the mathematical problem in your response and propose a concrete suggestion to fix it (e.g. 'Reduce Bob\\'s MATH periods by 6'). DO NOT use any comments inside the JSON for tool calls. Your output MUST be strictly valid JSON."
        },
        {
            "role": "user",
            "content": "Please generate a timetable for the selected classes."
        }
    ]
    
    max_turns = 10
    final_result = None
    
    try:
        for turn in range(max_turns):
            agent_logs.append(f"Turn {turn + 1}: Thinking...")
            response = client.chat.completions.create(
                model="llama-3.3-70b-versatile",
                messages=messages,
                tools=tools,
                tool_choice="auto",
            )
            
            message = response.choices[0].message
            messages.append(message)
            
            if message.tool_calls:
                for tool_call in message.tool_calls:
                    function_name = tool_call.function.name
                    agent_logs.append(f"Agent invoked tool: {function_name}")
                    
                    if function_name == "get_allocations":
                        allocs = get_allocations_tool(db, request.class_ids, request.school_id)
                        messages.append({
                            "role": "tool",
                            "tool_call_id": tool_call.id,
                            "name": function_name,
                            "content": json.dumps(allocs)
                        })
                        agent_logs.append(f"Returned allocations to agent.")
                    elif function_name == "validate_draft":
                        args = json.loads(tool_call.function.arguments)
                        validation = validate_timetable_tool(args.get("draft", []))
                        messages.append({
                            "role": "tool",
                            "tool_call_id": tool_call.id,
                            "name": function_name,
                            "content": json.dumps(validation)
                        })
                        agent_logs.append(f"Validation result: {validation['valid']}")
                    elif function_name == "submit_timetable":
                        args = json.loads(tool_call.function.arguments)
                        final_result = args.get("final_schedule", [])
                        messages.append({
                            "role": "tool",
                            "tool_call_id": tool_call.id,
                            "name": function_name,
                            "content": '{"status": "success"}'
                        })
                        agent_logs.append(f"Agent submitted the finalized timetable.")
                        break
            else:
                agent_logs.append(f"Agent responded: {message.content}")
                # Sometimes LLM forgets to call submit and just outputs it. 
                break
                
            if final_result is not None:
                break
                
    except Exception as e:
        logger.error(f"Groq API Error: {str(e)}")
        return AITimetableResponse(agent_logs=agent_logs, error=f"API Error: {str(e)}")
        
    if not final_result:
        last_msg = messages[-1]
        suggestion = "Agent failed to submit a timetable."
        if hasattr(last_msg, 'content') and last_msg.content:
            suggestion = last_msg.content
        elif isinstance(last_msg, dict) and last_msg.get('content'):
            suggestion = last_msg['content']
            
        return AITimetableResponse(agent_logs=agent_logs, error=suggestion)
        
    # Format the final_result into the expected structure
    # { section_id: { section_name: "", schedule: { "Monday": [ period dicts... ] } } }
    formatted_timetables = {}
    
    # Setup base structure
    sections_info = get_allocations_tool(db, request.class_ids, request.school_id)
    for sec in sections_info:
        formatted_timetables[str(sec["section_id"])] = {
            "section_name": sec["section_name"],
            "schedule": {day: [None]*9 for day in ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]}
        }
        
    days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]
    
    for entry in final_result:
        if not isinstance(entry, dict):
            continue
            
        sec_id = entry.get("section_id")
        slot_idx = entry.get("slot")
        subj = entry.get("subject_code")
        teacher = entry.get("teacher_name")
        
        if sec_id is None or slot_idx is None or not subj or not teacher:
            continue
            
        sec_id_str = str(sec_id)
        if sec_id_str not in formatted_timetables:
            continue
            
        try:
            slot_idx = int(slot_idx)
        except ValueError:
            continue
            
        if slot_idx >= 54:
            continue
            
        day_idx = slot_idx // 9
        period_idx = slot_idx % 9
        day_name = days[day_idx]
        
        formatted_timetables[sec_id_str]["schedule"][day_name][period_idx] = {
            "subject_code": subj,
            "subject_name": subj,
            "teacher_name": teacher
        }
            
    return AITimetableResponse(timetables=formatted_timetables, agent_logs=agent_logs)
