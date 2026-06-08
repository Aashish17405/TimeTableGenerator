import { Pagination } from '../components/Pagination'
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Pencil, Trash2, BookOpen } from 'lucide-react'
import { subjectsApi } from '../services/api'
import type { Subject, SubjectCreate } from '../types'
import {
  PageHeader, Card, Button, Badge, Input,
  Spinner, EmptyState, ErrorAlert, ConfirmDelete,
} from '../components/ui'

const SUBJECT_COLORS: Record<string, 'blue' | 'violet' | 'green' | 'amber' | 'pink' | 'cyan' | 'default'> = {
  FL: 'blue',
  SL: 'violet',
  ENG: 'green',
  MATH: 'amber',
  PET: 'pink',
  HW: 'cyan',
}

function SubjectForm({
  initial,
  onSubmit,
  onCancel,
  loading,
}: {
  initial?: Partial<SubjectCreate>
  onSubmit: (data: SubjectCreate) => void
  onCancel: () => void
  loading: boolean
}) {
  const [code, setCode] = useState(initial?.code ?? '')
  const [name, setName] = useState(initial?.name ?? '')

  return (
    <form
      onSubmit={e => { e.preventDefault(); onSubmit({ code: code.trim().toUpperCase(), name: name.trim() }) }}
      className="flex flex-col gap-4"
    >
      <Input
        id="subject-code"
        label="Code"
        placeholder="e.g. FL"
        value={code}
        onChange={e => setCode(e.target.value)}
        required
        maxLength={20}
      />
      <Input
        id="subject-name"
        label="Full Name"
        placeholder="e.g. First Language"
        value={name}
        onChange={e => setName(e.target.value)}
        required
        maxLength={100}
      />
      <div className="flex gap-3 pt-2">
        <Button type="submit" disabled={loading}>
          {loading && <Spinner size={14} />}
          Save
        </Button>
        <Button type="button" variant="ghost" onClick={onCancel}>Cancel</Button>
      </div>
    </form>
  )
}

export default function SubjectsPage() {
  const qc = useQueryClient()
  const [modal, setModal] = useState<'create' | { id: number } | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Subject | null>(null)
  const [editSubject, setEditSubject] = useState<Subject | null>(null)
  const [apiError, setApiError] = useState('')

  const [page, setPage] = useState(1)
  const { data: paginatedData, isLoading, error } = useQuery({ queryKey: ['subjects', page],
    queryFn: () => subjectsApi.list(page), })
  const subjects = paginatedData?.items || []

  const invalidate = () => qc.invalidateQueries({ queryKey: ['subjects'] })

  const createMut = useMutation({
    mutationFn: subjectsApi.create,
    onSuccess: () => { invalidate(); setModal(null); setApiError('') },
    onError: (e: any) => setApiError(e.response?.data?.detail ?? 'Failed to create subject'),
  })

  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => subjectsApi.update(id, data),
    onSuccess: () => { invalidate(); setEditSubject(null); setApiError('') },
    onError: (e: any) => setApiError(e.response?.data?.detail ?? 'Failed to update subject'),
  })

  const deleteMut = useMutation({
    mutationFn: subjectsApi.delete,
    onSuccess: () => { invalidate(); setDeleteTarget(null) },
  })

  if (isLoading) return <div className="flex justify-center py-20"><Spinner size={32} /></div>
  if (error) return <ErrorAlert message="Failed to load subjects." />

  return (
    <div>
      <PageHeader
        title="Subjects"
        subtitle={`${subjects.length} subject${subjects.length !== 1 ? 's' : ''} configured`}
        action={
          <Button onClick={() => { setModal('create'); setApiError('') }}>
            <Plus size={16} /> Add Subject
          </Button>
        }
      />

      {/* Create modal */}
      {modal === 'create' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setModal(null)} />
          <Card className="relative w-full max-w-md p-6 shadow-2xl">
            <h2 className="text-base font-semibold text-[var(--color-text-primary)] mb-5">New Subject</h2>
            {apiError && <ErrorAlert message={apiError} />}
            <div className="mt-4">
              <SubjectForm
                onSubmit={data => createMut.mutate(data)}
                onCancel={() => setModal(null)}
                loading={createMut.isPending}
              />
            </div>
          </Card>
        </div>
      )}

      {/* Edit modal */}
      {editSubject && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setEditSubject(null)} />
          <Card className="relative w-full max-w-md p-6 shadow-2xl">
            <h2 className="text-base font-semibold text-[var(--color-text-primary)] mb-5">Edit Subject</h2>
            {apiError && <ErrorAlert message={apiError} />}
            <div className="mt-4">
              <SubjectForm
                initial={editSubject}
                onSubmit={data => updateMut.mutate({ id: editSubject.id, data })}
                onCancel={() => setEditSubject(null)}
                loading={updateMut.isPending}
              />
            </div>
          </Card>
        </div>
      )}

      <ConfirmDelete
        open={!!deleteTarget}
        name={deleteTarget ? `${deleteTarget.code} — ${deleteTarget.name}` : ''}
        onConfirm={() => deleteTarget && deleteMut.mutate(deleteTarget.id)}
        onCancel={() => setDeleteTarget(null)}
        loading={deleteMut.isPending}
      />

      {subjects.length === 0 ? (
        <EmptyState
          icon={<BookOpen size={24} />}
          message="No subjects yet. Add your first subject to get started."
          action={<Button onClick={() => setModal('create')}><Plus size={14} /> Add Subject</Button>}
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {subjects.map(s => (
            <Card key={s.id} className="p-5 hover:border-[var(--color-surface-500)] transition-colors group">
              <div className="flex items-start justify-between mb-3">
                <Badge color={SUBJECT_COLORS[s.code] ?? 'default'}>{s.code}</Badge>
                <div className="flex gap-1 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity">
                  <button
                    id={`edit-subject-${s.id}`}
                    onClick={() => { setEditSubject(s); setApiError('') }}
                    className="p-1.5 rounded-lg text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-600)] transition-colors"
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    id={`delete-subject-${s.id}`}
                    onClick={() => setDeleteTarget(s)}
                    className="p-1.5 rounded-lg text-[var(--color-text-muted)] hover:text-[var(--hover-delete-text)] hover:bg-[var(--hover-delete-bg)] transition-colors"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
              <p className="text-sm font-medium text-[var(--color-text-primary)]">{s.name}</p>
              <p className="text-xs text-[var(--color-text-muted)] mt-1">ID #{s.id}</p>
            </Card>
          ))}
        </div>
      )}
      <Pagination currentPage={paginatedData?.page || 1} totalPages={paginatedData?.pages || 1} onPageChange={setPage} />
    </div>
  )
}
