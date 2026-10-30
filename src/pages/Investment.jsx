import { useMemo, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useLang } from '../context/LangContext'
import { addInvestment, useAllEntries, useStaff } from '../lib/money'
import { useCatalog } from '../lib/catalog'
import { useCustomers } from '../lib/selling'
import { useSuppliers } from '../lib/purchasing'
import { Button, Card, EmptyState, Field, MoneyInput, Notice, Page, Rs, SectionTitle, Segmented, Sheet, Spinner } from '../components/ui'
import { EntryGroups, PersonPicker, useSaveError } from '../components/MoneyBits'
import Icon from '../components/Icon'

const INTO = { cash: 'intoDrawer', bank: 'intoBank', outside: 'intoOutside' }

function InvestmentForm({ names, onDone }) {
  const { t } = useLang()
  const { user, displayName } = useAuth()
  const onFail = useSaveError()
  const [amount, setAmount] = useState('')
  const [investor, setInvestor] = useState(null)
  const [into, setInto] = useState('cash')
  const [note, setNote] = useState('')
  const [error, setError] = useState('')
  const who = investor ?? (names[0] || '')
  return (
    <form
      className="space-y-5"
      onSubmit={(e) => {
        e.preventDefault()
        if (!(Number(amount) > 0)) return setError(t('enterAmount'))
        if (!who.trim()) return setError(t('typeName'))
        addInvestment({ amount: Number(amount), investor: who, into, note, user: { uid: user.uid, name: displayName } }).catch(onFail)
        onDone(t('investmentSaved'))
      }}
    >
      <Field label={t('amount')}>
        <MoneyInput value={amount} onChange={setAmount} className="text-lg font-bold" />
      </Field>
      <div>
        <span className="mb-2 block text-sm font-semibold">{t('investor')}</span>
        <PersonPicker names={names} value={who} onChange={setInvestor} />
      </div>
      <div>
        <span className="mb-1.5 block text-sm font-semibold">{t('moneyWentTo')}</span>
        <Segmented value={into} onChange={setInto} options={Object.entries(INTO).map(([value, k]) => ({ value, label: t(k) }))} />
        {into === 'outside' && <p className="mt-1.5 text-sm text-muted">{t('intoOutsideHint')}</p>}
      </div>
      <Field label={`${t('note')} (${t('optional')})`}>
        <input className="field" value={note} onChange={(e) => setNote(e.target.value)} />
      </Field>
      <Notice>{error}</Notice>
      <Button type="submit" size="lg" className="w-full">
        <Icon name="check" size={20} /> {t('save')}
      </Button>
    </form>
  )
}

// What the shop holds now: stock at average cost, udhaar to collect, what it owes suppliers
function BusinessNow() {
  const { t } = useLang()
  const { can } = useAuth()
  const { ready, variants, itemById, costs } = useCatalog()
  const showStock = can('view_cost_price')
  const customers = useCustomers(can('manage_customers') || can('receive_payments') || can('sell_credit'))
  const suppliers = useSuppliers(can('manage_suppliers') || can('buy') || can('pay_suppliers'))

  const stock = useMemo(() => {
    let value = 0
    let missing = false
    for (const v of variants) {
      const item = itemById[v.itemId]
      if (!item || item.active === false || v.active === false || !(v.stock > 0)) continue
      const c = costs[v.itemId]?.avgCost
      if (c == null) missing = true
      else value += v.stock * c
    }
    return { value: Math.round(value), missing }
  }, [variants, itemById, costs])

  const toCollect = (customers || []).reduce((s, c) => s + Math.max(0, c.balance || 0), 0)
  const owe = (suppliers || []).reduce((s, x) => s + Math.max(0, x.balance || 0), 0)
  const rows = [
    showStock && { label: t('stockAtCost'), value: ready ? stock.value : null },
    customers !== null && customers.length > 0 && { label: t('udhaarToCollect'), value: toCollect },
    suppliers !== null && suppliers.length > 0 && { label: t('oweSuppliers'), value: -owe, danger: owe > 0 },
  ].filter(Boolean)
  if (!rows.length) return null

  return (
    <section>
      <SectionTitle>{t('businessNow')}</SectionTitle>
      <Card className="divide-y divide-line">
        {rows.map((r) => (
          <div key={r.label} className="flex items-center justify-between px-4 py-3">
            <span className="text-muted">{r.label}</span>
            {r.value == null ? <span className="text-muted">…</span> : <Rs value={r.value} className={`font-bold ${r.danger ? 'text-danger' : ''}`} />}
          </div>
        ))}
      </Card>
      {showStock && stock.missing && <p className="mt-2 text-sm text-muted">{t('stockCostMissing')}</p>}
    </section>
  )
}

export default function Investment() {
  const { t } = useLang()
  const { displayName, profile, isAdmin } = useAuth()
  const list = useAllEntries('investments')
  const staff = useStaff(true)
  const [adding, setAdding] = useState(false)
  const [msg, setMsg] = useState('')

  const names = useMemo(() => {
    const owners = staff.filter((u) => u.roleId === 'owner').map((u) => u.name)
    const me = isAdmin || profile?.roleId === 'owner' ? [displayName] : []
    return [...(list || []).map((e) => e.investor), ...owners, ...me]
  }, [staff, list, displayName, profile, isAdmin])

  const total = (list || []).reduce((s, e) => s + (e.amount || 0), 0)
  const byInvestor = useMemo(() => {
    const m = {}
    for (const e of list || []) m[e.investor || '—'] = (m[e.investor || '—'] || 0) + (e.amount || 0)
    return Object.entries(m).sort((a, b) => b[1] - a[1])
  }, [list])

  return (
    <Page
      title={t('investment')}
      right={
        <Button size="sm" className="me-1" onClick={() => setAdding(true)}>
          <Icon name="plus" size={18} /> {t('add')}
        </Button>
      }
    >
      <div className="space-y-5">
        {msg && <Notice type="ok">{msg}</Notice>}
        {list === null ? (
          <div className="flex justify-center py-16">
            <Spinner />
          </div>
        ) : (
          <>
            <Card className="p-5">
              <div className="text-sm font-semibold text-muted">{t('totalInvested')}</div>
              <Rs value={total} className="text-3xl font-bold" />
              {byInvestor.length > 1 && (
                <div className="mt-3 space-y-1 border-t border-line pt-3 text-sm">
                  {byInvestor.map(([n, v]) => (
                    <div key={n} className="flex justify-between">
                      <span className="text-muted">{n}</span>
                      <Rs value={v} className="font-semibold" />
                    </div>
                  ))}
                </div>
              )}
            </Card>

            <BusinessNow />

            <section>
              <SectionTitle>{t('history')}</SectionTitle>
              {list.length === 0 ? (
                <EmptyState
                  icon="trend"
                  body={t('noInvestments')}
                  action={
                    <Button onClick={() => setAdding(true)}>
                      <Icon name="plus" size={18} /> {t('addInvestment')}
                    </Button>
                  }
                />
              ) : (
                <EntryGroups
                  list={list}
                  kind="investments"
                  showTotals={false}
                  row={(e) => ({
                    icon: 'trend',
                    tone: 'bg-lime-100 text-charcoal',
                    title: e.investor,
                    sub: [t(INTO[e.into] || 'intoDrawer'), e.note].filter(Boolean).join(' · '),
                  })}
                />
              )}
            </section>
          </>
        )}
      </div>

      <Sheet open={adding} title={t('addInvestment')} onClose={() => setAdding(false)}>
        {adding && (
          <InvestmentForm
            names={names}
            onDone={(m) => {
              setAdding(false)
              setMsg(m)
              setTimeout(() => setMsg(''), 3000)
            }}
          />
        )}
      </Sheet>
    </Page>
  )
}
