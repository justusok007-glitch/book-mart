// Sale totals — pure maths (tested on its own)
import { round2 } from './costing'

/**
 * lines: [{ qty, price, unitCost }]   unitCost may be null when the cost is unknown
 * payType: 'cash' | 'partial' | 'credit'
 */
export function saleTotals(lines, discount, payType, paidInput) {
  const subtotal = round2(lines.reduce((s, l) => s + l.qty * l.price, 0))
  const disc = round2(Math.min(Math.max(Number(discount) || 0, 0), subtotal))
  const total = round2(subtotal - disc)
  const paid = round2(payType === 'cash' ? total : payType === 'credit' ? 0 : Math.min(Math.max(Number(paidInput) || 0, 0), total))
  const due = round2(total - paid)
  // cost of goods sold, using the average cost at the moment of sale
  const knownCost = lines.every((l) => l.unitCost != null)
  const cost = round2(lines.reduce((s, l) => s + l.qty * (l.unitCost ?? 0), 0))
  const profit = round2(total - cost)
  const items = lines.reduce((s, l) => s + l.qty, 0)
  return { subtotal, discount: disc, total, paid, due, cost, profit, knownCost, items }
}

// local calendar day key, e.g. 2026-10-29
export function dayKey(d = new Date()) {
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

// Receipt no. that is unique without needing internet: 261029-7K3F
export function makeReceiptNo(d = new Date()) {
  const p = (n) => String(n).padStart(2, '0')
  const rnd = Math.random().toString(36).slice(2, 6).toUpperCase().padEnd(4, '0')
  return `${String(d.getFullYear()).slice(2)}${p(d.getMonth() + 1)}${p(d.getDate())}-${rnd}`
}
