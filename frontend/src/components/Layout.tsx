import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import Sidebar from '../components/Sidebar'
import { Menu, Sun, Moon } from 'lucide-react'
import { useTheme } from '../context/ThemeContext'

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const { theme, toggleTheme } = useTheme()

  return (
    <div className="flex flex-col lg:flex-row h-screen overflow-hidden bg-[var(--color-surface-900)] text-[var(--color-text-primary)]">
      
      {/* Mobile Top Bar */}
      <header className="lg:hidden flex items-center justify-between px-4 py-3 border-b border-[var(--color-surface-600)] bg-[var(--color-surface-800)] shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2 -ml-2 rounded-lg text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-700)] transition-colors cursor-pointer"
            aria-label="Open menu"
          >
            <Menu size={20} />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[var(--color-brand-500)] to-[var(--color-brand-700)] flex items-center justify-center shrink-0">
              <span className="text-white text-xs font-bold font-mono">TG</span>
            </div>
            <span className="text-sm font-semibold text-[var(--color-text-primary)] leading-tight">Timetable</span>
          </div>
        </div>

        <button
          onClick={toggleTheme}
          className="p-2 rounded-lg text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-700)] transition-colors cursor-pointer"
          aria-label="Toggle theme"
        >
          {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
        </button>
      </header>

      <Sidebar open={sidebarOpen} setOpen={setSidebarOpen} />
      
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-full mx-auto px-4 sm:px-6 py-6 sm:py-8">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
