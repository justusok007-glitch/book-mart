import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useLang } from '../context/LangContext'
import { useCatalog } from '../lib/catalog'
import { bySeller, fetchSalesBetween, fetchStats, periodRange, seriesByDay, stockByCategory, sumStats, topItems } from '../lib/reports'
import { errorText } from '../lib/errors'
import { Card, EmptyState, Notice, Page, Rs, Segmented, Spinner } from '../components/ui'
import { BarChart, PeriodPicker, Row, shortLabel, usePeriod } from '../components/ReportBits'
import Icon from '../components/Icon'

const Loading = () => (
  <div className="flex justify-center py-16">
    <Spinner />
  </div>
)

function useStats(from, to) {
  const { t } = useLang()
  const [state, setState] = useState({ stats: null, error: '' })
  useEffect(() => {
    let live = true
    setState({ stats: null, error: '' })
    fetchStats(from, to)
      .then((s) => live && setState({ stats: s, error: '' }))
      .catch((e) => live && setState({ stats: [], error: errorText(e, t) }))
    return () => {
      live = false
    }
  }, [from, to, t])
  return state
}

/* ---------- sales by day ---------- */
function DaysReport({ from, to }) {
  const { t } = useLang()
  const { can } = useAuth()
  const { stats, error } = useStats(from, to)
  const series = useMemo(() => seriesByDay(stats || [], from, to), [stats, from, to])
  const total = useMemo(() => sumStats(stats || []), [stats])
  if (stats === null) return <Loading />
  if (error) return <Notice>{error}</Notice>
  if (!total.salesCount) return <EmptyState icon="chart" body={t('nothingInRange')} />
  const net = total.salesTotal - total.returnsTotal
  const days = series.filter((r) => r.bills > 0).length
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2.5">
        {[
          { label: t('netSales'), value: <Rs value={net} /> },
          { label: t('billsWord'), value: <span className="latin">{total.salesCount}</span> },
          { label: t('avgBill'), value: <Rs value={Math.round(total.salesTotal / total.salesCount)} /> },
          { label: series[0]?.monthly ? t('avgPerMonth') : t('avgPerDay'), value: <Rs value={Math.round(net / Math.max(1, days))} /> },
        ].map((s) => (
          <Card key={s.label} className="p-3">
            <div className="text-xs font-semibold text-muted">{s.label}</div>
            <div className="mt-1 text-lg font-bold">{s.value}</div>
          </Card>
        ))}
      </div>
      {series.length > 1 && (
        <Card className="p-4">
          <BarChart rows={series.map((r) => ({ key: r.key, value: r.net }))} label={t('netSales')} />
        </Card>
      )}
      <Card className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line text-muted">
              <th className="px-3 py-2 text-start font-semibold">{t('date')}</th>
              <th className="px-3 py-2 text-end font-semibold">{t('billsWord')}</th>
              <th className="px-3 py-2 text-end font-semibold">{t('netSales')}</th>
              <th className="px-3 py-2 text-end font-semibold">{can('view_profit_loss') ? t('profit') : t('cashReceived')}</th>
            </tr>
          </thead>
          <tbody>
            {[...series].reverse().filter((r) => r.bills > 0 || r.net).map((r) => (
              <tr key={r.key} className="border-b border-line last:border-b-0">
                <td className="latin px-3 py-2.5 font-semibold">
                  {r.monthly ? shortLabel(r.key, true) : <Link to={`/sales?day=${r.key}`} className="text-leaf underline-offset-2 hover:underline">{shortLabel(r.key)}</Link>}
                </td>
                <td className="latin px-3 py-2.5 text-end">{r.bills}</td>
                <td className="px-3 py-2.5 text-end"><Rs value={r.net} className="font-semibold" /></td>
                <td className="px-3 py-2.5 text-end">{can('view_profit_loss') ? <Rs value={r.profit} className="text-leaf" /> : <Rs value={r.cash} />}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  )
}

/* ---------- by salesman ---------- */
function StaffReport({ from, to }) {
  const { t } = useLang()
  const { stats, error } = useStats(from, to)
  const list = useMemo(() => bySeller(stats || []), [stats])
  if (stats === null) return <Loading />
  if (error) return <Notice>{error}</Notice>
  if (!list.length) return <EmptyState icon="users" body={t('nothingInRange')} />
  const all = list.reduce((s, x) => s + x.total, 0) || 1
  return (
    <div className="space-y-4">
      <Card className="divide-y divide-line">
        {list.map((s) => (
          <div key={s.uid} className="px-4 py-3">
            <div className="mb-1.5 flex items-baseline justify-between gap-2">
              <div className="min-w-0">
                <div className="truncate font-semibold">{s.name}</div>
                <div className="text-sm text-muted">
                  <span className="latin">{s.count}</span> {t('billsWord')} · {t('avgBill')} <Rs value={Math.round(s.total / Math.max(1, s.count))} />
                </div>
              </div>
              <div className="text-end">
                <Rs value={s.total} className="text-lg font-bold" />
                <div className="latin text-xs text-muted">{Math.round((s.total / all) * 100)}%</div>
              </div>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-paper">
              <div className="h-full rounded-full bg-leaf" style={{ width: `${Math.max(2, (s.total / all) * 100)}%` }} />
            </div>
          </div>
        ))}
      </Card>
      <p className="text-sm text-muted">{t('staffReportNote')}</p>
    </div>
  )
}

/* ---------- items sold ---------- */
function ItemsReport({ from, to }) {
  const { t, pick } = useLang()
  const { can } = useAuth()
  const [sales, setSales] = useState(null)
  const [error, setError] = useState('')
  const [sort, setSort] = useState('revenue')
  const showProfit = can('view_profit_loss')
  useEffect(() => {
    let live = true
    setSales(null)
    setError('')
    fetchSalesBetween(from, to)
      .then((s) => live && setSales(s))
      .catch((e) => {
        if (!live) return
        setSales([])
        setError(errorText(e, t))
      })
    return () => {
      live = false
    }
  }, [from, to, t])
  const rows = useMemo(() => topItems(sales || []).sort((a, b) => b[sort] - a[sort]), [sales, sort])
  if (sales === null) return <Loading />
  if (error) return <Notice>{error}</Notice>
  if (!rows.length) return <EmptyState icon="package" body={t('nothingInRange')} />
  const top = rows[0]?.[sort] || 1
  return (
    <div className="space-y-4">
      <Segmented
        value={sort}
        onChange={setSort}
        options={[
          { value: 'revenue', label: t('bySalesValue') },
          { value: 'qty', label: t('byQuantity') },
          ...(showProfit ? [{ value: 'profit', label: t('profit') }] : []),
        ]}
      />
      <Card className="divide-y divide-line">
        {rows.slice(0, 30).map((r, i) => (
          <Link key={r.itemId} to={`/items/${r.itemId}`} className="block px-4 py-3 hover:bg-paper">
            <div className="mb-1.5 flex items-baseline justify-between gap-2">
              <div className="flex min-w-0 items-baseline gap-2">
                <span className="latin w-5 shrink-0 text-sm font-bold text-muted">{i + 1}</span>
                <span className="truncate font-semibold">{pick({ en: r.en, ur: r.ur })}</span>
              </div>
              <div className="shrink-0 text-end">
                {sort === 'qty' ? <span className="latin text-lg font-bold">{r.qty}</span> : <Rs value={r[sort]} className="text-lg font-bold" />}
              </div>
            </div>
            <div className="flex items-center gap-3 ps-7">
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-paper">
                <div className="h-full rounded-full bg-leaf" style={{ width: `${Math.max(2, (Math.max(0, r[sort]) / top) * 100)}%` }} />
              </div>
              <span className="shrink-0 text-xs text-muted">
                {sort !== 'qty' && (
                  <>
                    <span className="latin">{r.qty}</span> {t('soldWord')}
                  </>
                )}
                {sort === 'qty' && <Rs value={r.revenue} />}
                {sort !== 'profit' && showProfit && r.knownCost && (
                  <>
                    {' '}· {t('profit')} <Rs value={r.profit} />
                  </>
                )}
              </span>
            </div>
          </Link>
        ))}
      </Card>
      <p className="text-sm text-muted">{t('itemsReportNote')}</p>
    </div>
  )
}

/* ---------- stock ---------- */
function StockReport() {
  const { t, pick } = useLang()
  const { can } = useAuth()
  const cat = useCatalog()
  const showCost = can('view_cost_price')
  const r = useMemo(() => stockByCategory(cat), [cat])
  if (!cat.ready) return <Loading />
  if (!r.rows.length) return <EmptyState icon="package" body={t('noItems')} />
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2.5">
        <Card className="p-3">
          <div className="text-xs font-semibold text-muted">{showCost ? t('stockAtCost') : t('unitsInStock')}</div>
          <div className="mt-1 text-lg font-bold">{showCost ? <Rs value={r.total.cost} /> : <span className="latin">{r.total.units}</span>}</div>
        </Card>
        <Card className="p-3">
          <div className="text-xs font-semibold text-muted">{t('stockAtSalePrice')}</div>
          <div className="mt-1 text-lg font-bold">
            <Rs value={r.total.retail} />
          </div>
        </Card>
        <Link to="/low-stock" className="rounded-2xl border border-line bg-white p-3 hover:border-charcoal-500">
          <div className="flex items-center gap-1 text-xs font-semibold text-muted">
            <Icon name="alert" size={14} /> {t('lowStock')}
          </div>
          <div className={`latin mt-1 text-lg font-bold`}>{r.lowCount}</div>
        </Link>
        <Link to="/low-stock" className="rounded-2xl border border-line bg-white p-3 hover:border-charcoal-500">
          <div className="text-xs font-semibold text-muted">{t('outOfStock')}</div>
          <div className={`latin mt-1 text-lg font-bold ${r.outCount ? 'text-danger' : ''}`}>{r.outCount}</div>
        </Link>
      </div>

      <Card className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line text-muted">
              <th className="px-3 py-2 text-start font-semibold">{t('category')}</th>
              <th className="px-3 py-2 text-end font-semibold">{t('unitsShort')}</th>
              {showCost && <th className="px-3 py-2 text-end font-semibold">{t('atCost')}</th>}
              <th className="px-3 py-2 text-end font-semibold">{t('atSalePrice')}</th>
            </tr>
          </thead>
          <tbody>
            {r.rows.map((x) => (
              <tr key={x.id} className="border-b border-line">
                <td className="px-3 py-2.5 font-semibold">{pick(x)}</td>
                <td className="latin px-3 py-2.5 text-end">{x.units}</td>
                {showCost && <td className="px-3 py-2.5 text-end"><Rs value={x.cost} /></td>}
                <td className="px-3 py-2.5 text-end"><Rs value={x.retail} /></td>
              </tr>
            ))}
            <tr className="font-bold">
              <td className="px-3 py-2.5">{t('total')}</td>
              <td className="latin px-3 py-2.5 text-end">{r.total.units}</td>
              {showCost && <td className="px-3 py-2.5 text-end"><Rs value={r.total.cost} /></td>}
              <td className="px-3 py-2.5 text-end"><Rs value={r.total.retail} /></td>
            </tr>
          </tbody>
        </table>
      </Card>
      {showCost && r.total.cost > 0 && (
        <Card className="px-4">
          <Row label={t('expectedMargin')} value={r.total.margin} sub={t('expectedMarginNote')} />
        </Card>
      )}
      {showCost && r.missingCost && <p className="text-sm text-muted">{t('stockCostMissing')}</p>}
    </div>
  )
}

const TABS = [
  { key: 'days', icon: 'calendar', label: 'byDay' },
  { key: 'staff', icon: 'users', label: 'bySalesman' },
  { key: 'items', icon: 'package', label: 'itemsSold' },
  { key: 'stock', icon: 'grid', label: 'stockWord' },
]

export default function Reports() {
  const { t } = useLang()
  const [tab, setTab] = useState(() => {
    try {
      return sessionStorage.getItem('bm-report-tab') || 'days'
    } catch {
      return 'days'
    }
  })
  const p = usePeriod('month')
  const { from, to } = periodRange(p.period, p.custom)
  const pickTab = (k) => {
    setTab(k)
    try {
      sessionStorage.setItem('bm-report-tab', k)
    } catch {
      /* ignore */
    }
  }

  return (
    <Page title={t('reports')}>
      <div className="space-y-4">
        <div className="grid grid-cols-4 gap-1.5 rounded-2xl bg-white p-1.5 ring-1 ring-line" role="tablist">
          {TABS.map((x) => {
            const on = tab === x.key
            return (
              <button
                key={x.key}
                type="button"
                role="tab"
                aria-selected={on}
                onClick={() => pickTab(x.key)}
                className={`flex min-h-14 cursor-pointer flex-col items-center justify-center gap-0.5 rounded-xl px-1 text-xs font-semibold leading-tight transition-colors duration-150 ${
                  on ? 'bg-lime text-charcoal' : 'text-muted hover:bg-paper'
                }`}
              >
                <Icon name={x.icon} size={18} />
                <span className="text-center">{t(x.label)}</span>
              </button>
            )
          })}
        </div>
        {tab !== 'stock' && <PeriodPicker {...p} />}
        {tab === 'days' && <DaysReport from={from} to={to} />}
        {tab === 'staff' && <StaffReport from={from} to={to} />}
        {tab === 'items' && <ItemsReport from={from} to={to} />}
        {tab === 'stock' && <StockReport />}
      </div>
    </Page>
  )
}
