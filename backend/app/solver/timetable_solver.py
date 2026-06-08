from __future__ import annotations

import logging
from math import ceil
from typing import Any

from ortools.sat.python import cp_model

DAYS = ("Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday")
PERIODS_PER_DAY = 9
TOTAL_SLOTS = len(DAYS) * PERIODS_PER_DAY

logger = logging.getLogger("app.solver")

class TimetableGenerationError(Exception):
    pass

def generate_timetables(
    sections_input: list[dict[str, Any]],
    locked_teacher_slots: dict[str, set[int]] | None = None,
) -> dict[str, Any]:
    if not sections_input:
        raise TimetableGenerationError("At least one section must be selected.")
        
    model = cp_model.CpModel()
    
    # Pre-process allocations and ensure period counts match EXACTLY 54 per section
    teachers_set = set()
    section_allocations = {}
    teacher_loads = {}
    
    for section in sections_input:
        sec_id = str(section["section_id"])
        allocs = []
        total_p = 0
        for a in section["allocations"]:
            p = int(a["periods_per_week"])
            teacher_name = a["teacher_name"]
            allocs.append({
                "subject_code": a["subject_code"],
                "subject_name": a["subject_name"],
                "teacher_name": teacher_name,
                "periods": p
            })
            total_p += p
            teachers_set.add(teacher_name)
            teacher_loads[teacher_name] = teacher_loads.get(teacher_name, 0) + p
            
        if total_p != TOTAL_SLOTS:
            raise TimetableGenerationError(
                f"Section {section['section_name']} needs exactly {TOTAL_SLOTS} periods, "
                f"but received {total_p}."
            )
        section_allocations[sec_id] = allocs

    # Add locked slots count to teacher loads
    if locked_teacher_slots:
        for t_name, slots in locked_teacher_slots.items():
            teacher_loads[t_name] = teacher_loads.get(t_name, 0) + len(slots)

    # Verify teacher limits globally before starting
    overloaded_teachers = [t for t, count in teacher_loads.items() if count > TOTAL_SLOTS]
    if overloaded_teachers:
        raise TimetableGenerationError(
            "Teacher load exceeds weekly capacity for: " + ", ".join(sorted(overloaded_teachers))
        )

    # X[section_id][alloc_idx][slot] = boolean var (1 if allocation assigned to slot)
    X = {}
    
    for sec in sections_input:
        sec_id = str(sec["section_id"])
        X[sec_id] = {}
        for a_idx, alloc in enumerate(section_allocations[sec_id]):
            X[sec_id][a_idx] = {}
            for t in range(TOTAL_SLOTS):
                name = f"X_s{sec_id}_a{a_idx}_t{t}"
                X[sec_id][a_idx][t] = model.NewBoolVar(name)
                
    # 1. Exact weekly match
    for sec_id, allocs in section_allocations.items():
        for a_idx, alloc in enumerate(allocs):
            model.Add(sum(X[sec_id][a_idx][t] for t in range(TOTAL_SLOTS)) == alloc["periods"])

    # 2. One Subject per Slot per Section
    for sec_id, allocs in section_allocations.items():
        for t in range(TOTAL_SLOTS):
            model.AddExactlyOne([X[sec_id][a_idx][t] for a_idx in range(len(allocs))])
            
    # 3. One Teacher per Slot globally (No double booking)
    for t in range(TOTAL_SLOTS):
        for teacher in teachers_set:
            teacher_vars = []
            for sec_id, allocs in section_allocations.items():
                for a_idx, alloc in enumerate(allocs):
                    if alloc["teacher_name"] == teacher:
                        teacher_vars.append(X[sec_id][a_idx][t])
            if teacher_vars:
                if locked_teacher_slots and teacher in locked_teacher_slots and t in locked_teacher_slots[teacher]:
                    model.Add(sum(teacher_vars) == 0)
                else:
                    model.Add(sum(teacher_vars) <= 1)

    # 4. Soft Constraints formulated as Hard Limits
    for sec_id, allocs in section_allocations.items():
        # First, apply per-allocation limits
        for a_idx, alloc in enumerate(allocs):
            subj_code = alloc["subject_code"].upper()
            periods = alloc["periods"]
            
            # Daily Limit
            max_daily = max(1, ceil(periods / len(DAYS)))
            for d in range(len(DAYS)):
                day_vars = [X[sec_id][a_idx][d * PERIODS_PER_DAY + p] for p in range(PERIODS_PER_DAY)]
                model.Add(sum(day_vars) <= max_daily)
                        
            # Consecutive subject limit: Max 2 consecutive periods of ANY specific allocation on the same day
            for d in range(len(DAYS)):
                for p in range(PERIODS_PER_DAY - 2):
                    slot1 = d * PERIODS_PER_DAY + p
                    slot2 = slot1 + 1
                    slot3 = slot1 + 2
                    model.Add(X[sec_id][a_idx][slot1] + X[sec_id][a_idx][slot2] + X[sec_id][a_idx][slot3] <= 2)
                        
            # Same period index variety
            # We don't want the same subject in Period 1 every single day
            for p in range(PERIODS_PER_DAY):
                p_vars = [X[sec_id][a_idx][d * PERIODS_PER_DAY + p] for d in range(len(DAYS))]
                model.Add(sum(p_vars) <= 3) # Max 3 times in the same period index

        # Now, apply aggregate limits across all allocations of specific subjects (e.g. if multiple teachers teach PET to the same section)
        pet_indices = [i for i, a in enumerate(allocs) if "PET" in a["subject_code"].upper()]
        if pet_indices:
            for d in range(len(DAYS)):
                # Daily limit: Max 1 PET period per day
                pet_day_vars = [
                    X[sec_id][a_idx][d * PERIODS_PER_DAY + p]
                    for a_idx in pet_indices
                    for p in range(PERIODS_PER_DAY)
                ]
                model.Add(sum(pet_day_vars) <= 1)
                
                # Rule: PET must never be in the 1st period (index 0) of the day
                model.Add(sum(X[sec_id][a_idx][d * PERIODS_PER_DAY + 0] for a_idx in pet_indices) == 0)

        hw_indices = [i for i, a in enumerate(allocs) if "HW" in a["subject_code"].upper()]
        if hw_indices:
            for d in range(len(DAYS)):
                for p in range(PERIODS_PER_DAY - 1):
                    slot1 = d * PERIODS_PER_DAY + p
                    slot2 = slot1 + 1
                    model.Add(sum(X[sec_id][a_idx][slot1] for a_idx in hw_indices) + 
                              sum(X[sec_id][a_idx][slot2] for a_idx in hw_indices) <= 1)

    solver = cp_model.CpSolver()
    solver.parameters.max_time_in_seconds = 15.0
    status = solver.Solve(model)
    
    if status in [cp_model.OPTIMAL, cp_model.FEASIBLE]:
        logger.info(f"[Solver] Timetable successfully generated using OR-Tools!")
        result = {"timetables": {}}
        for section in sections_input:
            sec_id = str(section["section_id"])
            schedule_list = [None] * TOTAL_SLOTS
            allocs = section_allocations[sec_id]
            for a_idx, alloc in enumerate(allocs):
                for t in range(TOTAL_SLOTS):
                    if solver.Value(X[sec_id][a_idx][t]):
                        schedule_list[t] = {
                            "subject_code": alloc["subject_code"],
                            "subject_name": alloc["subject_name"],
                            "teacher_name": alloc["teacher_name"],
                        }
            
            schedule_dict = {}
            for d_idx, day_name in enumerate(DAYS):
                schedule_dict[day_name] = schedule_list[d_idx * PERIODS_PER_DAY : (d_idx + 1) * PERIODS_PER_DAY]
                
            result["timetables"][sec_id] = {
                "section_name": section["section_name"],
                "schedule": schedule_dict
            }
        return result
    else:
        logger.warning(f"[Solver] OR-Tools failed to find a valid solution.")
        raise TimetableGenerationError("Unable to find a conflict-free timetable satisfying all constraints within the time limit. Please check teacher loads and subject allocations.")
