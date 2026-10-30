import { useEffect, useMemo, useState } from 'react'
import { useLang } from '../context/LangContext'
import { fetchExpensesBetween, fetchStats, periodRange, profitAndLoss, seriesByDay, sumStats } from '../lib/reports'
import { expenseCategory } from '../lib/money'
import { errorText } from '../lib/errors'
import { Card, EmptyState, Notice, Page, Rs, SectionTitle, Spinner } from '../components/ui'
import { BarChart, PeriodPicker, Row, shortLabel, usePeriod } from '../components/ReportBits'

export default function ProfitLoss() {
  const { t, pick } = useLang()
  const p = usePeriod('month')
  const { from, to } = periodRange(p.period, p.custom)
  const [stats, setStats] = useState(null)
  const [expenses, setExpenses] = useState([])
  const [error, setError] = useState('')

  useEffect(() => {
    let live = true
    setStats(null)
    setError('')
    fetchStats(from, to)
      .then((s) => live && setStats(s))
      .catch((e) => {
        if (!live) return
        setStats([])
        setError(errorText(e, t))
      })
    fetchExpensesBetween(from, to)
      .then((x) => live && setExpenses(x))
      .catch(() => live && setExpenses([]))
    return () => {
      live = false
    }
  }, [from, to, t])

  const total = useMemo(() => sumStats(stats || []), [stats])
  const pl = profitAndLoss(total)
  const series = useMemo(() => seriesByDay(stats || [], from, to), [stats, from, to])
  const expByCat = useMemo(() => {
    const m = {}
    for (const e of expenses) m[e.category] = (m[e.category] || 0) + (e.amount || 0)
    return Object.entries(m).sort((a, b) => b[1] - a[1])
  }, [expenses])
  const empty = stats && total.salesCount === 0 && total.expensesTotal === 0 && total.returnsTotal === 0

  return (
    <Page title={t('profitLoss')}>
      <div className="space-y-5">
        <PeriodPicker {...p} />
        <Notice>{error}</Notice>

        {stats === null ? (
          <div className="flex justify-center py-16">
            <Spinner />
          </div>
        ) : empty ? (
          <EmptyState icon="chart" body={t('nothingInRange')} />
        ) : (
          <>
            {/* headline */}
            <Card className={`p-5 ${pl.netProfit < 0 ? 'border-danger' : ''}`}>
              <div className="text-sm font-semibold text-muted">{pl.netProfit < 0 ? t('netLoss') : t('netProfit')}</div>
              <Rs value={Math.abs(pl.netProfit)} className={`text-4xl font-bold ${pl.netProfit < 0 ? 'text-danger' : 'text-leaf'}`} />
              <div className="mt-1 text-sm text-muted">
                {pl.margin != null && (
                  <>
                    <span className="latin">{pl.margin}%</span> {t('ofSales')} ·{' '}
                  </>
                )}
                <span className="latin">{total.salesCount}</span> {t('billsWord')}
              </div>
            </Card>

            {/* statement */}
            <Card className="divide-y divide-line px-4">
              <Row label={t('salesGross')} value={pl.sales} sub={pl.discount > 0 ? `${t('afterDiscount')} Rs ${pl.discount.toLocaleString('en-PK')}` : null} />
              {pl.returns > 0 && <Row label={t('returnsShort')} value={pl.returns} sign="−" />}
              <Row label={t('netSales')} value={pl.netSales} strong />
              <Row label={t('costOfGoods')} value={pl.cogs} sign="−" />
              <Row label={t('grossProfit')} value={pl.grossProfit} strong />
              <Row label={t('expenses')} value={pl.expenses} sign="−" />
              <Row label={pl.netProfit < 0 ? t('netLoss') : t('netProfit')} value={pl.netProfit} strong tone={pl.netProfit < 0 ? 'text-danger' : 'text-leaf'} />
            </Card>
            <p className="-mt-2 text-sm text-muted">{t('plCostNote')}</p>

            {series.length > 1 && (
              <Card className="p-4">
                <BarChart rows={series.map((r) => ({ key: r.key, value: r.netProfit }))} label={series[0].monthly ? t('netProfitByMonth') : t('netProfitByDay')} />
              </Card>
            )}

            {expByCat.length > 0 && (
              <section>
                <SectionTitle>{t('expenses')}</SectionTitle>
                <Card className="divide-y divide-line px-4">
                  {expByCat.map(([k, v]) => (
                    <Row key={k} label={pick(expenseCategory(k))} value={v} />
                  ))}
                </Card>
              </section>
            )}

            {/* money that moved but is not profit or loss */}
            {(total.cashOutTotal > 0 || total.investTotal > 0) && (
              <section>
                <SectionTitle>{t('notInProfit')}</SectionTitle>
                <Card className="divide-y divide-line px-4">
                  {total.cashOutTotal > 0 && <Row label={t('ownerCashOut')} value={total.cashOutTotal} />}
                  {total.investTotal > 0 && <Row label={t('investment')} value={total.investTotal} />}
                </Card>
                <p className="mt-2 text-sm text-muted">{t('notInProfitNote')}</p>
              </section>
            )}

            {series.length > 1 && (
              <section>
                <SectionTitle>{series[0].monthly ? t('byMonth') : t('byDay')}</SectionTitle>
                <Card className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-line text-muted">
                        <th className="px-3 py-2 text-start font-semibold">{t('date')}</th>
                        <th className="px-3 py-2 text-end font-semibold">{t('netSales')}</th>
                        <th className="px-3 py-2 text-end font-semibold">{t('expenses')}</th>
                        <th className="px-3 py-2 text-end font-semibold">{t('netProfit')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...series].reverse().filter((r) => r.net || r.expenses || r.profit).map((r) => (
                        <tr key={r.key} className="border-b border-line last:border-b-0">
                          <td className="latin px-3 py-2.5 font-semibold">{shortLabel(r.key, r.monthly)}</td>
                          <td className="px-3 py-2.5 text-end"><Rs value={r.net} /></td>
                          <td className="px-3 py-2.5 text-end"><Rs value={r.expenses} /></td>
                          <td className="px-3 py-2.5 text-end"><Rs value={r.netProfit} className={`font-semibold ${r.netProfit < 0 ? 'text-danger' : ''}`} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </Card>
              </section>
            )}
          </>
        )}
      </div>
    </Page>
  )
}
