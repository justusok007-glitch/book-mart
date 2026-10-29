import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Icon from './Icon'
import { useLang } from '../context/LangContext'

export function Button({ variant = 'primary', className = '', children, ...props }) {
  const styles = {
    primary: 'bg-brand-600 text-white hover:bg-brand-700 active:bg-brand-700',
    secondary: 'bg-white text-ink border-[1.5px] border-line hover:border-brand-500',
    danger: 'bg-danger text-white hover:opacity-90',
    ghost: 'text-brand-600 hover:bg-brand-50',
  }
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 font-semibold transition disabled:opacity-50 disabled:pointer-events-none ${styles[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  )
}

export function Field({ label, hint, children }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-semibold text-ink">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-muted">{hint}</span>}
    </label>
  )
}

export function Card({ className = '', children }) {
  return <div className={`rounded-2xl border border-line bg-card ${className}`}>{children}</div>
}

export function Notice({ type = 'error', children }) {
  if (!children) return null
  const cls = type === 'error' ? 'bg-danger-50 text-danger' : type === 'ok' ? 'bg-brand-50 text-brand-700' : 'bg-amber-50 text-ink'
  return <div className={`rounded-xl px-3.5 py-2.5 text-sm ${cls}`}>{children}</div>
}

export function Toggle({ checked, onChange, disabled }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative h-7 w-12 shrink-0 rounded-full transition ${checked ? 'bg-brand-500' : 'bg-line'} disabled:opacity-50`}
    >
      <span
        className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all ${checked ? 'start-6' : 'start-1'}`}
      />
    </button>
  )
}

// Bottom sheet on phones, centered dialog on wider screens
export function Sheet({ open, title, onClose, children }) {
  useEffect(() => {
    if (!open) return
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center" onClick={onClose}>
      <div
        className="max-h-[92vh] w-full overflow-y-auto rounded-t-3xl bg-paper p-5 pb-8 sm:max-w-md sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">{title}</h2>
          <button onClick={onClose} className="rounded-full p-1.5 text-muted hover:bg-line/60" aria-label="close">
            <Icon name="x" />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

export function useOnline() {
  const [online, setOnline] = useState(typeof navigator === 'undefined' ? true : navigator.onLine)
  useEffect(() => {
    const up = () => setOnline(true)
    const down = () => setOnline(false)
    window.addEventListener('online', up)
    window.addEventListener('offline', down)
    return () => {
      window.removeEventListener('online', up)
      window.removeEventListener('offline', down)
    }
  }, [])
  return online
}

export function OfflineBanner() {
  const online = useOnline()
  const { t } = useLang()
  if (online) return null
  return (
    <div className="flex items-center justify-center gap-2 bg-amber px-4 py-1.5 text-sm font-semibold text-ink">
      <Icon name="wifiOff" size={16} />
      {t('offline')}
    </div>
  )
}

export function PageHeader({ title, back = true, right }) {
  const navigate = useNavigate()
  const { t } = useLang()
  return (
    <header className="sticky top-0 z-30 bg-brand-600 text-white shadow-sm">
      <div className="mx-auto flex h-14 max-w-3xl items-center gap-2 px-3">
        {back && (
          <button onClick={() => navigate(-1)} className="rounded-full p-2 hover:bg-white/10" aria-label={t('back')}>
            <Icon name="back" className="rtl:rotate-180" />
          </button>
        )}
        <h1 className="flex-1 truncate px-1 text-lg font-bold">{title}</h1>
        {right}
      </div>
    </header>
  )
}

export function Page({ title, back, right, children }) {
  return (
    <div className="min-h-screen">
      <PageHeader title={title} back={back} right={right} />
      <OfflineBanner />
      <main className="mx-auto max-w-3xl px-4 py-5">{children}</main>
    </div>
  )
}

export function Spinner() {
  return <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-100 border-t-brand-600" />
}

export function FullScreenLoader() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <Spinner />
    </div>
  )
}
