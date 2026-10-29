import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useLang } from '../context/LangContext'
import { fetchRecentReturns, findSaleByReceipt, recordReturn, RETURN_REASONS } from '../lib/customers'
import { fetchSalesForDay } from '../lib/selling'
import { dayKey, returnable, returnValue } from '../lib/saleMath'
import { fmtDate, toDate } from '../lib/format'
import { errorText } from '../lib/errors'
import { Badge, Button, Card, EmptyState, Field, IconButton, Notice, Page, Rs, SectionTitle, Segmented, Spinner, Toggle } from '../components/ui'
import Icon from '../components/Icon'

/* ---------- the return form (opened from a sale) ---------- */
export function ReturnForm({ sale, onDone }) {
  const { t, pick } = useLang()
  const { user, displayName } = useAuth()
  const rows = returnable(sale)
  const [qty, setQty] = useState(() => Object.fromEntries(rows.map((r) => [r.variantId, 0])))
  const [refund, setRefund] = useState(sale.customerId && sale.due > 0 ? 'account' : 'cash')
  const [reason, setReason] = useState('changed_mind')
  const [restock, setRestock] = useState(true)
  const [error, setError] = useState('')
  const picks = rows.map((r) => ({ line: r, qty: qty[r.variantId] || 0 }))
  const value = returnValue(sale, picks.filter((p) => p.qty > 0).map((p) => ({ ...p.line, qty: p.qty })))

  const step = (id, d, max) => setQty((q) => ({ ...q, [id]: Math.min(max, Math.max(0, (q[id] || 0) + d)) }))

  function save() {
    if (value.items === 0) return setError(t('pickItemsToReturn'))
    const res = recordReturn({ sale, picks, refund, reason, restock, user: { uid: user.uid, name: displayName } })
    res.done.catch((e) => window.alert(`${t('returnNotSaved')}\n${errorText(e, t)}`))
    onDone(res)
  }

  if (rows.every((r) => r.max === 0)) return <Notice type="info">{t('allReturned')}</Notice>

  return (
    <div className="space-y-4">
      <ul className="divide-y divide-line rounded-2xl border border-line">
        {rows.map((r) => (
          <li key={r.variantId} className={`flex items-center gap-3 px-3 py-2 ${r.max === 0 ? 'opacity-50' : ''}`}>
            <div className="min-w-0 flex-1">
              <div className="font-semibold leading-snug">
                {pick({ en: r.itemName, ur: r.itemNameUr })}
                {r.variantName && <span className="font-normal text-muted"> · {pick({ en: r.variantName, ur: r.variantNameUr })}</span>}
              </div>
              <div className="text-sm text-muted">
                {t('sold')} <span className="latin">{r.qty}</span> × <Rs value={r.price} />
                {r.qty !== r.max && (
                  <>
                    {' · '}
                    {t('alreadyReturned')} <span className="latin">{r.qty - r.max}</span>
                  </>
                )}
              </div>
            </div>
            <div className="flex items-center rounded-xl border border-line bg-white">
              <IconButton icon="minus" label={t('less')} onClick={() => step(r.variantId, -1, r.max)} size={18} className="rounded-xl" />
              <span className="latin w-8 text-center text-lg font-bold">{qty[r.variantId] || 0}</span>
              <IconButton icon="plus" label={t('more')} onClick={() => step(r.variantId, 1, r.max)} size={18} className="rounded-xl" />
            </div>
          </li>
        ))}
      </ul>

      <Field label={t('reason')}>
        <select
          className="field"
          value={reason}
          onChange={(e) => {
            setReason(e.target.value)
            setRestock(e.target.value !== 'damaged')
          }}
        >
          {RETURN_REASONS.map((r) => (
            <option key={r.key} value={r.key}>
              {pick(r)}
            </option>
          ))}
        </select>
      </Field>

      <label className="flex min-h-14 cursor-pointer items-center justify-between gap-3 rounded-xl border border-line bg-white ps-4 pe-1">
        <span>
          <span className="block font-semibold">{t('putBackInStock')}</span>
          <span className="block text-sm text-muted">{restock ? t('restockYes') : t('restockNo')}</span>
        </span>
        <Toggle checked={restock} onChange={setRestock} label={t('putBackInStock')} />
      </label>

      <div>
        <span className="mb-1.5 block text-sm font-semibold">{t('refundHow')}</span>
        <Segmented
          value={refund}
          onChange={setRefund}
          options={[
            { value: 'cash', label: t('cashBack') },
            ...(sale.customerId ? [{ value: 'account', label: t('offUdhaar') }] : []),
          ]}
        />
      </div>

      <div className="flex items-center justify-between rounded-2xl bg-paper p-4">
        <span className="text-lg font-bold">{refund === 'cash' ? t('giveBack') : t('takeOffAccount')}</span>
        <Rs value={value.amount} className="text-2xl font-bold text-charcoal" />
      </div>
      {sale.discount > 0 && value.items > 0 && <p className="text-sm text-muted">{t('discountShared')}</p>}

      <Notice>{error}</Notice>
      <Button size="lg" variant="accent" className="w-full" onClick={save}>
        <Icon name="rotate" size={20} /> {t('saveReturn')}
      </Button>
    </div>
  )
}

/* ---------- Returns page: find a sale, see recent returns ---------- */
export default function Returns() {
  const { t, pick } = useLang()
  const navigate = useNavigate()
  const [code, setCode] = useState('')
  const [searching, setSearching] = useState(false)
  const [notFound, setNotFound] = useState(false)
  const [today, setToday] = useState(null)
  const [recent, setRecent] = useState(null)

  useEffect(() => {
    fetchSalesForDay(dayKey())
      .then(setToday)
      .catch(() => setToday([]))
    fetchRecentReturns()
      .then(setRecent)
      .catch(() => setRecent([]))
  }, [])

  async function find(e) {
    e.preventDefault()
    setNotFound(false)
    setSearching(true)
    try {
      const sale = await findSaleByReceipt(code)
      if (sale) navigate(`/sales/${sale.id}?return=1`)
      else setNotFound(true)
    } catch {
      setNotFound(true)
    }
    setSearching(false)
  }

  const timeOf = (s) => (toDate(s.at) || new Date(s.clientAt || 0)).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })

  return (
    <Page title={t('returns')}>
      <div className="space-y-6">
        <Card className="p-4">
          <form onSubmit={find} className="space-y-3">
            <Field label={t('receiptNoLabel')} hint={t('receiptNoHint')}>
              <div className="flex gap-2">
                <input
                  className="field latin text-lg uppercase"
                  dir="ltr"
                  autoCapitalize="characters"
                  placeholder="261029-7K3F"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                />
                <Button type="submit" disabled={!code.trim() || searching}>
                  <Icon name="search" size={20} />
                </Button>
              </div>
            </Field>
            {notFound && <Notice>{t('receiptNotFound')}</Notice>}
          </form>
        </Card>

        <section>
          <SectionTitle>{t('todaysSales')}</SectionTitle>
          {today === null ? (
            <div className="flex justify-center py-6">
              <Spinner />
            </div>
          ) : today.length === 0 ? (
            <p className="text-muted">{t('noSalesThisDay')}</p>
          ) : (
            <ul className="space-y-2">
              {today.slice(0, 15).map((s) => (
                <li key={s.id}>
                  <Link
                    to={`/sales/${s.id}?return=1`}
                    className="flex min-h-16 items-center gap-3 rounded-2xl border-[1.5px] border-line bg-white px-4 py-2 hover:border-charcoal-500 active:bg-paper"
                  >
                    <span className="latin w-12 text-sm font-bold text-muted">{timeOf(s)}</span>
                    <span className="min-w-0 flex-1 truncate">{s.lines.map((l) => pick({ en: l.itemName, ur: l.itemNameUr })).join(', ')}</span>
                    <Rs value={s.total} className="font-bold" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section>
          <SectionTitle>{t('recentReturns')}</SectionTitle>
          {recent === null ? (
            <div className="flex justify-center py-6">
              <Spinner />
            </div>
          ) : recent.length === 0 ? (
            <EmptyState icon="rotate" body={t('noReturns')} />
          ) : (
            <Card className="overflow-hidden">
              <ul>
                {recent.map((r) => (
                  <li key={r.id} className="border-b border-line/70 last:border-0">
                    <Link to={`/sales/${r.saleId}`} className="flex min-h-16 items-center gap-3 px-4 py-2 hover:bg-paper/60">
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-semibold">{r.lines.map((l) => `${l.qty} × ${pick({ en: l.itemName, ur: l.itemNameUr })}`).join(', ')}</div>
                        <div className="truncate text-sm text-muted">
                          <span className="latin">{fmtDate(r.at)}</span> · <span className="latin">#{r.receiptNo}</span> · {r.byName}
                        </div>
                      </div>
                      <div className="text-end">
                        <Rs value={r.amount} className="font-bold" />
                        <div>
                          <Badge tone={r.refund === 'cash' ? 'neutral' : 'lime'}>{r.refund === 'cash' ? t('cashBack') : t('offUdhaar')}</Badge>
                        </div>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </section>
      </div>
    </Page>
  )
}
