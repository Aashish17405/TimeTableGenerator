import { useState, useMemo, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Trash2, CalendarDays, ChevronRight, CheckSquare, Square } from 'lucide-react'
import { allocationsApi, teachersApi, sectionsApi, subjectsApi, teacherClassMappingsApi, requirementsApi } from '../services/api'
import type { TeacherAllocation, SchoolClass, Subject } from '../types'
import { useSchool } from '../features/school/SchoolContext'
import {
  PageHeader, Card, Button, Badge, Select,
  Spinner, EmptyState, ErrorAlert, ConfirmDelete,
} from '../components/ui'

// ─── Types ────────────────────────────────────────────────────────────────────
/** One row in the modal: a class the teacher is mapped to, with multi-subject selection */
interface ClassRow {
  classId: number
  className: string
  selected: boolean
  /** All subject IDs the teacher will teach to this class (multi-select) */
  subjectIds: Set<number>
}

// ─── Step indicator ───────────────────────────────────────────────────────────
function StepDot({ n, active, done }: { n: number; active: boolean; done: boolean }) {
  const bg = done
    ? 'bg-[var(--color-brand-600)]'
    : active
    ? 'bg-[var(--color-brand-600)]'
    : 'bg-[var(--color-surface-600)]'
  const text = done || active ? 'text-white' : 'text-[var(--color-text-muted)]'
  return (
    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 transition-colors ${bg} ${text}`}>
      {done ? '✓' : n}
    </div>
  )
}

// ─── Subject checkbox row inside a class card ─────────────────────────────────
function SubjectCheckbox({
  subject,
  checked,
  onToggle,
}: {
  subject: Subject
  checked: boolean
  onToggle: () => void
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`flex items-center gap-2.5 w-full text-left px-3 py-2 rounded-lg transition-colors ${
        checked
          ? 'bg-[var(--color-brand-600)]/10 border border-[var(--color-brand-600)]/30'
          : 'hover:bg-[var(--color-surface-600)]/50 border border-transparent'
      }`}
    >
      {checked
        ? <CheckSquare size={14} className="text-[var(--color-brand-500)] shrink-0" />
        : <Square size={14} className="text-[var(--color-text-muted)] shrink-0" />
      }
      <span className="text-xs font-medium text-[var(--color-text-muted)] bg-[var(--color-surface-600)] px-1.5 py-0.5 rounded">
        {subject.code}
      </span>
      <span className={`text-sm flex-1 ${checked ? 'text-[var(--color-text-primary)]' : 'text-[var(--color-text-secondary)]'}`}>
        {subject.name}
      </span>
    </button>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function AllocationsPage() {
  const qc = useQueryClient()
  const { activeSchoolId } = useSchool()

  // ── List-page state ──────────────────────────────────────────────────────────
  const [modal, setModal] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<TeacherAllocation | null>(null)
  const [filterTeacher, setFilterTeacher] = useState<number | undefined>()
  const [filterSection, setFilterSection] = useState<number | undefined>()

  // ── Modal state (step 1: teacher, step 2: classes + multi-subjects) ──────────
  const [step, setStep] = useState<1 | 2>(1)
  const [selectedTeacherId, setSelectedTeacherId] = useState('')
  const [classRows, setClassRows] = useState<ClassRow[]>([])
  const [apiError, setApiError] = useState('')

  // ── Data fetches ─────────────────────────────────────────────────────────────
  const { data: allTeachersData } = useQuery({
    queryKey: ['teachers', activeSchoolId],
    queryFn: () => teachersApi.list(activeSchoolId ?? undefined, undefined, 1000),
    enabled: activeSchoolId !== null,
  })
  const allTeachers = allTeachersData?.items || []

  const { data: sectionsData } = useQuery({
    queryKey: ['sections', activeSchoolId],
    queryFn: () => sectionsApi.list({ school_id: activeSchoolId ?? undefined, size: 1000 }),
    enabled: activeSchoolId !== null,
  })
  const sections = sectionsData?.items || []

  const { data: paginatedData, isLoading } = useQuery({
    queryKey: ['allocations', activeSchoolId, filterTeacher, filterSection],
    queryFn: () =>
      allocationsApi.list({
        school_id: activeSchoolId ?? undefined,
        teacher_id: filterTeacher,
        section_id: filterSection,
        size: 1000,
      }),
    enabled: activeSchoolId !== null,
  })
  const allocs = paginatedData?.items || []

  const { data: subjectsData } = useQuery({
    queryKey: ['subjects'],
    queryFn: () => subjectsApi.list(undefined, 1000),
  })
  const subjects = subjectsData?.items || []

  // Fetch the classes this teacher is mapped to (used in step 2)
  const { data: teacherClasses, isLoading: classesLoading } = useQuery({
    queryKey: ['teacher-classes', selectedTeacherId],
    queryFn: () => teacherClassMappingsApi.classesForTeacher(Number(selectedTeacherId)),
    enabled: !!selectedTeacherId,
  })

  // Batch-fetch per-class subject requirements once class rows are set
  const classIds = classRows.map(r => r.classId)
  const { data: reqData } = useQuery({
    queryKey: ['class-requirements-batch', classIds],
    queryFn: async () => {
      const results = await Promise.all(classIds.map(id => requirementsApi.summary(id)))
      const map: Record<number, number[]> = {}
      classIds.forEach((id, i) => {
        map[id] = results[i].requirements.map(r => r.subject_id)
      })
      return map
    },
    enabled: classIds.length > 0,
  })
  const subjectsForClass: Record<number, number[]> = reqData ?? {}

  // ── Mutations ────────────────────────────────────────────────────────────────
  const invalidate = () => qc.invalidateQueries({ queryKey: ['allocations'] })

  const createMut = useMutation({
    mutationFn: async () => {
      const promises: Promise<any>[] = []
      for (const row of classRows) {
        if (!row.selected || row.subjectIds.size === 0) continue
        const classSections = sections.filter(s => s.school_class_id === row.classId)
        for (const subjectId of row.subjectIds) {
          for (const sec of classSections) {
            promises.push(
              allocationsApi.create({
                teacher_id: Number(selectedTeacherId),
                section_id: sec.id,
                subject_id: subjectId,
              })
            )
          }
        }
      }
      if (promises.length === 0) return
      await Promise.all(promises)
    },
    onSuccess: () => {
      invalidate()
      closeModal()
    },
    onError: (e: any) => {
      setApiError(e.response?.data?.detail ?? 'One or more allocations could not be created.')
    },
  })

  const deleteMut = useMutation({
    mutationFn: allocationsApi.delete,
    onSuccess: () => { invalidate(); setDeleteTarget(null) },
  })

  // ── Helpers ──────────────────────────────────────────────────────────────────
  const openModal = () => {
    setStep(1)
    setSelectedTeacherId('')
    setClassRows([])
    setApiError('')
    setModal(true)
  }

  const closeModal = () => {
    setModal(false)
    setStep(1)
    setSelectedTeacherId('')
    setClassRows([])
    setApiError('')
  }

  const proceedToStep2 = useCallback(() => {
    if (!teacherClasses) return
    const rows: ClassRow[] = (teacherClasses as SchoolClass[]).map(c => ({
      classId: c.id,
      className: c.name,
      selected: false,
      subjectIds: new Set<number>(),
    }))
    setClassRows(rows)
    setStep(2)
  }, [teacherClasses])

  const toggleClass = (classId: number) => {
    setClassRows(prev =>
      prev.map(r =>
        r.classId === classId
          ? { ...r, selected: !r.selected, subjectIds: r.selected ? new Set<number>() : r.subjectIds }
          : r
      )
    )
  }

  const toggleSubject = (classId: number, subjectId: number) => {
    setClassRows(prev =>
      prev.map(r => {
        if (r.classId !== classId) return r
        const next = new Set(r.subjectIds)
        if (next.has(subjectId)) next.delete(subjectId)
        else next.add(subjectId)
        return { ...r, subjectIds: next }
      })
    )
  }

  // Valid when ≥1 class is selected AND every selected class has ≥1 subject chosen
  const canSubmit = useMemo(() => {
    const selected = classRows.filter(r => r.selected)
    return selected.length > 0 && selected.every(r => r.subjectIds.size > 0)
  }, [classRows])

  // Summary numbers
  const summaryStats = useMemo(() => {
    const readyRows = classRows.filter(r => r.selected && r.subjectIds.size > 0)
    const totalAllocations = readyRows.reduce((acc, r) => {
      const sectionCount = sections.filter(s => s.school_class_id === r.classId).length
      return acc + r.subjectIds.size * sectionCount
    }, 0)
    const totalSections = readyRows.reduce(
      (acc, r) => acc + sections.filter(s => s.school_class_id === r.classId).length,
      0
    )
    const totalSubjectAssignments = readyRows.reduce((acc, r) => acc + r.subjectIds.size, 0)
    return { readyRows, totalAllocations, totalSections, totalSubjectAssignments }
  }, [classRows, sections])

  // ── Display helpers ───────────────────────────────────────────────────────────
  const grouped = allocs.reduce<Record<string, TeacherAllocation[]>>((acc, a) => {
    ;(acc[a.teacher.name] ??= []).push(a)
    return acc
  }, {})

  const selectedTeacher = allTeachers.find(t => t.id === Number(selectedTeacherId))

  if (!activeSchoolId) return (
    <div className="flex items-center justify-center py-20 text-[var(--color-text-muted)] text-sm">
      Select a school from the sidebar to manage allocations.
    </div>
  )

  return (
    <div>
      <PageHeader
        title="Teacher Allocations"
        subtitle="Map teachers to subjects for each section — the source of truth for the timetable solver"
        action={
          <div className="flex items-center gap-3 flex-wrap justify-end">
            <Select
              id="alloc-teacher-filter"
              value={filterTeacher ?? ''}
              onChange={e => setFilterTeacher(e.target.value ? Number(e.target.value) : undefined)}
              className="w-40"
            >
              <option value="">All Teachers</option>
              {allTeachers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </Select>
            <Select
              id="alloc-section-filter"
              value={filterSection ?? ''}
              onChange={e => setFilterSection(e.target.value ? Number(e.target.value) : undefined)}
              className="w-40"
            >
              <option value="">All Sections</option>
              {sections.map(s => <option key={s.id} value={s.id}>{s.school_class.name}{s.name}</option>)}
            </Select>
            <Button onClick={openModal}><Plus size={16} />Add Allocation</Button>
          </div>
        }
      />

      {/* ── Modal ──────────────────────────────────────────────────────────────── */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={closeModal} />
          <Card className="relative w-full max-w-lg p-6 shadow-2xl max-h-[90vh] overflow-y-auto">

            {/* Step indicator */}
            <div className="flex items-center gap-2 mb-6">
              <StepDot n={1} active={step === 1} done={step > 1} />
              <span className={`text-xs font-medium ${step === 1 ? 'text-[var(--color-text-primary)]' : 'text-[var(--color-text-muted)]'}`}>
                Select Teacher
              </span>
              <ChevronRight size={14} className="text-[var(--color-text-muted)]" />
              <StepDot n={2} active={step === 2} done={false} />
              <span className={`text-xs font-medium ${step === 2 ? 'text-[var(--color-text-primary)]' : 'text-[var(--color-text-muted)]'}`}>
                Assign Classes &amp; Subjects
              </span>
            </div>

            {apiError && <div className="mb-4"><ErrorAlert message={apiError} /></div>}

            {/* ── STEP 1: Pick teacher ──────────────────────────────────────────── */}
            {step === 1 && (
              <div className="flex flex-col gap-5">
                <p className="text-sm text-[var(--color-text-secondary)]">
                  Choose the teacher. In the next step you'll select which classes they teach and which subjects they cover for each class.
                </p>

                <Select
                  id="alloc-teacher"
                  label="Teacher"
                  value={selectedTeacherId}
                  onChange={e => setSelectedTeacherId(e.target.value)}
                  required
                >
                  <option value="">Select teacher…</option>
                  {allTeachers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </Select>

                {selectedTeacherId && classesLoading && (
                  <div className="flex items-center gap-2 text-sm text-[var(--color-text-muted)]">
                    <Spinner size={14} /> Loading mapped classes…
                  </div>
                )}

                {selectedTeacherId && !classesLoading && teacherClasses?.length === 0 && (
                  <p className="text-xs text-amber-400 bg-amber-400/10 border border-amber-400/20 rounded-lg px-3 py-2">
                    This teacher has no class mappings yet. Go to <strong>Classes</strong> settings to map them first.
                  </p>
                )}

                {selectedTeacherId && !classesLoading && (teacherClasses?.length ?? 0) > 0 && (
                  <p className="text-xs text-[var(--color-text-muted)]">
                    Mapped to <strong className="text-[var(--color-text-secondary)]">{teacherClasses!.length} class{teacherClasses!.length !== 1 ? 'es' : ''}</strong>.
                    Continue to assign subjects.
                  </p>
                )}

                <div className="flex gap-3 pt-1">
                  <Button
                    type="button"
                    disabled={!selectedTeacherId || classesLoading || !teacherClasses || teacherClasses.length === 0}
                    onClick={proceedToStep2}
                  >
                    Continue <ChevronRight size={14} />
                  </Button>
                  <Button type="button" variant="ghost" onClick={closeModal}>Cancel</Button>
                </div>
              </div>
            )}

            {/* ── STEP 2: Pick classes + multiple subjects per class ────────────── */}
            {step === 2 && (
              <div className="flex flex-col gap-5">
                {/* Teacher pill */}
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-gradient-to-br from-[var(--color-brand-600)] to-[var(--color-brand-800)] flex items-center justify-center shrink-0">
                    <span className="text-xs font-bold text-white">{selectedTeacher?.name.charAt(0)}</span>
                  </div>
                  <span className="text-sm font-semibold text-[var(--color-text-primary)]">{selectedTeacher?.name}</span>
                </div>

                <p className="text-sm text-[var(--color-text-secondary)] -mt-2">
                  Enable the classes this teacher will teach, then tick <em>every</em> subject they cover for that class.
                  One allocation per section × subject will be created.
                </p>

                {/* Class rows */}
                <div className="flex flex-col gap-3">
                  {classRows.length === 0 && (
                    <p className="text-xs text-[var(--color-text-muted)]">No classes available.</p>
                  )}

                  {classRows.map(row => {
                    const allowedSubjectIds = subjectsForClass[row.classId]
                    const classSections = sections.filter(s => s.school_class_id === row.classId)
                    const filteredSubjects = allowedSubjectIds
                      ? subjects.filter(s => allowedSubjectIds.includes(s.id))
                      : subjects

                    return (
                      <div
                        key={row.classId}
                        className={`rounded-xl border transition-all ${
                          row.selected
                            ? 'border-[var(--color-brand-600)]/40 bg-[var(--color-brand-600)]/5'
                            : 'border-[var(--color-surface-600)] bg-[var(--color-surface-700)]/20'
                        }`}
                      >
                        {/* ── Class header toggle ── */}
                        <button
                          type="button"
                          className="w-full flex items-center gap-3 px-4 py-3 text-left"
                          onClick={() => toggleClass(row.classId)}
                        >
                          {row.selected
                            ? <CheckSquare size={16} className="text-[var(--color-brand-500)] shrink-0" />
                            : <Square size={16} className="text-[var(--color-text-muted)] shrink-0" />
                          }
                          <span className={`text-sm font-semibold flex-1 ${row.selected ? 'text-[var(--color-text-primary)]' : 'text-[var(--color-text-secondary)]'}`}>
                            Class {row.className}
                          </span>
                          <div className="flex items-center gap-1.5">
                            {row.subjectIds.size > 0 && (
                              <Badge color="violet">{row.subjectIds.size} subject{row.subjectIds.size !== 1 ? 's' : ''}</Badge>
                            )}
                            {classSections.length > 0 && (
                              <span className="text-xs text-[var(--color-text-muted)]">
                                {classSections.map(s => s.school_class.name + s.name).join(', ')}
                              </span>
                            )}
                          </div>
                        </button>

                        {/* ── Subject multi-select (shown when class is toggled on) ── */}
                        {row.selected && (
                          <div className="px-4 pb-4 pt-0">
                            {filteredSubjects.length === 0 ? (
                              <p className="text-xs text-amber-400 bg-amber-400/10 border border-amber-400/20 rounded-lg px-3 py-2">
                                No subject requirements defined for this class. Add them on the Requirements page first.
                              </p>
                            ) : (
                              <>
                                <p className="text-xs text-[var(--color-text-muted)] mb-2 ml-0.5">
                                  Select all subjects this teacher teaches to Class {row.className}:
                                </p>
                                <div className="flex flex-col gap-1">
                                  {filteredSubjects.map(sub => (
                                    <SubjectCheckbox
                                      key={sub.id}
                                      subject={sub}
                                      checked={row.subjectIds.has(sub.id)}
                                      onToggle={() => toggleSubject(row.classId, sub.id)}
                                    />
                                  ))}
                                </div>
                                {row.subjectIds.size === 0 && (
                                  <p className="text-xs text-amber-400 mt-2 ml-0.5">
                                    Select at least one subject for this class.
                                  </p>
                                )}
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>

                {/* Summary box */}
                {summaryStats.readyRows.length > 0 && (
                  <div className="rounded-lg bg-[var(--color-surface-700)]/50 border border-[var(--color-surface-600)] px-4 py-3 text-xs text-[var(--color-text-muted)] leading-relaxed">
                    Will create{' '}
                    <strong className="text-[var(--color-text-secondary)]">
                      {summaryStats.totalAllocations} allocation{summaryStats.totalAllocations !== 1 ? 's' : ''}
                    </strong>
                    {' '}—{' '}
                    <strong className="text-[var(--color-text-secondary)]">
                      {summaryStats.totalSubjectAssignments} subject assignment{summaryStats.totalSubjectAssignments !== 1 ? 's' : ''}
                    </strong>
                    {' '}across{' '}
                    <strong className="text-[var(--color-text-secondary)]">
                      {summaryStats.totalSections} section{summaryStats.totalSections !== 1 ? 's' : ''}
                    </strong>.
                  </div>
                )}

                <div className="flex gap-3 pt-1">
                  <Button
                    type="button"
                    onClick={() => createMut.mutate()}
                    disabled={!canSubmit || createMut.isPending}
                  >
                    {createMut.isPending && <Spinner size={14} />}
                    Save Allocations
                  </Button>
                  <Button type="button" variant="ghost" onClick={() => { setStep(1); setApiError('') }}>
                    ← Back
                  </Button>
                  <Button type="button" variant="ghost" onClick={closeModal}>Cancel</Button>
                </div>
              </div>
            )}
          </Card>
        </div>
      )}

      {/* ── Delete confirm ──────────────────────────────────────────────────────── */}
      <ConfirmDelete
        open={!!deleteTarget}
        name={
          deleteTarget
            ? `${deleteTarget.teacher.name} → ${deleteTarget.section.school_class.name}${deleteTarget.section.name} (${deleteTarget.subject.code})`
            : ''
        }
        onConfirm={() => deleteTarget && deleteMut.mutate(deleteTarget.id)}
        onCancel={() => setDeleteTarget(null)}
        loading={deleteMut.isPending}
      />

      {/* ── Allocation table ────────────────────────────────────────────────────── */}
      {isLoading ? (
        <div className="flex justify-center py-20"><Spinner size={32} /></div>
      ) : allocs.length === 0 ? (
        <EmptyState
          icon={<CalendarDays size={24} />}
          message="No allocations yet."
          action={<Button onClick={openModal}><Plus size={14} />Add Allocation</Button>}
        />
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
                <Card className="overflow-x-auto">
                  <table className="w-full min-w-[500px] text-sm">
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
                        <tr
                          key={a.id}
                          className={`border-b border-[var(--color-surface-600)]/60 hover:bg-[var(--color-surface-700)]/40 transition-colors ${i === items.length - 1 ? 'border-b-0' : ''}`}
                        >
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
                            <button
                              id={`delete-alloc-${a.id}`}
                              onClick={() => setDeleteTarget(a)}
                              className="p-1.5 rounded-lg text-[var(--color-text-muted)] hover:text-[var(--hover-delete-text)] hover:bg-[var(--hover-delete-bg)] transition-colors"
                            >
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
    </div>
  )
}
