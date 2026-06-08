import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, CalendarDays, Check, Printer, RefreshCw, Sparkles, Trash2 } from 'lucide-react'
import { sectionsApi, timetableApi } from '../services/api'
import type { Section } from '../types'
import { Badge, Button, Card, PageHeader, Spinner } from '../components/ui'
import { useSchool } from '../features/school/SchoolContext'

function getSubjectColor(code: string) {
  const normalizedCode = code.toUpperCase().trim()
  if (normalizedCode === 'MATH') return 'bg-[var(--color-subj-math-bg)] text-[var(--color-subj-math-text)] border-[var(--color-subj-math-border)]'
  if (normalizedCode === 'FL') return 'bg-[var(--color-subj-fl-bg)] text-[var(--color-subj-fl-text)] border-[var(--color-subj-fl-border)]'
  if (normalizedCode === 'SL') return 'bg-[var(--color-subj-sl-bg)] text-[var(--color-subj-sl-text)] border-[var(--color-subj-sl-border)]'
  if (normalizedCode === 'ENG') return 'bg-[var(--color-subj-eng-bg)] text-[var(--color-subj-eng-text)] border-[var(--color-subj-eng-border)]'
  if (normalizedCode === 'PET') return 'bg-[var(--color-subj-pet-bg)] text-[var(--color-subj-pet-text)] border-[var(--color-subj-pet-border)]'
  if (normalizedCode === 'HW') return 'bg-[var(--color-subj-hw-bg)] text-[var(--color-subj-hw-text)] border-[var(--color-subj-hw-border)]'
  return 'bg-[var(--color-surface-700)] text-[var(--color-text-secondary)] border-[var(--color-surface-600)]'
}

export default function TimetablesPage() {
  const queryClient = useQueryClient()
  const { activeSchoolId } = useSchool()
  const [activeClassId, setActiveClassId] = useState<number | null>(null)
  const [activeSectionId, setActiveSectionId] = useState<number | null>(null)
  const [validationErrors, setValidationErrors] = useState<string[]>([])
  const [apiError, setApiError] = useState('')
  const [showGenerateConfirm, setShowGenerateConfirm] = useState(false)

  // 1. Query for sections to build class list
  const { data: paginatedSections, isLoading: sectionsLoading } = useQuery({
    queryKey: ['sections', activeSchoolId],
    queryFn: () => sectionsApi.list({ school_id: activeSchoolId ?? undefined, size: 1000 }),
    enabled: activeSchoolId !== null,
  })
  const sections = paginatedSections?.items || []

  // 2. Query for stored timetables
  const { data: storedData, isLoading: storedLoading } = useQuery({
    queryKey: ['stored-timetable', activeSchoolId],
    queryFn: () => timetableApi.getStored(activeSchoolId!),
    enabled: activeSchoolId !== null,
  })

  const classes = useMemo(() => {
    const grouped = new Map<number, { id: number; name: string; displayOrder: number; sections: Section[] }>()
    for (const section of sections) {
      const schoolClass = section.school_class
      const existing = grouped.get(schoolClass.id)
      if (existing) {
        existing.sections.push(section)
      } else {
        grouped.set(schoolClass.id, {
          id: schoolClass.id,
          name: schoolClass.name,
          displayOrder: schoolClass.display_order,
          sections: [section],
        })
      }
    }

    return [...grouped.values()]
      .map((item) => ({
        ...item,
        sections: [...item.sections].sort((left, right) => left.name.localeCompare(right.name)),
      }))
      .sort((left, right) => left.displayOrder - right.displayOrder)
  }, [sections])

  // Automatically select first class and section on load
  useEffect(() => {
    if (classes.length > 0) {
      if (activeClassId === null || !classes.find((c) => c.id === activeClassId)) {
        setActiveClassId(classes[0].id)
        if (classes[0].sections.length > 0) {
          setActiveSectionId(classes[0].sections[0].id)
        }
      }
    }
  }, [classes, activeClassId])

  const handleClassTabChange = (classId: number) => {
    setActiveClassId(classId)
    const targetClass = classes.find((c) => c.id === classId)
    if (targetClass && targetClass.sections.length > 0) {
      setActiveSectionId(targetClass.sections[0].id)
    } else {
      setActiveSectionId(null)
    }
  }

  // 3. Mutations
  const generateAllMutation = useMutation({
    mutationFn: () => timetableApi.generateAll(activeSchoolId!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stored-timetable', activeSchoolId] })
      setValidationErrors([])
      setApiError('')
    },
    onError: (error: any) => {
      const detail = error.response?.data?.detail
      if (detail && typeof detail === 'object') {
        if (Array.isArray(detail.errors)) {
          setValidationErrors(detail.errors)
        } else if (Array.isArray(detail)) {
          const messages = detail.map((err: any) => {
            const path = err.loc ? err.loc.filter((l: any) => l !== 'body').join('.') : ''
            return path ? `${path}: ${err.msg}` : err.msg
          })
          setValidationErrors(messages)
        } else {
          setApiError(JSON.stringify(detail))
        }
      } else {
        setApiError(detail ?? 'Failed to generate all timetables.')
      }
    },
  })

  const regenerateClassMutation = useMutation({
    mutationFn: (classId: number) => timetableApi.regenerateClass(activeSchoolId!, classId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stored-timetable', activeSchoolId] })
      setValidationErrors([])
      setApiError('')
    },
    onError: (error: any) => {
      const detail = error.response?.data?.detail
      if (detail && typeof detail === 'object') {
        if (Array.isArray(detail.errors)) {
          setValidationErrors(detail.errors)
        } else if (Array.isArray(detail)) {
          const messages = detail.map((err: any) => {
            const path = err.loc ? err.loc.filter((l: any) => l !== 'body').join('.') : ''
            return path ? `${path}: ${err.msg}` : err.msg
          })
          setValidationErrors(messages)
        } else {
          setApiError(JSON.stringify(detail))
        }
      } else {
        setApiError(detail ?? 'Failed to regenerate class timetable.')
      }
    },
  })

  const deleteStoredMutation = useMutation({
    mutationFn: () => timetableApi.deleteStored(activeSchoolId!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stored-timetable', activeSchoolId] })
      setValidationErrors([])
      setApiError('')
      setActiveClassId(classes[0]?.id ?? null)
      setActiveSectionId(classes[0]?.sections[0]?.id ?? null)
    },
    onError: (error: any) => {
      setApiError(error.response?.data?.detail ?? 'Failed to delete stored timetables.')
    },
  })

  const handleGenerateAll = () => {
    setShowGenerateConfirm(true)
  }

  const confirmGenerateAll = () => {
    setShowGenerateConfirm(false)
    generateAllMutation.mutate()
  }

  const handleRegenerateClass = (classId: number, className: string) => {
    const confirm = window.confirm(
      `This will regenerate the timetable for Class ${className} (including all its sections) while locking in and respecting the schedules of all other classes. Continue?`
    )
    if (confirm) {
      regenerateClassMutation.mutate(classId)
    }
  }

  const handleDeleteAll = () => {
    const confirm = window.confirm(
      'Are you sure you want to delete all stored timetables for this school? This action cannot be undone.'
    )
    if (confirm) {
      deleteStoredMutation.mutate()
    }
  }

  const handleExportPDF = () => {
    if (!activeSchoolId) return
    const baseUrl = import.meta.env.VITE_API_URL || '/api/v1'
    const url = `${baseUrl}/timetable/export-pdf/${activeSchoolId}`
    const link = document.createElement('a')
    link.href = url
    link.download = `school_timetables_${activeSchoolId}.pdf`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const timetables = storedData?.timetables
  const hasTimetables = storedData?.generated_at !== null && timetables && Object.keys(timetables).length > 0
  const activeTimetable = activeSectionId && timetables ? timetables[activeSectionId] : null
  const activeClass = classes.find((c) => c.id === activeClassId)

  const isPending =
    generateAllMutation.isPending || regenerateClassMutation.isPending || deleteStoredMutation.isPending

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

  const totalSectionsCount = sections.length
  const totalClassesCount = classes.length

  if (sectionsLoading || storedLoading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <Spinner size={36} />
      </div>
    )
  }

  return (
    <div>
      <PageHeader
        title="Timetables"
        subtitle="Manage and view conflict-free timetables for the entire school."
        action={
          hasTimetables && (
            <div className="flex gap-3">
              <Button
                variant="ghost"
                onClick={handleExportPDF}
                disabled={isPending}
                className="hover:border-[var(--color-brand-500)]"
              >
                <Printer size={15} />
                Export PDF
              </Button>
              <Button
                variant="ghost"
                onClick={handleGenerateAll}
                disabled={isPending}
                className="hover:border-[var(--color-brand-500)]"
              >
                <RefreshCw size={15} className={generateAllMutation.isPending ? 'animate-spin' : ''} />
                Regenerate All
              </Button>
              <Button variant="danger" onClick={handleDeleteAll} disabled={isPending}>
                <Trash2 size={15} />
                Delete All
              </Button>
            </div>
          )
        }
      />

      {/* Generation Timestamp Header */}
      {hasTimetables && storedData?.generated_at && (
        <div className="mb-6 flex items-center justify-between rounded-xl bg-[var(--color-surface-800)] border border-[var(--color-surface-600)] p-4 text-sm text-[var(--color-text-secondary)]">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>
              Timetables are live. Generated on:{' '}
              <span className="font-semibold text-[var(--color-text-primary)]">
                {new Date(storedData.generated_at).toLocaleString(undefined, {
                  dateStyle: 'medium',
                  timeStyle: 'short',
                })}
              </span>
            </span>
          </div>
          <div className="flex gap-2">
            <Badge color="green">{totalClassesCount} Classes</Badge>
            <Badge color="blue">{totalSectionsCount} Sections</Badge>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-6">
        {/* Errors Block */}
        {validationErrors.length > 0 && (
          <Card className="flex flex-col gap-3 border-red-900/40 bg-red-950/20 p-5">
            <div className="flex items-center gap-2 text-sm font-semibold text-red-400">
              <AlertTriangle size={18} />
              <span>Timetable Constraint Validation Failed</span>
            </div>
            <ul className="list-disc list-inside space-y-1 text-xs leading-relaxed text-red-300">
              {validationErrors.map((errorMessage, index) => (
                <li key={index}>{errorMessage}</li>
              ))}
            </ul>
          </Card>
        )}

        {apiError && (
          <Card className="flex items-start gap-3 border-red-900/40 bg-red-950/20 p-4 text-sm text-red-400">
            <AlertTriangle size={18} className="mt-0.5 shrink-0" />
            <span>{apiError}</span>
          </Card>
        )}

        {/* Loading Solver State */}
        {isPending ? (
          <Card className="flex flex-col items-center justify-center border-[var(--color-brand-700)]/40 bg-[var(--color-surface-800)] px-6 py-24 shadow-lg">
            <div className="relative mb-6">
              <div className="h-16 w-16 animate-spin rounded-full border-4 border-[var(--color-brand-800)]/40 border-t-[var(--color-brand-500)]" />
              <Sparkles className="absolute inset-0 m-auto animate-pulse text-[var(--color-brand-400)]" size={24} />
            </div>
            <h3 className="mb-2 text-base font-semibold text-[var(--color-text-primary)]">
              {generateAllMutation.isPending
                ? 'Generating All Timetables'
                : regenerateClassMutation.isPending
                ? 'Regenerating Class Timetable'
                : 'Deleting Timetables'}
            </h3>
            <p className="max-w-md text-center text-sm text-[var(--color-text-secondary)]">
              {generateAllMutation.isPending
                ? 'Executing OR-Tools constraint solver to schedule all sections concurrently without teacher conflicts...'
                : regenerateClassMutation.isPending
                ? 'Analyzing existing locked teacher slots and re-solving for target class sections...'
                : 'Clearing all stored schedule entries from database...'}
            </p>
          </Card>
        ) : !hasTimetables ? (
          /* Empty State */
          <Card className="flex flex-col items-center justify-center py-24 text-center">
            <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--color-surface-700)] text-[var(--color-text-muted)] border border-[var(--color-surface-600)] shadow-inner">
              <CalendarDays size={28} className="text-[var(--color-brand-400)]" />
            </div>
            <h3 className="mb-2 text-base font-semibold text-[var(--color-text-primary)]">
              Bulk Timetable Generation Required
            </h3>
            <p className="max-w-md px-6 text-sm text-[var(--color-text-secondary)] mb-6 leading-relaxed">
              Timetables are generated for the entire school simultaneously to guarantee that shared teachers are never
              double-booked. Once generated, you can selectively regenerate individual classes.
            </p>
            <div className="flex flex-col items-center gap-3">
              <Button onClick={handleGenerateAll} className="px-6 py-3 font-semibold shadow-md">
                <Sparkles size={16} />
                Generate All Timetables
              </Button>
              <div className="flex gap-2">
                <Badge color="default">{totalClassesCount} Classes</Badge>
                <Badge color="default">{totalSectionsCount} Sections</Badge>
              </div>
            </div>
          </Card>
        ) : (
          /* Stored State: Displays timetables and tabs */
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
            {/* Sidebar / Navigation list of Classes */}
            <div className="flex flex-col gap-4 lg:col-span-1">
              <Card className="flex h-fit flex-col gap-4 p-4">
                <div>
                  <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">Classes</h3>
                  <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">
                    Select a class to view its generated section timetables or regenerate them.
                  </p>
                </div>

                <div className="space-y-2.5">
                  {classes.map((schoolClass) => {
                    const selected = activeClassId === schoolClass.id
                    return (
                      <div
                        key={schoolClass.id}
                        onClick={() => handleClassTabChange(schoolClass.id)}
                        className={[
                          'flex w-full cursor-pointer items-center justify-between rounded-xl border px-4 py-3 text-left transition-all duration-150',
                          selected
                            ? 'border-[var(--color-brand-600)] bg-[var(--color-brand-700)]/30 text-[var(--color-brand-300)]'
                            : 'border-[var(--color-surface-500)] bg-[var(--color-surface-700)] text-[var(--color-text-secondary)] hover:border-[var(--color-surface-400)] hover:text-[var(--color-text-primary)]',
                        ].join(' ')}
                      >
                        <div className="flex flex-col gap-1">
                          <span className="text-sm font-semibold">Class {schoolClass.name}</span>
                          <span className="text-[11px] opacity-75">
                            Sections: {schoolClass.sections.map((section) => section.name).join(', ')}
                          </span>
                        </div>
                        {selected ? <Check size={16} className="text-[var(--color-brand-400)]" /> : null}
                      </div>
                    )
                  })}
                </div>

                {activeClass && (
                  <Button
                    onClick={() => handleRegenerateClass(activeClass.id, activeClass.name)}
                    disabled={isPending}
                    variant="ghost"
                    className="mt-2 w-full justify-center py-2.5 border-[var(--color-brand-600)] bg-[var(--color-brand-700)]/10 text-[var(--color-brand-300)] hover:bg-[var(--color-brand-600)] hover:text-white"
                  >
                    <RefreshCw size={15} />
                    Regenerate Class {activeClass.name}
                  </Button>
                )}
              </Card>
            </div>

            {/* Timetable Grid area */}
            <div className="flex flex-col gap-6 lg:col-span-3">
              {/* Section Sub-tabs */}
              {activeClass && activeClass.sections.length > 0 && (
                <div className="flex flex-wrap gap-2 border-b border-[var(--color-surface-600)] pb-3">
                  {activeClass.sections.map((section) => {
                    const isActive = activeSectionId === section.id
                    return (
                      <button
                        key={section.id}
                        onClick={() => setActiveSectionId(section.id)}
                        className={[
                          'cursor-pointer rounded-lg border px-4 py-2 text-xs font-semibold transition-all',
                          isActive
                            ? 'border-[var(--color-brand-600)] bg-[var(--color-brand-600)] text-white shadow-md'
                            : 'border-[var(--color-surface-600)] bg-[var(--color-surface-700)] text-[var(--color-text-secondary)] hover:border-[var(--color-surface-400)] hover:text-[var(--color-text-primary)]',
                        ].join(' ')}
                      >
                        Section {section.name}
                      </button>
                    )
                  })}
                </div>
              )}

              {/* Grid or Empty Grid Warning */}
              {activeTimetable ? (
                <div className="overflow-x-auto rounded-xl border border-[var(--color-surface-600)] shadow-md">
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
                            const period = activeTimetable.schedule[day]?.[periodIndex]
                            return (
                              <td key={`period-${idx}`} className="p-1.5 text-center align-middle min-w-[120px]">
                                {period && period.subject_code !== '-' ? (
                                  <div
                                    className={`flex flex-col items-center justify-center gap-0.5 rounded-lg border p-2 shadow-sm ${getSubjectColor(
                                      period.subject_code
                                    )}`}
                                  >
                                    <span className="text-xs font-bold leading-tight tracking-wide">
                                      {period.subject_code}
                                    </span>
                                    <span className="max-w-full truncate text-[9px] font-medium leading-tight opacity-75">
                                      {period.teacher_name}
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
              ) : (
                <Card className="flex flex-col items-center justify-center py-20 text-center">
                  <AlertTriangle className="text-[var(--color-text-muted)] mb-3" size={24} />
                  <p className="text-sm text-[var(--color-text-muted)]">
                    No generated timetable exists for this section. Try generating all timetables.
                  </p>
                </Card>
              )}
            </div>
          </div>
        )}

        {/* Solver Rules Info Card */}
        <Card className="p-5 border-[var(--color-surface-600)]">
          <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mb-3 flex items-center gap-2">
            <Sparkles size={16} className="text-[var(--color-brand-400)]" />
            Generation Rules & Constraints
          </h3>
          <ul className="space-y-2 text-xs text-[var(--color-text-secondary)] list-disc list-inside">
            <li>
              <strong>Weekly Period Constraint:</strong> Each section must have exactly 54 periods scheduled (6 days
              &times; 9 periods) matching requirements.
            </li>
            <li>
              <strong>One Subject per Slot:</strong> Only one subject can be scheduled in a section for a given time
              slot.
            </li>
            <li>
              <strong>One Teacher per Slot (No Double Booking):</strong> A teacher cannot teach in multiple sections at
              the same time.
            </li>
            <li>
              <strong>Teacher Capacity Limits:</strong> A teacher's total workload cannot exceed their weekly assigned
              capacity (max 54 periods globally).
            </li>
            <li>
              <strong>Daily Subject Variety Limits:</strong> Weekly subject periods are evenly spread across days,
              capped at <code>ceil(weekly_periods / 6)</code> per day.
            </li>
            <li>
              <strong>No Consecutive Handwriting (HW):</strong> Handwriting (HW) cannot be scheduled back-to-back on
              the same day.
            </li>
            <li>
              <strong>Capped PET Spread:</strong> Physical Education (PET) is limited to exactly 2 periods per week
              (maximum 1 period per day) and can never be scheduled in the 1st period.
            </li>
            <li>
              <strong>Period Index Variety:</strong> A subject cannot occupy the same period position (e.g., Period 1)
              more than 3 times in a week.
            </li>
          </ul>
        </Card>
      </div>

      {showGenerateConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setShowGenerateConfirm(false)} />
          <div className="relative bg-[var(--color-surface-800)] border border-[var(--color-surface-600)] rounded-2xl p-6 w-full max-w-md shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--color-brand-700)]/20 text-[var(--color-brand-400)] border border-[var(--color-brand-600)]/30">
              <Sparkles size={22} className="text-[var(--color-brand-400)]" />
            </div>
            <h3 className="text-base font-semibold text-[var(--color-text-primary)] mb-2">
              Generate All Timetables?
            </h3>
            <p className="text-sm text-[var(--color-text-secondary)] mb-6 leading-relaxed">
              This action will run the timetable generator to generate a complete, conflict-free timetable for all classes and sections.
              <br /><br />
              <strong className="text-[var(--color-text-primary)]">Warning:</strong> Any existing stored timetables will be cleared and replaced.
            </p>
            <div className="flex gap-3 justify-end">
              <Button variant="ghost" onClick={() => setShowGenerateConfirm(false)} disabled={generateAllMutation.isPending}>
                Cancel
              </Button>
              <Button onClick={confirmGenerateAll} disabled={generateAllMutation.isPending}>
                {generateAllMutation.isPending ? <Spinner size={14} /> : null}
                Generate Timetables
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
