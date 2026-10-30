// Phase 4 — selling (works offline: everything is written in one batch that syncs later)
//
// Firestore collections
//   sales/{id}            { receiptNo, day, lines[], subtotal, discount, total, paid, due, cost, profit,
//                           payType, customerId, customerName, by, byName, at, clientAt }
//   dailyStats/{YYYY-MM-DD} running totals for Home / daily closing / reports
//   customers/{id}        { name, phone, balance }  balance = udhaar the customer still owes
//   customerLedger/{id}   { customerId, type: 'sale'|'payment', amount, paid, due, saleId, receiptNo, by, byName, at }
//   variants.stock goes down, stockMoves type 'sale' (negative qty)

import { useEffect, useState } from 'react'
import {
  collection,
  doc,
  getDoc,
  getDocs,
  increment,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  where,
  writeBatch,
} from 'firebase/firestore'
import { db, isTraining } from './firebase'
import { dayKey, formatReceipt, makeReceiptNo, saleTotals } from './saleMath'

/* ================= shop details (for receipts) ================= */

export function useShopSettings() {
  const [shop, setShop] = useState({ name: 'Book Mart', phone: '', address: 'Okara', footer: '' })
  useEffect(
    () =>
      onSnapshot(
        doc(db, 'settings', 'shop'),
        (s) => s.exists() && setShop((d) => ({ ...d, ...s.data() })),
        () => {},
      ),
    [],
  )
  return shop
}

/* ================= customers ================= */

export function useCustomers(enabled = true) {
  const [list, setList] = useState(null)
  useEffect(() => {
    if (!enabled) return setList([])
    return onSnapshot(
      collection(db, 'customers'),
      (s) => setList(s.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => (a.name || '').localeCompare(b.name || ''))),
      () => setList([]),
    )
  }, [enabled])
  return list
}

export function saveCustomer({ id, name, phone = '', address = '', note = '' }) {
  const data = { name: name.trim(), phone: phone.trim(), address: address.trim(), note: note.trim() }
  if (id) {
    setDoc(doc(db, 'customers', id), { ...data, updatedAt: serverTimestamp() }, { merge: true })
    return id
  }
  const ref = doc(collection(db, 'customers'))
  setDoc(ref, { ...data, balance: 0, createdAt: serverTimestamp() })
  return ref.id
}

/* ================= receipt numbers: each user has a letter and counts 00001, 00002… ================= */
// The count is kept on the phone (works offline) and copied online (receiptCounters/{uid}),
// so a reinstalled app or a new phone carries on from the last number.

const serverLast = {}
const lastKey = (uid) => (isTraining() ? 'training-' : '') + uid
// practice receipts count separately, so training never moves the real receipt numbers
const localKey = (uid) => `bm-receipt-${isTraining() ? 'training-' : ''}${uid}`
function localLast(uid) {
  try {
    return Number(localStorage.getItem(localKey(uid))) || 0
  } catch {
    return 0
  }
}

export function useReceiptCounter(uid) {
  useEffect(() => {
    if (!uid) return
    return onSnapshot(
      doc(db, 'receiptCounters', uid),
      (s) => {
        if (s.exists()) serverLast[lastKey(uid)] = Math.max(serverLast[lastKey(uid)] || 0, Number(s.data().last) || 0)
      },
      () => {},
    )
  }, [uid])
}

function takeReceiptNumber(user) {
  const n = Math.max(localLast(user.uid), serverLast[lastKey(user.uid)] || 0) + 1
  try {
    localStorage.setItem(localKey(user.uid), String(n))
  } catch {
    /* ignore */
  }
  serverLast[lastKey(user.uid)] = n
  return n
}

/* ================= save a sale ================= */

/**
 * Saves at once on this phone and syncs to Firebase when online.
 * cartLines: [{ item, variant, qty }]  (item has en/ur/price, variant has en/ur/id)
 * costs: { itemId: { avgCost } }  — the average cost now is stored with the sale for profit
 * onFail(err, sale): called if Firebase later refuses the sale (e.g. rules not published)
 */
export function recordSale({ cartLines, discount, payType, paidInput, customer, costs, user, onFail }) {
  const lines = cartLines.map((l) => ({
    itemId: l.item.id,
    variantId: l.variant.id,
    itemName: l.item.en,
    itemNameUr: l.item.ur || '',
    variantName: l.item.variants?.length > 1 ? l.variant.en : '',
    variantNameUr: l.item.variants?.length > 1 ? l.variant.ur || '' : '',
    qty: l.qty,
    price: Number(l.item.price),
    unitCost: costs[l.item.id]?.avgCost ?? null,
  }))
  const totals = saleTotals(lines, discount, payType, paidInput)
  const now = new Date()
  const day = dayKey(now)
  const ref = doc(collection(db, 'sales'))
  // user's own series (A00001…); old random style only if the Admin hasn't given this user a letter yet
  const seq = user.letter ? takeReceiptNumber(user) : null
  const receiptNo = seq ? formatReceipt(user.letter, seq) : makeReceiptNo(now)
  const sale = {
    receiptNo,
    ...(seq ? { receiptSeries: user.letter, receiptSeq: seq } : { receiptShort: receiptNo.slice(-4) }),
    day,
    lines,
    ...totals,
    payType: totals.due > 0 ? payType : 'cash',
    customerId: customer?.id || null,
    customerName: customer?.name || '',
    by: user.uid,
    byName: user.name || '',
    clientAt: now.getTime(),
  }

  const batch = writeBatch(db)
  const stamp = serverTimestamp()
  batch.set(ref, { ...sale, at: stamp })
  if (seq) batch.set(doc(db, 'receiptCounters', user.uid), { last: seq, letter: user.letter, updatedAt: stamp }, { merge: true })

  for (const l of lines) {
    batch.update(doc(db, 'variants', l.variantId), { stock: increment(-l.qty) })
    batch.set(doc(collection(db, 'stockMoves')), {
      type: 'sale',
      itemId: l.itemId,
      variantId: l.variantId,
      qty: -l.qty,
      unitCost: l.unitCost,
      saleId: ref.id,
      by: user.uid,
      byName: user.name || '',
      at: stamp,
    })
  }

  // running totals for today (Home, daily closing, reports)
  batch.set(
    doc(db, 'dailyStats', day),
    {
      day,
      salesCount: increment(1),
      salesTotal: increment(totals.total),
      discountTotal: increment(totals.discount),
      costTotal: increment(totals.cost),
      profit: increment(totals.profit),
      cashIn: increment(totals.paid),
      creditGiven: increment(totals.due),
      itemsSold: increment(totals.items),
      bySeller: { [user.uid]: { name: user.name || '', count: increment(1), total: increment(totals.total) } },
      updatedAt: stamp,
    },
    { merge: true },
  )

  if (customer?.id) {
    batch.set(doc(db, 'customers', customer.id), { balance: increment(totals.due), updatedAt: stamp }, { merge: true })
    batch.set(doc(collection(db, 'customerLedger')), {
      customerId: customer.id,
      type: 'sale',
      amount: totals.total,
      paid: totals.paid,
      due: totals.due,
      saleId: ref.id,
      receiptNo: sale.receiptNo,
      by: user.uid,
      byName: user.name || '',
      at: stamp,
    })
  }

  batch.commit().catch((e) => onFail?.(e, sale))
  return { id: ref.id, ...sale, at: now }
}

/* ================= reading sales ================= */

export async function fetchSalesForDay(day) {
  const snap = await getDocs(query(collection(db, 'sales'), where('day', '==', day)))
  return snap.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => (b.clientAt || 0) - (a.clientAt || 0))
}

export async function fetchSale(id) {
  const s = await getDoc(doc(db, 'sales', id))
  return s.exists() ? { id: s.id, ...s.data() } : null
}

export function useDayStats(day, enabled = true) {
  const [stats, setStats] = useState(null)
  useEffect(() => {
    if (!enabled) return setStats(null)
    return onSnapshot(
      doc(db, 'dailyStats', day),
      (s) => setStats(s.exists() ? s.data() : {}),
      () => setStats(null),
    )
  }, [day, enabled])
  return stats
}
