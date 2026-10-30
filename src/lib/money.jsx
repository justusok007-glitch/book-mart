// Phase 6 — expenses, owner cash-out, investment, daily closing
// Every entry is saved in one batch, so it works offline and syncs later.
//
// Firestore collections
//   expenses/{id}     { day, category, amount, method: 'cash'|'bank', note, by, byName, at, clientAt }
//   cashOuts/{id}     { day, amount, person, purpose, by, byName, at, clientAt }   money taken out of the drawer
//   investments/{id}  { day, amount, investor, into: 'cash'|'bank'|'outside', note, by, byName, at, clientAt }
//   closings/{day}    { day, opening, cashIn, investCash, expenseCash, cashOut, supplierCash, expected,
//                       counted, diff, notes, note, by, byName, at }
//   dailyStats/{day}  + expensesTotal, expenseCash, cashOutTotal, investTotal, investCash, supplierCash

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
  serverTimestamp,
  setDoc,
  where,
  writeBatch,
} from 'firebase/firestore'
import { db } from './firebase'
import { round2 } from './costing'
import { dayKey } from './saleMath'

export const EXPENSE_CATEGORIES = [
  { key: 'rent', en: 'Rent', ur: 'کرایہ' },
  { key: 'electricity', en: 'Electricity', ur: 'بجلی' },
  { key: 'salary', en: 'Salary', ur: 'تنخواہ' },
  { key: 'tea', en: 'Tea & food', ur: 'چائے / کھانا' },
  { key: 'transport', en: 'Transport', ur: 'ٹرانسپورٹ' },
  { key: 'phone', en: 'Phone & internet', ur: 'فون / انٹرنیٹ' },
  { key: 'repairs', en: 'Repairs', ur: 'مرمت' },
  { key: 'supplies', en: 'Shop supplies', ur: 'دکان کا سامان' },
  { key: 'other', en: 'Other', ur: 'دیگر' },
]
export const expenseCategory = (key) => EXPENSE_CATEGORIES.find((c) => c.key === key) || EXPENSE_CATEGORIES.at(-1)

// Pakistani notes for counting the drawer
export const NOTES = [5000, 1000, 500, 100, 50, 20, 10]

/* ================= pure maths ================= */

/** Cash that should be in the drawer at the end of the day */
export function expectedCash(opening, stats = {}) {
  const n = (k) => Number(stats?.[k]) || 0
  const parts = {
    opening: round2(Number(opening) || 0),
    cashIn: n('cashIn'), // cash sales + udhaar received in cash − cash refunds
    investCash: n('investCash'),
    expenseCash: n('expenseCash'),
    cashOut: n('cashOutTotal'),
    supplierCash: n('supplierCash'),
  }
  parts.expected = round2(parts.opening + parts.cashIn + parts.investCash - parts.expenseCash - parts.cashOut - parts.supplierCash)
  return parts
}

export function countNotes(notes = {}, coins = 0) {
  return NOTES.reduce((s, v) => s + v * (Number(notes[v]) || 0), 0) + (Number(coins) || 0)
}

// first and last day key of a month ('2026-10')
export function monthRange(month) {
  const [y, m] = month.split('-').map(Number)
  const last = new Date(y, m, 0).getDate()
  return { from: `${month}-01`, to: `${month}-${String(last).padStart(2, '0')}` }
}
export const monthKey = (d = new Date()) => dayKey(d).slice(0, 7)
export function shiftMonth(month, n) {
  const [y, m] = month.split('-').map(Number)
  return monthKey(new Date(y, m - 1 + n, 1))
}

/* ================= saving (offline-safe) ================= */

function base(user, amount, now) {
  return { day: dayKey(now), amount: round2(amount), by: user.uid, byName: user.name || '', clientAt: now.getTime() }
}

function statsUpdate(batch, day, fields) {
  batch.set(doc(db, 'dailyStats', day), { day, ...fields, updatedAt: serverTimestamp() }, { merge: true })
}

export function addExpense({ category, amount, method = 'cash', note = '', user }) {
  const now = new Date()
  const data = { ...base(user, amount, now), category, method, note: note.trim() }
  const ref = doc(collection(db, 'expenses'))
  const batch = writeBatch(db)
  batch.set(ref, { ...data, at: serverTimestamp() })
  statsUpdate(batch, data.day, {
    expensesTotal: increment(data.amount),
    ...(method === 'cash' ? { expenseCash: increment(data.amount) } : {}),
  })
  return batch.commit()
}

export function addCashOut({ amount, person, purpose = '', user }) {
  const now = new Date()
  const data = { ...base(user, amount, now), person: person.trim(), purpose: purpose.trim() }
  const ref = doc(collection(db, 'cashOuts'))
  const batch = writeBatch(db)
  batch.set(ref, { ...data, at: serverTimestamp() })
  statsUpdate(batch, data.day, { cashOutTotal: increment(data.amount), cashOutCount: increment(1) })
  return batch.commit()
}

export function addInvestment({ amount, investor, into = 'cash', note = '', user }) {
  const now = new Date()
  const data = { ...base(user, amount, now), investor: investor.trim(), into, note: note.trim() }
  const ref = doc(collection(db, 'investments'))
  const batch = writeBatch(db)
  batch.set(ref, { ...data, at: serverTimestamp() })
  statsUpdate(batch, data.day, {
    investTotal: increment(data.amount),
    ...(into === 'cash' ? { investCash: increment(data.amount) } : {}),
  })
  return batch.commit()
}

// Undo a wrong entry (allowed by the rules for the person who made it within a day, or the Admin)
export function removeEntry(kind, e) {
  const batch = writeBatch(db)
  batch.delete(doc(db, kind, e.id))
  const a = -(Number(e.amount) || 0)
  if (kind === 'expenses') statsUpdate(batch, e.day, { expensesTotal: increment(a), ...(e.method === 'cash' ? { expenseCash: increment(a) } : {}) })
  if (kind === 'cashOuts') statsUpdate(batch, e.day, { cashOutTotal: increment(a), cashOutCount: increment(-1) })
  if (kind === 'investments') statsUpdate(batch, e.day, { investTotal: increment(a), ...(e.into === 'cash' ? { investCash: increment(a) } : {}) })
  return batch.commit()
}

export function canUndo(e, user, isAdmin) {
  if (isAdmin) return true
  const at = e.at?.toMillis?.() ?? e.clientAt ?? 0
  return e.by === user?.uid && Date.now() - at < 24 * 3600 * 1000
}

/* ================= reading ================= */

const sortNewest = (a, b) => (b.clientAt || 0) - (a.clientAt || 0)

// live list of entries between two day keys (inclusive)
export function useEntries(kind, from, to, enabled = true) {
  const [list, setList] = useState(null)
  useEffect(() => {
    if (!enabled) return setList([])
    setList(null)
    const q = query(collection(db, kind), where('day', '>=', from), where('day', '<=', to))
    return onSnapshot(
      q,
      (s) => setList(s.docs.map((d) => ({ id: d.id, ...d.data() })).sort(sortNewest)),
      () => setList([]),
    )
  }, [kind, from, to, enabled])
  return list
}

export function useAllEntries(kind, enabled = true) {
  const [list, setList] = useState(null)
  useEffect(() => {
    if (!enabled) return setList([])
    return onSnapshot(
      collection(db, kind),
      (s) => setList(s.docs.map((d) => ({ id: d.id, ...d.data() })).sort(sortNewest)),
      () => setList([]),
    )
  }, [kind, enabled])
  return list
}

// names of staff, to suggest who took cash / who invested
export function useStaff(enabled = true) {
  const [list, setList] = useState([])
  useEffect(() => {
    if (!enabled) return
    return onSnapshot(
      collection(db, 'users'),
      (s) => setList(s.docs.map((d) => ({ id: d.id, ...d.data() })).filter((u) => u.active !== false)),
      () => setList([]),
    )
  }, [enabled])
  return list
}

/* ================= daily closing ================= */

export function useClosing(day, enabled = true) {
  const [c, setC] = useState(undefined)
  useEffect(() => {
    if (!enabled) return setC(null)
    setC(undefined)
    return onSnapshot(
      doc(db, 'closings', day),
      (s) => setC(s.exists() ? s.data() : null),
      () => setC(null),
    )
  }, [day, enabled])
  return c
}

// the last closing before this day (its counted cash is today's opening)
export async function fetchPreviousClosing(day) {
  const snap = await getDocs(query(collection(db, 'closings'), where('day', '<', day), orderBy('day', 'desc'), limit(1)))
  return snap.empty ? null : snap.docs[0].data()
}

export function saveClosing({ day, parts, counted, notes, coins, note = '', user }) {
  const data = {
    day,
    ...parts,
    counted: round2(counted),
    diff: round2(counted - parts.expected),
    notes: notes || null,
    coins: Number(coins) || 0,
    note: note.trim(),
    by: user.uid,
    byName: user.name || '',
    at: serverTimestamp(),
    clientAt: Date.now(),
  }
  // set (not batch) is also queued offline
  return setDoc(doc(db, 'closings', day), data)
}

export async function fetchClosing(day) {
  const s = await getDoc(doc(db, 'closings', day))
  return s.exists() ? s.data() : null
}
