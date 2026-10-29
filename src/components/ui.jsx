import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Icon from './Icon'
import { useLang } from '../context/LangContext'

/* ---------- Buttons ---------- */
// primary = charcoal (main actions), accent = lime (money/sell actions), secondary = outline
export function Button({ variant = 'primary', size = 'md', className = '', children, ...props }) {
  const styles = {
    primary: 'bg-charcoal text-white hover:bg-charcoal-700 active:bg-charcoal-700',
    accent: 'bg-lime text-charcoal hover:bg-lime-600 active:bg-lime-600',
    secondary: 'bg-white text-ink border-[1.5px] border-line hover:border-charcoal-500 active:bg-paper',
    danger: 'bg-white text-danger border-[1.5px] border-danger/40 hover:bg-danger-50 active:bg-danger-50',
    ghost: 'text-leaf hover:bg-lime-50 active:bg-lime-100',
  }
  const sizes = {
    sm: 'min-h-10 px-3 text-sm',
    md: 'min-h-12 px-4',
    lg: 'min-h-14 px-5 text-lg',
  }
  return (
    <button
      className={`inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl font-semibold transition-colors duration-150 disabled:pointer-events-none disabled:opacity-45 ${styles[variant]} ${sizes[size]} ${className}`}
      {...props}
    >
      {children}
    </button>
  )
}

// 48x48 icon-only button. Always pass a label for screen readers.
export function IconButton({ icon, label, onClick, className = '', iconClass = '', size = 22 }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={`inline-flex h-12 w-12 shrink-0 cursor-pointer items-center justify-center rounded-full transition-colors duration-150 hover:bg-paper active:bg-line ${className}`}
    >
      <Icon name={icon} size={size} className={iconClass} />
    </button>
  )
}

/* ---------- Forms ---------- */
export function Field({ label, hint, error, children }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-semibold text-ink">{label}</span>
      {children}
      {error ? (
        <span className="mt-1 block text-sm font-medium text-danger">{error}</span>
      ) : (
        hint && <span className="mt-1 block text-sm text-muted">{hint}</span>
      )}
    </label>
  )
}

export function Toggle({ checked, onChange, disabled, label }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="flex h-12 w-14 shrink-0 cursor-pointer items-center justify-center disabled:opacity-45"
    >
      <span className={`relative h-7 w-12 rounded-full transition-colors duration-150 ${checked ? 'bg-leaf' : 'bg-[#c9cdc2]'}`}>
        <span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow-sm transition-all duration-150 ${checked ? 'start-6' : 'start-1'}`} />
      </span>
    </button>
  )
}

export function Checkbox({ checked, disabled }) {
  return (
    <span
      aria-hidden="true"
      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md border-2 transition-colors duration-150 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-leaf ${
        checked ? 'border-charcoal bg-charcoal text-white' : 'border-[#b5bbae] bg-white'
      } ${disabled ? 'opacity-50' : ''}`}
    >
      {checked && <Icon name="check" size={16} strokeWidth={3} />}
    </span>
  )
}

/* ---------- Surfaces ---------- */
export function Card({ className = '', children, ...props }) {
  return (
    <div className={`rounded-2xl border border-line bg-card ${className}`} {...props}>
      {children}
    </div>
  )
}

export function Notice({ type = 'error', children }) {
  if (!children) return null
  const cls = {
    error: 'bg-danger-50 text-danger',
    ok: 'bg-lime-50 text-leaf',
    info: 'bg-white border border-line text-ink',
    warn: 'bg-warn-50 text-ink',
  }[type]
  return (
    <div role={type === 'error' ? 'alert' : 'status'} className={`rounded-xl px-4 py-3 text-sm font-medium ${cls}`}>
      {children}
    </div>
  )
}

export function Badge({ tone = 'neutral', children }) {
  const cls = {
    neutral: 'bg-paper text-muted',
    lime: 'bg-lime-100 text-charcoal',
    dark: 'bg-charcoal text-white',
    danger: 'bg-danger-50 text-danger',
  }[tone]
  return <span className={`inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ${cls}`}>{children}</span>
}

export function SectionTitle({ children, action }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-2">
      <h2 className="text-sm font-bold uppercase tracking-wide text-muted">{children}</h2>
      {action}
    </div>
  )
}

/* ---------- Sheet (bottom sheet on phones, dialog on wide screens) ---------- */
export function Sheet({ open, title, onClose, children }) {
  const panel = useRef(null)
  // keep the latest onClose without re-running the effect on every keystroke
  // (re-running it used to move focus away from the box being typed in and close the phone keyboard)
  const closeRef = useRef(onClose)
  closeRef.current = onClose
  useEffect(() => {
    if (!open) return
    const onKey = (e) => e.key === 'Escape' && closeRef.current()
    window.addEventListener('keydown', onKey)
    // focus the panel only when it opens, and only if nothing inside it (e.g. an autoFocus box) has focus
    if (!panel.current?.contains(document.activeElement)) panel.current?.focus()
    return () => window.removeEventListener('keydown', onKey)
  }, [open])
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center" onClick={onClose}>
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className="safe-bottom max-h-[92vh] w-full overflow-y-auto rounded-t-3xl bg-white p-5 pb-8 outline-none sm:max-w-md sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-line sm:hidden" />
        <div className="mb-4 flex items-center justify-between gap-2">
          <h2 className="text-lg font-bold">{title}</h2>
          <IconButton icon="x" label="Close" onClick={onClose} className="-me-2 text-muted" />
        </div>
        {children}
      </div>
    </div>
  )
}

/* ---------- Online state ---------- */
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
    <div role="status" className="flex items-center justify-center gap-2 bg-warn px-4 py-2 text-sm font-semibold text-charcoal">
      <Icon name="wifiOff" size={16} />
      {t('offline')}
    </div>
  )
}

/* ---------- Page chrome ---------- */
export function PageHeader({ title, back = true, right }) {
  const navigate = useNavigate()
  const { t } = useLang()
  return (
    <header className="safe-top sticky top-0 z-30 border-b border-line bg-white">
      <div className="mx-auto flex h-16 max-w-3xl items-center gap-1 px-2">
        {back ? (
          <IconButton icon="back" label={t('back')} onClick={() => navigate(-1)} className="text-charcoal" iconClass="rtl:rotate-180" />
        ) : (
          <img src="./logo-mark.png" alt="" className="mx-2 h-9 w-9 object-contain" />
        )}
        <h1 className="flex-1 truncate px-1 text-lg font-bold text-charcoal">{title}</h1>
        {right}
      </div>
    </header>
  )
}

export function Page({ title, back, right, children, wide = false }) {
  return (
    <div className="min-h-screen">
      <PageHeader title={title} back={back} right={right} />
      <OfflineBanner />
      <main className={`mx-auto px-4 py-5 ${wide ? 'max-w-5xl' : 'max-w-3xl'}`}>{children}</main>
    </div>
  )
}

export function Spinner() {
  return <div className="h-9 w-9 animate-spin rounded-full border-4 border-lime-100 border-t-charcoal" aria-label="Loading" />
}

export function FullScreenLoader() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-5">
      <img src="./logo-mark.png" alt="Book Mart" className="h-20 w-20 object-contain" />
      <Spinner />
    </div>
  )
}

export function EmptyState({ icon, title, body, action }) {
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-12 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-lime-50 text-leaf">
        <Icon name={icon} size={30} />
      </div>
      {title && <h3 className="text-lg font-bold">{title}</h3>}
      {body && <p className="max-w-xs text-muted">{body}</p>}
      {action}
    </div>
  )
}

/* ---------- Money ---------- */
export function Rs({ value, className = '' }) {
  const n = Number(value || 0)
  return (
    <span className={`latin whitespace-nowrap tabular-nums ${className}`} dir="ltr">
      Rs {n.toLocaleString('en-PK', { maximumFractionDigits: 2 })}
    </span>
  )
}

/* ---------- Segmented choice (radio buttons) ---------- */
export function Segmented({ options, value, onChange, size = 'md' }) {
  return (
    <div role="radiogroup" className="grid gap-2" style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}>
      {options.map((o) => {
        const active = value === o.value
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            disabled={o.disabled}
            onClick={() => onChange(o.value)}
            className={`flex cursor-pointer items-center justify-center gap-2 rounded-2xl border-[1.5px] px-3 font-semibold transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-40 ${
              size === 'lg' ? 'min-h-14 text-lg' : 'min-h-12'
            } ${active ? 'border-charcoal bg-charcoal text-white' : 'border-line bg-white text-ink hover:border-charcoal-500'}`}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

/* ---------- Money input with Rs prefix ---------- */
export function MoneyInput({ value, onChange, className = '', ...props }) {
  return (
    <div className="relative">
      <span className="latin pointer-events-none absolute inset-y-0 start-0 flex items-center ps-3.5 text-muted" dir="ltr">
        Rs
      </span>
      <input
        className={`field latin ps-11 ${className}`}
        dir="ltr"
        inputMode="decimal"
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/[^\d.]/g, '').replace(/(\..*)\./g, '$1'))}
        placeholder="0"
        {...props}
      />
    </div>
  )
}
