// Small pieces shared by the money screens (expenses, cash out, investment, closing)
import { useMemo, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useLang } from '../context/LangContext'
import { dayKey } from '../lib/saleMath'
import { canUndo, monthKey, removeEntry, shiftMonth } from '../lib/money'
import { toDate } from '../lib/format'
import { errorText } from '../lib/errors'
import { Button, Card, Rs } from './ui'
import Icon from './Icon'

export function DayPicker({ day, onChange }) {
  const { t } = useLang()
  const shift = (n) => {
    const d = new Date(day + 'T12:00:00')
    d.setDate(d.getDate() + n)
    onChange(dayKey(d))
  }
  const isToday = day === dayKey()
  return (
    <div className="flex items-center gap-2">
      <Button variant="secondary" onClick={() => shift(-1)} aria-label={t('previousDay')} className="px-3">
        <Icon name="chevron" size={20} className="rotate-180 rtl:rotate-0" />
      </Button>
      <input type="date" className="field latin flex-1 text-center font-semibold" dir="ltr" value={day} max={dayKey()} onChange={(e) => e.target.value && onChange(e.target.value)} aria-label="Date" />
      <Button variant="secondary" onClick={() => shift(1)} disabled={isToday} aria-label={t('nextDay')} className="px-3">
        <Icon name="chevron" size={20} className="rtl:rotate-180" />
      </Button>
    </div>
  )
}

export function MonthPicker({ month, onChange }) {
  const { t, lang } = useLang()
  const [y, m] = month.split('-').map(Number)
  const label = new Date(y, m - 1, 1).toLocaleDateString(lang === 'ur' ? 'ur-PK' : 'en-GB', { month: 'long', year: 'numeric' })
  const isNow = month === monthKey()
  return (
    <div className="flex items-center gap-2">
      <Button variant="secondary" onClick={() => onChange(shiftMonth(month, -1))} aria-label={t('previousMonth')} className="px-3">
        <Icon name="chevron" size={20} className="rotate-180 rtl:rotate-0" />
      </Button>
      <div className="flex min-h-12 flex-1 items-center justify-center rounded-xl border-[1.5px] border-line bg-white px-3 text-center font-bold">{label}</div>
      <Button variant="secondary" onClick={() => onChange(shiftMonth(month, 1))} disabled={isNow} aria-label={t('nextMonth')} className="px-3">
        <Icon name="chevron" size={20} className="rtl:rotate-180" />
      </Button>
    </div>
  )
}

/**
 * Choose a person: chips for suggested names, plus "Someone else" with a text box.
 * names: string[]
 */
export function PersonPicker({ names, value, onChange }) {
  const { t } = useLang()
  const list = useMemo(() => [...new Set(names.map((n) => (n || '').trim()).filter(Boolean))].slice(0, 8), [names])
  const [other, setOther] = useState(() => !!value && !list.includes(value))
  const chip = (active) =>
    `inline-flex min-h-12 cursor-pointer items-center gap-2 rounded-full border-[1.5px] px-4 font-semibold transition-colors duration-150 ${
      active ? 'border-charcoal bg-charcoal text-white' : 'border-line bg-white text-ink hover:border-charcoal-500'
    }`
  return (
    <div className="space-y-2.5">
      <div className="flex flex-wrap gap-2" role="radiogroup">
        {list.map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={!other && value === n}
            className={chip(!other && value === n)}
            onClick={() => {
              setOther(false)
              onChange(n)
            }}
          >
            {n}
          </button>
        ))}
        <button
          type="button"
          role="radio"
          aria-checked={other || list.length === 0}
          className={chip(other || list.length === 0)}
          onClick={() => {
            setOther(true)
            onChange('')
          }}
        >
          <Icon name="pencil" size={16} /> {t('someoneElse')}
        </button>
      </div>
      {(other || list.length === 0) && (
        <input className="field" value={value} onChange={(e) => onChange(e.target.value)} placeholder={t('typeName')} aria-label={t('typeName')} autoFocus={other} />
      )}
    </div>
  )
}

export function timeOf(e) {
  const d = toDate(e.at) || new Date(e.clientAt || 0)
  return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}

export function dateLabel(day, lang) {
  const d = new Date(day + 'T12:00:00')
  const today = dayKey()
  const yest = dayKey(new Date(Date.now() - 864e5))
  if (day === today) return lang === 'ur' ? 'آج' : 'Today'
  if (day === yest) return lang === 'ur' ? 'کل' : 'Yesterday'
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short', year: d.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined })
}

// group a newest-first list by day
export function groupByDay(list) {
  const out = []
  for (const e of list) {
    const last = out.at(-1)
    if (last && last.day === e.day) last.items.push(e)
    else out.push({ day: e.day, items: [e] })
  }
  return out
}

/**
 * Entries grouped by day, newest first.
 * kind: Firestore collection (for Undo); row(e) → { icon, title, sub, tone }
 */
export function EntryGroups({ list, kind, row, showTotals = true }) {
  const { t, lang } = useLang()
  const { user, isAdmin } = useAuth()
  const groups = groupByDay(list)
  return (
    <div className="space-y-5">
      {groups.map((g) => (
        <section key={g.day}>
          <div className="mb-2 flex items-baseline justify-between px-1">
            <h3 className="text-sm font-bold text-muted">{dateLabel(g.day, lang)}</h3>
            {showTotals && <Rs value={g.items.reduce((s, e) => s + (e.amount || 0), 0)} className="text-sm font-bold text-muted" />}
          </div>
          <Card className="overflow-hidden">
            <ul>
              {g.items.map((e) => {
                const r = row(e)
                return (
                  <li key={e.id} className="flex items-center gap-3 border-b border-line px-4 py-3 last:border-b-0">
                    <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${r.tone || 'bg-paper text-charcoal'}`}>
                      <Icon name={r.icon} size={18} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-semibold">{r.title}</div>
                      <div className="truncate text-sm text-muted">
                        <span className="latin">{timeOf(e)}</span>
                        {r.sub && <> · {r.sub}</>}
                      </div>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-0.5">
                      <Rs value={e.amount} className="font-bold" />
                      {canUndo(e, user, isAdmin) && (
                        <button
                          type="button"
                          className="min-h-8 cursor-pointer rounded-lg px-1.5 text-xs font-semibold text-danger hover:bg-danger-50"
                          onClick={() => {
                            if (window.confirm(t('confirmUndo')))
                              removeEntry(kind, e).catch((err) => window.alert(`${t('notSavedTitle')}\n${errorText(err, t)}`))
                          }}
                        >
                          {t('undo')}
                        </button>
                      )}
                    </div>
                  </li>
                )
              })}
            </ul>
          </Card>
        </section>
      ))}
    </div>
  )
}

// Amount + save button row used at the bottom of the money forms
export function useSaveError() {
  const { t } = useLang()
  return (err) => window.alert(`${t('notSavedTitle')}\n${errorText(err, t)}`)
}
