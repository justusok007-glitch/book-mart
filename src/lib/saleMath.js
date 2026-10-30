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

// Receipt number for a user's own series: A + 5 digits → A00001
export function formatReceipt(letter, n) {
  return `${letter}${String(n).padStart(5, '0')}`
}

// Next free series letter: A…Z, then AA, AB…
export function nextLetter(used) {
  const taken = new Set([...used].map((x) => String(x || '').toUpperCase()))
  const A = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
  for (const a of A) if (!taken.has(a)) return a
  for (const a of A) for (const b of A) if (!taken.has(a + b)) return a + b
  return null
}

export const LETTER_RE = /^[A-Z]{1,2}$/

// Old receipt style (still used when a user has no letter yet): unique without internet: 261029-7K3F
export function makeReceiptNo(d = new Date()) {
  const p = (n) => String(n).padStart(2, '0')
  const rnd = Math.random().toString(36).slice(2, 6).toUpperCase().padEnd(4, '0')
  return `${String(d.getFullYear()).slice(2)}${p(d.getMonth() + 1)}${p(d.getDate())}-${rnd}`
}

/**
 * Value of items handed back from a sale.
 * Any bill discount is shared out in proportion, so returning half the goods refunds half the discounted total.
 * returnLines: [{ qty, price, unitCost }]
 */
export function returnValue(sale, returnLines) {
  const gross = returnLines.reduce((s, l) => s + l.qty * l.price, 0)
  const factor = sale.subtotal > 0 ? sale.total / sale.subtotal : 1
  // whole rupees (no paisas in a shop), and never more than what is left of the bill
  const left = Math.max(0, (sale.total || 0) - (sale.returnedTotal || 0))
  const amount = Math.min(Math.round(gross * factor), left)
  const cost = round2(returnLines.reduce((s, l) => s + l.qty * (l.unitCost ?? 0), 0))
  return { amount, cost, items: returnLines.reduce((s, l) => s + l.qty, 0) }
}

// how many of each line can still be returned
export function returnable(sale) {
  const done = sale.returned || {}
  return sale.lines.map((l) => ({ ...l, max: Math.max(0, l.qty - (done[l.variantId] || 0)) }))
}
