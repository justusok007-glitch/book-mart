import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useLang } from '../context/LangContext'
import { saveCustomer, useCustomers, useShopSettings } from '../lib/selling'
import { fetchCustomerLedger, receivePayment, waNumber } from '../lib/customers'
import { matchScore, norm, tokenize } from '../lib/search'
import { fmtDate } from '../lib/format'
import { errorText } from '../lib/errors'
import { Button, Card, EmptyState, Field, MoneyInput, Notice, Page, Rs, SectionTitle, Segmented, Sheet, Spinner } from '../components/ui'
import Icon from '../components/Icon'

export function CustomerForm({ initial, onDone }) {
  const { t } = useLang()
  const [f, setF] = useState({ name: initial?.name || '', phone: initial?.phone || '', address: initial?.address || '', note: initial?.note || '' })
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })
  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault()
        if (f.name.trim()) onDone(saveCustomer({ id: initial?.id, ...f }))
      }}
    >
      <Field label={t('customerName')}>
        <input className="field" value={f.name} onChange={set('name')} autoFocus />
      </Field>
      <Field label={`${t('phone')} (${t('optional')})`} hint={t('phoneForWhatsapp')}>
        <input className="field latin" dir="ltr" inputMode="tel" value={f.phone} onChange={set('phone')} placeholder="03xx xxxxxxx" />
      </Field>
      <Field label={`${t('address')} (${t('optional')})`}>
        <input className="field" value={f.address} onChange={set('address')} />
      </Field>
      <Field label={`${t('note')} (${t('optional')})`}>
        <input className="field" value={f.note} onChange={set('note')} />
      </Field>
      <Button type="submit" size="lg" className="w-full" disabled={!f.name.trim()}>
        {t('save')}
      </Button>
    </form>
  )
}

export function CustomersList() {
  const { t } = useLang()
  const { can } = useAuth()
  const list = useCustomers(true)
  const [q, setQ] = useState('')
  const [onlyOwing, setOnlyOwing] = useState(false)
  const [adding, setAdding] = useState(false)
  const canAdd = can('manage_customers') || can('sell_credit')

  const shown = useMemo(() => {
    const query = norm(q)
    const tokens = tokenize(q)
    return (list || [])
      .filter((c) => !onlyOwing || (c.balance || 0) > 0)
      .map((c) => ({ c, s: matchScore([c.name], [c.phone, c.address], query, tokens) }))
      .filter((r) => r.s >= 0)
      .sort((a, b) => b.s - a.s || (b.c.balance || 0) - (a.c.balance || 0))
      .map((r) => r.c)
  }, [list, q, onlyOwing])

  const totalDue = (list || []).reduce((s, c) => s + Math.max(0, c.balance || 0), 0)
  const owingCount = (list || []).filter((c) => (c.balance || 0) > 0).length

  return (
    <Page
      title={t('customers')}
      right={
        canAdd && (
          <Button size="sm" className="me-1" onClick={() => setAdding(true)}>
            <Icon name="plus" size={18} /> {t('newCustomer')}
          </Button>
        )
      }
    >
      {list === null ? (
        <div className="flex justify-center py-16">
          <Spinner />
        </div>
      ) : list.length === 0 ? (
        <EmptyState icon="user" title={t('noCustomers')} body={t('noCustomersBody')} />
      ) : (
        <>
          <Card className="mb-4 flex items-center justify-between p-4">
            <div>
              <div className="font-semibold text-muted">{t('totalUdhaar')}</div>
              <div className="text-sm text-muted">
                <span className="latin">{owingCount}</span> {t('customersOwe')}
              </div>
            </div>
            <Rs value={totalDue} className={`text-2xl font-bold ${totalDue > 0 ? 'text-danger' : ''}`} />
          </Card>

          <div className="relative mb-3">
            <Icon name="search" size={22} className="pointer-events-none absolute inset-y-0 start-4 my-auto text-muted" />
            <input
              type="search"
              className="field min-h-14 rounded-2xl ps-12 text-lg [&::-webkit-search-cancel-button]:hidden"
              placeholder={t('searchCustomer')}
              aria-label={t('searchCustomer')}
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <div className="mb-3">
            <Segmented
              value={onlyOwing ? 'owing' : 'all'}
              onChange={(v) => setOnlyOwing(v === 'owing')}
              options={[
                { value: 'all', label: t('all') },
                { value: 'owing', label: t('withUdhaar') },
              ]}
            />
          </div>

          {shown.length === 0 && <EmptyState icon="search" body={t('noMatch')} />}
          <ul className="space-y-2.5">
            {shown.map((c) => {
              const bal = c.balance || 0
              return (
                <li key={c.id}>
                  <Link
                    to={`/customers/${c.id}`}
                    className="flex min-h-[72px] items-center gap-3 rounded-2xl border-[1.5px] border-line bg-white px-4 py-3 transition-colors duration-150 hover:border-charcoal-500 active:bg-paper"
                  >
                    <div className="latin flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-lime-100 text-lg font-bold text-charcoal" aria-hidden="true">
                      {(c.name || '?').charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-semibold">{c.name}</div>
                      {c.phone && (
                        <div className="latin truncate text-sm text-muted" dir="ltr">
                          {c.phone}
                        </div>
                      )}
                    </div>
                    <div className="text-end">
                      <Rs value={Math.abs(bal)} className={`font-bold ${bal > 0 ? 'text-danger' : bal < 0 ? 'text-leaf' : 'text-muted'}`} />
                      <div className="text-xs text-muted">{bal > 0 ? t('owesUs') : bal < 0 ? t('advance') : t('settled')}</div>
                    </div>
                  </Link>
                </li>
              )
            })}
          </ul>
        </>
      )}

      <Sheet open={adding} title={t('newCustomer')} onClose={() => setAdding(false)}>
        {adding && <CustomerForm onDone={() => setAdding(false)} />}
      </Sheet>
    </Page>
  )
}

function ReceiveForm({ customer, onDone }) {
  const { t } = useLang()
  const { user, displayName } = useAuth()
  const [amount, setAmount] = useState(customer.balance > 0 ? String(customer.balance) : '')
  const [method, setMethod] = useState('cash')
  const [note, setNote] = useState('')
  const [error, setError] = useState('')
  const left = (customer.balance || 0) - (Number(amount) || 0)
  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault()
        if (!(Number(amount) > 0)) return setError(t('enterAmount'))
        receivePayment({ customer, amount: Number(amount), method, note, user: { uid: user.uid, name: displayName } }).catch((err) =>
          window.alert(`${t('paymentNotSaved')}\n${errorText(err, t)}`),
        )
        onDone()
      }}
    >
      <div className="flex items-center justify-between rounded-xl bg-paper px-4 py-3">
        <span className="text-muted">{t('owesUs')}</span>
        <Rs value={customer.balance || 0} className="text-lg font-bold text-danger" />
      </div>
      <Field label={t('amountReceived')}>
        <MoneyInput value={amount} onChange={setAmount} className="text-lg font-bold" autoFocus />
      </Field>
      <div>
        <span className="mb-1.5 block text-sm font-semibold">{t('receivedAs')}</span>
        <Segmented
          value={method}
          onChange={setMethod}
          options={[
            { value: 'cash', label: t('cash') },
            { value: 'bank', label: t('bankOrOther') },
          ]}
        />
      </div>
      <Field label={`${t('note')} (${t('optional')})`}>
        <input className="field" value={note} onChange={(e) => setNote(e.target.value)} />
      </Field>
      <div className="flex items-center justify-between rounded-xl border border-line px-4 py-3">
        <span className="text-muted">{t('stillOwes')}</span>
        <Rs value={Math.max(0, left)} className="font-bold" />
      </div>
      <Notice>{error}</Notice>
      <Button type="submit" variant="accent" size="lg" className="w-full">
        <Icon name="check" size={20} /> {t('savePayment')}
      </Button>
    </form>
  )
}

const LEDGER_ICON = { sale: 'cart', payment: 'cash', return: 'rotate' }

export function CustomerDetail() {
  const { id } = useParams()
  const { t } = useLang()
  const { can } = useAuth()
  const shop = useShopSettings()
  const list = useCustomers(true)
  const c = (list || []).find((x) => x.id === id)
  const [ledger, setLedger] = useState(null)
  const [sheet, setSheet] = useState(null)

  const balKey = c?.balance
  useEffect(() => {
    let live = true
    fetchCustomerLedger(id)
      .then((l) => live && setLedger(l))
      .catch(() => live && setLedger([]))
    return () => {
      live = false
    }
  }, [id, balKey])

  if (list === null)
    return (
      <Page title={t('customers')}>
        <div className="flex justify-center py-16">
          <Spinner />
        </div>
      </Page>
    )
  if (!c)
    return (
      <Page title={t('customers')}>
        <EmptyState icon="user" body={t('notFound')} />
      </Page>
    )

  const bal = c.balance || 0
  const wa = waNumber(c.phone)
  const reminder = encodeURIComponent(
    `${t('waGreeting')} ${c.name},\n${t('waReminder')} Rs ${bal.toLocaleString('en-PK')}.\n${shop.name || 'Book Mart'}${shop.phone ? ' · ' + shop.phone : ''}`,
  )

  return (
    <Page
      title={c.name}
      right={
        can('manage_customers') && (
          <Button size="sm" variant="secondary" className="me-1" onClick={() => setSheet('edit')}>
            <Icon name="pencil" size={16} /> {t('edit')}
          </Button>
        )
      }
    >
      <div className="space-y-5">
        <Card className="p-5">
          <div className="text-sm font-semibold text-muted">{bal > 0 ? t('owesUs') : bal < 0 ? t('advance') : t('settled')}</div>
          <Rs value={Math.abs(bal)} className={`text-3xl font-bold ${bal > 0 ? 'text-danger' : bal < 0 ? 'text-leaf' : ''}`} />
          {(c.phone || c.address) && (
            <div className="mt-2 space-y-0.5 text-sm text-muted">
              {c.phone && (
                <a href={`tel:${c.phone}`} className="latin block font-semibold text-leaf" dir="ltr">
                  {c.phone}
                </a>
              )}
              {c.address && <div>{c.address}</div>}
            </div>
          )}
          <div className="mt-4 grid grid-cols-2 gap-3">
            {can('receive_payments') && (
              <Button variant="accent" size="lg" onClick={() => setSheet('pay')} disabled={bal <= 0}>
                <Icon name="cash" size={20} /> {t('receive')}
              </Button>
            )}
            {wa && bal > 0 ? (
              <a
                href={`https://wa.me/${wa}?text=${reminder}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex min-h-14 items-center justify-center gap-2 rounded-xl border-[1.5px] border-line bg-white px-4 text-lg font-semibold hover:border-charcoal-500"
              >
                <Icon name="share" size={20} /> {t('remind')}
              </a>
            ) : (
              c.phone && (
                <a
                  href={`tel:${c.phone}`}
                  className="inline-flex min-h-14 items-center justify-center gap-2 rounded-xl border-[1.5px] border-line bg-white px-4 text-lg font-semibold hover:border-charcoal-500"
                >
                  <Icon name="user" size={20} /> {t('call')}
                </a>
              )
            )}
          </div>
        </Card>

        <section>
          <SectionTitle>{t('ledger')}</SectionTitle>
          {ledger === null ? (
            <div className="flex justify-center py-6">
              <Spinner />
            </div>
          ) : ledger.length === 0 ? (
            <p className="text-muted">{t('noHistory')}</p>
          ) : (
            <Card className="overflow-hidden">
              <ul>
                {ledger.map((e) => {
                  const up = e.type === 'sale'
                  const amount = up ? e.due ?? e.amount : e.amount
                  const row = (
                    <>
                      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${up ? 'bg-danger-50 text-danger' : 'bg-lime-100 text-leaf'}`}>
                        <Icon name={LEDGER_ICON[e.type] || 'receipt'} size={18} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="font-semibold">
                          {e.type === 'sale' ? t('saleOnUdhaar') : e.type === 'payment' ? t('paymentReceived') : t('returnCredit')}
                          {e.receiptNo && <span className="latin font-normal text-muted"> #{e.receiptNo}</span>}
                        </div>
                        <div className="truncate text-sm text-muted">
                          <span className="latin">{fmtDate(e.at)}</span>
                          {e.byName && <> · {e.byName}</>}
                          {e.type === 'sale' && e.paid > 0 && (
                            <>
                              {' · '}
                              {t('billWas')} <span className="latin">{Number(e.amount).toLocaleString('en-PK')}</span>, {t('paidNowShort')}{' '}
                              <span className="latin">{Number(e.paid).toLocaleString('en-PK')}</span>
                            </>
                          )}
                          {e.method === 'bank' && <> · {t('bankOrOther')}</>}
                          {e.note && <> · {e.note}</>}
                        </div>
                      </div>
                      <span className={`latin text-lg font-bold ${up ? 'text-danger' : 'text-leaf'}`} dir="ltr">
                        {up ? '+' : '−'} {Number(amount).toLocaleString('en-PK')}
                      </span>
                    </>
                  )
                  return (
                    <li key={e.id} className="border-b border-line/70 last:border-0">
                      {e.saleId ? (
                        <Link to={`/sales/${e.saleId}`} className="flex min-h-16 items-center gap-3 px-4 py-2 hover:bg-paper/60">
                          {row}
                        </Link>
                      ) : (
                        <div className="flex min-h-16 items-center gap-3 px-4 py-2">{row}</div>
                      )}
                    </li>
                  )
                })}
              </ul>
            </Card>
          )}
          <p className="mt-2 text-sm text-muted">{t('customerLedgerNote')}</p>
        </section>
      </div>

      <Sheet open={sheet === 'pay'} title={t('receive')} onClose={() => setSheet(null)}>
        {sheet === 'pay' && <ReceiveForm customer={c} onDone={() => setSheet(null)} />}
      </Sheet>
      <Sheet open={sheet === 'edit'} title={t('edit')} onClose={() => setSheet(null)}>
        {sheet === 'edit' && <CustomerForm initial={c} onDone={() => setSheet(null)} />}
      </Sheet>
    </Page>
  )
}
