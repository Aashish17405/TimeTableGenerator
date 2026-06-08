import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { AlertTriangle, CalendarDays, Check, RefreshCw, Sparkles, Terminal } from 'lucide-react'
import { sectionsApi, aiTimetableApi } from '../services/api'
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

export default function AITimetablePage() {
  const [selectedClassIds, setSelectedClassIds] = useState<number[]>([])
  const [activeTabSectionId, setActiveTabSectionId] = useState<string | null>(null)
  const [validationErrors, setValidationErrors] = useState<string[]>([])
  const [apiError, setApiError] = useState('')
  const { activeSchoolId } = useSchool()

  const { data: paginatedSections, isLoading: sectionsLoading } = useQuery({
    queryKey: ['sections', activeSchoolId],
    queryFn: () => sectionsApi.list({ school_id: activeSchoolId ?? undefined, size: 1000 }),
    enabled: activeSchoolId !== null,
  })
  const sections = paginatedSections?.items || []

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

  const selectedSectionIds = useMemo(() => {
    return classes
      .filter((schoolClass) => selectedClassIds.includes(schoolClass.id))
      .flatMap((schoolClass) => schoolClass.sections.map((section) => section.id))
  }, [classes, selectedClassIds])

  const generateMutation = useMutation<{ timetables: any, agent_logs: string[], error?: string }, any, number[]>({
    mutationFn: (classIds) => aiTimetableApi.generate({ class_ids: classIds, school_id: activeSchoolId ?? undefined }),
    onSuccess: (data) => {
      setValidationErrors([])
      if (data.error) {
        setApiError(data.error)
      } else {
        setApiError('')
      }
      if (data.timetables) {
        const sectionIds = Object.keys(data.timetables)
        setActiveTabSectionId(sectionIds[0] ?? null)
      } else {
        setActiveTabSectionId(null)
      }
    },
    onError: (error: any) => {
      const detail = error.response?.data?.detail
      if (detail && typeof detail === 'object') {
        if (Array.isArray(detail.errors)) {
          setValidationErrors(detail.errors)
          setApiError('')
        } else if (Array.isArray(detail)) {
          // Handle FastAPI validation error list (e.g. 422 error list)
          const messages = detail.map((err: any) => {
            const path = err.loc ? err.loc.filter((l: any) => l !== 'body').join('.') : ''
            return path ? `${path}: ${err.msg}` : err.msg
          })
          setValidationErrors(messages)
          setApiError('')
        } else {
          setValidationErrors([])
          setApiError(JSON.stringify(detail))
        }
      } else {
        setValidationErrors([])
        setApiError(detail ?? 'Failed to generate timetable.')
      }
    },
  })

  const { data, isPending, mutate, reset } = generateMutation
  const selectedClassKey = selectedClassIds.join(',')

  useEffect(() => {
    if (selectedClassIds.length === 0) {
      setValidationErrors([])
      setApiError('')
      setActiveTabSectionId(null)
      reset()
      return
    }

    const timer = window.setTimeout(() => {
      mutate(selectedClassIds)
    }, 250)

    return () => window.clearTimeout(timer)
  }, [mutate, reset, selectedClassIds, selectedClassKey])

  const toggleClass = (classId: number) => {
    setSelectedClassIds((current) =>
      current.includes(classId)
        ? current.filter((value) => value !== classId)
        : [...current, classId].sort((left, right) => left - right)
    )
  }

  const handleRefresh = () => {
    if (selectedClassIds.length === 0) {
      return
    }
    mutate(selectedClassIds)
  }

  const timetables = data?.timetables
  const activeTimetable = activeTabSectionId && timetables ? timetables[activeTabSectionId] : null
  const selectedClasses = classes.filter((schoolClass) => selectedClassIds.includes(schoolClass.id))
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

  return (
    <div>
      <PageHeader
        title="Generate Timetable"
        subtitle="Select classes and the timetable is generated automatically across all of their sections."
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-4">
        <div className="flex flex-col gap-4 lg:col-span-1">
          <Card className="flex h-fit flex-col gap-4 p-4">
            <div>
              <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">Select Classes</h3>
              <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">
                Choosing a class automatically includes all of its sections in the generated timetable.
              </p>
            </div>

            {sectionsLoading ? (
              <div className="flex justify-center py-8"><Spinner size={24} /></div>
            ) : classes.length === 0 ? (
              <p className="py-4 text-center text-xs text-[var(--color-text-muted)]">No classes available.</p>
            ) : (
              <div className="space-y-3">
                {classes.map((schoolClass) => {
                  const selected = selectedClassIds.includes(schoolClass.id)
                  return (
                    <button
                      key={schoolClass.id}
                      onClick={() => toggleClass(schoolClass.id)}
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
                    </button>
                  )
                })}
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              <Badge>{selectedClassIds.length} classes selected</Badge>
              <Badge>{selectedSectionIds.length} sections included</Badge>
            </div>

            <Button
              onClick={handleRefresh}
              disabled={selectedClassIds.length === 0 || isPending}
              className="w-full justify-center py-2.5"
            >
              {isPending ? (
                <>
                  <Spinner size={16} /> Regenerating...
                </>
              ) : (
                <>
                  <RefreshCw size={16} /> Regenerate Current Selection
                </>
              )}
            </Button>
          </Card>
        </div>

        <div className="flex flex-col gap-6 lg:col-span-3">
          {validationErrors.length > 0 && (
            <Card className="flex flex-col gap-3 border-red-900/40 bg-red-950/20 p-5">
              <div className="flex items-center gap-2 text-sm font-semibold text-red-400">
                <AlertTriangle size={18} />
                <span>Allocation Validation Failed</span>
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

          {isPending ? (
            <Card className="flex flex-col items-center justify-center border-[var(--color-brand-700)]/40 bg-[var(--color-surface-800)] px-6 py-24">
              <div className="relative mb-6">
                <div className="h-16 w-16 animate-spin rounded-full border-4 border-[var(--color-brand-800)]/40 border-t-[var(--color-brand-500)]" />
                <Sparkles className="absolute inset-0 m-auto animate-pulse text-[var(--color-brand-400)]" size={24} />
              </div>
              <h3 className="mb-1 text-base font-semibold text-[var(--color-text-primary)]">Generating Timetables</h3>
              <p className="max-w-md text-center text-sm text-[var(--color-text-secondary)]">
                Building balanced schedules for {selectedClasses.map((schoolClass) => `Class ${schoolClass.name}`).join(', ')}.
              </p>
            </Card>
          ) : !timetables ? (
            <Card className="flex flex-col items-center justify-center py-24 text-center">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--color-surface-700)] text-[var(--color-text-muted)]">
                <CalendarDays size={28} />
              </div>
              <h3 className="mb-1 text-sm font-semibold text-[var(--color-text-primary)]">No Timetable Generated</h3>
              <p className="max-w-sm px-6 text-xs text-[var(--color-text-muted)]">
                Select one or more classes and the timetable will be generated automatically.
              </p>
            </Card>
          ) : (
            <div className="flex flex-col gap-4">
              <div className="flex flex-wrap gap-2 border-b border-[var(--color-surface-600)] pb-3">
                {Object.entries(timetables).map(([sectionId, timetable]: [string, any]) => {
                  const isActive = activeTabSectionId === sectionId
                  return (
                    <button
                      key={sectionId}
                      onClick={() => setActiveTabSectionId(sectionId)}
                      className={[
                        'cursor-pointer rounded-lg border px-4 py-2 text-xs font-semibold transition-all',
                        isActive
                          ? 'border-[var(--color-brand-600)] bg-[var(--color-brand-600)] text-white shadow-md'
                          : 'border-[var(--color-surface-600)] bg-[var(--color-surface-700)] text-[var(--color-text-secondary)] hover:border-[var(--color-surface-400)] hover:text-[var(--color-text-primary)]',
                      ].join(' ')}
                    >
                      Section {timetable.section_name}
                    </button>
                  )
                })}
              </div>

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
              ) : null}
            </div>
          )}

          {/* Solver Rules Info Card */}
          <Card className="mt-6 p-5 border-[var(--color-surface-600)]">
            <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mb-3 flex items-center gap-2">
              <Sparkles size={16} className="text-[var(--color-brand-400)]" />
              Generation Rules & Constraints
            </h3>
            <ul className="space-y-2 text-xs text-[var(--color-text-secondary)] list-disc list-inside">
              <li><strong>Weekly Period Constraint:</strong> Each section must have exactly 54 periods scheduled (6 days &times; 9 periods) matching requirements.</li>
              <li><strong>One Subject per Slot:</strong> Only one subject can be scheduled in a section for a given time slot.</li>
              <li><strong>One Teacher per Slot (No Double Booking):</strong> A teacher cannot teach in multiple sections at the same time.</li>
              <li><strong>Teacher Capacity Limits:</strong> A teacher's total workload cannot exceed their weekly assigned capacity (max 54 periods globally).</li>
              <li><strong>Daily Subject Variety Limits:</strong> Weekly subject periods are evenly spread across days, capped at <code>ceil(weekly_periods / 6)</code> per day.</li>
              <li><strong>No Consecutive Handwriting (HW):</strong> Handwriting (HW) cannot be scheduled back-to-back on the same day.</li>
              <li><strong>Capped PET Spread:</strong> Physical Education (PET) is limited to exactly 2 periods per week (maximum 1 period per day).</li>
              <li><strong>Period Index Variety:</strong> A subject cannot occupy the same period position (e.g., Period 1) more than 3 times in a week.</li>
            </ul>
          </Card>

          {/* Agent Logs Card */}
          <Card className="mt-6 p-5 border-[var(--color-surface-600)]">
            <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mb-3 flex items-center gap-2">
              <Terminal size={16} className="text-[var(--color-brand-400)]" />
              Groq Agent Logs
            </h3>
            <div className="space-y-2 text-xs text-[var(--color-text-secondary)] bg-black/50 p-4 rounded-xl border border-[var(--color-surface-600)] h-48 overflow-y-auto font-mono">
              {data?.agent_logs && data.agent_logs.length > 0 ? (
                data.agent_logs.map((log, i) => (
                  <div key={i} className="whitespace-pre-wrap">{log}</div>
                ))
              ) : (
                <div className="opacity-50 italic">Agent is sleeping...</div>
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}
