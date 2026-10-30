import { useEffect, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useLang } from '../context/LangContext'
import { fetchSale, useShopSettings } from '../lib/selling'
import { fetchSalesBetween, fetchStats, periodRange, sumStats } from '../lib/reports'
import { dayKey } from '../lib/saleMath'
import { toDate } from '../lib/format'
import { Badge, Button, Card, EmptyState, Notice, Page, Rs, Sheet, Spinner } from '../components/ui'
import { ReturnForm } from './Returns'
import { printReceipt, ReceiptView, shareReceipt } from '../components/Receipt'
import Icon from '../components/Icon'
import { PeriodPicker } from '../components/ReportBits'
import { dateLabel, groupByDay } from '../components/MoneyBits'

const timeOf = (s) => {
  const d = toDate(s.at) || new Date(s.clientAt || 0)
  return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}

function SaleRow({ s }) {
  const { t, pick } = useLang()
  return (
    <Link
      to={`/sales/${s.id}`}
      className="flex min-h-[72px] items-center gap-3 rounded-2xl border-[1.5px] border-line bg-white px-4 py-3 transition-colors duration-150 hover:border-charcoal-500 active:bg-paper"
    >
      <div className="latin w-12 shrink-0 text-center text-sm font-bold text-muted">{timeOf(s)}</div>
      <div className="min-w-0 flex-1">
        <div className="truncate font-semibold">{s.lines.map((l) => pick({ en: l.itemName, ur: l.itemNameUr })).join(', ')}</div>
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
  )
}

export function SalesList() {
  const { t, lang } = useLang()
  const [search] = useSearchParams()
  // opened from a report with ?day=YYYY-MM-DD → show just that day
  const linkedDay = /^\d{4}-\d{2}-\d{2}$/.test(search.get('day') || '') ? search.get('day') : null
  const [period, setPeriod] = useState(linkedDay ? 'custom' : 'today')
  const [custom, setCustom] = useState(() => (linkedDay ? { from: linkedDay, to: linkedDay } : { from: dayKey().slice(0, 8) + '01', to: dayKey() }))
  const { from, to } = periodRange(period, custom)
  const [list, setList] = useState(null)
  const [stats, setStats] = useState(null)

  useEffect(() => {
    let live = true
    setList(null)
    setStats(null)
    fetchSalesBetween(from, to)
      .then((l) => live && setList(l.sort((a, b) => (b.clientAt || 0) - (a.clientAt || 0))))
      .catch(() => live && setList([]))
    fetchStats(from, to)
      .then((x) => live && setStats(sumStats(x)))
      .catch(() => live && setStats(false))
    return () => {
      live = false
    }
  }, [from, to])

  const sum = (k) => (list || []).reduce((s, x) => s + (Number(x[k]) || 0), 0)
  // running totals include returns made in the period; fall back to the bills themselves
  const returns = stats ? stats.returnsTotal : sum('returnedTotal')
  const netSales = (stats ? stats.salesTotal : sum('total')) - returns
  const cashIn = stats ? stats.cashIn : sum('paid')
  const credit = stats ? stats.creditGiven : sum('due')
  const groups = groupByDay((list || []).map((s) => ({ ...s, amount: s.total })))
  const oneDay = from === to

  return (
    <Page title={t('salesHistory')}>
      <div className="mb-4">
        <PeriodPicker period={period} setPeriod={setPeriod} custom={custom} setCustom={setCustom} />
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
              { label: t('udhaarGiven'), value: <Rs value={credit} className={credit > 0 ? 'text-danger' : ''} /> },
            ].map((s) => (
              <Card key={s.label} className="p-3">
                <div className="text-xs font-semibold text-muted">{s.label}</div>
                <div className="mt-1 text-lg font-bold">{s.value}</div>
                {s.sub && <div className="text-xs text-muted">{s.sub}</div>}
              </Card>
            ))}
          </div>

          {list.length === 0 ? (
            <EmptyState icon="receipt" body={oneDay ? t('noSalesThisDay') : t('nothingInRange')} />
          ) : (
            <div className="space-y-5">
              {groups.map((g) => (
                <section key={g.day}>
                  {!oneDay && (
                    <div className="mb-2 flex items-baseline justify-between px-1">
                      <h3 className="text-sm font-bold text-muted">{dateLabel(g.day, lang)}</h3>
                      <span className="text-sm font-bold text-muted">
                        <span className="latin">{g.items.length}</span> {t('billsWord')} · <Rs value={g.items.reduce((s, x) => s + (x.total || 0), 0)} />
                      </span>
                    </div>
                  )}
                  <ul className="space-y-2.5">
                    {g.items.map((s) => (
                      <li key={s.id}>
                        <SaleRow s={s} />
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
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
