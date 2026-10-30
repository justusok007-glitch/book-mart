import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useLang } from '../context/LangContext'
import { addCashOut, monthKey, monthRange, shiftMonth, useEntries, useStaff } from '../lib/money'
import { dayKey } from '../lib/saleMath'
import { Button, Card, EmptyState, Field, MoneyInput, Notice, Page, Rs, SectionTitle, Segmented, Spinner } from '../components/ui'
import { EntryGroups, PersonPicker, useSaveError } from '../components/MoneyBits'
import Icon from '../components/Icon'

// names to offer: the owners first, then whoever took cash recently
function useCashNames(recent) {
  const { displayName, profile, isAdmin } = useAuth()
  const staff = useStaff(true)
  return useMemo(() => {
    const owners = staff.filter((u) => u.roleId === 'owner').map((u) => u.name)
    const me = isAdmin || profile?.roleId === 'owner' ? [displayName] : []
    return [...me, ...owners, ...(recent || []).map((e) => e.person)]
  }, [staff, recent, displayName, profile, isAdmin])
}

const cashRow = (t) => (e) => ({
  icon: 'cash',
  tone: 'bg-lime-100 text-charcoal',
  title: e.person,
  sub: [e.purpose, e.byName && e.byName !== e.person ? `${t('enteredBy')} ${e.byName}` : ''].filter(Boolean).join(' · '),
})

export default function CashOut() {
  const { t } = useLang()
  const { user, displayName, can } = useAuth()
  const onFail = useSaveError()
  const month = monthKey()
  // this month and last month, so the list is never empty on the 1st
  const list = useEntries('cashOuts', monthRange(shiftMonth(month, -1)).from, monthRange(month).to)
  const names = useCashNames(list)
  const [amount, setAmount] = useState('')
  const [person, setPerson] = useState(null)
  const [purpose, setPurpose] = useState('')
  const [error, setError] = useState('')
  const [msg, setMsg] = useState('')

  const who = person ?? (names[0] || '')
  const today = dayKey()
  const todayTotal = (list || []).filter((e) => e.day === today).reduce((s, e) => s + (e.amount || 0), 0)

  return (
    <Page
      title={t('cashOut')}
      right={
        can('view_cash_out_summary') && (
          <Link to="/cash-out/summary" className="me-1 inline-flex min-h-10 items-center gap-1.5 rounded-xl border-[1.5px] border-line bg-white px-3 text-sm font-semibold hover:border-charcoal-500">
            <Icon name="chart" size={16} /> {t('seeSummary')}
          </Link>
        )
      }
    >
      <div className="space-y-5">
        <Card className="flex items-center justify-between p-4">
          <span className="font-semibold text-muted">{t('todayTaken')}</span>
          <Rs value={todayTotal} className="text-2xl font-bold" />
        </Card>

        <Card className="p-4">
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault()
              if (!(Number(amount) > 0)) return setError(t('enterAmount'))
              if (!who.trim()) return setError(t('typeName'))
              addCashOut({ amount: Number(amount), person: who, purpose, user: { uid: user.uid, name: displayName } }).catch(onFail)
              setAmount('')
              setPurpose('')
              setError('')
              setMsg(`${t('cashOutSaved')} — Rs ${Number(amount).toLocaleString('en-PK')}`)
              setTimeout(() => setMsg(''), 3500)
            }}
          >
            <Field label={t('amount')}>
              <MoneyInput value={amount} onChange={setAmount} className="min-h-14 text-xl font-bold" />
            </Field>
            <div>
              <span className="mb-2 block text-sm font-semibold">{t('takenBy')}</span>
              <PersonPicker names={names} value={who} onChange={setPerson} />
            </div>
            <Field label={`${t('purpose')} (${t('optional')})`}>
              <input className="field" value={purpose} onChange={(e) => setPurpose(e.target.value)} placeholder={t('purposeHint')} />
            </Field>
            <Notice>{error}</Notice>
            <Button type="submit" variant="accent" size="lg" className="w-full">
              <Icon name="check" size={20} /> {t('takeCash')}
            </Button>
            <p className="text-center text-sm text-muted">{t('cashOutNote')}</p>
          </form>
        </Card>
        {msg && <Notice type="ok">{msg}</Notice>}

        <section>
          <SectionTitle>{t('recentCashOuts')}</SectionTitle>
          {list === null ? (
            <div className="flex justify-center py-8">
              <Spinner />
            </div>
          ) : list.length === 0 ? (
            <p className="text-muted">{t('noCashOuts')}</p>
          ) : (
            <EntryGroups list={list} kind="cashOuts" row={cashRow(t)} />
          )}
        </section>
      </div>
    </Page>
  )
}

/* ================= summary ================= */

function periodRange(period, custom) {
  const m = monthKey()
  if (period === 'month') return monthRange(m)
  if (period === 'last') return monthRange(shiftMonth(m, -1))
  if (period === 'year') return { from: `${m.slice(0, 4)}-01-01`, to: `${m.slice(0, 4)}-12-31` }
  return custom
}

export function CashOutSummary() {
  const { t } = useLang()
  const [period, setPeriod] = useState('month')
  const [custom, setCustom] = useState(() => ({ from: monthRange(monthKey()).from, to: dayKey() }))
  const { from, to } = periodRange(period, custom)
  const list = useEntries('cashOuts', from, to)

  const total = (list || []).reduce((s, e) => s + (e.amount || 0), 0)
  const people = useMemo(() => {
    const m = {}
    for (const e of list || []) {
      const k = e.person || '—'
      m[k] ||= { name: k, total: 0, count: 0 }
      m[k].total += e.amount || 0
      m[k].count += 1
    }
    return Object.values(m).sort((a, b) => b.total - a.total)
  }, [list])
  const top = people[0]?.total || 1

  return (
    <Page title={t('cashOutSummary')}>
      <div className="space-y-4">
        <Segmented
          value={period}
          onChange={setPeriod}
          options={[
            { value: 'month', label: t('thisMonth') },
            { value: 'last', label: t('lastMonth') },
            { value: 'year', label: t('thisYear') },
            { value: 'custom', label: t('customRange') },
          ]}
        />
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

        {list === null ? (
          <div className="flex justify-center py-16">
            <Spinner />
          </div>
        ) : list.length === 0 ? (
          <EmptyState icon="cash" body={t('nothingInRange')} />
        ) : (
          <>
            <Card className="p-4">
              <div className="flex items-baseline justify-between">
                <div>
                  <div className="font-semibold text-muted">{t('totalTaken')}</div>
                  <div className="text-sm text-muted">
                    <span className="latin">{list.length}</span> {t('entriesWord')}
                  </div>
                </div>
                <Rs value={total} className="text-2xl font-bold" />
              </div>
              <div className="mt-4 space-y-3">
                <h3 className="text-sm font-bold text-muted">{t('byPerson')}</h3>
                {people.map((p) => (
                  <div key={p.name}>
                    <div className="mb-1 flex items-baseline justify-between gap-2">
                      <span className="truncate font-semibold">
                        {p.name}{' '}
                        <span className="text-sm font-normal text-muted">
                          · <span className="latin">{p.count}</span> {t('timesWord')}
                        </span>
                      </span>
                      <Rs value={p.total} className="font-bold" />
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-paper">
                      <div className="h-full rounded-full bg-lime" style={{ width: `${Math.max(3, (p.total / top) * 100)}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </Card>
            <EntryGroups list={list} kind="cashOuts" row={cashRow(t)} />
          </>
        )}
      </div>
    </Page>
  )
}
