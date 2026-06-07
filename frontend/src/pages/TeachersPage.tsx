import { Pagination } from '../components/Pagination'
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Pencil, Trash2, Users, Mail, GraduationCap, X } from 'lucide-react'
import { teachersApi, classesApi, teacherClassMappingsApi } from '../services/api'
import type { Teacher } from '../types'
import { useSchool } from '../features/school/SchoolContext'
import {
  PageHeader, Card, Button, Input,
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
                        ? 'border-[var(--color-brand-600)]/50 bg-[var(--color-brand-900)]/20'
                        : 'border-[var(--color-surface-600)] bg-[var(--color-surface-700)]'
                    }`}
                  >
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 font-bold text-base ${isMapped ? 'bg-[var(--color-brand-700)]/40 text-[var(--color-brand-300)]' : 'bg-[var(--color-surface-600)] text-[var(--color-text-muted)]'}`}>
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
                        className="px-3 py-1.5 text-xs font-medium rounded-lg border border-red-800/40 text-red-400 bg-red-900/20 hover:bg-red-900/40 transition-colors"
                      >
                        Remove
                      </button>
                    ) : (
                      <button
                        onClick={() => addMut.mutate({ teacher_id: teacher.id, class_id: cls.id })}
                        disabled={addMut.isPending}
                        className="px-3 py-1.5 text-xs font-medium rounded-lg border border-[var(--color-brand-700)]/50 text-[var(--color-brand-300)] bg-[var(--color-brand-900)]/20 hover:bg-[var(--color-brand-900)]/40 transition-colors"
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

export default function TeachersPage() {
  const qc = useQueryClient()
  const { activeSchoolId, activeSchool } = useSchool()
  const [modal, setModal] = useState(false)
  const [editItem, setEditItem] = useState<Teacher | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Teacher | null>(null)
  const [mappingTarget, setMappingTarget] = useState<Teacher | null>(null)
  const [apiError, setApiError] = useState('')

  const [page, setPage] = useState(1)
  const { data: paginatedData, isLoading, error } = useQuery({ 
    queryKey: ['teachers', activeSchoolId, page],
    queryFn: () => teachersApi.list(activeSchoolId ?? undefined, page, 20),
    enabled: activeSchoolId !== null, 
  })
  const teachers = paginatedData?.items || []
  const invalidate = () => qc.invalidateQueries({ queryKey: ['teachers', activeSchoolId] })

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

      <ConfirmDelete open={!!deleteTarget} name={deleteTarget?.name ?? ''} onConfirm={() => deleteTarget && deleteMut.mutate(deleteTarget.id)} onCancel={() => setDeleteTarget(null)} loading={deleteMut.isPending} />

      {teachers.length === 0 ? (
        <EmptyState icon={<Users size={24} />} message="No teachers yet." action={<Button onClick={() => setModal(true)}><Plus size={14} />Add Teacher</Button>} />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {teachers.map(t => (
            <Card key={t.id} className="p-5 hover:border-[var(--color-surface-500)] transition-colors group">
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
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                  <button id={`edit-teacher-${t.id}`} onClick={() => { setEditItem(t); setApiError('') }} className="p-1.5 rounded-lg text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-600)] transition-colors">
                    <Pencil size={14} />
                  </button>
                  <button id={`delete-teacher-${t.id}`} onClick={() => setDeleteTarget(t)} className="p-1.5 rounded-lg text-[var(--color-text-muted)] hover:text-red-400 hover:bg-red-900/20 transition-colors">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
              <button
                id={`assign-classes-${t.id}`}
                onClick={() => setMappingTarget(t)}
                className="mt-3 flex items-center gap-1.5 text-[10px] font-medium text-[var(--color-brand-400)] hover:text-[var(--color-brand-300)] transition-colors"
              >
                <GraduationCap size={11} />
                Assign to Classes
              </button>
            </Card>
          ))}
        </div>
      )}
      <Pagination currentPage={paginatedData?.page || 1} totalPages={paginatedData?.pages || 1} onPageChange={setPage} />
    </div>
  )
}
