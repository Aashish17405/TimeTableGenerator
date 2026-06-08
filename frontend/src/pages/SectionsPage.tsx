import { Pagination } from '../components/Pagination'
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Trash2, Layout } from 'lucide-react'
import { sectionsApi, classesApi } from '../services/api'
import type { Section } from '../types'
import { useSchool } from '../features/school/SchoolContext'
import {
  PageHeader, Card, Button, Badge, Input, Select,
  Spinner, EmptyState, ErrorAlert, ConfirmDelete,
} from '../components/ui'

export default function SectionsPage() {
  const qc = useQueryClient()
  const { activeSchoolId, activeSchool } = useSchool()
  const [modal, setModal] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Section | null>(null)
  const [classFilter, setClassFilter] = useState<number | undefined>()
  const [newClassId, setNewClassId] = useState('')
  const [newName, setNewName] = useState('')
  const [apiError, setApiError] = useState('')

  const [page, setPage] = useState(1)
  const { data: paginatedData, isLoading } = useQuery({ 
    queryKey: ['sections', activeSchoolId, classFilter, page],
    queryFn: () => sectionsApi.list({ school_id: activeSchoolId ?? undefined, class_id: classFilter, page, size: 20 }),
    enabled: activeSchoolId !== null,
  })
  const sections = paginatedData?.items || []
  const { data: classesData } = useQuery({
    queryKey: ['classes', activeSchoolId],
    queryFn: () => classesApi.list(activeSchoolId ?? undefined, undefined, 1000),
    enabled: activeSchoolId !== null,
  })
  const classes = classesData?.items || []

  const invalidate = () => qc.invalidateQueries({ queryKey: ['sections'] })

  const createMut = useMutation({
    mutationFn: sectionsApi.create,
    onSuccess: () => { invalidate(); setModal(false); setNewClassId(''); setNewName(''); setApiError('') },
    onError: (e: any) => setApiError(e.response?.data?.detail ?? 'Failed to create section'),
  })
  const deleteMut = useMutation({
    mutationFn: sectionsApi.delete,
    onSuccess: () => { invalidate(); setDeleteTarget(null) },
  })

  // Group sections by class for display
  const grouped = sections.reduce<Record<string, Section[]>>((acc, s) => {
    const key = s.school_class.name
    ;(acc[key] ??= []).push(s)
    return acc
  }, {})

  if (!activeSchoolId) return (
    <div className="flex items-center justify-center py-20 text-[var(--color-text-muted)] text-sm">
      Select a school from the sidebar to manage sections.
    </div>
  )

  return (
    <div>
      <PageHeader
        title="Sections"
        subtitle={`Sections for ${activeSchool?.name ?? 'current school'}`}
        action={
          <div className="flex items-center gap-3">
            <Select
              id="class-filter"
              value={classFilter ?? ''}
              onChange={e => setClassFilter(e.target.value ? Number(e.target.value) : undefined)}
              className="w-36"
            >
              <option value="">All Classes</option>
              {classes.map(c => <option key={c.id} value={c.id}>Class {c.name}</option>)}
            </Select>
            <Button onClick={() => { setModal(true); setApiError('') }}><Plus size={16} />Add Section</Button>
          </div>
        }
      />

      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setModal(false)} />
          <Card className="relative w-full max-w-md p-6 shadow-2xl">
            <h2 className="text-base font-semibold text-[var(--color-text-primary)] mb-5">New Section</h2>
            {apiError && <div className="mb-4"><ErrorAlert message={apiError} /></div>}
            <form
              onSubmit={e => {
                e.preventDefault()
                createMut.mutate({ school_class_id: Number(newClassId), name: newName.trim().toUpperCase() })
              }}
              className="flex flex-col gap-4"
            >
              <Select id="new-section-class" label="Class" value={newClassId} onChange={e => setNewClassId(e.target.value)} required>
                <option value="">Select class…</option>
                {classes.map(c => <option key={c.id} value={c.id}>Class {c.name}</option>)}
              </Select>
              <Input id="new-section-name" label="Section Name" placeholder="A" value={newName} onChange={e => setNewName(e.target.value)} required maxLength={5} />
              <div className="flex gap-3 pt-2">
                <Button type="submit" disabled={createMut.isPending}>{createMut.isPending && <Spinner size={14} />}Save</Button>
                <Button type="button" variant="ghost" onClick={() => setModal(false)}>Cancel</Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      <ConfirmDelete open={!!deleteTarget} name={deleteTarget ? `${deleteTarget.school_class.name}${deleteTarget.name}` : ''} onConfirm={() => deleteTarget && deleteMut.mutate(deleteTarget.id)} onCancel={() => setDeleteTarget(null)} loading={deleteMut.isPending} />

      {isLoading ? (
        <div className="flex justify-center py-20"><Spinner size={32} /></div>
      ) : sections.length === 0 ? (
        <EmptyState icon={<Layout size={24} />} message="No sections yet." action={<Button onClick={() => setModal(true)}><Plus size={14} />Add Section</Button>} />
      ) : (
        <div className="flex flex-col gap-6">
          {Object.entries(grouped).sort(([a], [b]) => {
            const ao = classes.find(c => c.name === a)?.display_order ?? 0
            const bo = classes.find(c => c.name === b)?.display_order ?? 0
            return ao - bo
          }).map(([className, secs]) => (
            <div key={className}>
              <div className="flex items-center gap-3 mb-3">
                <h2 className="text-sm font-semibold text-[var(--color-text-secondary)] uppercase tracking-widest">Class {className}</h2>
                <div className="flex-1 h-px bg-[var(--color-surface-600)]" />
                <Badge color="blue">{secs.length} section{secs.length !== 1 ? 's' : ''}</Badge>
              </div>
              <div className="flex flex-wrap gap-3">
                {secs.map(s => (
                  <Card key={s.id} className="px-5 py-4 flex items-center gap-4 group hover:border-[var(--color-surface-500)] transition-colors">
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[var(--color-brand-700)]/30 to-[var(--color-brand-900)]/30 border border-[var(--color-brand-700)]/20 flex items-center justify-center">
                      <span className="text-base font-bold text-[var(--color-brand-300)]">{className}{s.name}</span>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-[var(--color-text-primary)]">Section {s.name}</p>
                      <p className="text-xs text-[var(--color-text-muted)]">ID #{s.id}</p>
                    </div>
                    <button
                      id={`delete-section-${s.id}`}
                      onClick={() => setDeleteTarget(s)}
                      className="ml-2 p-1.5 rounded-lg text-[var(--color-text-muted)] hover:text-[var(--hover-delete-text)] hover:bg-[var(--hover-delete-bg)] transition-colors opacity-100 lg:opacity-0 lg:group-hover:opacity-100"
                    >
                      <Trash2 size={14} />
                    </button>
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
      <Pagination currentPage={paginatedData?.page || 1} totalPages={paginatedData?.pages || 1} onPageChange={setPage} />
    </div>
  )
}
