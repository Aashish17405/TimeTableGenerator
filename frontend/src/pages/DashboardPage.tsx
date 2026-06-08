import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { BookOpen, GraduationCap, Layout, Users, ClipboardList, CalendarDays, ArrowRight } from 'lucide-react'
import { subjectsApi, classesApi, sectionsApi, teachersApi, requirementsApi, allocationsApi } from '../services/api'
import { Card } from '../components/ui'
import { useSchool } from '../features/school/SchoolContext'

function StatCard({ icon: Icon, label, count, to, color }: { icon: any; label: string; count: number | undefined; to: string; color: string }) {
  return (
    <Link to={to} className="group">
      <Card className="p-5 hover:border-[var(--color-surface-500)] transition-all duration-200 hover:shadow-lg hover:shadow-black/20 hover:-translate-y-0.5">
        <div className="flex items-start justify-between mb-4">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${color}`}>
            <Icon size={18} className="text-white" />
          </div>
          <ArrowRight size={16} className="text-[var(--color-text-muted)] group-hover:text-[var(--color-brand-400)] transition-colors group-hover:translate-x-0.5 transform" />
        </div>
        <p className="text-2xl font-bold text-[var(--color-text-primary)]">
          {count === undefined ? <span className="inline-block w-8 h-7 bg-[var(--color-surface-600)] rounded animate-pulse" /> : count}
        </p>
        <p className="text-xs text-[var(--color-text-muted)] mt-1 font-medium uppercase tracking-wide">{label}</p>
      </Card>
    </Link>
  )
}

export default function DashboardPage() {
  const { activeSchoolId } = useSchool()
  const { data: subjectsData } = useQuery({ queryKey: ['subjects'], queryFn: () => subjectsApi.list(undefined, 1000) })
  const subjects = subjectsData?.items || []
  const { data: classesData } = useQuery({ queryKey: ['classes', activeSchoolId], queryFn: () => classesApi.list(activeSchoolId ?? undefined, undefined, 1000), enabled: activeSchoolId !== null })
  const classes = classesData?.items || []
  const { data: sectionsData } = useQuery({ queryKey: ['sections', activeSchoolId], queryFn: () => sectionsApi.list({ school_id: activeSchoolId ?? undefined, size: 1000 }), enabled: activeSchoolId !== null })
  const sections = sectionsData?.items || []
  const { data: teachersData } = useQuery({ queryKey: ['teachers', activeSchoolId], queryFn: () => teachersApi.list(activeSchoolId ?? undefined, undefined, 1000), enabled: activeSchoolId !== null })
  const teachers = teachersData?.items || []
  const { data: reqsData } = useQuery({ queryKey: ['requirements', activeSchoolId], queryFn: () => requirementsApi.list({ school_id: activeSchoolId ?? undefined, size: 1000 }), enabled: activeSchoolId !== null })
  const reqs = reqsData?.items || []
  const { data: allocsData } = useQuery({ queryKey: ['allocations', activeSchoolId], queryFn: () => allocationsApi.list({ school_id: activeSchoolId ?? undefined, size: 1000 }), enabled: activeSchoolId !== null })
  const allocs = allocsData?.items || []

  const stats = [
    { icon: BookOpen, label: 'Subjects', count: subjects?.length, to: '/subjects', color: 'bg-blue-600' },
    { icon: GraduationCap, label: 'Classes', count: classes?.length, to: '/classes', color: 'bg-violet-600' },
    { icon: Layout, label: 'Sections', count: sections?.length, to: '/sections', color: 'bg-indigo-600' },
    { icon: Users, label: 'Teachers', count: teachers?.length, to: '/teachers', color: 'bg-purple-600' },
    { icon: ClipboardList, label: 'Requirements', count: reqs?.length, to: '/requirements', color: 'bg-fuchsia-600' },
    { icon: CalendarDays, label: 'Allocations', count: allocs?.length, to: '/allocations', color: 'bg-pink-600' },
  ]

  return (
    <div>
      <div className="mb-10">
        <p className="text-xs font-semibold text-[var(--color-brand-400)] uppercase tracking-widest mb-2">Overview</p>
        <h1 className="text-3xl font-bold text-[var(--color-text-primary)] tracking-tight">Timetable Generator</h1>
        <p className="text-[var(--color-text-muted)] mt-2 text-sm max-w-lg">
          Manage your school's subjects, classes, sections, teachers, and allocations. The data you enter here powers the timetable solver.
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-10">
        {stats.map(s => <StatCard key={s.to} {...s} />)}
      </div>

      {/* Quick guide */}
      <Card className="p-6">
        <h2 className="text-sm font-semibold text-[var(--color-text-primary)] mb-4">Setup checklist</h2>
        <ol className="space-y-3">
          {[
            { step: 1, label: 'Add Subjects', sub: 'FL, SL, ENG, MATH, PET, HW…', to: '/subjects', done: (subjects?.length ?? 0) > 0 },
            { step: 2, label: 'Add Classes', sub: 'I through VIII with display order', to: '/classes', done: (classes?.length ?? 0) > 0 },
            { step: 3, label: 'Add Sections', sub: 'A, B sections for each class', to: '/sections', done: (sections?.length ?? 0) > 0 },
            { step: 4, label: 'Add Teachers', sub: 'Staff who will be allocated', to: '/teachers', done: (teachers?.length ?? 0) > 0 },
            { step: 5, label: 'Set Requirements', sub: '54 periods/week per class', to: '/requirements', done: (reqs?.length ?? 0) > 0 },
            { step: 6, label: 'Create Allocations', sub: 'Assign teachers to sections', to: '/allocations', done: (allocs?.length ?? 0) > 0 },
          ].map(({ step, label, sub, to, done }) => (
            <li key={step} className="flex items-center gap-4 group">
              <div className={`w-7 h-7 rounded-full border-2 flex items-center justify-center text-xs font-bold shrink-0 transition-colors ${done ? 'bg-[var(--success-bg)] border-[var(--success-border)] text-[var(--success-text)]' : 'border-[var(--color-surface-500)] text-[var(--color-text-muted)]'}`}>
                {done ? '✓' : step}
              </div>
              <Link to={to} className="flex-1 min-w-0">
                <p className={`text-sm font-medium group-hover:text-[var(--color-brand-300)] transition-colors ${done ? 'text-[var(--color-text-secondary)] line-through decoration-[var(--success-strike)]' : 'text-[var(--color-text-primary)]'}`}>{label}</p>
                <p className="text-xs text-[var(--color-text-muted)] truncate">{sub}</p>
              </Link>
            </li>
          ))}
        </ol>
      </Card>
    </div>
  )
}
