import { useMemo, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useLang } from '../context/LangContext'
import { addExpense, EXPENSE_CATEGORIES, expenseCategory, monthKey, monthRange, useEntries } from '../lib/money'
import { Button, Card, EmptyState, Field, MoneyInput, Notice, Page, Rs, SectionTitle, Segmented, Sheet, Spinner } from '../components/ui'
import { EntryGroups, MonthPicker, useSaveError } from '../components/MoneyBits'
import Icon from '../components/Icon'

export function ExpenseForm({ onDone }) {
  const { t, pick } = useLang()
  const { user, displayName } = useAuth()
  const onFail = useSaveError()
  const [category, setCategory] = useState('')
  const [amount, setAmount] = useState('')
  const [method, setMethod] = useState('cash')
  const [note, setNote] = useState('')
  const [error, setError] = useState('')
  return (
    <form
      className="space-y-5"
      onSubmit={(e) => {
        e.preventDefault()
        if (!category) return setError(t('expenseFor'))
        if (!(Number(amount) > 0)) return setError(t('enterAmount'))
        addExpense({ category, amount: Number(amount), method, note, user: { uid: user.uid, name: displayName } }).catch(onFail)
        onDone(t('expenseSaved'))
      }}
    >
      <div>
        <span className="mb-2 block text-sm font-semibold">{t('expenseFor')}</span>
        <div className="grid grid-cols-3 gap-2" role="radiogroup">
          {EXPENSE_CATEGORIES.map((c) => {
            const on = category === c.key
            return (
              <button
                key={c.key}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => {
                  setCategory(c.key)
                  setError('')
                }}
                className={`min-h-14 cursor-pointer rounded-2xl border-[1.5px] px-2 text-sm font-semibold leading-tight transition-colors duration-150 ${
                  on ? 'border-charcoal bg-charcoal text-white' : 'border-line bg-white hover:border-charcoal-500'
                }`}
              >
                {pick(c)}
              </button>
            )
          })}
        </div>
      </div>
      <Field label={t('amount')}>
        <MoneyInput value={amount} onChange={setAmount} className="text-lg font-bold" />
      </Field>
      <div>
        <span className="mb-1.5 block text-sm font-semibold">{t('paidFrom')}</span>
        <Segmented
          value={method}
          onChange={setMethod}
          options={[
            { value: 'cash', label: t('shopDrawer') },
            { value: 'bank', label: t('bankOrOutside') },
          ]}
        />
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

export default function Expenses() {
  const { t, pick } = useLang()
  const [month, setMonth] = useState(monthKey())
  const [adding, setAdding] = useState(false)
  const [msg, setMsg] = useState('')
  const { from, to } = monthRange(month)
  const list = useEntries('expenses', from, to)

  const total = (list || []).reduce((s, e) => s + (e.amount || 0), 0)
  const byCat = useMemo(() => {
    const m = {}
    for (const e of list || []) m[e.category] = (m[e.category] || 0) + (e.amount || 0)
    return Object.entries(m).sort((a, b) => b[1] - a[1])
  }, [list])
  const top = byCat[0]?.[1] || 1

  return (
    <Page
      title={t('expenses')}
      right={
        <Button size="sm" className="me-1" onClick={() => setAdding(true)}>
          <Icon name="plus" size={18} /> {t('add')}
        </Button>
      }
    >
      <div className="space-y-4">
        <MonthPicker month={month} onChange={setMonth} />
        {msg && <Notice type="ok">{msg}</Notice>}

        {list === null ? (
          <div className="flex justify-center py-16">
            <Spinner />
          </div>
        ) : list.length === 0 ? (
          <EmptyState
            icon="receipt"
            body={t('noExpenses')}
            action={
              <Button onClick={() => setAdding(true)}>
                <Icon name="plus" size={18} /> {t('addExpense')}
              </Button>
            }
          />
        ) : (
          <>
            <Card className="p-4">
              <div className="flex items-baseline justify-between">
                <span className="font-semibold text-muted">{t('monthTotal')}</span>
                <Rs value={total} className="text-2xl font-bold" />
              </div>
              <div className="mt-4 space-y-2.5">
                {byCat.map(([k, v]) => (
                  <div key={k}>
                    <div className="mb-1 flex justify-between text-sm">
                      <span className="font-semibold">{pick(expenseCategory(k))}</span>
                      <Rs value={v} className="font-semibold" />
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-paper">
                      <div className="h-full rounded-full bg-lime" style={{ width: `${Math.max(3, (v / top) * 100)}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            <SectionTitle>{t('expenses')}</SectionTitle>
            <EntryGroups
              list={list}
              kind="expenses"
              row={(e) => ({
                icon: 'receipt',
                title: pick(expenseCategory(e.category)),
                sub: [e.note, e.method === 'cash' ? t('fromDrawer') : t('bankOrOutside'), e.byName].filter(Boolean).join(' · '),
              })}
            />
          </>
        )}
      </div>

      <Sheet open={adding} title={t('addExpense')} onClose={() => setAdding(false)}>
        {adding && (
          <ExpenseForm
            onDone={(m) => {
              setAdding(false)
              setMonth(monthKey())
              setMsg(m)
              setTimeout(() => setMsg(''), 3000)
            }}
          />
        )}
      </Sheet>
    </Page>
  )
}
