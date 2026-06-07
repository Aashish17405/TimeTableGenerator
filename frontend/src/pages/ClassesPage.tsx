import { Pagination } from '../components/Pagination'
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Pencil, Trash2, GraduationCap, Users, X } from 'lucide-react'
import { classesApi, teachersApi, teacherClassMappingsApi } from '../services/api'
import type { SchoolClass } from '../types'
import { useSchool } from '../features/school/SchoolContext'
import {
  PageHeader, Card, Button, Input,
  Spinner, EmptyState, ErrorAlert, ConfirmDelete,
} from '../components/ui'

function ClassForm({
  initial,
  schoolId,
  onSubmit,
  onCancel,
  loading,
}: {
  initial?: Partial<SchoolClass>
  schoolId: number
  onSubmit: (data: { name: string; display_order: number; school_id: number }) => void
  onCancel: () => void
  loading: boolean
}) {
  const [name, setName] = useState(initial?.name ?? '')
  const [order, setOrder] = useState(String(initial?.display_order ?? ''))

  return (
    <form
      onSubmit={e => { e.preventDefault(); onSubmit({ name: name.trim(), display_order: Number(order), school_id: schoolId }) }}
      className="flex flex-col gap-4"
    >
      <Input id="class-name" label="Class Name" placeholder="e.g. VI" value={name} onChange={e => setName(e.target.value)} required maxLength={20} />
      <Input id="class-order" label="Display Order" type="number" placeholder="e.g. 6" value={order} onChange={e => setOrder(e.target.value)} required min={1} />
      <div className="flex gap-3 pt-2">
        <Button type="submit" disabled={loading}>{loading && <Spinner size={14} />}Save</Button>
        <Button type="button" variant="ghost" onClick={onCancel}>Cancel</Button>
      </div>
    </form>
  )
}

function TeacherMappingModal({ schoolClass, schoolId, onClose }: {
  schoolClass: SchoolClass
  schoolId: number
  onClose: () => void
}) {
  const qc = useQueryClient()
  const [apiError, setApiError] = useState('')

  const { data: teachersData } = useQuery({
    queryKey: ['teachers', schoolId],
    queryFn: () => teachersApi.list(schoolId, undefined, 1000),
  })
  const allTeachers = teachersData?.items || []

  const { data: paginatedData, isLoading: mappingsLoading } = useQuery({
    queryKey: ['teacher-class-mappings', 'class', schoolClass.id],
    queryFn: () => teacherClassMappingsApi.list({ class_id: schoolClass.id, size: 1000 }),
  })
  const mappings = paginatedData?.items || []
  const mappedTeacherIds = new Set(mappings.map(m => m.teacher_id))

  const addMut = useMutation({
    mutationFn: teacherClassMappingsApi.create,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['teacher-class-mappings', 'class', schoolClass.id] })
      setApiError('')
    },
    onError: (e: any) => setApiError(e.response?.data?.detail ?? 'Failed to add mapping'),
  })

  const removeMut = useMutation({
    mutationFn: teacherClassMappingsApi.delete,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['teacher-class-mappings', 'class', schoolClass.id] })
    },
  })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <Card className="relative w-full max-w-lg p-6 shadow-2xl max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-base font-semibold text-[var(--color-text-primary)]">
              Mapped Teachers — Class {schoolClass.name}
            </h2>
            <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
              Only mapped teachers can be allocated to sections of this class.
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
            {allTeachers.length === 0 ? (
              <p className="text-xs text-[var(--color-text-muted)] text-center py-6">
                No teachers in this school yet. Add teachers first.
              </p>
            ) : (
              allTeachers.map(teacher => {
                const isMapped = mappedTeacherIds.has(teacher.id)
                const mapping = mappings.find(m => m.teacher_id === teacher.id)
                return (
                  <div
                    key={teacher.id}
                    className={`flex items-center gap-3 rounded-lg border px-4 py-3 transition-all ${
                      isMapped
                        ? 'border-[var(--color-brand-600)]/50 bg-[var(--color-brand-900)]/20'
                        : 'border-[var(--color-surface-600)] bg-[var(--color-surface-700)]'
                    }`}
                  >
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[var(--color-brand-600)] to-[var(--color-brand-800)] flex items-center justify-center shrink-0">
                      <span className="text-xs font-bold text-white">{teacher.name.charAt(0).toUpperCase()}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-[var(--color-text-primary)] truncate">{teacher.name}</p>
                      {teacher.email && <p className="text-xs text-[var(--color-text-muted)] truncate">{teacher.email}</p>}
                    </div>
                    {isMapped ? (
                      <button
                        onClick={() => mapping && removeMut.mutate(mapping.id)}
                        disabled={removeMut.isPending}
                        className="px-3 py-1.5 text-xs font-medium rounded-lg border border-red-800/40 text-red-400 bg-red-900/20 hover:bg-red-900/40 transition-colors"
                      >
                        Remove
                      </button>
                    ) : (
                      <button
                        onClick={() => addMut.mutate({ teacher_id: teacher.id, class_id: schoolClass.id })}
                        disabled={addMut.isPending}
                        className="px-3 py-1.5 text-xs font-medium rounded-lg border border-[var(--color-brand-700)]/50 text-[var(--color-brand-300)] bg-[var(--color-brand-900)]/20 hover:bg-[var(--color-brand-900)]/40 transition-colors"
                      >
                        Add
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

export default function ClassesPage() {
  const qc = useQueryClient()
  const { activeSchoolId, activeSchool } = useSchool()
  const [modal, setModal] = useState<'create' | null>(null)
  const [editItem, setEditItem] = useState<SchoolClass | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<SchoolClass | null>(null)
  const [mappingTarget, setMappingTarget] = useState<SchoolClass | null>(null)
  const [apiError, setApiError] = useState('')

  const [page, setPage] = useState(1)
  const { data: paginatedData, isLoading, error } = useQuery({ 
    queryKey: ['classes', activeSchoolId, page],
    queryFn: () => classesApi.list(activeSchoolId ?? undefined, page, 20),
    enabled: activeSchoolId !== null, 
  })
  const classes = paginatedData?.items || []
  const invalidate = () => qc.invalidateQueries({ queryKey: ['classes', activeSchoolId] })

  const createMut = useMutation({
    mutationFn: classesApi.create,
    onSuccess: () => { invalidate(); setModal(null); setApiError('') },
    onError: (e: any) => setApiError(e.response?.data?.detail ?? 'Failed to create'),
  })
  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => classesApi.update(id, data),
    onSuccess: () => { invalidate(); setEditItem(null); setApiError('') },
    onError: (e: any) => setApiError(e.response?.data?.detail ?? 'Failed to update'),
  })
  const deleteMut = useMutation({
    mutationFn: classesApi.delete,
    onSuccess: () => { invalidate(); setDeleteTarget(null) },
  })

  if (!activeSchoolId) return (
    <div className="flex items-center justify-center py-20 text-[var(--color-text-muted)] text-sm">
      Select a school from the sidebar to manage classes.
    </div>
  )

  if (isLoading) return <div className="flex justify-center py-20"><Spinner size={32} /></div>
  if (error) return <ErrorAlert message="Failed to load classes." />

  return (
    <div>
      <PageHeader
        title="School Classes"
        subtitle={`Classes for ${activeSchool?.name ?? 'current school'}`}
        action={<Button onClick={() => { setModal('create'); setApiError('') }}><Plus size={16} />Add Class</Button>}
      />

      {modal === 'create' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setModal(null)} />
          <Card className="relative w-full max-w-md p-6 shadow-2xl">
            <h2 className="text-base font-semibold text-[var(--color-text-primary)] mb-5">New Class</h2>
            {apiError && <div className="mb-4"><ErrorAlert message={apiError} /></div>}
            <ClassForm schoolId={activeSchoolId} onSubmit={d => createMut.mutate(d)} onCancel={() => setModal(null)} loading={createMut.isPending} />
          </Card>
        </div>
      )}

      {editItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setEditItem(null)} />
          <Card className="relative w-full max-w-md p-6 shadow-2xl">
            <h2 className="text-base font-semibold text-[var(--color-text-primary)] mb-5">Edit Class</h2>
            {apiError && <div className="mb-4"><ErrorAlert message={apiError} /></div>}
            <ClassForm schoolId={activeSchoolId} initial={editItem} onSubmit={d => updateMut.mutate({ id: editItem.id, data: d })} onCancel={() => setEditItem(null)} loading={updateMut.isPending} />
          </Card>
        </div>
      )}

      {mappingTarget && (
        <TeacherMappingModal
          schoolClass={mappingTarget}
          schoolId={activeSchoolId}
          onClose={() => setMappingTarget(null)}
        />
      )}

      <ConfirmDelete open={!!deleteTarget} name={deleteTarget?.name ?? ''} onConfirm={() => deleteTarget && deleteMut.mutate(deleteTarget.id)} onCancel={() => setDeleteTarget(null)} loading={deleteMut.isPending} />

      {classes.length === 0 ? (
        <EmptyState icon={<GraduationCap size={24} />} message="No classes yet." action={<Button onClick={() => setModal('create')}><Plus size={14} />Add Class</Button>} />
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {classes.map(c => (
            <Card key={c.id} className="p-5 flex flex-col items-center text-center group hover:border-[var(--color-surface-500)] transition-colors relative">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[var(--color-brand-700)]/40 to-[var(--color-brand-900)]/40 border border-[var(--color-brand-700)]/30 flex items-center justify-center mb-3">
                <span className="text-lg font-bold text-[var(--color-brand-300)]">{c.name}</span>
              </div>
              <p className="text-xs text-[var(--color-text-muted)]">Order #{c.display_order}</p>
              <button
                id={`manage-teachers-${c.id}`}
                onClick={() => setMappingTarget(c)}
                className="mt-3 flex items-center gap-1.5 text-[10px] font-medium text-[var(--color-brand-400)] hover:text-[var(--color-brand-300)] transition-colors"
              >
                <Users size={11} />
                Manage Teachers
              </button>
              <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button id={`edit-class-${c.id}`} onClick={() => { setEditItem(c); setApiError('') }} className="p-1.5 rounded-lg text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-600)] transition-colors">
                  <Pencil size={12} />
                </button>
                <button id={`delete-class-${c.id}`} onClick={() => setDeleteTarget(c)} className="p-1.5 rounded-lg text-[var(--color-text-muted)] hover:text-red-400 hover:bg-red-900/20 transition-colors">
                  <Trash2 size={12} />
                </button>
              </div>
            </Card>
          ))}
        </div>
      )}
      <Pagination currentPage={paginatedData?.page || 1} totalPages={paginatedData?.pages || 1} onPageChange={setPage} />
    </div>
  )
}
