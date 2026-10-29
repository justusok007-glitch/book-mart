import { useEffect, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useLang } from '../context/LangContext'
import { fetchSale, fetchSalesForDay, useDayStats, useShopSettings } from '../lib/selling'
import { dayKey } from '../lib/saleMath'
import { toDate } from '../lib/format'
import { Badge, Button, Card, EmptyState, Notice, Page, Rs, Sheet, Spinner } from '../components/ui'
import { ReturnForm } from './Returns'
import { printReceipt, ReceiptView, shareReceipt } from '../components/Receipt'
import Icon from '../components/Icon'

const timeOf = (s) => {
  const d = toDate(s.at) || new Date(s.clientAt || 0)
  return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}

export function SalesList() {
  const { t, pick } = useLang()
  const { can } = useAuth()
  const [day, setDay] = useState(dayKey())
  const [list, setList] = useState(null)
  const showProfit = can('view_profit_loss')

  useEffect(() => {
    let live = true
    setList(null)
    fetchSalesForDay(day)
      .then((l) => live && setList(l))
      .catch(() => live && setList([]))
    return () => {
      live = false
    }
  }, [day])

  const sum = (k) => (list || []).reduce((s, x) => s + (Number(x[k]) || 0), 0)
  // the day's running totals already include returns made that day (refunds, profit given back)
  const stats = useDayStats(day, true)
  const returns = stats?.returnsTotal ?? sum('returnedTotal')
  const netSales = (stats?.salesTotal ?? sum('total')) - returns
  const cashIn = stats?.cashIn ?? sum('paid')
  const profit = stats?.profit ?? sum('profit')
  const shift = (n) => {
    const d = new Date(day + 'T12:00:00')
    d.setDate(d.getDate() + n)
    setDay(dayKey(d))
  }
  const isToday = day === dayKey()

  return (
    <Page title={t('salesHistory')}>
      {/* day picker */}
      <div className="mb-4 flex items-center gap-2">
        <Button variant="secondary" onClick={() => shift(-1)} aria-label={t('previousDay')} className="px-3">
          <Icon name="chevron" size={20} className="rotate-180 rtl:rotate-0" />
        </Button>
        <input type="date" className="field latin flex-1 text-center font-semibold" dir="ltr" value={day} max={dayKey()} onChange={(e) => e.target.value && setDay(e.target.value)} />
        <Button variant="secondary" onClick={() => shift(1)} disabled={isToday} aria-label={t('nextDay')} className="px-3">
          <Icon name="chevron" size={20} className="rtl:rotate-180" />
        </Button>
      </div>

      {list === null ? (
        <div className="flex justify-center py-16">
          <Spinner />
        </div>
      ) : (
        <>
          <div className="mb-4 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            {[
              { label: t('salesCount'), value: <span className="latin">{list.length}</span> },
              { label: t('netSales'), value: <Rs value={netSales} />, sub: returns > 0 ? <>{t('returnsShort')} <Rs value={returns} /></> : null },
              { label: t('cashReceived'), value: <Rs value={cashIn} /> },
              showProfit
                ? { label: t('profit'), value: <Rs value={profit} className="text-leaf" /> }
                : { label: t('udhaarGiven'), value: <Rs value={sum('due')} className="text-danger" /> },
            ].map((s) => (
              <Card key={s.label} className="p-3">
                <div className="text-xs font-semibold text-muted">{s.label}</div>
                <div className="mt-1 text-lg font-bold">{s.value}</div>
                {s.sub && <div className="text-xs text-muted">{s.sub}</div>}
              </Card>
            ))}
          </div>

          {list.length === 0 ? (
            <EmptyState icon="receipt" body={t('noSalesThisDay')} />
          ) : (
            <ul className="space-y-2.5">
              {list.map((s) => (
                <li key={s.id}>
                  <Link
                    to={`/sales/${s.id}`}
                    className="flex min-h-[72px] items-center gap-3 rounded-2xl border-[1.5px] border-line bg-white px-4 py-3 transition-colors duration-150 hover:border-charcoal-500 active:bg-paper"
                  >
                    <div className="latin w-12 shrink-0 text-center text-sm font-bold text-muted">{timeOf(s)}</div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-semibold">
                        {s.lines.map((l) => pick({ en: l.itemName, ur: l.itemNameUr })).join(', ')}
                      </div>
                      <div className="truncate text-sm text-muted">
                        <span className="latin">#{s.receiptNo}</span> · {s.byName}
                        {s.customerName && <> · {s.customerName}</>}
                      </div>
                    </div>
                    <div className="text-end">
                      <Rs value={s.total} className="font-bold" />
                      {(s.due > 0 || s.returnedTotal > 0) && (
                        <div className="flex justify-end gap-1">
                          {s.due > 0 && <Badge tone="danger">{t('credit')}</Badge>}
                          {s.returnedTotal > 0 && <Badge>{t('returnedBadge')}</Badge>}
                        </div>
                      )}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </Page>
  )
}

export function SaleDetail() {
  const { id } = useParams()
  const { t } = useLang()
  const { can } = useAuth()
  const shop = useShopSettings()
  const [sale, setSale] = useState(undefined)
  const [msg, setMsg] = useState('')
  const [params] = useSearchParams()
  const [returning, setReturning] = useState(false)
  const [reload, setReload] = useState(0)

  useEffect(() => {
    fetchSale(id)
      .then((s) => {
        setSale(s)
        if (s && params.get('return') && can('sale_returns') && reload === 0) setReturning(true)
      })
      .catch(() => setSale(null))
  }, [id, reload])

  if (sale === undefined)
    return (
      <Page title={t('sale')}>
        <div className="flex justify-center py-16">
          <Spinner />
        </div>
      </Page>
    )
  if (!sale)
    return (
      <Page title={t('sale')}>
        <EmptyState icon="receipt" body={t('notFound')} />
      </Page>
    )

  return (
    <Page title={`${t('sale')} #${sale.receiptNo}`}>
      <div className="space-y-4">
        <ReceiptView sale={sale} shop={shop} />
        {sale.returnedTotal > 0 && (
          <Notice type="warn">
            {t('itemsReturnedFromSale')} <Rs value={sale.returnedTotal} className="font-bold" />
          </Notice>
        )}
        {can('view_profit_loss') && (
          <Card className="space-y-1 p-4 text-sm">
            <div className="flex justify-between">
              <span className="text-muted">{t('costOfGoods')}</span>
              <Rs value={sale.cost} />
            </div>
            <div className="flex justify-between font-semibold">
              <span>{t('profit')}</span>
              <Rs value={sale.profit} className="text-leaf" />
            </div>
            {sale.knownCost === false && <p className="text-muted">{t('someCostUnknown')}</p>}
          </Card>
        )}
        <div className="grid grid-cols-2 gap-3">
          <Button variant="secondary" size="lg" onClick={() => printReceipt(sale, shop, t('receiptThanks'))}>
            <Icon name="printer" size={20} /> {t('print')}
          </Button>
          <Button
            variant="secondary"
            size="lg"
            onClick={async () => {
              if ((await shareReceipt(sale, shop)) === 'copied') setMsg(t('copied'))
            }}
          >
            <Icon name="share" size={20} /> {t('share')}
          </Button>
        </div>
        {can('sale_returns') && (
          <Button size="lg" className="w-full" onClick={() => setReturning(true)}>
            <Icon name="rotate" size={20} /> {t('returnItems')}
          </Button>
        )}
        {msg && <p className="text-center text-sm text-leaf">{msg}</p>}
      </div>
      <Sheet open={returning} title={`${t('returnItems')} #${sale.receiptNo}`} onClose={() => setReturning(false)}>
        {returning && (
          <ReturnForm
            sale={sale}
            onDone={(res) => {
              setReturning(false)
              setMsg(`${t('returnSaved')} — Rs ${res.amount.toLocaleString('en-PK')}`)
              setTimeout(() => setReload((r) => r + 1), 300)
            }}
          />
        )}
      </Sheet>
    </Page>
  )
}
