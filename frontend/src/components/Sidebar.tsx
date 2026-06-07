import { Link, useLocation } from 'react-router-dom'
import {
  BookOpen, GraduationCap, Layout, Users,
  ClipboardList, CalendarDays, Menu, X, Sparkles,
  Building2, ChevronDown, Check, PanelLeftClose, PanelLeftOpen
} from 'lucide-react'
import { useState, useRef, useEffect } from 'react'
import { useSchool } from '../features/school/SchoolContext'

const nav = [
  { to: '/schools', label: 'Schools', icon: Building2 },
  { to: '/subjects', label: 'Subjects', icon: BookOpen },
  { to: '/classes', label: 'Classes', icon: GraduationCap },
  { to: '/sections', label: 'Sections', icon: Layout },
  { to: '/teachers', label: 'Teachers', icon: Users },
  { to: '/requirements', label: 'Requirements', icon: ClipboardList },
  { to: '/allocations', label: 'Allocations', icon: CalendarDays },
  { to: '/timetable', label: 'Timetable', icon: Sparkles },
  { to: '/ai-timetable', label: 'AI Timetable', icon: Sparkles },
]

export default function Sidebar() {
  const { pathname } = useLocation()
  const [open, setOpen] = useState(false)
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const { schools, activeSchool, setActiveSchool } = useSchool()

  const [collapsed, setCollapsed] = useState(() => {
    return localStorage.getItem('sidebar_collapsed') === 'true'
  })

  useEffect(() => {
    localStorage.setItem('sidebar_collapsed', String(collapsed))
  }, [collapsed])

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  return (
    <>
      {/* Mobile overlay */}
      <div
        className={`fixed inset-0 z-20 bg-black/60 lg:hidden transition-opacity ${open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
        onClick={() => setOpen(false)}
      />

      {/* Sidebar */}
      <aside
        className={`
          fixed top-0 left-0 z-30 h-screen flex flex-col
          bg-[var(--color-surface-800)] border-r border-[var(--color-surface-600)]
          transition-all duration-300
          ${open ? 'translate-x-0 w-64' : '-translate-x-full w-64'}
          lg:translate-x-0 ${collapsed ? 'lg:w-16' : 'lg:w-64'} lg:static lg:flex
        `}
      >
        {/* Logo */}
        <div className={`flex items-center gap-3 py-5 border-b border-[var(--color-surface-600)] ${collapsed ? 'justify-center px-2' : 'px-6'}`}>
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[var(--color-brand-500)] to-[var(--color-brand-700)] flex items-center justify-center shrink-0">
            <CalendarDays size={16} className="text-white" />
          </div>
          {!collapsed && (
            <div className="overflow-hidden whitespace-nowrap">
              <p className="text-sm font-semibold text-[var(--color-text-primary)] leading-tight">Timetable</p>
              <p className="text-xs text-[var(--color-text-muted)]">Generator</p>
            </div>
          )}
          <button className="ml-auto lg:hidden text-[var(--color-text-muted)]" onClick={() => setOpen(false)}>
            <X size={18} />
          </button>
        </div>

        {/* School Switcher */}
        <div className={`py-3 border-b border-[var(--color-surface-600)] relative ${collapsed ? 'px-2' : 'px-3'}`} ref={dropdownRef}>
          {!collapsed && <p className="text-[10px] font-semibold uppercase tracking-widest text-[var(--color-text-muted)] px-2 mb-1.5 whitespace-nowrap">Active Campus</p>}
          <button
            onClick={() => setDropdownOpen(d => !d)}
            className={`w-full flex items-center gap-2.5 rounded-lg border border-[var(--color-surface-500)] bg-[var(--color-surface-700)] hover:border-[var(--color-brand-600)]/60 transition-all ${collapsed ? 'p-2.5 justify-center' : 'px-3 py-2.5 text-left'}`}
          >
            <Building2 size={15} className="text-[var(--color-brand-400)] shrink-0" />
            {!collapsed && (
              <>
                <span className="flex-1 text-xs font-medium text-[var(--color-text-primary)] truncate">
                  {activeSchool?.name ?? 'No school selected'}
                </span>
                <ChevronDown
                  size={14}
                  className={`text-[var(--color-text-muted)] transition-transform ${dropdownOpen ? 'rotate-180' : ''}`}
                />
              </>
            )}
          </button>

          {dropdownOpen && schools.length > 0 && (
            <div className={`z-50 rounded-lg border border-[var(--color-surface-500)] bg-[var(--color-surface-800)] shadow-xl overflow-hidden ${collapsed ? 'absolute left-full top-0 ml-2 w-48' : 'mt-1.5'}`}>
              {schools.map(school => (
                <button
                  key={school.id}
                  onClick={() => { setActiveSchool(school); setDropdownOpen(false) }}
                  className="w-full flex items-center gap-2 px-3 py-2.5 text-xs text-left hover:bg-[var(--color-surface-700)] transition-colors"
                >
                  <Building2 size={13} className="text-[var(--color-text-muted)] shrink-0" />
                  <span className={`flex-1 truncate font-medium ${school.id === activeSchool?.id ? 'text-[var(--color-brand-300)]' : 'text-[var(--color-text-secondary)]'}`}>
                    {school.name}
                  </span>
                  {school.id === activeSchool?.id && <Check size={12} className="text-[var(--color-brand-400)] shrink-0" />}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Nav */}
        <nav className={`flex-1 overflow-y-auto py-4 space-y-1 ${collapsed ? 'px-2' : 'px-3'}`}>
          {nav.map(({ to, label, icon: Icon }) => {
            const active = pathname === to || pathname.startsWith(to + '/')
            return (
              <Link
                key={to}
                to={to}
                title={collapsed ? label : undefined}
                className={`
                  flex items-center gap-3 rounded-lg text-sm font-medium
                  transition-all duration-150 group
                  ${collapsed ? 'p-2.5 justify-center' : 'px-3 py-2.5'}
                  ${active
                    ? 'bg-[var(--color-brand-700)]/30 text-[var(--color-brand-300)] border border-[var(--color-brand-700)]/40'
                    : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-700)] hover:text-[var(--color-text-primary)] border border-transparent'
                  }
                `}
              >
                <Icon
                  size={17}
                  className={`shrink-0 transition-colors ${active ? 'text-[var(--color-brand-400)]' : 'text-[var(--color-text-muted)] group-hover:text-[var(--color-text-secondary)]'}`}
                />
                {!collapsed && (
                  <>
                    <span className="truncate">{label}</span>
                    {active && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-[var(--color-brand-400)] shrink-0" />}
                  </>
                )}
              </Link>
            )
          })}
        </nav>

        {/* Footer */}
        <div className={`flex items-center ${collapsed ? 'justify-center p-3' : 'px-4 py-3 justify-between'} border-t border-[var(--color-surface-600)]`}>
          {!collapsed && <p className="text-xs text-[var(--color-text-muted)] whitespace-nowrap">Data Layer v0.2</p>}
          <button 
            onClick={() => setCollapsed(!collapsed)}
            className="hidden lg:flex p-1.5 rounded-lg text-[var(--color-text-muted)] hover:bg-[var(--color-surface-700)] hover:text-[var(--color-text-primary)] transition-colors"
          >
            {collapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
          </button>
        </div>
      </aside>

      {/* Mobile toggle */}
      <button
        className="lg:hidden fixed top-4 left-4 z-40 p-2 rounded-lg bg-[var(--color-surface-700)] text-[var(--color-text-secondary)] border border-[var(--color-surface-600)]"
        onClick={() => setOpen(true)}
      >
        <Menu size={20} />
      </button>
    </>
  )
}
