import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useLang } from '../context/LangContext'
import { fetchLedger, paySupplier, useSuppliers } from '../lib/purchasing'
import { Button, Card, EmptyState, Field, MoneyInput, Notice, Page, Rs, SectionTitle, Segmented, Sheet, Spinner } from '../components/ui'
import Icon from '../components/Icon'
import { SupplierForm } from './Suppliers'
import { fmtDate } from '../lib/format'

function PayForm({ supplier, onDone }) {
  const { t } = useLang()
  const { user, displayName } = useAuth()
  const [amount, setAmount] = useState(supplier.balance > 0 ? String(supplier.balance) : '')
  const [method, setMethod] = useState('cash')
  const [note, setNote] = useState('')
  const [error, setError] = useState('')
  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault()
        if (!(Number(amount) > 0)) return setError(t('enterAmount'))
        paySupplier({ supplierId: supplier.id, amount: Number(amount), method, note, user: { uid: user.uid, name: displayName } })
        onDone()
      }}
    >
      <div className="flex items-center justify-between rounded-xl bg-paper px-4 py-3">
        <span className="text-muted">{t('weOwe')}</span>
        <Rs value={supplier.balance || 0} className="text-lg font-bold text-danger" />
      </div>
      <Field label={t('amountPaid')}>
        <MoneyInput value={amount} onChange={setAmount} className="text-lg font-bold" autoFocus />
      </Field>
      <div>
        <span className="mb-1.5 block text-sm font-semibold">{t('paidBy')}</span>
        <Segmented
          value={method}
          onChange={setMethod}
          options={[
            { value: 'cash', label: t('cashFromShop') },
            { value: 'bank', label: t('bankOrOther') },
          ]}
        />
      </div>
      <Field label={`${t('note')} (${t('optional')})`}>
        <input className="field" value={note} onChange={(e) => setNote(e.target.value)} />
      </Field>
      <Notice>{error}</Notice>
      <Button type="submit" size="lg" className="w-full">
        <Icon name="check" size={20} /> {t('savePayment')}
      </Button>
    </form>
  )
}

export default function SupplierDetail() {
  const { id } = useParams()
  const { t } = useLang()
  const { can } = useAuth()
  const list = useSuppliers(true)
  const supplier = (list || []).find((s) => s.id === id)
  const [ledger, setLedger] = useState(null)
  const [sheet, setSheet] = useState(null) // 'pay' | 'edit'

  const balanceKey = supplier?.balance
  useEffect(() => {
    let live = true
    fetchLedger(id)
      .then((l) => live && setLedger(l))
      .catch(() => live && setLedger([]))
    return () => {
      live = false
    }
  }, [id, balanceKey])

  if (list === null)
    return (
      <Page title={t('suppliers')}>
        <div className="flex justify-center py-16">
          <Spinner />
        </div>
      </Page>
    )
  if (!supplier)
    return (
      <Page title={t('suppliers')}>
        <EmptyState icon="truck" body={t('notFound')} />
      </Page>
    )

  const owe = supplier.balance || 0
  return (
    <Page
      title={supplier.name}
      right={
        can('manage_suppliers') && (
          <Button size="sm" variant="secondary" className="me-1" onClick={() => setSheet('edit')}>
            <Icon name="pencil" size={16} /> {t('edit')}
          </Button>
        )
      }
    >
      <div className="space-y-5">
        <Card className="p-5">
          <div className="text-sm font-semibold text-muted">{owe > 0 ? t('weOwe') : owe < 0 ? t('advancePaid') : t('settled')}</div>
          <Rs value={Math.abs(owe)} className={`text-3xl font-bold ${owe > 0 ? 'text-danger' : 'text-ink'}`} />
          {(supplier.phone || supplier.address) && (
            <div className="mt-3 space-y-0.5 text-sm text-muted">
              {supplier.phone && (
                <a href={`tel:${supplier.phone}`} className="latin block font-semibold text-leaf" dir="ltr">
                  {supplier.phone}
                </a>
              )}
              {supplier.address && <div>{supplier.address}</div>}
            </div>
          )}
          <div className="mt-4 grid grid-cols-2 gap-3">
            {can('pay_suppliers') && (
              <Button variant="accent" size="lg" onClick={() => setSheet('pay')}>
                <Icon name="cash" size={20} /> {t('paySupplier')}
              </Button>
            )}
            {can('buy') && (
              <Link
                to="/buy"
                className="inline-flex min-h-14 items-center justify-center gap-2 rounded-xl border-[1.5px] border-line bg-white px-5 text-lg font-semibold hover:border-charcoal-500"
              >
                <Icon name="truck" size={20} /> {t('buy')}
              </Link>
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
                  const isPay = e.type === 'payment'
                  const row = (
                    <>
                      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${isPay ? 'bg-lime-100 text-leaf' : 'bg-danger-50 text-danger'}`}>
                        <Icon name={isPay ? 'cash' : 'truck'} size={18} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="font-semibold">
                          {isPay ? t('paymentMade') : t('purchaseOnBill')}
                          {e.billNo && <span className="latin font-normal text-muted"> #{e.billNo}</span>}
                        </div>
                        <div className="truncate text-sm text-muted">
                          <span className="latin">{fmtDate(e.at)}</span>
                          {e.byName && <> · {e.byName}</>}
                          {e.method === 'bank' && <> · {t('bankOrOther')}</>}
                          {e.note && e.note !== 'paid with purchase' && <> · {e.note}</>}
                        </div>
                      </div>
                      <span className={`latin text-lg font-bold ${isPay ? 'text-leaf' : 'text-danger'}`} dir="ltr">
                        {isPay ? '−' : '+'} {Number(e.amount).toLocaleString('en-PK')}
                      </span>
                    </>
                  )
                  return (
                    <li key={e.id} className="border-b border-line/70 last:border-0">
                      {e.purchaseId && !isPay ? (
                        <Link to={`/purchases/${e.purchaseId}`} className="flex min-h-16 items-center gap-3 px-4 py-2 hover:bg-paper/60">
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
          <p className="mt-2 text-sm text-muted">{t('ledgerNote')}</p>
        </section>
      </div>

      <Sheet open={sheet === 'pay'} title={t('paySupplier')} onClose={() => setSheet(null)}>
        {sheet === 'pay' && <PayForm supplier={supplier} onDone={() => setSheet(null)} />}
      </Sheet>
      <Sheet open={sheet === 'edit'} title={t('edit')} onClose={() => setSheet(null)}>
        {sheet === 'edit' && <SupplierForm initial={supplier} onDone={() => setSheet(null)} />}
      </Sheet>
    </Page>
  )
}
