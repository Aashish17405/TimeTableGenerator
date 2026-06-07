// ─── Pagination ─────────────────────────────────────────────────────────────────
export interface PaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  size: number
  pages: number
}

// ─── Subjects ────────────────────────────────────────────────────────────────
export interface Subject {
  id: number
  code: string
  name: string
}
export interface SubjectCreate { code: string; name: string }
export interface SubjectUpdate { code?: string; name?: string }

// ─── Schools ─────────────────────────────────────────────────────────────────
export interface School {
  id: number
  name: string
  address: string | null
}
export interface SchoolCreate { name: string; address?: string }
export interface SchoolUpdate { name?: string; address?: string }
export interface SchoolStats {
  school_id: number
  classes_count: number
  sections_count: number
  teachers_count: number
  requirements_count: number
  allocations_count: number
}

// ─── School Classes ───────────────────────────────────────────────────────────
export interface SchoolClass {
  id: number
  name: string
  display_order: number
  school_id: number
}
export interface SchoolClassCreate { name: string; display_order: number; school_id: number }
export interface SchoolClassUpdate { name?: string; display_order?: number }

// ─── Sections ─────────────────────────────────────────────────────────────────
export interface Section {
  id: number
  school_class_id: number
  name: string
  school_class: SchoolClass
}
export interface SectionCreate { school_class_id: number; name: string }
export interface SectionUpdate { name?: string }

// ─── Teachers ─────────────────────────────────────────────────────────────────
export interface Teacher {
  id: number
  name: string
  email: string | null
  school_id: number
}
export interface TeacherCreate { name: string; email?: string; school_id: number }
export interface TeacherUpdate { name?: string; email?: string }

// ─── Teacher-Class Mappings ───────────────────────────────────────────────────
export interface TeacherClassMapping {
  id: number
  teacher_id: number
  class_id: number
}
export interface TeacherClassMappingCreate { teacher_id: number; class_id: number }

// ─── Subject Requirements ─────────────────────────────────────────────────────
export interface SubjectRequirement {
  id: number
  school_class_id: number
  subject_id: number
  periods_per_week: number
  school_class: SchoolClass
  subject: Subject
}
export interface SubjectRequirementCreate {
  school_class_id: number
  subject_id: number
  periods_per_week: number
}
export interface SubjectRequirementUpdate { periods_per_week?: number }

export interface ClassRequirementSummary {
  school_class_id: number
  total_periods: number
  remaining_periods: number
  requirements: SubjectRequirement[]
}

// ─── Teacher Allocations ──────────────────────────────────────────────────────
export interface TeacherAllocation {
  id: number
  teacher_id: number
  section_id: number
  subject_id: number
  periods_per_week: number
  teacher: Teacher
  section: Section
  subject: Subject
}
export interface TeacherAllocationCreate {
  teacher_id: number
  section_id: number
  subject_id: number
  periods_per_week: number
}
export interface TeacherAllocationUpdate { periods_per_week?: number }

// ─── Timetable Generation ──────────────────────────────────────────────────────
export interface TimetablePeriod {
  subject_code: string
  teacher_name: string
}

export interface SectionTimetable {
  section_name: string
  schedule: {
    [day: string]: TimetablePeriod[]
  }
}

export interface TimetableGenerateResponse {
  timetables: {
    [sectionId: string]: SectionTimetable
  }
}

export interface TimetableGenerateRequest {
  section_ids?: number[]
  class_ids?: number[]
}
