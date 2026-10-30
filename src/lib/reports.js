// Phase 7 — reports. Reads the running daily totals (dailyStats) and, for item reports, the sales.
import { collection, getDocs, query, where } from 'firebase/firestore'
import { db } from './firebase'
import { round2 } from './costing'
import { dayKey } from './saleMath'
import { monthKey, monthRange, shiftMonth } from './money'

/* ================= periods ================= */

export const PERIODS = ['today', 'week', 'month', 'last', 'year', 'custom']

export function periodRange(period, custom) {
  const today = dayKey()
  const m = monthKey()
  if (period === 'today') return { from: today, to: today }
  if (period === 'week') return { from: dayKey(new Date(Date.now() - 6 * 864e5)), to: today }
  if (period === 'month') return monthRange(m)
  if (period === 'last') return monthRange(shiftMonth(m, -1))
  if (period === 'year') return { from: `${m.slice(0, 4)}-01-01`, to: `${m.slice(0, 4)}-12-31` }
  return custom
}

// every day key between two keys (inclusive), oldest first
export function daysBetween(from, to) {
  const out = []
  const d = new Date(from + 'T12:00:00')
  const end = new Date(Math.min(new Date(to + 'T12:00:00').getTime(), new Date(dayKey() + 'T12:00:00').getTime()))
  while (d <= end && out.length < 400) {
    out.push(dayKey(d))
    d.setDate(d.getDate() + 1)
  }
  return out
}

/* ================= reading ================= */

export async function fetchStats(from, to) {
  const snap = await getDocs(query(collection(db, 'dailyStats'), where('day', '>=', from), where('day', '<=', to)))
  return snap.docs.map((d) => d.data()).sort((a, b) => a.day.localeCompare(b.day))
}

export async function fetchSalesBetween(from, to) {
  const snap = await getDocs(query(collection(db, 'sales'), where('day', '>=', from), where('day', '<=', to)))
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }))
}

export async function fetchExpensesBetween(from, to) {
  const snap = await getDocs(query(collection(db, 'expenses'), where('day', '>=', from), where('day', '<=', to)))
  return snap.docs.map((d) => d.data())
}

/* ================= pure maths ================= */

const KEYS = [
  'salesCount', 'salesTotal', 'discountTotal', 'costTotal', 'profit', 'cashIn', 'creditGiven', 'creditReceived',
  'itemsSold', 'returnsCount', 'returnsTotal', 'returnsCost', 'expensesTotal', 'cashOutTotal', 'investTotal', 'supplierCash', 'bankIn',
]

export function sumStats(list) {
  const t = Object.fromEntries(KEYS.map((k) => [k, 0]))
  for (const s of list) for (const k of KEYS) t[k] += Number(s[k]) || 0
  for (const k of KEYS) t[k] = round2(t[k])
  return t
}

/** Profit & loss from summed daily totals */
export function profitAndLoss(t) {
  const netSales = round2(t.salesTotal - t.returnsTotal)
  const cogs = round2(t.costTotal - t.returnsCost)
  // goods returned damaged keep their cost in cogs, so netSales − cogs = profit
  const grossProfit = round2(t.profit)
  const netProfit = round2(grossProfit - t.expensesTotal)
  const margin = netSales > 0 ? Math.round((netProfit / netSales) * 1000) / 10 : null
  return { sales: t.salesTotal, returns: t.returnsTotal, netSales, cogs, grossProfit, expenses: t.expensesTotal, netProfit, margin, discount: t.discountTotal }
}

/** Rows per day, or per month when the range is long */
export function seriesByDay(stats, from, to) {
  const byDay = Object.fromEntries(stats.map((s) => [s.day, s]))
  const days = daysBetween(from, to)
  const monthly = days.length > 62
  const rows = []
  for (const d of days) {
    const key = monthly ? d.slice(0, 7) : d
    let r = rows.at(-1)
    if (!r || r.key !== key) rows.push((r = { key, monthly, list: [] }))
    if (byDay[d]) r.list.push(byDay[d])
  }
  return rows.map((r) => {
    const t = sumStats(r.list)
    return { key: r.key, monthly: r.monthly, bills: t.salesCount, net: round2(t.salesTotal - t.returnsTotal), profit: t.profit, netProfit: round2(t.profit - t.expensesTotal), cash: t.cashIn, expenses: t.expensesTotal }
  })
}

export function bySeller(stats) {
  const m = {}
  for (const s of stats)
    for (const [uid, v] of Object.entries(s.bySeller || {})) {
      m[uid] ||= { uid, name: v.name || '—', count: 0, total: 0 }
      if (v.name) m[uid].name = v.name
      m[uid].count += Number(v.count) || 0
      m[uid].total = round2(m[uid].total + (Number(v.total) || 0))
    }
  return Object.values(m).sort((a, b) => b.total - a.total)
}

/** Items sold, from sale lines (before returns) */
export function topItems(sales) {
  const m = {}
  for (const s of sales) {
    // bill discount shared out over the lines
    const factor = s.subtotal > 0 ? s.total / s.subtotal : 1
    for (const l of s.lines || []) {
      m[l.itemId] ||= { itemId: l.itemId, en: l.itemName, ur: l.itemNameUr, qty: 0, revenue: 0, cost: 0, knownCost: true }
      const r = m[l.itemId]
      r.qty += l.qty
      r.revenue += l.qty * l.price * factor
      if (l.unitCost == null) r.knownCost = false
      else r.cost += l.qty * l.unitCost
    }
  }
  return Object.values(m).map((r) => ({ ...r, revenue: Math.round(r.revenue), profit: Math.round(r.revenue - r.cost) }))
}

/** Stock value grouped by main category */
export function stockByCategory({ categories, items, variants, itemById, costs, catById }) {
  const m = {}
  let lowCount = 0
  let outCount = 0
  let missingCost = false
  for (const v of variants) {
    const item = itemById[v.itemId]
    if (!item || item.active === false || v.active === false) continue
    const stock = Math.max(0, v.stock || 0)
    if ((v.stock || 0) <= 0) outCount++
    else if ((v.stock || 0) <= (item.lowStock ?? 0)) lowCount++
    const cat = catById[item.catId]
    const key = cat?.id || '_'
    m[key] ||= { id: key, en: cat?.en || '—', ur: cat?.ur || '—', order: cat?.order ?? 999, units: 0, cost: 0, retail: 0 }
    const r = m[key]
    r.units += stock
    r.retail += stock * (Number(item.price) || 0)
    const c = costs[v.itemId]?.avgCost
    if (c == null) {
      if (stock > 0) missingCost = true
    } else r.cost += stock * c
  }
  const rows = Object.values(m)
    .map((r) => ({ ...r, cost: Math.round(r.cost), retail: Math.round(r.retail) }))
    .sort((a, b) => a.order - b.order)
  const total = rows.reduce((t, r) => ({ units: t.units + r.units, cost: t.cost + r.cost, retail: t.retail + r.retail }), { units: 0, cost: 0, retail: 0 })
  return { rows, total, lowCount, outCount, missingCost, itemCount: items.filter((i) => i.active !== false).length, catCount: categories.length }
}
