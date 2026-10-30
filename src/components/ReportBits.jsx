// Pieces shared by the report screens
import { useState } from 'react'
import { useLang } from '../context/LangContext'
import { dayKey } from '../lib/saleMath'
import { PERIODS } from '../lib/reports'
import { Field, Rs } from './ui'

const PERIOD_LABEL = { today: 'today', week: 'last7Days', month: 'thisMonth', last: 'lastMonth', year: 'thisYear', custom: 'customRange' }

/** Chips in one scrollable row + date boxes for "Dates" */
export function PeriodPicker({ period, setPeriod, custom, setCustom, options = PERIODS }) {
  const { t } = useLang()
  return (
    <div className="space-y-3">
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]" role="radiogroup" aria-label={t('period')}>
        {options.map((p) => {
          const on = p === period
          return (
            <button
              key={p}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => setPeriod(p)}
              className={`min-h-11 shrink-0 cursor-pointer whitespace-nowrap rounded-full border-[1.5px] px-4 text-sm font-semibold transition-colors duration-150 ${
                on ? 'border-charcoal bg-charcoal text-white' : 'border-line bg-white hover:border-charcoal-500'
              }`}
            >
              {t(PERIOD_LABEL[p])}
            </button>
          )
        })}
      </div>
      {period === 'custom' && (
        <div className="grid grid-cols-2 gap-3">
          <Field label={t('from')}>
            <input type="date" className="field latin" dir="ltr" value={custom.from} max={custom.to} onChange={(e) => e.target.value && setCustom({ ...custom, from: e.target.value })} />
          </Field>
          <Field label={t('to')}>
            <input type="date" className="field latin" dir="ltr" value={custom.to} min={custom.from} max={dayKey()} onChange={(e) => e.target.value && setCustom({ ...custom, to: e.target.value })} />
          </Field>
        </div>
      )}
    </div>
  )
}

export function usePeriod(initial = 'month') {
  const [period, setPeriod] = useState(initial)
  const [custom, setCustom] = useState(() => ({ from: dayKey().slice(0, 8) + '01', to: dayKey() }))
  return { period, setPeriod, custom, setCustom }
}

// short label for a day key ('2026-10-30' → '30 Oct') or month key ('2026-10' → 'Oct')
export function shortLabel(key, withYear = false) {
  if (key.length === 7) {
    const [y, m] = key.split('-').map(Number)
    return new Date(y, m - 1, 1).toLocaleDateString('en-GB', { month: 'short', year: withYear ? '2-digit' : undefined })
  }
  return new Date(key + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

/**
 * One-series bar chart (values ≥ 0 go up, < 0 go down in red).
 * rows: [{ key, value }]; tap a bar to see its value.
 */
export function BarChart({ rows, label, height = 160 }) {
  const { t } = useLang()
  const [sel, setSel] = useState(null)
  const max = Math.max(1, ...rows.map((r) => Math.abs(r.value)))
  const hasNeg = rows.some((r) => r.value < 0)
  const picked = rows.find((r) => r.key === sel) || rows.findLast((r) => r.value !== 0) || rows.at(-1)
  const every = Math.ceil(rows.length / 6) // how often to print an axis label
  const posH = hasNeg ? height * 0.7 : height
  const negH = hasNeg ? height * 0.3 : 0

  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <span className="text-sm text-muted">
          {label} · <span className="latin">{picked ? shortLabel(picked.key, true) : ''}</span>
        </span>
        {picked && <Rs value={picked.value} className={`text-lg font-bold ${picked.value < 0 ? 'text-danger' : ''}`} />}
      </div>
      <div className="flex items-stretch gap-[2px]" dir="ltr" role="list" aria-label={label}>
        {rows.map((r) => {
          const h = (Math.abs(r.value) / max) * (r.value < 0 ? negH : posH)
          const on = picked?.key === r.key
          return (
            <button
              key={r.key}
              type="button"
              role="listitem"
              aria-label={`${shortLabel(r.key, true)}: Rs ${Math.round(r.value).toLocaleString('en-PK')}`}
              onClick={() => setSel(r.key)}
              className="group flex min-w-0 flex-1 cursor-pointer flex-col"
              style={{ height: height }}
            >
              <div className="flex w-full flex-1 items-end justify-center" style={{ height: posH }}>
                {r.value > 0 && <div className={`w-full max-w-7 rounded-t-[4px] ${on ? 'bg-charcoal' : 'bg-leaf group-hover:bg-charcoal-500'}`} style={{ height: Math.max(2, h) }} />}
              </div>
              {hasNeg && (
                <div className="flex w-full items-start justify-center border-t border-line" style={{ height: negH }}>
                  {r.value < 0 && <div className={`w-full max-w-7 rounded-b-[4px] ${on ? 'bg-charcoal' : 'bg-danger'}`} style={{ height: Math.max(2, h) }} />}
                </div>
              )}
            </button>
          )
        })}
      </div>
      <div className="mt-1 flex gap-[2px] border-t border-line pt-1" dir="ltr" aria-hidden="true">
        {rows.map((r, i) => (
          <div key={r.key} className="latin min-w-0 flex-1 overflow-visible whitespace-nowrap text-center text-[11px] text-muted">
            {i % every === 0 ? shortLabel(r.key).replace(' ', ' ') : ''}
          </div>
        ))}
      </div>
      <p className="sr-only">{t('tapBarHint')}</p>
    </div>
  )
}

// label + amount row used in report cards
export function Row({ label, value, strong, tone = '', sign, sub }) {
  return (
    <div className={`flex items-center justify-between gap-3 py-2.5 ${strong ? 'font-bold' : ''}`}>
      <div className="min-w-0">
        <div className={strong ? 'text-lg' : 'text-muted'}>{label}</div>
        {sub && <div className="text-xs font-normal text-muted">{sub}</div>}
      </div>
      <span className="latin flex shrink-0 items-center gap-1" dir="ltr">
        {sign && <span className={`w-3 text-center font-bold ${sign === '−' ? 'text-danger' : 'text-leaf'}`}>{sign}</span>}
        <Rs value={value} className={`${strong ? 'text-xl' : 'font-semibold'} ${tone}`} />
      </span>
    </div>
  )
}
