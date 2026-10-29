// Phase 3 — buying stock, suppliers and payables, stock adjustments
//
// Firestore collections
//   suppliers/{id}       { name, phone, address, note, balance, active }   balance = what the shop still owes
//   supplierLedger/{id}  { supplierId, type: 'purchase'|'payment', amount, purchaseId?, method?, note, by, byName, at }
//   purchases/{id}       { supplierId, supplierName, billNo, note, lines[], total, paid, due, payType, by, byName, at }
//   stockMoves/{id}      type 'purchase' (with unitCost, purchaseId) or 'adjust' (with reason)

import { useEffect, useState } from 'react'
import {
  collection,
  doc,
  getDoc,
  getDocs,
  increment,
  limit,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore'
import { db } from './firebase'
import { nextAverage, round2 } from './costing'

/* ================= suppliers ================= */

export function useSuppliers(enabled = true) {
  const [list, setList] = useState(null)
  useEffect(() => {
    if (!enabled) return setList([])
    return onSnapshot(
      collection(db, 'suppliers'),
      (s) => setList(s.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => (a.name || '').localeCompare(b.name || ''))),
      () => setList([]),
    )
  }, [enabled])
  return list
}

export function saveSupplier({ id, name, phone = '', address = '', note = '' }) {
  const data = { name: name.trim(), phone: phone.trim(), address: address.trim(), note: note.trim() }
  if (id) {
    updateDoc(doc(db, 'suppliers', id), { ...data, updatedAt: serverTimestamp() })
    return id
  }
  const ref = doc(collection(db, 'suppliers'))
  setDoc(ref, { ...data, balance: 0, active: true, createdAt: serverTimestamp() })
  return ref.id
}

// Pay a supplier (works offline; syncs later)
export function paySupplier({ supplierId, amount, method = 'cash', note = '', user }) {
  const amt = round2(amount)
  const batch = writeBatch(db)
  batch.update(doc(db, 'suppliers', supplierId), { balance: increment(-amt), updatedAt: serverTimestamp() })
  batch.set(doc(collection(db, 'supplierLedger')), {
    supplierId,
    type: 'payment',
    amount: amt,
    method,
    note: note.trim(),
    by: user.uid,
    byName: user.name || '',
    at: serverTimestamp(),
  })
  batch.commit()
}

export async function fetchLedger(supplierId) {
  const snap = await getDocs(query(collection(db, 'supplierLedger'), where('supplierId', '==', supplierId), limit(200)))
  return snap.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => (b.at?.toMillis?.() ?? 0) - (a.at?.toMillis?.() ?? 0))
}

/* ================= purchases ================= */

/**
 * Save one purchase (needs internet: average cost is worked out from the live stock).
 * lines: [{ itemId, variantId, itemName, variantName, qty, unitCost }]
 * priceUpdates: { [itemId]: newSalePrice }  (only for users who can edit items)
 * variantIdsByItem: { [itemId]: [variantId…] } — all colours of each item, to know total stock held
 */
export async function recordPurchase({ supplier, billNo, note, lines, paid, payType, priceUpdates = {}, variantIdsByItem, user }) {
  // merge repeated colour lines
  const merged = []
  for (const l of lines) {
    const same = merged.find((m) => m.variantId === l.variantId && m.unitCost === l.unitCost)
    if (same) same.qty += l.qty
    else merged.push({ ...l })
  }
  const total = round2(merged.reduce((s, l) => s + l.qty * l.unitCost, 0))
  const paidAmt = round2(payType === 'cash' ? total : payType === 'credit' ? 0 : Math.min(Number(paid) || 0, total))
  const due = round2(total - paidAmt)
  const itemIds = [...new Set(merged.map((l) => l.itemId))]
  const purchaseRef = doc(collection(db, 'purchases'))

  await runTransaction(db, async (tx) => {
    // ---- reads ----
    const costSnaps = await Promise.all(itemIds.map((id) => tx.get(doc(db, 'itemCosts', id))))
    const heldByItem = {}
    for (const id of itemIds) {
      const vSnaps = await Promise.all((variantIdsByItem[id] || []).map((vid) => tx.get(doc(db, 'variants', vid))))
      heldByItem[id] = vSnaps.reduce((s, v) => s + (v.exists() ? Math.max(0, v.data().stock || 0) : 0), 0)
    }

    // ---- writes ----
    const stamp = serverTimestamp()
    itemIds.forEach((id, i) => {
      const old = costSnaps[i].exists() ? costSnaps[i].data() : null
      const res = nextAverage(heldByItem[id], old?.avgCost ?? null, merged.filter((l) => l.itemId === id))
      tx.set(doc(db, 'itemCosts', id), { avgCost: res.avgCost, lastCost: res.lastCost, updatedAt: stamp })
      if (priceUpdates[id] != null && Number(priceUpdates[id]) > 0)
        tx.update(doc(db, 'items', id), { price: round2(priceUpdates[id]), updatedAt: stamp })
    })
    for (const l of merged) {
      tx.update(doc(db, 'variants', l.variantId), { stock: increment(l.qty) })
      tx.set(doc(collection(db, 'stockMoves')), {
        type: 'purchase',
        itemId: l.itemId,
        variantId: l.variantId,
        qty: l.qty,
        unitCost: l.unitCost,
        purchaseId: purchaseRef.id,
        by: user.uid,
        byName: user.name || '',
        at: stamp,
      })
    }
    tx.set(purchaseRef, {
      supplierId: supplier?.id || null,
      supplierName: supplier?.name || '',
      billNo: (billNo || '').trim(),
      note: (note || '').trim(),
      lines: merged.map((l) => ({ ...l, qty: l.qty, unitCost: round2(l.unitCost) })),
      total,
      paid: paidAmt,
      due,
      payType,
      by: user.uid,
      byName: user.name || '',
      at: stamp,
    })
    if (supplier?.id) {
      tx.update(doc(db, 'suppliers', supplier.id), { balance: increment(due), updatedAt: stamp })
      tx.set(doc(collection(db, 'supplierLedger')), {
        supplierId: supplier.id,
        type: 'purchase',
        amount: total,
        purchaseId: purchaseRef.id,
        billNo: (billNo || '').trim(),
        by: user.uid,
        byName: user.name || '',
        at: stamp,
      })
      if (paidAmt > 0) {
        tx.set(doc(collection(db, 'supplierLedger')), {
          supplierId: supplier.id,
          type: 'payment',
          amount: paidAmt,
          method: 'cash',
          purchaseId: purchaseRef.id,
          note: 'paid with purchase',
          by: user.uid,
          byName: user.name || '',
          at: stamp,
        })
      }
    }
  })
  return { id: purchaseRef.id, total, paid: paidAmt, due }
}

export async function fetchPurchases(max = 60) {
  const snap = await getDocs(query(collection(db, 'purchases'), orderBy('at', 'desc'), limit(max)))
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }))
}

export async function fetchPurchase(id) {
  const s = await getDoc(doc(db, 'purchases', id))
  return s.exists() ? { id: s.id, ...s.data() } : null
}

/* ================= stock adjustment (works offline) ================= */

export const ADJUST_REASONS = [
  { key: 'damaged', en: 'Damaged', ur: 'خراب' },
  { key: 'lost', en: 'Lost / missing', ur: 'گم' },
  { key: 'count', en: 'Stock count correction', ur: 'گنتی کی درستی' },
  { key: 'own_use', en: 'Shop use', ur: 'دکان کے استعمال میں' },
  { key: 'found', en: 'Found extra', ur: 'زائد ملا' },
  { key: 'other', en: 'Other', ur: 'دیگر' },
]

export function adjustStock({ itemId, variantId, delta, reason, note = '', user }) {
  const batch = writeBatch(db)
  batch.update(doc(db, 'variants', variantId), { stock: increment(delta) })
  batch.set(doc(collection(db, 'stockMoves')), {
    type: 'adjust',
    itemId,
    variantId,
    qty: delta,
    reason,
    note: note.trim(),
    by: user.uid,
    byName: user.name || '',
    at: serverTimestamp(),
  })
  batch.commit()
}
