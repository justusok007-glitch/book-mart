import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useLang } from '../context/LangContext'
import { countNotes, expectedCash, fetchPreviousClosing, NOTES, saveClosing, useClosing } from '../lib/money'
import { useDayStats, useShopSettings } from '../lib/selling'
import { dayKey } from '../lib/saleMath'
import { fmtDate } from '../lib/format'
import { Badge, Button, Card, Field, MoneyInput, Notice, Page, Rs, SectionTitle, Segmented, Spinner } from '../components/ui'
import { dateLabel, DayPicker, useSaveError } from '../components/MoneyBits'
import Icon from '../components/Icon'

const money = (n) => 'Rs ' + Math.round(Number(n) || 0).toLocaleString('en-PK')

function Line({ label, value, sign, strong, muted }) {
  return (
    <div className={`flex items-center justify-between gap-3 py-2 ${strong ? 'text-lg font-bold' : ''}`}>
      <span className={muted ? 'text-muted' : ''}>{label}</span>
      <span className="latin flex items-center gap-1 tabular-nums" dir="ltr">
        {sign && <span className={`w-3 text-center font-bold ${sign === '−' ? 'text-danger' : 'text-leaf'}`}>{sign}</span>}
        <Rs value={value} className={strong ? '' : 'font-semibold'} />
      </span>
    </div>
  )
}

function NoteCounter({ notes, setNotes, coins, setCoins }) {
  const { t } = useLang()
  return (
    <div className="space-y-2">
      {NOTES.map((v) => {
        const n = Number(notes[v]) || 0
        return (
          <div key={v} className="flex items-center gap-2">
            <span className="latin w-16 shrink-0 font-bold" dir="ltr">
              {v.toLocaleString('en-PK')}
            </span>
            <span className="text-muted" aria-hidden="true">
              ×
            </span>
            <div className="flex items-center gap-1">
              <button type="button" aria-label={`− ${v}`} className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-xl border-[1.5px] border-line bg-white hover:border-charcoal-500 disabled:opacity-40" disabled={n <= 0} onClick={() => setNotes({ ...notes, [v]: n - 1 })}>
                <Icon name="minus" size={18} />
              </button>
              <input
                className="field latin h-11 w-16 px-1 text-center font-bold"
                dir="ltr"
                inputMode="numeric"
                aria-label={`${v} ×`}
                value={notes[v] ?? ''}
                placeholder="0"
                onChange={(e) => setNotes({ ...notes, [v]: e.target.value.replace(/\D/g, '') })}
              />
              <button type="button" aria-label={`+ ${v}`} className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-xl border-[1.5px] border-line bg-white hover:border-charcoal-500" onClick={() => setNotes({ ...notes, [v]: n + 1 })}>
                <Icon name="plus" size={18} />
              </button>
            </div>
            <Rs value={v * n} className={`ms-auto text-sm font-semibold ${n ? '' : 'text-muted'}`} />
          </div>
        )
      })}
      <div className="flex items-center gap-2 pt-1">
        <span className="w-20 shrink-0 text-sm font-semibold">{t('coinsOther')}</span>
        <div className="flex-1">
          <MoneyInput value={coins} onChange={setCoins} aria-label={t('coinsOther')} />
        </div>
      </div>
    </div>
  )
}

function closingText(c, shop, lang, t) {
  const lines = [
    `${shop.name || 'Book Mart'} — ${t('dailyClosing')}`,
    dateLabel(c.day, 'en') + ` (${c.day})`,
    '',
    `${t('openingCash')}: ${money(c.opening)}`,
    `+ ${t('cashSalesReceived')}: ${money(c.cashIn)}`,
    c.investCash ? `+ ${t('investedIntoDrawer')}: ${money(c.investCash)}` : null,
    `− ${t('expensesFromDrawer')}: ${money(c.expenseCash)}`,
    `− ${t('cashTakenOut')}: ${money(c.cashOut)}`,
    c.supplierCash ? `− ${t('paidToSuppliers')}: ${money(c.supplierCash)}` : null,
    `= ${t('shouldBeInDrawer')}: ${money(c.expected)}`,
    `${t('countedCash')}: ${money(c.counted)}`,
    c.diff ? `${c.diff < 0 ? t('short') : t('over')}: ${money(Math.abs(c.diff))}` : `✓ ${t('matches')}`,
    c.note ? `${t('note')}: ${c.note}` : null,
    c.byName ? `${t('closedBy')}: ${c.byName}` : null,
  ]
  return lines.filter((l) => l !== null).join('\n')
}

export default function Closing() {
  const { t, lang } = useLang()
  const { user, displayName, can } = useAuth()
  const onFail = useSaveError()
  const shop = useShopSettings()
  const [day, setDay] = useState(dayKey())
  const stats = useDayStats(day, true)
  const saved = useClosing(day)
  const [prev, setPrev] = useState(undefined)

  // form
  const [openingEdit, setOpeningEdit] = useState(null) // null = use automatic opening
  const [mode, setMode] = useState('total')
  const [total, setTotal] = useState('')
  const [notes, setNotes] = useState({})
  const [coins, setCoins] = useState('')
  const [note, setNote] = useState('')
  const [error, setError] = useState('')
  const [msg, setMsg] = useState('')

  useEffect(() => {
    let live = true
    setPrev(undefined)
    fetchPreviousClosing(day)
      .then((p) => live && setPrev(p))
      .catch(() => live && setPrev(null))
    return () => {
      live = false
    }
  }, [day])

  // load the saved closing into the form when the day changes
  const savedKey = saved ? `${saved.day}-${saved.clientAt}` : saved === null ? 'none' : 'loading'
  useEffect(() => {
    if (saved === undefined) return
    setOpeningEdit(saved && prev && Math.abs(saved.opening - (prev.counted || 0)) > 0.5 ? String(saved.opening) : saved && !prev ? String(saved.opening) : null)
    if (saved?.notes) {
      setMode('notes')
      setNotes(Object.fromEntries(Object.entries(saved.notes).map(([k, v]) => [k, v ? String(v) : ''])))
      setCoins(saved.coins ? String(saved.coins) : '')
      setTotal('')
    } else {
      setMode('total')
      setNotes({})
      setCoins('')
      setTotal(saved ? String(saved.counted) : '')
    }
    setNote(saved?.note || '')
    setError('')
  }, [savedKey, prev === undefined])

  const autoOpening = prev?.counted ?? 0
  const opening = openingEdit != null ? Number(openingEdit) || 0 : autoOpening
  const parts = useMemo(() => expectedCash(opening, stats || {}), [opening, stats])
  const counted = mode === 'notes' ? countNotes(notes, coins) : Number(total) || 0
  const hasCount = mode === 'notes' ? Object.values(notes).some((v) => Number(v) > 0) || Number(coins) > 0 : total !== ''
  const diff = Math.round(counted - parts.expected)
  const changed = saved && Math.abs((saved.expected || 0) - parts.expected) > 0.5

  const sales = (stats?.salesTotal || 0) - (stats?.returnsTotal || 0)
  const loading = stats === null || saved === undefined || prev === undefined

  async function share() {
    const text = closingText(saved, shop, lang, t)
    if (navigator.share) {
      try {
        await navigator.share({ text })
      } catch {
        /* cancelled */
      }
      return
    }
    try {
      await navigator.clipboard.writeText(text)
      setMsg(t('copied'))
    } catch {
      /* ignore */
    }
  }

  return (
    <Page title={t('dailyClosing')}>
      <div className="space-y-5">
        <DayPicker day={day} onChange={setDay} />

        {loading ? (
          <div className="flex justify-center py-16">
            <Spinner />
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between gap-2">
              {saved ? (
                <Badge tone="lime">
                  <Icon name="check" size={14} className="me-1" /> {t('closedBadge')} · {saved.byName} · <span className="latin ms-1">{fmtDate(saved.at || new Date(saved.clientAt))}</span>
                </Badge>
              ) : (
                <Badge>{t('notClosedYet')}</Badge>
              )}
              {saved && (
                <Button size="sm" variant="secondary" onClick={share}>
                  <Icon name="share" size={16} /> {t('shareClosing')}
                </Button>
              )}
            </div>
            {changed && <Notice type="warn">{t('changedSinceClosing')}</Notice>}

            {/* cash that should be in the galla */}
            <Card className="px-4 py-2">
              <div className="flex items-center justify-between gap-3 py-2">
                <div className="min-w-0">
                  <div>{t('openingCash')}</div>
                  <div className="text-xs text-muted">
                    {prev ? (
                      <>
                        {t('lastClosingOn')} {dateLabel(prev.day, lang)}
                      </>
                    ) : (
                      t('noLastClosing')
                    )}
                  </div>
                </div>
                {openingEdit != null || !prev ? (
                  <div className="w-36 shrink-0">
                    <MoneyInput value={openingEdit ?? ''} onChange={setOpeningEdit} aria-label={t('openingCash')} className="text-end font-semibold" />
                  </div>
                ) : (
                  <button type="button" className="flex min-h-11 cursor-pointer items-center gap-1.5 rounded-xl px-2 hover:bg-paper" onClick={() => setOpeningEdit(String(autoOpening))} aria-label={`${t('edit')} ${t('openingCash')}`}>
                    <Rs value={autoOpening} className="font-semibold" />
                    <Icon name="pencil" size={14} className="text-muted" />
                  </button>
                )}
              </div>
              <div className="border-t border-line" />
              <Line label={t('cashSalesReceived')} value={parts.cashIn} sign="+" />
              {parts.investCash > 0 && <Line label={t('investedIntoDrawer')} value={parts.investCash} sign="+" />}
              <Line label={t('expensesFromDrawer')} value={parts.expenseCash} sign="−" />
              <Line label={t('cashTakenOut')} value={parts.cashOut} sign="−" />
              {parts.supplierCash > 0 && <Line label={t('paidToSuppliers')} value={parts.supplierCash} sign="−" />}
              <div className="border-t-2 border-charcoal" />
              <Line label={t('shouldBeInDrawer')} value={parts.expected} strong />
            </Card>
            <p className="-mt-2 flex items-start gap-1.5 text-sm text-muted">
              <Icon name="alert" size={16} className="mt-0.5 shrink-0" /> {t('takeHomeTip')}
            </p>

            {/* count */}
            {can('daily_closing') && (
              <Card className="space-y-4 p-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-bold">{t('countedCash')}</h2>
                </div>
                <Segmented
                  value={mode}
                  onChange={setMode}
                  options={[
                    { value: 'total', label: t('enterTotal') },
                    { value: 'notes', label: t('countNotes') },
                  ]}
                />
                {mode === 'total' ? (
                  <MoneyInput value={total} onChange={setTotal} className="min-h-14 text-xl font-bold" aria-label={t('countedCash')} />
                ) : (
                  <NoteCounter notes={notes} setNotes={setNotes} coins={coins} setCoins={setCoins} />
                )}

                {hasCount && (
                  <div
                    className={`flex items-center justify-between rounded-xl px-4 py-3 font-bold ${
                      diff === 0 ? 'bg-lime-50 text-leaf' : diff < 0 ? 'bg-danger-50 text-danger' : 'bg-warn-50 text-ink'
                    }`}
                    role="status"
                  >
                    <span className="flex items-center gap-2">
                      <Icon name={diff === 0 ? 'check' : 'alert'} size={18} />
                      {diff === 0 ? t('matches') : diff < 0 ? t('short') : t('over')}
                    </span>
                    <span className="flex items-baseline gap-3">
                      {mode === 'notes' && <Rs value={counted} className="text-sm font-semibold opacity-80" />}
                      {diff !== 0 && <Rs value={Math.abs(diff)} className="text-lg" />}
                    </span>
                  </div>
                )}

                <Field label={`${t('note')} (${t('optional')})`}>
                  <input className="field" value={note} onChange={(e) => setNote(e.target.value)} />
                </Field>
                <Notice>{error}</Notice>
                <Button
                  size="lg"
                  variant="accent"
                  className="w-full"
                  onClick={() => {
                    if (!hasCount) return setError(t('closingNeedsCount'))
                    setError('')
                    saveClosing({
                      day,
                      parts,
                      counted,
                      notes: mode === 'notes' ? Object.fromEntries(NOTES.map((v) => [v, Number(notes[v]) || 0])) : null,
                      coins: mode === 'notes' ? coins : 0,
                      note,
                      user: { uid: user.uid, name: displayName },
                    }).catch(onFail)
                    setMsg(t('closingSaved'))
                    setTimeout(() => setMsg(''), 3000)
                  }}
                >
                  <Icon name="check" size={20} /> {saved ? t('updateClosing') : t('saveClosing')}
                </Button>
                {msg && <Notice type="ok">{msg}</Notice>}
              </Card>
            )}

            {/* the day at a glance */}
            <section>
              <SectionTitle>{t('daySummary')}</SectionTitle>
              <Card className="divide-y divide-line px-4">
                <div className="flex justify-between py-2.5">
                  <span className="text-muted">{t('netSales')}</span>
                  <Rs value={sales} className="font-semibold" />
                </div>
                {can('view_profit_loss') && (
                  <div className="flex justify-between py-2.5">
                    <span className="text-muted">{t('profit')}</span>
                    <Rs value={stats?.profit || 0} className="font-semibold text-leaf" />
                  </div>
                )}
                <div className="flex justify-between py-2.5">
                  <span className="text-muted">{t('udhaarGiven')}</span>
                  <Rs value={stats?.creditGiven || 0} className="font-semibold" />
                </div>
                <div className="flex justify-between py-2.5">
                  <span className="text-muted">{t('udhaarReceived')}</span>
                  <Rs value={stats?.creditReceived || 0} className="font-semibold" />
                </div>
                <div className="flex justify-between py-2.5">
                  <span className="text-muted">{t('expensesAll')}</span>
                  <Rs value={stats?.expensesTotal || 0} className="font-semibold" />
                </div>
                {stats?.bankIn > 0 && (
                  <div className="flex justify-between py-2.5">
                    <span className="text-muted">{t('bankIn')}</span>
                    <Rs value={stats.bankIn} className="font-semibold" />
                  </div>
                )}
              </Card>
            </section>
          </>
        )}
      </div>
    </Page>
  )
}
