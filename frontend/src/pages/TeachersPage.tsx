import { Pagination } from '../components/Pagination'
import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Pencil, Trash2, Users, Mail, GraduationCap, X, CalendarDays } from 'lucide-react'
import { teachersApi, classesApi, teacherClassMappingsApi, timetableApi } from '../services/api'
import type { Teacher } from '../types'
import { useSchool } from '../features/school/SchoolContext'
import {
  PageHeader, Card, Button, Input, Badge,
  Spinner, EmptyState, ErrorAlert, ConfirmDelete,
} from '../components/ui'

function TeacherForm({ initial, schoolId, onSubmit, onCancel, loading }: {
  initial?: Partial<Teacher>
  schoolId: number
  onSubmit: (d: { name: string; email?: string; school_id: number }) => void
  onCancel: () => void
  loading: boolean
}) {
  const [name, setName] = useState(initial?.name ?? '')
  const [email, setEmail] = useState(initial?.email ?? '')
  return (
    <form onSubmit={e => { e.preventDefault(); onSubmit({ name: name.trim(), email: email.trim() || undefined, school_id: schoolId }) }} className="flex flex-col gap-4">
      <Input id="teacher-name" label="Name" placeholder="e.g. Archana" value={name} onChange={e => setName(e.target.value)} required maxLength={100} />
      <Input id="teacher-email" label="Email (optional)" type="email" placeholder="e.g. archana@school.edu" value={email} onChange={e => setEmail(e.target.value)} maxLength={200} />
      <div className="flex gap-3 pt-2">
        <Button type="submit" disabled={loading}>{loading && <Spinner size={14} />}Save</Button>
        <Button type="button" variant="ghost" onClick={onCancel}>Cancel</Button>
      </div>
    </form>
  )
}

function ClassMappingModal({ teacher, schoolId, onClose }: {
  teacher: Teacher
  schoolId: number
  onClose: () => void
}) {
  const qc = useQueryClient()
  const [apiError, setApiError] = useState('')

  const { data: classesData } = useQuery({
    queryKey: ['classes', schoolId],
    queryFn: () => classesApi.list(schoolId, undefined, 1000),
  })
  const allClasses = classesData?.items || []

  const { data: paginatedData, isLoading: mappingsLoading } = useQuery({
    queryKey: ['teacher-class-mappings', 'teacher', teacher.id],
    queryFn: () => teacherClassMappingsApi.list({ teacher_id: teacher.id, size: 1000 }),
  })
  const mappings = paginatedData?.items || []
  const mappedClassIds = new Set(mappings.map(m => m.class_id))

  const addMut = useMutation({
    mutationFn: teacherClassMappingsApi.create,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['teacher-class-mappings', 'teacher', teacher.id] })
      setApiError('')
    },
    onError: (e: any) => setApiError(e.response?.data?.detail ?? 'Failed to add mapping'),
  })

  const removeMut = useMutation({
    mutationFn: teacherClassMappingsApi.delete,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['teacher-class-mappings', 'teacher', teacher.id] })
    },
  })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <Card className="relative w-full max-w-md p-6 shadow-2xl max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-base font-semibold text-[var(--color-text-primary)]">
              Class Assignments — {teacher.name}
            </h2>
            <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
              Map this teacher to classes they can teach.
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-600)]">
            <X size={18} />
          </button>
        </div>

        {apiError && <div className="mb-3"><ErrorAlert message={apiError} /></div>}

        {mappingsLoading ? (
          <div className="flex justify-center py-6"><Spinner size={24} /></div>
        ) : (
          <div className="flex-1 overflow-y-auto space-y-2 min-h-0">
            {allClasses.length === 0 ? (
              <p className="text-xs text-[var(--color-text-muted)] text-center py-6">
                No classes in this school yet.
              </p>
            ) : (
              allClasses.map(cls => {
                const isMapped = mappedClassIds.has(cls.id)
                const mapping = mappings.find(m => m.class_id === cls.id)
                return (
                  <div
                    key={cls.id}
                    className={`flex items-center gap-3 rounded-lg border px-4 py-3 transition-all ${
                      isMapped
                        ? 'border-[var(--mapped-border)] bg-[var(--mapped-bg)]'
                        : 'border-[var(--unmapped-border)] bg-[var(--unmapped-bg)]'
                    }`}
                  >
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 font-bold text-base ${isMapped ? 'bg-[var(--mapped-icon-bg)] text-[var(--mapped-icon-text)]' : 'bg-[var(--unmapped-icon-bg)] text-[var(--unmapped-icon-text)]'}`}>
                      {cls.name}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-[var(--color-text-primary)]">Class {cls.name}</p>
                      <p className="text-xs text-[var(--color-text-muted)]">Order #{cls.display_order}</p>
                    </div>
                    {isMapped ? (
                      <button
                        onClick={() => mapping && removeMut.mutate(mapping.id)}
                        disabled={removeMut.isPending}
                        className="px-3 py-1.5 text-xs font-medium rounded-lg border border-[var(--remove-btn-border)] text-[var(--remove-btn-text)] bg-[var(--remove-btn-bg)] hover:bg-[var(--remove-btn-bg-hover)] transition-colors"
                      >
                        Remove
                      </button>
                    ) : (
                      <button
                        onClick={() => addMut.mutate({ teacher_id: teacher.id, class_id: cls.id })}
                        disabled={addMut.isPending}
                        className="px-3 py-1.5 text-xs font-medium rounded-lg border border-[var(--assign-btn-border)] text-[var(--assign-btn-text)] bg-[var(--assign-btn-bg)] hover:bg-[var(--assign-btn-bg-hover)] transition-colors"
                      >
                        Assign
                      </button>
                    )}
                  </div>
                )
              })
            )}
          </div>
        )}
      </Card>
    </div>
  )
}

function TeacherTimetableModal({ teacher, schedule, onClose }: {
  teacher: Teacher
  schedule: Record<string, Array<{ subject_code: string; class_section: string } | null>>
  onClose: () => void
}) {
  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  const rows = [
    { type: 'period', index: 0, label: 'Period 1', time: '09:00 - 09:40' },
    { type: 'period', index: 1, label: 'Period 2', time: '09:40 - 10:20' },
    { type: 'break', label: 'SHORT BREAK', time: '10:20 - 10:35' },
    { type: 'period', index: 2, label: 'Period 3', time: '10:35 - 11:15' },
    { type: 'period', index: 3, label: 'Period 4', time: '11:15 - 11:55' },
    { type: 'period', index: 4, label: 'Period 5', time: '11:55 - 12:35' },
    { type: 'lunch', label: 'LUNCH BREAK', time: '12:35 - 01:20' },
    { type: 'period', index: 5, label: 'Period 6', time: '01:20 - 02:00' },
    { type: 'period', index: 6, label: 'Period 7', time: '02:00 - 02:40' },
    { type: 'break', label: 'SHORT BREAK', time: '02:40 - 02:55' },
    { type: 'period', index: 7, label: 'Period 8', time: '02:55 - 03:35' },
    { type: 'period', index: 8, label: 'Period 9', time: '03:35 - 04:15' },
  ]

  const getSubjectColor = (code: string) => {
    const normalizedCode = code.toUpperCase().trim()
    if (normalizedCode === 'MATH') return 'bg-[var(--color-subj-math-bg)] text-[var(--color-subj-math-text)] border-[var(--color-subj-math-border)]'
    if (normalizedCode === 'FL') return 'bg-[var(--color-subj-fl-bg)] text-[var(--color-subj-fl-text)] border-[var(--color-subj-fl-border)]'
    if (normalizedCode === 'SL') return 'bg-[var(--color-subj-sl-bg)] text-[var(--color-subj-sl-text)] border-[var(--color-subj-sl-border)]'
    if (normalizedCode === 'ENG') return 'bg-[var(--color-subj-eng-bg)] text-[var(--color-subj-eng-text)] border-[var(--color-subj-eng-border)]'
    if (normalizedCode === 'PET') return 'bg-[var(--color-subj-pet-bg)] text-[var(--color-subj-pet-text)] border-[var(--color-subj-pet-border)]'
    if (normalizedCode === 'HW') return 'bg-[var(--color-subj-hw-bg)] text-[var(--color-subj-hw-text)] border-[var(--color-subj-hw-border)]'
    return 'bg-[var(--color-surface-700)] text-[var(--color-text-secondary)] border-[var(--color-surface-600)]'
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <Card className="relative w-full max-w-6xl p-6 shadow-2xl max-h-[90vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between mb-5 shrink-0">
          <div>
            <h2 className="text-lg font-bold text-[var(--color-text-primary)]">
              Teacher Timetable — {teacher.name}
            </h2>
            <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
              Weekly schedule view mapping days, periods, and assigned classes.
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-600)]">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-auto rounded-xl border border-[var(--color-surface-600)] shadow-md min-h-0 bg-[var(--color-surface-800)]">
          <table className="min-w-[1000px] w-full border-collapse text-xs">
            <thead>
              <tr className="border-b border-[var(--color-surface-600)] bg-[var(--color-surface-700)] text-[var(--color-text-secondary)]">
                <th className="w-28 border-r border-[var(--color-surface-600)] px-4 py-3 text-left font-semibold sticky left-0 bg-[var(--color-surface-700)] z-20 shadow-[2px_0_5px_rgba(0,0,0,0.1)]">
                  Day / Period
                </th>
                {rows.map((row, idx) => (
                  <th key={idx} className="px-4 py-3 text-center font-semibold min-w-[120px]">
                    <div className="font-semibold text-[var(--color-text-primary)]">{row.label}</div>
                    <div className="mt-0.5 text-[10px] text-[var(--color-text-muted)]">{row.time}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-surface-600)]">
              {days.map((day) => (
                <tr key={day} className="transition-colors hover:bg-[var(--color-surface-900)]/30">
                  <td className="border-r border-[var(--color-surface-600)] bg-[var(--color-surface-700)] px-4 py-3 text-left font-semibold text-[var(--color-text-primary)] sticky left-0 z-10 shadow-[2px_0_5px_rgba(0,0,0,0.1)]">
                    {day}
                  </td>
                  {rows.map((row, idx) => {
                    if (row.type === 'break' || row.type === 'lunch') {
                      return (
                        <td
                          key={`divider-${idx}`}
                          className="bg-[var(--color-surface-900)]/45 text-center font-bold text-[var(--color-brand-300)]/90 select-none align-middle px-2 py-3 text-[10px] tracking-wider border-l border-r border-[var(--color-surface-600)]/30 min-w-[100px]"
                        >
                          {row.type === 'lunch' ? 'LUNCH' : 'BREAK'}
                        </td>
                      )
                    }

                    const periodIndex = row.index!
                    const period = schedule[day]?.[periodIndex]
                    return (
                      <td key={`period-${idx}`} className="p-1.5 text-center align-middle min-w-[120px]">
                        {period ? (
                          <div
                            className={`flex flex-col items-center justify-center gap-0.5 rounded-lg border p-2 shadow-sm ${getSubjectColor(
                              period.subject_code
                            )}`}
                          >
                            <span className="text-xs font-bold leading-tight tracking-wide">
                              {period.subject_code}
                            </span>
                            <span className="max-w-full truncate text-[9px] font-medium leading-tight opacity-75">
                              {period.class_section}
                            </span>
                          </div>
                        ) : (
                          <div className="rounded-lg border border-dashed border-[var(--color-surface-600)] bg-[var(--color-surface-700)]/10 p-2 text-[var(--color-text-muted)]">
                            -
                          </div>
                        )}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}

export default function TeachersPage() {
  const qc = useQueryClient()
  const { activeSchoolId, activeSchool } = useSchool()
  const [modal, setModal] = useState(false)
  const [editItem, setEditItem] = useState<Teacher | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Teacher | null>(null)
  const [mappingTarget, setMappingTarget] = useState<Teacher | null>(null)
  const [timetableTarget, setTimetableTarget] = useState<Teacher | null>(null)
  const [apiError, setApiError] = useState('')

  const [page, setPage] = useState(1)
  const { data: paginatedData, isLoading, error } = useQuery({ 
    queryKey: ['teachers', activeSchoolId, page],
    queryFn: () => teachersApi.list(activeSchoolId ?? undefined, page, 20),
    enabled: activeSchoolId !== null, 
  })
  const teachers = paginatedData?.items || []
  const invalidate = () => qc.invalidateQueries({ queryKey: ['teachers', activeSchoolId] })

  // Query for stored timetables to count periods and view schedule
  const { data: storedData } = useQuery({
    queryKey: ['stored-timetable', activeSchoolId],
    queryFn: () => timetableApi.getStored(activeSchoolId!),
    enabled: activeSchoolId !== null,
  })

  const teacherPeriodCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    if (storedData?.timetables) {
      Object.values(storedData.timetables).forEach((tt: any) => {
        if (tt.schedule) {
          Object.values(tt.schedule).forEach((periods: any) => {
            if (Array.isArray(periods)) {
              periods.forEach((period: any) => {
                if (period && period.subject_code !== '-' && period.teacher_name !== '-') {
                  const name = period.teacher_name
                  counts[name] = (counts[name] || 0) + 1
                }
              })
            }
          })
        }
      })
    }
    return counts
  }, [storedData])

  const getTeacherSchedule = (teacherName: string) => {
    const schedule: Record<string, Array<{ subject_code: string; class_section: string } | null>> = {
      Monday: Array(9).fill(null),
      Tuesday: Array(9).fill(null),
      Wednesday: Array(9).fill(null),
      Thursday: Array(9).fill(null),
      Friday: Array(9).fill(null),
      Saturday: Array(9).fill(null),
    }

    if (storedData?.timetables) {
      Object.values(storedData.timetables).forEach((tt: any) => {
        const classSectionName = `${tt.class_name}-${tt.section_name}`
        if (tt.schedule) {
          Object.entries(tt.schedule).forEach(([day, periods]: [string, any]) => {
            if (Array.isArray(periods)) {
              periods.forEach((period: any, idx: number) => {
                if (period && period.teacher_name === teacherName && period.subject_code !== '-') {
                  schedule[day][idx] = {
                    subject_code: period.subject_code,
                    class_section: classSectionName,
                  }
                }
              })
            }
          })
        }
      })
    }
    return schedule
  }

  const createMut = useMutation({
    mutationFn: teachersApi.create,
    onSuccess: () => { invalidate(); setModal(false); setApiError('') },
    onError: (e: any) => setApiError(e.response?.data?.detail ?? 'Failed to create'),
  })
  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => teachersApi.update(id, data),
    onSuccess: () => { invalidate(); setEditItem(null); setApiError('') },
    onError: (e: any) => setApiError(e.response?.data?.detail ?? 'Failed to update'),
  })
  const deleteMut = useMutation({
    mutationFn: teachersApi.delete,
    onSuccess: () => { invalidate(); setDeleteTarget(null) },
  })

  if (!activeSchoolId) return (
    <div className="flex items-center justify-center py-20 text-[var(--color-text-muted)] text-sm">
      Select a school from the sidebar to manage teachers.
    </div>
  )

  if (isLoading) return <div className="flex justify-center py-20"><Spinner size={32} /></div>
  if (error) return <ErrorAlert message="Failed to load teachers." />

  return (
    <div>
      <PageHeader
        title="Teachers"
        subtitle={`${teachers.length} teacher${teachers.length !== 1 ? 's' : ''} in ${activeSchool?.name ?? 'this school'}`}
        action={<Button onClick={() => { setModal(true); setApiError('') }}><Plus size={16} />Add Teacher</Button>}
      />

      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setModal(false)} />
          <Card className="relative w-full max-w-md p-6 shadow-2xl">
            <h2 className="text-base font-semibold text-[var(--color-text-primary)] mb-5">New Teacher</h2>
            {apiError && <div className="mb-4"><ErrorAlert message={apiError} /></div>}
            <TeacherForm schoolId={activeSchoolId} onSubmit={d => createMut.mutate(d)} onCancel={() => setModal(false)} loading={createMut.isPending} />
          </Card>
        </div>
      )}

      {editItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setEditItem(null)} />
          <Card className="relative w-full max-w-md p-6 shadow-2xl">
            <h2 className="text-base font-semibold text-[var(--color-text-primary)] mb-5">Edit Teacher</h2>
            {apiError && <div className="mb-4"><ErrorAlert message={apiError} /></div>}
            <TeacherForm schoolId={activeSchoolId} initial={editItem} onSubmit={d => updateMut.mutate({ id: editItem.id, data: d })} onCancel={() => setEditItem(null)} loading={updateMut.isPending} />
          </Card>
        </div>
      )}

      {mappingTarget && (
        <ClassMappingModal
          teacher={mappingTarget}
          schoolId={activeSchoolId}
          onClose={() => setMappingTarget(null)}
        />
      )}

      {timetableTarget && (
        <TeacherTimetableModal
          teacher={timetableTarget}
          schedule={getTeacherSchedule(timetableTarget.name)}
          onClose={() => setTimetableTarget(null)}
        />
      )}

      <ConfirmDelete open={!!deleteTarget} name={deleteTarget?.name ?? ''} onConfirm={() => deleteTarget && deleteMut.mutate(deleteTarget.id)} onCancel={() => setDeleteTarget(null)} loading={deleteMut.isPending} />

      {teachers.length === 0 ? (
        <EmptyState icon={<Users size={24} />} message="No teachers yet." action={<Button onClick={() => setModal(true)}><Plus size={14} />Add Teacher</Button>} />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {teachers.map(t => {
            const count = teacherPeriodCounts[t.name] || 0
            return (
              <Card key={t.id} className="p-5 hover:border-[var(--color-surface-500)] transition-colors group flex flex-col justify-between">
                <div>
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[var(--color-brand-600)] to-[var(--color-brand-800)] flex items-center justify-center shrink-0">
                      <span className="text-sm font-bold text-white">{t.name.charAt(0).toUpperCase()}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-[var(--color-text-primary)] truncate">{t.name}</p>
                      {t.email ? (
                        <p className="text-xs text-[var(--color-text-muted)] flex items-center gap-1 mt-0.5 truncate">
                          <Mail size={11} />{t.email}
                        </p>
                      ) : (
                        <p className="text-xs text-[var(--color-text-muted)] mt-0.5">No email</p>
                      )}
                    </div>
                    <div className="flex gap-1 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity shrink-0">
                      <button id={`edit-teacher-${t.id}`} onClick={() => { setEditItem(t); setApiError('') }} className="p-1.5 rounded-lg text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-600)] transition-colors">
                        <Pencil size={14} />
                      </button>
                      <button id={`delete-teacher-${t.id}`} onClick={() => setDeleteTarget(t)} className="p-1.5 rounded-lg text-[var(--color-text-muted)] hover:text-[var(--hover-delete-text)] hover:bg-[var(--hover-delete-bg)] transition-colors">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                  <div className="mt-3 text-xs text-[var(--color-text-secondary)]">
                    Workload: <Badge color={count > 0 ? "green" : "default"}>{count} periods / week</Badge>
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-between border-t border-[var(--color-surface-600)] pt-3 shrink-0">
                  <button
                    id={`assign-classes-${t.id}`}
                    onClick={() => setMappingTarget(t)}
                    className="flex items-center gap-1.5 text-[10px] font-semibold text-[var(--color-brand-400)] hover:text-[var(--color-brand-300)] transition-colors cursor-pointer"
                  >
                    <GraduationCap size={12} />
                    Assign Classes
                  </button>
                  <button
                    id={`view-timetable-${t.id}`}
                    onClick={() => setTimetableTarget(t)}
                    className="flex items-center gap-1.5 text-[10px] font-semibold text-[var(--color-brand-400)] hover:text-[var(--color-brand-300)] transition-colors cursor-pointer"
                  >
                    <CalendarDays size={12} />
                    View Timetable
                  </button>
                </div>
              </Card>
            )
          })}
        </div>
      )}
      <Pagination currentPage={paginatedData?.page || 1} totalPages={paginatedData?.pages || 1} onPageChange={setPage} />
    </div>
  )
}
