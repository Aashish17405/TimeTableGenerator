import api from '../lib/api'
import type {
  PaginatedResponse,
  School, SchoolCreate, SchoolUpdate, SchoolStats,
  Subject, SubjectCreate, SubjectUpdate,
  SchoolClass, SchoolClassCreate, SchoolClassUpdate,
  Section, SectionCreate, SectionUpdate,
  Teacher, TeacherCreate, TeacherUpdate,
  TeacherClassMapping, TeacherClassMappingCreate,
  SubjectRequirement, SubjectRequirementCreate, SubjectRequirementUpdate,
  ClassRequirementSummary,
  TeacherAllocation, TeacherAllocationCreate, TeacherAllocationUpdate,
  StoredTimetableResponse, TimetableGenerateResponse,
} from '../types'

// ─── Schools ──────────────────────────────────────────────────────────────────
export const schoolsApi = {
  list: (page = 1, size = 20) => api.get<PaginatedResponse<School>>('/schools/', { params: { page, size } }).then(r => r.data),
  get: (id: number) => api.get<School>(`/schools/${id}`).then(r => r.data),
  create: (data: SchoolCreate) => api.post<School>('/schools/', data).then(r => r.data),
  update: (id: number, data: SchoolUpdate) => api.put<School>(`/schools/${id}`, data).then(r => r.data),
  delete: (id: number) => api.delete(`/schools/${id}`),
  stats: (id: number) => api.get<SchoolStats>(`/schools/${id}/stats`).then(r => r.data),
}

// ─── Subjects ─────────────────────────────────────────────────────────────────
export const subjectsApi = {
  list: (page = 1, size = 20) => api.get<PaginatedResponse<Subject>>('/subjects/', { params: { page, size } }).then(r => r.data),
  get: (id: number) => api.get<Subject>(`/subjects/${id}`).then(r => r.data),
  create: (data: SubjectCreate) => api.post<Subject>('/subjects/', data).then(r => r.data),
  update: (id: number, data: SubjectUpdate) => api.put<Subject>(`/subjects/${id}`, data).then(r => r.data),
  delete: (id: number) => api.delete(`/subjects/${id}`),
}

// ─── School Classes ────────────────────────────────────────────────────────────
export const classesApi = {
  list: (schoolId?: number, page = 1, size = 20) => api.get<PaginatedResponse<SchoolClass>>('/classes/', { params: { ...(schoolId ? { school_id: schoolId } : {}), page, size } }).then(r => r.data),
  get: (id: number) => api.get<SchoolClass>(`/classes/${id}`).then(r => r.data),
  create: (data: SchoolClassCreate) => api.post<SchoolClass>('/classes/', data).then(r => r.data),
  update: (id: number, data: SchoolClassUpdate) => api.put<SchoolClass>(`/classes/${id}`, data).then(r => r.data),
  delete: (id: number) => api.delete(`/classes/${id}`),
}

// ─── Sections ─────────────────────────────────────────────────────────────────
export const sectionsApi = {
  list: (params?: { class_id?: number; school_id?: number ; page?: number; size?: number}) =>
    api.get<PaginatedResponse<Section>>('/sections/', { params: { page: 1, size: 20, ...params } }).then(r => r.data),
  get: (id: number) => api.get<Section>(`/sections/${id}`).then(r => r.data),
  create: (data: SectionCreate) => api.post<Section>('/sections/', data).then(r => r.data),
  update: (id: number, data: SectionUpdate) => api.put<Section>(`/sections/${id}`, data).then(r => r.data),
  delete: (id: number) => api.delete(`/sections/${id}`),
}

// ─── Teachers ─────────────────────────────────────────────────────────────────
export const teachersApi = {
  list: (schoolId?: number, page = 1, size = 20) => api.get<PaginatedResponse<Teacher>>('/teachers/', { params: { ...(schoolId ? { school_id: schoolId } : {}), page, size } }).then(r => r.data),
  get: (id: number) => api.get<Teacher>(`/teachers/${id}`).then(r => r.data),
  create: (data: TeacherCreate) => api.post<Teacher>('/teachers/', data).then(r => r.data),
  update: (id: number, data: TeacherUpdate) => api.put<Teacher>(`/teachers/${id}`, data).then(r => r.data),
  delete: (id: number) => api.delete(`/teachers/${id}`),
}

// ─── Teacher-Class Mappings ───────────────────────────────────────────────────
export const teacherClassMappingsApi = {
  list: (params?: { teacher_id?: number; class_id?: number ; page?: number; size?: number}) =>
    api.get<PaginatedResponse<TeacherClassMapping>>('/teacher-class-mappings/', { params: { page: 1, size: 20, ...params } }).then(r => r.data),
  create: (data: TeacherClassMappingCreate) =>
    api.post<TeacherClassMapping>('/teacher-class-mappings/', data).then(r => r.data),
  delete: (id: number) => api.delete(`/teacher-class-mappings/${id}`),
  teachersForClass: (classId: number) =>
    api.get<Teacher[]>(`/teacher-class-mappings/teachers-for-class/${classId}`).then(r => r.data),
}

// ─── Subject Requirements ──────────────────────────────────────────────────────
export const requirementsApi = {
  list: (params?: { class_id?: number; school_id?: number ; page?: number; size?: number}) =>
    api.get<PaginatedResponse<SubjectRequirement>>('/subject-requirements/', { params: { page: 1, size: 20, ...params } }).then(r => r.data),
  summary: (classId: number) => api.get<ClassRequirementSummary>(`/subject-requirements/summary/${classId}`).then(r => r.data),
  create: (data: SubjectRequirementCreate) => api.post<SubjectRequirement>('/subject-requirements/', data).then(r => r.data),
  update: (id: number, data: SubjectRequirementUpdate) => api.put<SubjectRequirement>(`/subject-requirements/${id}`, data).then(r => r.data),
  delete: (id: number) => api.delete(`/subject-requirements/${id}`),
}

// ─── Teacher Allocations ───────────────────────────────────────────────────────
export const allocationsApi = {
  list: (params?: { teacher_id?: number; section_id?: number; school_id?: number ; page?: number; size?: number}) =>
    api.get<PaginatedResponse<TeacherAllocation>>('/teacher-allocations/', { params: { page: 1, size: 20, ...params } }).then(r => r.data),
  create: (data: TeacherAllocationCreate) => api.post<TeacherAllocation>('/teacher-allocations/', data).then(r => r.data),
  update: (id: number, data: TeacherAllocationUpdate) => api.put<TeacherAllocation>(`/teacher-allocations/${id}`, data).then(r => r.data),
  delete: (id: number) => api.delete(`/teacher-allocations/${id}`),
}

// ─── Timetable ─────────────────────────────────────────────────────────────────
export const timetableApi = {
  generateAll: (schoolId: number) =>
    api.post<TimetableGenerateResponse>('/timetable/generate-all', { school_id: schoolId }).then(r => r.data),
  regenerateClass: (schoolId: number, classId: number) =>
    api.post<TimetableGenerateResponse>('/timetable/regenerate-class', { school_id: schoolId, class_id: classId }).then(r => r.data),
  getStored: (schoolId: number) =>
    api.get<StoredTimetableResponse>(`/timetable/stored/${schoolId}`).then(r => r.data),
  deleteStored: (schoolId: number) =>
    api.delete(`/timetable/stored/${schoolId}`).then(r => r.data),
}

export const aiTimetableApi = {
  generate: (payload: { class_ids: number[], school_id?: number }) =>
    api.post<{ timetables: any, agent_logs: string[], error?: string }>('/ai-timetable/generate', payload).then(r => r.data),
}
