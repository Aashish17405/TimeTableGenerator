import { Pagination } from '../components/Pagination'
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Trash2, ClipboardList } from 'lucide-react'
import { requirementsApi, classesApi, subjectsApi } from '../services/api'
import {
  PageHeader, Card, Button, Badge, Input, Select,
  Spinner, EmptyState, ErrorAlert, ConfirmDelete,
} from '../components/ui'
import type { SubjectRequirement } from '../types'
import { useSchool } from '../features/school/SchoolContext'

const TOTAL = 54

function ProgressBar({ value, max = TOTAL }: { value: number; max?: number }) {
  const pct = Math.min((value / max) * 100, 100)
  const color = value > max ? 'bg-red-500' : value === max ? 'bg-emerald-500' : 'bg-[var(--color-brand-500)]'
  return (
    <div className="h-1.5 w-full bg-[var(--color-surface-600)] rounded-full overflow-hidden">
      <div className={`h-full rounded-full transition-all duration-500 ${color}`} style={{ width: `${pct}%` }} />
    </div>
  )
}

export default function RequirementsPage() {
  const qc = useQueryClient()
  const { activeSchoolId } = useSchool()
  const [selectedClass, setSelectedClass] = useState<number | undefined>()
  const [modal, setModal] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<SubjectRequirement | null>(null)
  const [newSubjectId, setNewSubjectId] = useState('')
  const [newPeriods, setNewPeriods] = useState('')
  const [apiError, setApiError] = useState('')

  const { data: classesData } = useQuery({
    queryKey: ['classes', activeSchoolId],
    queryFn: () => classesApi.list(activeSchoolId ?? undefined, undefined, 1000),
    enabled: activeSchoolId !== null,
  })
  const classes = classesData?.items || []
  const { data: subjectsData } = useQuery({ queryKey: ['subjects'], queryFn: () => subjectsApi.list(undefined, 1000) })
  const subjects = subjectsData?.items || []
  const { data: summary, isLoading } = useQuery({
    queryKey: ['req-summary', selectedClass],
    queryFn: () => selectedClass ? requirementsApi.summary(selectedClass) : null,
    enabled: !!selectedClass,
  })
  const [page, setPage] = useState(1)
  const { data: paginatedData, isLoading: allLoading } = useQuery({ 
    queryKey: ['requirements', activeSchoolId, selectedClass, page],
    queryFn: () => requirementsApi.list({ school_id: activeSchoolId ?? undefined, page, size: 20 }),
    enabled: !selectedClass && activeSchoolId !== null,
  })
  const allReqs = paginatedData?.items || []

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['requirements'] })
    qc.invalidateQueries({ queryKey: ['req-summary'] })
  }

  const createMut = useMutation({
    mutationFn: requirementsApi.create,
    onSuccess: () => { invalidate(); setModal(false); setNewSubjectId(''); setNewPeriods(''); setApiError('') },
    onError: (e: any) => setApiError(e.response?.data?.detail ?? 'Failed to create'),
  })
  const deleteMut = useMutation({
    mutationFn: requirementsApi.delete,
    onSuccess: () => { invalidate(); setDeleteTarget(null) },
  })

  const reqs = summary?.requirements ?? allReqs
  const total = summary?.total_periods ?? reqs.reduce((a, r) => a + r.periods_per_week, 0)
  const remaining = TOTAL - total

  return (
    <div>
      <PageHeader
        title="Subject Requirements"
        subtitle="Define how many periods per week each subject is taught to each class (target: 54/week)"
        action={
          <div className="flex items-center gap-3">
            <Select id="req-class-filter" value={selectedClass ?? ''} onChange={e => setSelectedClass(e.target.value ? Number(e.target.value) : undefined)} className="w-40">
              <option value="">All Classes</option>
              {classes.map(c => <option key={c.id} value={c.id}>Class {c.name}</option>)}
            </Select>
            <Button onClick={() => { setModal(true); setApiError('') }}><Plus size={16} />Add Requirement</Button>
          </div>
        }
      />

      {/* Period progress summary */}
      {selectedClass && (
        <Card className="p-5 mb-6">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-[var(--color-text-secondary)]">Weekly periods assigned</span>
            <div className="flex items-center gap-2">
              <span className={`text-sm font-bold ${total > TOTAL ? 'text-[var(--danger-text)]' : total === TOTAL ? 'text-[var(--success-text)]' : 'text-[var(--color-text-primary)]'}`}>{total}</span>
              <span className="text-xs text-[var(--color-text-muted)]">/ {TOTAL}</span>
            </div>
          </div>
          <ProgressBar value={total} />
          <p className="text-xs text-[var(--color-text-muted)] mt-2">
            {remaining > 0 ? `${remaining} periods remaining` : remaining === 0 ? '✓ Perfectly balanced' : `${Math.abs(remaining)} periods over budget`}
          </p>
        </Card>
      )}

      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setModal(false)} />
          <Card className="relative w-full max-w-md p-6 shadow-2xl">
            <h2 className="text-base font-semibold text-[var(--color-text-primary)] mb-5">New Subject Requirement</h2>
            {apiError && <div className="mb-4"><ErrorAlert message={apiError} /></div>}
            <form
              onSubmit={e => {
                e.preventDefault()
                createMut.mutate({
                  school_class_id: selectedClass ?? Number((document.getElementById('req-class-sel') as HTMLSelectElement).value),
                  subject_id: Number(newSubjectId),
                  periods_per_week: Number(newPeriods),
                })
              }}
              className="flex flex-col gap-4"
            >
              {!selectedClass && (
                <Select id="req-class-sel" label="Class" required defaultValue="">
                  <option value="">Select class…</option>
                  {classes.map(c => <option key={c.id} value={c.id}>Class {c.name}</option>)}
                </Select>
              )}
              <Select id="req-subject" label="Subject" value={newSubjectId} onChange={e => setNewSubjectId(e.target.value)} required>
                <option value="">Select subject…</option>
                {subjects.map(s => <option key={s.id} value={s.id}>{s.code} — {s.name}</option>)}
              </Select>
              <Input id="req-periods" label="Periods / Week" type="number" min={1} max={54} placeholder="e.g. 12" value={newPeriods} onChange={e => setNewPeriods(e.target.value)} required />
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
        name={deleteTarget ? `${deleteTarget.school_class.name} — ${deleteTarget.subject.code}` : ''}
        onConfirm={() => deleteTarget && deleteMut.mutate(deleteTarget.id)}
        onCancel={() => setDeleteTarget(null)}
        loading={deleteMut.isPending}
      />

      {(isLoading || allLoading) ? (
        <div className="flex justify-center py-20"><Spinner size={32} /></div>
      ) : reqs.length === 0 ? (
        <EmptyState icon={<ClipboardList size={24} />} message="No requirements yet." action={<Button onClick={() => setModal(true)}><Plus size={14} />Add Requirement</Button>} />
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full min-w-[500px] text-sm">
            <thead>
              <tr className="border-b border-[var(--color-surface-600)]">
                <th className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">Class</th>
                <th className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">Subject</th>
                <th className="text-right px-5 py-3 text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">Periods/Week</th>
                <th className="px-5 py-3 w-10" />
              </tr>
            </thead>
            <tbody>
              {reqs.map((r, i) => (
                <tr key={r.id} className={`border-b border-[var(--color-surface-600)]/60 hover:bg-[var(--color-surface-700)]/40 transition-colors ${i === reqs.length - 1 ? 'border-b-0' : ''}`}>
                  <td className="px-5 py-3">
                    <Badge color="blue">Class {r.school_class.name}</Badge>
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      <Badge color="violet">{r.subject.code}</Badge>
                      <span className="text-[var(--color-text-secondary)]">{r.subject.name}</span>
                    </div>
                  </td>
                  <td className="px-5 py-3 text-right">
                    <span className="font-semibold text-[var(--color-text-primary)]">{r.periods_per_week}</span>
                  </td>
                  <td className="px-5 py-3">
                    <button id={`delete-req-${r.id}`} onClick={() => setDeleteTarget(r)} className="p-1.5 rounded-lg text-[var(--color-text-muted)] hover:text-[var(--hover-delete-text)] hover:bg-[var(--hover-delete-bg)] transition-colors">
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
      <Pagination currentPage={paginatedData?.page || 1} totalPages={paginatedData?.pages || 1} onPageChange={setPage} />
    </div>
  )
}
