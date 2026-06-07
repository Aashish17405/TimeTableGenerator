import type { ReactNode } from 'react'

// ─── Page Header ──────────────────────────────────────────────────────────────
interface PageHeaderProps {
  title: string
  subtitle?: string
  action?: ReactNode
}
export function PageHeader({ title, subtitle, action }: PageHeaderProps) {
  return (
    <div className="flex items-start justify-between mb-8">
      <div>
        <h1 className="text-2xl font-bold text-[var(--color-text-primary)] tracking-tight">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-[var(--color-text-muted)]">{subtitle}</p>}
      </div>
      {action && <div className="shrink-0 ml-4">{action}</div>}
    </div>
  )
}

// ─── Card ─────────────────────────────────────────────────────────────────────
interface CardProps { children: ReactNode; className?: string }
export function Card({ children, className = '' }: CardProps) {
  return (
    <div className={`bg-[var(--color-surface-800)] border border-[var(--color-surface-600)] rounded-xl ${className}`}>
      {children}
    </div>
  )
}

// ─── Button ───────────────────────────────────────────────────────────────────
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'ghost' | 'danger'
  size?: 'sm' | 'md'
  children: ReactNode
}
export function Button({ variant = 'primary', size = 'md', children, className = '', ...props }: ButtonProps) {
  const base = 'inline-flex items-center gap-2 font-medium rounded-lg transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer'
  const sizes = { sm: 'px-3 py-1.5 text-xs', md: 'px-4 py-2 text-sm' }
  const variants = {
    primary: 'bg-[var(--color-brand-600)] hover:bg-[var(--color-brand-500)] text-white shadow-sm',
    ghost: 'bg-transparent hover:bg-[var(--color-surface-700)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] border border-[var(--color-surface-600)]',
    danger: 'bg-red-900/20 hover:bg-red-900/40 text-red-400 border border-red-900/40',
  }
  return (
    <button className={`${base} ${sizes[size]} ${variants[variant]} ${className}`} {...props}>
      {children}
    </button>
  )
}

// ─── Badge ────────────────────────────────────────────────────────────────────
interface BadgeProps { children: ReactNode; color?: 'blue' | 'violet' | 'green' | 'amber' | 'default' }
export function Badge({ children, color = 'default' }: BadgeProps) {
  const colors = {
    blue: 'bg-blue-900/30 text-blue-300 border-blue-800/40',
    violet: 'bg-violet-900/30 text-violet-300 border-violet-800/40',
    green: 'bg-emerald-900/30 text-emerald-300 border-emerald-800/40',
    amber: 'bg-amber-900/30 text-amber-300 border-amber-800/40',
    default: 'bg-[var(--color-surface-600)] text-[var(--color-text-secondary)] border-[var(--color-surface-500)]',
  }
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium border ${colors[color]}`}>
      {children}
    </span>
  )
}

// ─── Input ────────────────────────────────────────────────────────────────────
interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> { label?: string; error?: string }
export function Input({ label, error, className = '', id, ...props }: InputProps) {
  return (
    <div className="flex flex-col gap-1.5">
      {label && <label htmlFor={id} className="text-xs font-medium text-[var(--color-text-secondary)] uppercase tracking-wide">{label}</label>}
      <input
        id={id}
        className={`
          w-full px-3 py-2 rounded-lg text-sm
          bg-[var(--color-surface-700)] border border-[var(--color-surface-500)]
          text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)]
          focus:outline-none focus:border-[var(--color-brand-500)] focus:ring-1 focus:ring-[var(--color-brand-500)]/30
          transition-colors
          ${error ? 'border-red-600 focus:border-red-500' : ''}
          ${className}
        `}
        {...props}
      />
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  )
}

// ─── Select ───────────────────────────────────────────────────────────────────
interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> { label?: string; error?: string; children: ReactNode }
export function Select({ label, error, className = '', id, children, ...props }: SelectProps) {
  return (
    <div className="flex flex-col gap-1.5">
      {label && <label htmlFor={id} className="text-xs font-medium text-[var(--color-text-secondary)] uppercase tracking-wide">{label}</label>}
      <select
        id={id}
        className={`
          w-full px-3 py-2 rounded-lg text-sm
          bg-[var(--color-surface-700)] border border-[var(--color-surface-500)]
          text-[var(--color-text-primary)]
          focus:outline-none focus:border-[var(--color-brand-500)] focus:ring-1 focus:ring-[var(--color-brand-500)]/30
          transition-colors cursor-pointer
          ${error ? 'border-red-600' : ''}
          ${className}
        `}
        {...props}
      >
        {children}
      </select>
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  )
}

// ─── Loading spinner ──────────────────────────────────────────────────────────
export function Spinner({ size = 20 }: { size?: number }) {
  return (
    <svg
      width={size} height={size} viewBox="0 0 24 24" fill="none"
      className="animate-spin text-[var(--color-brand-500)]"
    >
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" strokeOpacity="0.2" />
      <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

// ─── Empty state ──────────────────────────────────────────────────────────────
export function EmptyState({ icon, message, action }: { icon: ReactNode; message: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="w-14 h-14 rounded-2xl bg-[var(--color-surface-700)] flex items-center justify-center mb-4 text-[var(--color-text-muted)]">
        {icon}
      </div>
      <p className="text-sm text-[var(--color-text-muted)] mb-4">{message}</p>
      {action}
    </div>
  )
}

// ─── Error alert ──────────────────────────────────────────────────────────────
export function ErrorAlert({ message }: { message: string }) {
  return (
    <div className="flex items-start gap-3 p-4 rounded-lg bg-red-900/20 border border-red-800/40 text-red-300 text-sm">
      <span className="shrink-0 mt-0.5">⚠</span>
      <span>{message}</span>
    </div>
  )
}

// ─── Confirm delete modal ─────────────────────────────────────────────────────
interface ConfirmDeleteProps {
  open: boolean
  name: string
  onConfirm: () => void
  onCancel: () => void
  loading?: boolean
}
export function ConfirmDelete({ open, name, onConfirm, onCancel, loading }: ConfirmDeleteProps) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative bg-[var(--color-surface-800)] border border-[var(--color-surface-600)] rounded-2xl p-6 w-full max-w-sm shadow-2xl">
        <h3 className="text-base font-semibold text-[var(--color-text-primary)] mb-2">Delete confirmation</h3>
        <p className="text-sm text-[var(--color-text-secondary)] mb-6">
          Are you sure you want to delete <span className="font-medium text-[var(--color-text-primary)]">{name}</span>? This cannot be undone.
        </p>
        <div className="flex gap-3 justify-end">
          <Button variant="ghost" onClick={onCancel} disabled={loading}>Cancel</Button>
          <Button variant="danger" onClick={onConfirm} disabled={loading}>
            {loading ? <Spinner size={14} /> : null}
            Delete
          </Button>
        </div>
      </div>
    </div>
  )
}
