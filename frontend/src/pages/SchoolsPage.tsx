import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Pencil, Trash2, Building2, Users, Layout, ClipboardList, CalendarDays } from 'lucide-react'
import { schoolsApi } from '../services/api'
import type { School, SchoolStats } from '../types'
import { useSchool } from '../features/school/SchoolContext'
import {
  PageHeader, Card, Button, Input,
  Spinner, EmptyState, ErrorAlert, ConfirmDelete,
} from '../components/ui'
import { Pagination } from '../components/Pagination'

function SchoolForm({ initial, onSubmit, onCancel, loading }: {
  initial?: Partial<School>
  onSubmit: (d: { name: string; address?: string }) => void
  onCancel: () => void
  loading: boolean
}) {
  const [name, setName] = useState(initial?.name ?? '')
  const [address, setAddress] = useState(initial?.address ?? '')
  return (
    <form onSubmit={e => { e.preventDefault(); onSubmit({ name: name.trim(), address: address.trim() || undefined }) }} className="flex flex-col gap-4">
      <Input id="school-name" label="School Name" placeholder="e.g. Springfield High School" value={name} onChange={e => setName(e.target.value)} required maxLength={150} />
      <Input id="school-address" label="Address (optional)" placeholder="e.g. 123 Main St" value={address} onChange={e => setAddress(e.target.value)} maxLength={300} />
      <div className="flex gap-3 pt-2">
        <Button type="submit" disabled={loading}>{loading && <Spinner size={14} />}Save</Button>
        <Button type="button" variant="ghost" onClick={onCancel}>Cancel</Button>
      </div>
    </form>
  )
}

function StatBadge({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: number }) {
  return (
    <div className="flex flex-col items-center gap-1 rounded-lg bg-[var(--color-surface-700)]/60 px-3 py-2 min-w-[64px]">
      <Icon size={13} className="text-[var(--color-brand-400)]" />
      <span className="text-sm font-bold text-[var(--color-text-primary)]">{value}</span>
      <span className="text-[10px] text-[var(--color-text-muted)] leading-tight text-center">{label}</span>
    </div>
  )
}

function SchoolCard({ school, onEdit, onDelete, onSelect, isActive }: {
  school: School
  onEdit: () => void
  onDelete: () => void
  onSelect: () => void
  isActive: boolean
}) {
  const { data: stats } = useQuery<SchoolStats>({
    queryKey: ['school-stats', school.id],
    queryFn: () => schoolsApi.stats(school.id),
    staleTime: 30_000,
  })

  return (
    <Card className={`p-5 flex flex-col gap-4 group transition-all ${isActive ? 'border-[var(--color-brand-600)]/60 bg-[var(--color-brand-900)]/10' : 'hover:border-[var(--color-surface-500)]'}`}>
      <div className="flex items-start gap-3">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${isActive ? 'bg-gradient-to-br from-[var(--color-brand-600)] to-[var(--color-brand-800)]' : 'bg-[var(--color-surface-700)]'}`}>
          <Building2 size={18} className={isActive ? 'text-white' : 'text-[var(--color-text-muted)]'} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-[var(--color-text-primary)] truncate">{school.name}</p>
          {school.address ? (
            <p className="text-xs text-[var(--color-text-muted)] mt-0.5 truncate">{school.address}</p>
          ) : (
            <p className="text-xs text-[var(--color-text-muted)] mt-0.5 italic">No address</p>
          )}
        </div>
        <div className="flex gap-1 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity shrink-0">
          <button id={`edit-school-${school.id}`} onClick={onEdit} className="p-1.5 rounded-lg text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-600)] transition-colors">
            <Pencil size={13} />
          </button>
          <button id={`delete-school-${school.id}`} onClick={onDelete} className="p-1.5 rounded-lg text-[var(--color-text-muted)] hover:text-[var(--hover-delete-text)] hover:bg-[var(--hover-delete-bg)] transition-colors">
            <Trash2 size={13} />
          </button>
        </div>
      </div>

      {stats && (
        <div className="flex flex-wrap gap-2">
          <StatBadge icon={GraduationCap} label="Classes" value={stats.classes_count} />
          <StatBadge icon={Layout} label="Sections" value={stats.sections_count} />
          <StatBadge icon={Users} label="Teachers" value={stats.teachers_count} />
          <StatBadge icon={ClipboardList} label="Reqs" value={stats.requirements_count} />
          <StatBadge icon={CalendarDays} label="Allocs" value={stats.allocations_count} />
        </div>
      )}

      <Button
        id={`select-school-${school.id}`}
        variant={isActive ? 'primary' : 'ghost'}
        onClick={onSelect}
        className="w-full justify-center py-2 text-xs"
      >
        {isActive ? '✓ Active Campus' : 'Switch to This Campus'}
      </Button>
    </Card>
  )
}

// Add missing GraduationCap import
import { GraduationCap } from 'lucide-react'

export default function SchoolsPage() {
  const qc = useQueryClient()
  const { setActiveSchool, activeSchoolId } = useSchool()
  const [modal, setModal] = useState(false)
  const [editItem, setEditItem] = useState<School | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<School | null>(null)
  const [apiError, setApiError] = useState('')

  const [page, setPage] = useState(1)

  const { data: paginatedData, isLoading, error } = useQuery({ 
    queryKey: ['schools', page], 
    queryFn: () => schoolsApi.list(page, 20) 
  })
  const schools = paginatedData?.items || []
  const invalidate = () => qc.invalidateQueries({ queryKey: ['schools'] })

  const createMut = useMutation({
    mutationFn: schoolsApi.create,
    onSuccess: (school) => { invalidate(); setModal(false); setApiError(''); setActiveSchool(school) },
    onError: (e: any) => setApiError(e.response?.data?.detail ?? 'Failed to create'),
  })
  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => schoolsApi.update(id, data),
    onSuccess: () => { invalidate(); setEditItem(null); setApiError('') },
    onError: (e: any) => setApiError(e.response?.data?.detail ?? 'Failed to update'),
  })
  const deleteMut = useMutation({
    mutationFn: schoolsApi.delete,
    onSuccess: () => { invalidate(); setDeleteTarget(null) },
  })

  if (isLoading) return <div className="flex justify-center py-20"><Spinner size={32} /></div>
  if (error) return <ErrorAlert message="Failed to load schools." />

  return (
    <div>
      <PageHeader
        title="Schools / Campuses"
        subtitle={`${paginatedData?.total ?? 0} school${paginatedData?.total !== 1 ? 's' : ''} configured`}
        action={<Button onClick={() => { setModal(true); setApiError('') }}><Plus size={16} />Add School</Button>}
      />

      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setModal(false)} />
          <Card className="relative w-full max-w-md p-6 shadow-2xl">
            <h2 className="text-base font-semibold text-[var(--color-text-primary)] mb-5">New School</h2>
            {apiError && <div className="mb-4"><ErrorAlert message={apiError} /></div>}
            <SchoolForm onSubmit={d => createMut.mutate(d)} onCancel={() => setModal(false)} loading={createMut.isPending} />
          </Card>
        </div>
      )}

      {editItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setEditItem(null)} />
          <Card className="relative w-full max-w-md p-6 shadow-2xl">
            <h2 className="text-base font-semibold text-[var(--color-text-primary)] mb-5">Edit School</h2>
            {apiError && <div className="mb-4"><ErrorAlert message={apiError} /></div>}
            <SchoolForm initial={editItem} onSubmit={d => updateMut.mutate({ id: editItem.id, data: d })} onCancel={() => setEditItem(null)} loading={updateMut.isPending} />
          </Card>
        </div>
      )}

      <ConfirmDelete
        open={!!deleteTarget}
        name={deleteTarget?.name ?? ''}
        onConfirm={() => deleteTarget && deleteMut.mutate(deleteTarget.id)}
        onCancel={() => setDeleteTarget(null)}
        loading={deleteMut.isPending}
      />

      {schools.length === 0 ? (
        <EmptyState
          icon={<Building2 size={24} />}
          message="No schools yet. Create your first campus to get started."
          action={<Button onClick={() => setModal(true)}><Plus size={14} />Add School</Button>}
        />
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 mb-6">
            {schools.map(school => (
              <SchoolCard
                key={school.id}
                school={school}
                isActive={school.id === activeSchoolId}
                onEdit={() => { setEditItem(school); setApiError('') }}
                onDelete={() => setDeleteTarget(school)}
                onSelect={() => setActiveSchool(school)}
              />
            ))}
          </div>
          <Pagination
            currentPage={paginatedData?.page || 1}
            totalPages={paginatedData?.pages || 1}
            onPageChange={setPage}
          />
        </>
      )}
    </div>
  )
}
