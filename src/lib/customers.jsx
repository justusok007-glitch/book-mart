// Phase 5 — udhaar payments and returns (both work offline: one batch that syncs later)
//
//   customerLedger type 'payment'  amount received
//   customerLedger type 'return'   amount taken off the account
//   returns/{id} { saleId, receiptNo, day, lines[], amount, cost, refund: 'cash'|'account', reason, customerId, by, byName, at }
//   sales/{id}.returned { variantId: qty }  and  returnedTotal
//   dailyStats: creditReceived / cashIn for payments; returnsTotal / returnsCost / profit / cashIn for returns

import { collection, doc, getDocs, increment, limit, orderBy, query, serverTimestamp, where, writeBatch } from 'firebase/firestore'
import { db } from './firebase'
import { round2 } from './costing'
import { dayKey, formatReceipt, returnValue } from './saleMath'

/* ================= udhaar payments ================= */

export function receivePayment({ customer, amount, method = 'cash', note = '', user }) {
  const amt = round2(amount)
  const day = dayKey()
  const stamp = serverTimestamp()
  const batch = writeBatch(db)
  batch.set(doc(db, 'customers', customer.id), { balance: increment(-amt), updatedAt: stamp }, { merge: true })
  batch.set(doc(collection(db, 'customerLedger')), {
    customerId: customer.id,
    type: 'payment',
    amount: amt,
    method,
    note: note.trim(),
    by: user.uid,
    byName: user.name || '',
    at: stamp,
  })
  batch.set(
    doc(db, 'dailyStats', day),
    {
      day,
      creditReceived: increment(amt),
      ...(method === 'cash' ? { cashIn: increment(amt) } : { bankIn: increment(amt) }),
      updatedAt: stamp,
    },
    { merge: true },
  )
  return batch.commit()
}

export async function fetchCustomerLedger(customerId) {
  const snap = await getDocs(query(collection(db, 'customerLedger'), where('customerId', '==', customerId), limit(300)))
  return snap.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => (b.at?.toMillis?.() ?? 0) - (a.at?.toMillis?.() ?? 0))
}

// Pakistani mobile → WhatsApp number (0300 1234567 → 923001234567)
export function waNumber(phone = '') {
  let d = phone.replace(/\D/g, '')
  if (d.startsWith('00')) d = d.slice(2)
  if (d.startsWith('0')) d = '92' + d.slice(1)
  if (d.length === 10 && d.startsWith('3')) d = '92' + d
  return d.length >= 11 ? d : ''
}

/* ================= returns ================= */

/**
 * Find sales by receipt number. Accepts:
 *   A00125 / a125  → that user's receipt        125 → receipt 125 of every user (pick one)
 *   261030-7K3F / 7K3F → old-style receipts (whole number or last 4 characters)
 * Returns a list, newest first.
 */
export async function findSalesByReceipt(input) {
  const code = String(input || '').toUpperCase().replace(/[#\s]/g, '')
  if (!code) return []
  const found = new Map()
  const add = (snap) => snap.docs.forEach((d) => found.set(d.id, { id: d.id, ...d.data() }))
  const sales = collection(db, 'sales')

  const series = code.match(/^([A-Z]{1,2})0*(\d{1,7})$/)
  if (series) add(await getDocs(query(sales, where('receiptNo', '==', formatReceipt(series[1], Number(series[2]))), limit(5))))
  if (/^\d{1,7}$/.test(code)) add(await getDocs(query(sales, where('receiptSeq', '==', Number(code)), limit(20))))

  if (/^\d{6}-[A-Z0-9]{4}$/.test(code)) add(await getDocs(query(sales, where('receiptNo', '==', code), limit(5))))
  else if (code.length <= 5 && /^[A-Z0-9]+$/.test(code.slice(-4)) && code.slice(-4).length === 4) {
    // old style: last 4 characters
    const short = code.slice(-4)
    add(await getDocs(query(sales, where('receiptShort', '==', short), limit(20))))
    if (!found.size) {
      const from = dayKey(new Date(Date.now() - 183 * 864e5))
      const older = await getDocs(query(sales, where('day', '>=', from)))
      older.docs.forEach((d) => (d.data().receiptNo || '').endsWith('-' + short) && found.set(d.id, { id: d.id, ...d.data() }))
    }
  }
  return [...found.values()].sort((a, b) => (b.clientAt || 0) - (a.clientAt || 0))
}

export async function fetchRecentReturns(max = 30) {
  const snap = await getDocs(query(collection(db, 'returns'), orderBy('at', 'desc'), limit(max)))
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }))
}

/**
 * Take items back from a sale.
 * picks: [{ line, qty }] — line from sale.lines
 * refund: 'cash' (money back from the drawer) | 'account' (taken off the customer's udhaar)
 * restock: false for damaged goods — they do not go back on the shelf, so the full amount is a loss
 */
export function recordReturn({ sale, picks, refund, reason, restock = true, note = '', user }) {
  const lines = picks
    .filter((p) => p.qty > 0)
    .map((p) => ({
      itemId: p.line.itemId,
      variantId: p.line.variantId,
      itemName: p.line.itemName,
      itemNameUr: p.line.itemNameUr || '',
      variantName: p.line.variantName || '',
      variantNameUr: p.line.variantNameUr || '',
      qty: p.qty,
      price: p.line.price,
      unitCost: p.line.unitCost ?? null,
    }))
  const { amount, cost, items } = returnValue(sale, lines)
  const day = dayKey()
  const stamp = serverTimestamp()
  const ref = doc(collection(db, 'returns'))
  const batch = writeBatch(db)

  batch.set(ref, {
    saleId: sale.id,
    receiptNo: sale.receiptNo,
    day,
    lines,
    amount,
    cost,
    items,
    refund,
    reason,
    restock,
    note: note.trim(),
    customerId: sale.customerId || null,
    customerName: sale.customerName || '',
    by: user.uid,
    byName: user.name || '',
    at: stamp,
  })

  for (const l of restock ? lines : []) {
    batch.update(doc(db, 'variants', l.variantId), { stock: increment(l.qty) })
    batch.set(doc(collection(db, 'stockMoves')), {
      type: 'return',
      itemId: l.itemId,
      variantId: l.variantId,
      qty: l.qty,
      unitCost: l.unitCost,
      saleId: sale.id,
      returnId: ref.id,
      reason,
      by: user.uid,
      byName: user.name || '',
      at: stamp,
    })
  }

  // mark what came back on the sale (so it cannot be returned twice)
  const returned = {}
  for (const l of lines) returned[l.variantId] = increment(l.qty)
  batch.set(doc(db, 'sales', sale.id), { returned, returnedTotal: increment(amount), updatedAt: stamp }, { merge: true })

  batch.set(
    doc(db, 'dailyStats', day),
    {
      day,
      returnsCount: increment(1),
      returnsTotal: increment(amount),
      // goods back on the shelf: we lose only the margin; damaged goods: we lose the whole amount
      returnsCost: increment(restock ? cost : 0),
      profit: increment(-(restock ? amount - cost : amount)),
      ...(refund === 'cash' ? { cashIn: increment(-amount), cashRefunds: increment(amount) } : {}),
      updatedAt: stamp,
    },
    { merge: true },
  )

  if (refund === 'account' && sale.customerId) {
    batch.set(doc(db, 'customers', sale.customerId), { balance: increment(-amount), updatedAt: stamp }, { merge: true })
    batch.set(doc(collection(db, 'customerLedger')), {
      customerId: sale.customerId,
      type: 'return',
      amount,
      saleId: sale.id,
      receiptNo: sale.receiptNo,
      returnId: ref.id,
      by: user.uid,
      byName: user.name || '',
      at: stamp,
    })
  }

  const done = batch.commit()
  return { id: ref.id, amount, cost, items, done }
}

export const RETURN_REASONS = [
  { key: 'changed_mind', en: 'Customer changed mind', ur: 'گاہک نے ارادہ بدلا' },
  { key: 'wrong_item', en: 'Wrong item / colour', ur: 'غلط چیز / رنگ' },
  { key: 'damaged', en: 'Damaged / faulty', ur: 'خراب' },
  { key: 'other', en: 'Other', ur: 'دیگر' },
]
