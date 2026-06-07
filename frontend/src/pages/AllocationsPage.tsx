import { Pagination } from '../components/Pagination'
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Trash2, CalendarDays } from 'lucide-react'
import { allocationsApi, teachersApi, sectionsApi, subjectsApi, teacherClassMappingsApi } from '../services/api'
import type { TeacherAllocation } from '../types'
import { useSchool } from '../features/school/SchoolContext'
import {
  PageHeader, Card, Button, Badge, Select,
  Spinner, EmptyState, ErrorAlert, ConfirmDelete,
} from '../components/ui'

export default function AllocationsPage() {
  const qc = useQueryClient()
  const { activeSchoolId } = useSchool()
  const [modal, setModal] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<TeacherAllocation | null>(null)
  const [filterTeacher, setFilterTeacher] = useState<number | undefined>()
  const [filterSection, setFilterSection] = useState<number | undefined>()
  const [form, setForm] = useState({ teacher_id: '', section_id: '', subject_id: '' })
  const [apiError, setApiError] = useState('')

  // Derive the class_id of the currently selected section (for teacher-class mapping filter)
  const { data: sectionsData } = useQuery({
    queryKey: ['sections', activeSchoolId],
    queryFn: () => sectionsApi.list({ school_id: activeSchoolId ?? undefined, size: 1000 }),
    enabled: activeSchoolId !== null,
  })
  const sections = sectionsData?.items || []
  const selectedSection = form.section_id ? sections.find(s => s.id === Number(form.section_id)) : null
  const selectedClassId = selectedSection?.school_class_id ?? null

  // Teachers: if a section is selected, only show mapped teachers; otherwise show all school teachers
  const { data: allTeachersData } = useQuery({
    queryKey: ['teachers', activeSchoolId],
    queryFn: () => teachersApi.list(activeSchoolId ?? undefined, undefined, 1000),
    enabled: activeSchoolId !== null,
  })
  const allTeachers = allTeachersData?.items || []
  const { data: mappedTeachers } = useQuery({
    queryKey: ['teacher-class-mappings', 'teachers-for-class', selectedClassId],
    queryFn: () => teacherClassMappingsApi.teachersForClass(selectedClassId!),
    enabled: selectedClassId !== null,
  })
  const availableTeachers = selectedClassId ? (mappedTeachers || []) : allTeachers

  const [page, setPage] = useState(1)
  const { data: paginatedData, isLoading } = useQuery({ 
    queryKey: ['allocations', activeSchoolId, filterTeacher, filterSection, page],
    queryFn: () => allocationsApi.list({ school_id: activeSchoolId ?? undefined, teacher_id: filterTeacher, section_id: filterSection, page, size: 20 }),
    enabled: activeSchoolId !== null,
  })
  const allocs = paginatedData?.items || []
  const { data: subjectsData } = useQuery({ queryKey: ['subjects'], queryFn: () => subjectsApi.list(undefined, 1000) })
  const subjects = subjectsData?.items || []

  const invalidate = () => qc.invalidateQueries({ queryKey: ['allocations'] })

  const createMut = useMutation({
    mutationFn: allocationsApi.create,
    onSuccess: () => { invalidate(); setModal(false); setForm({ teacher_id: '', section_id: '', subject_id: '' }); setApiError('') },
    onError: (e: any) => setApiError(e.response?.data?.detail ?? 'Failed to create allocation'),
  })
  const deleteMut = useMutation({
    mutationFn: allocationsApi.delete,
    onSuccess: () => { invalidate(); setDeleteTarget(null) },
  })

  // Group by teacher name
  const grouped = allocs.reduce<Record<string, TeacherAllocation[]>>((acc, a) => {
    ;(acc[a.teacher.name] ??= []).push(a)
    return acc
  }, {})

  if (!activeSchoolId) return (
    <div className="flex items-center justify-center py-20 text-[var(--color-text-muted)] text-sm">
      Select a school from the sidebar to manage allocations.
    </div>
  )

  return (
    <div>
      <PageHeader
        title="Teacher Allocations"
        subtitle="Which teacher teaches which subject to which section — the source of truth for the solver"
        action={
          <div className="flex items-center gap-3 flex-wrap justify-end">
            <Select id="alloc-teacher-filter" value={filterTeacher ?? ''} onChange={e => setFilterTeacher(e.target.value ? Number(e.target.value) : undefined)} className="w-40">
              <option value="">All Teachers</option>
              {allTeachers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </Select>
            <Select id="alloc-section-filter" value={filterSection ?? ''} onChange={e => setFilterSection(e.target.value ? Number(e.target.value) : undefined)} className="w-40">
              <option value="">All Sections</option>
              {sections.map(s => <option key={s.id} value={s.id}>{s.school_class.name}{s.name}</option>)}
            </Select>
            <Button onClick={() => { setModal(true); setApiError('') }}><Plus size={16} />Add Allocation</Button>
          </div>
        }
      />

      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setModal(false)} />
          <Card className="relative w-full max-w-md p-6 shadow-2xl">
            <h2 className="text-base font-semibold text-[var(--color-text-primary)] mb-5">New Allocation</h2>
            {apiError && <div className="mb-4"><ErrorAlert message={apiError} /></div>}
            <form
              onSubmit={e => {
                e.preventDefault()
                createMut.mutate({
                  teacher_id: Number(form.teacher_id),
                  section_id: Number(form.section_id),
                  subject_id: Number(form.subject_id),
                })
              }}
              className="flex flex-col gap-4"
            >
              <Select id="alloc-teacher" label="Teacher" value={form.teacher_id} onChange={e => setForm(f => ({ ...f, teacher_id: e.target.value }))} required>
                <option value="">Select teacher…</option>
                {availableTeachers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </Select>
              {selectedClassId && availableTeachers.length === 0 && (
                <p className="text-xs text-amber-400">No teachers are mapped to this class yet. Go to Classes → Manage Teachers to add mappings.</p>
              )}
              <Select id="alloc-section" label="Section" value={form.section_id} onChange={e => setForm(f => ({ ...f, section_id: e.target.value }))} required>
                <option value="">Select section…</option>
                {sections.map(s => <option key={s.id} value={s.id}>{s.school_class.name}{s.name}</option>)}
              </Select>
              <Select id="alloc-subject" label="Subject" value={form.subject_id} onChange={e => setForm(f => ({ ...f, subject_id: e.target.value }))} required>
                <option value="">Select subject…</option>
                {subjects.map(s => <option key={s.id} value={s.id}>{s.code} — {s.name}</option>)}
              </Select>

              <div className="flex gap-3 pt-2">
                <Button type="submit" disabled={createMut.isPending}>{createMut.isPending && <Spinner size={14} />}Save</Button>
                <Button type="button" variant="ghost" onClick={() => setModal(false)}>Cancel</Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      <ConfirmDelete
        open={!!deleteTarget}
        name={deleteTarget ? `${deleteTarget.teacher.name} → ${deleteTarget.section.school_class.name}${deleteTarget.section.name} (${deleteTarget.subject.code})` : ''}
        onConfirm={() => deleteTarget && deleteMut.mutate(deleteTarget.id)}
        onCancel={() => setDeleteTarget(null)}
        loading={deleteMut.isPending}
      />

      {isLoading ? (
        <div className="flex justify-center py-20"><Spinner size={32} /></div>
      ) : allocs.length === 0 ? (
        <EmptyState icon={<CalendarDays size={24} />} message="No allocations yet." action={<Button onClick={() => setModal(true)}><Plus size={14} />Add Allocation</Button>} />
      ) : (
        <div className="flex flex-col gap-6">
          {Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b)).map(([teacherName, items]) => {
            const total = items.reduce((s, a) => s + a.periods_per_week, 0)
            return (
              <div key={teacherName}>
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[var(--color-brand-600)] to-[var(--color-brand-800)] flex items-center justify-center shrink-0">
                    <span className="text-xs font-bold text-white">{teacherName.charAt(0)}</span>
                  </div>
                  <h2 className="text-sm font-semibold text-[var(--color-text-secondary)]">{teacherName}</h2>
                  <div className="flex-1 h-px bg-[var(--color-surface-600)]" />
                  <Badge color="amber">{total} periods/week</Badge>
                </div>
                <Card>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-[var(--color-surface-600)]">
                        <th className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">Section</th>
                        <th className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">Subject</th>
                        <th className="text-right px-5 py-3 text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">Periods/Week</th>
                        <th className="px-5 py-3 w-10" />
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((a, i) => (
                        <tr key={a.id} className={`border-b border-[var(--color-surface-600)]/60 hover:bg-[var(--color-surface-700)]/40 transition-colors ${i === items.length - 1 ? 'border-b-0' : ''}`}>
                          <td className="px-5 py-3">
                            <Badge color="blue">{a.section.school_class.name}{a.section.name}</Badge>
                          </td>
                          <td className="px-5 py-3">
                            <div className="flex items-center gap-2">
                              <Badge color="violet">{a.subject.code}</Badge>
                              <span className="text-[var(--color-text-secondary)]">{a.subject.name}</span>
                            </div>
                          </td>
                          <td className="px-5 py-3 text-right font-semibold text-[var(--color-text-primary)]">{a.periods_per_week}</td>
                          <td className="px-5 py-3">
                            <button id={`delete-alloc-${a.id}`} onClick={() => setDeleteTarget(a)} className="p-1.5 rounded-lg text-[var(--color-text-muted)] hover:text-red-400 hover:bg-red-900/20 transition-colors">
                              <Trash2 size={14} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </Card>
              </div>
            )
          })}
        </div>
      )}
      <Pagination currentPage={paginatedData?.page || 1} totalPages={paginatedData?.pages || 1} onPageChange={setPage} />
    </div>
  )
}
