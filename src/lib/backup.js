// Phase 8 — backup & restore (Admin only)
// A backup is one JSON file with every document of every collection.
// Firestore Timestamps are stored as { "__ts": millis } so they come back as Timestamps.

import { collection, doc, getDoc, getDocs, setDoc, Timestamp, writeBatch } from 'firebase/firestore'
import { db } from './firebase'

export const COLLECTIONS = [
  'settings', 'roles', 'users', 'meta', 'counters', 'receiptCounters',
  'categories', 'items', 'variants', 'barcodes', 'itemCosts', 'stockMoves',
  'suppliers', 'supplierLedger', 'purchases',
  'customers', 'customerLedger', 'sales', 'returns', 'dailyStats',
  'expenses', 'cashOuts', 'investments', 'closings',
]

/* ---------- encode / decode (pure) ---------- */

export function encode(v) {
  if (v === null || v === undefined) return v ?? null
  if (v instanceof Timestamp) return { __ts: v.toMillis() }
  if (v instanceof Date) return { __ts: v.getTime() }
  if (Array.isArray(v)) return v.map(encode)
  if (typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, encode(x)]))
  return v
}

export function decode(v) {
  if (v === null || v === undefined) return v ?? null
  if (Array.isArray(v)) return v.map(decode)
  if (typeof v === 'object') {
    const keys = Object.keys(v)
    if (keys.length === 1 && keys[0] === '__ts' && typeof v.__ts === 'number') return Timestamp.fromMillis(v.__ts)
    return Object.fromEntries(keys.map((k) => [k, decode(v[k])]))
  }
  return v
}

/** Checks a parsed file; returns { ok, counts, createdAt, error } */
export function inspectBackup(data) {
  if (!data || data.app !== 'book-mart' || typeof data.collections !== 'object') return { ok: false, error: 'notBackupFile' }
  const counts = {}
  for (const [name, docs] of Object.entries(data.collections)) {
    if (!COLLECTIONS.includes(name) || !Array.isArray(docs)) return { ok: false, error: 'notBackupFile' }
    if (docs.some((d) => !d || typeof d.id !== 'string' || !d.id || d.id.includes('/') || typeof d.data !== 'object')) return { ok: false, error: 'notBackupFile' }
    counts[name] = docs.length
  }
  return { ok: true, counts, createdAt: data.createdAt, by: data.by, total: Object.values(counts).reduce((a, b) => a + b, 0) }
}

/* ---------- make a backup ---------- */

export async function makeBackup({ by, onProgress } = {}) {
  const out = { app: 'book-mart', format: 1, createdAt: Date.now(), by: by || '', collections: {} }
  let i = 0
  for (const name of COLLECTIONS) {
    onProgress?.(i++ / COLLECTIONS.length, name)
    const snap = await getDocs(collection(db, name))
    out.collections[name] = snap.docs.map((d) => ({ id: d.id, data: encode(d.data()) }))
  }
  onProgress?.(1)
  return out
}

export function backupFileName(ts = Date.now()) {
  const d = new Date(ts)
  const p = (n) => String(n).padStart(2, '0')
  return `book-mart-backup-${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}.json`
}

/** Save the file on the phone (download), or share it (WhatsApp, Drive…) when asked */
export async function saveBackupFile(data, { share = false } = {}) {
  const name = backupFileName(data.createdAt)
  const blob = new Blob([JSON.stringify(data)], { type: 'application/json' })
  if (share) {
    const file = new File([blob], name, { type: 'application/json' })
    if (navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: name })
        return 'shared'
      } catch {
        return 'cancelled'
      }
    }
  }
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 5000)
  return 'downloaded'
}

export function noteBackupMade(data) {
  return setDoc(doc(db, 'meta', 'backup'), { lastAt: data.createdAt, by: data.by, docs: Object.values(data.collections).reduce((s, l) => s + l.length, 0) }, { merge: true })
}

/* ---------- restore ---------- */

/**
 * Puts the shop back exactly as it was in the backup:
 * every document in the file is written, and documents made after the backup are removed.
 * The admin's own user record is never removed. Needs internet.
 */
export async function restoreBackup(data, { keepUid, onProgress } = {}) {
  const names = COLLECTIONS.filter((n) => Array.isArray(data.collections[n]))
  const total = names.reduce((s, n) => s + data.collections[n].length, 0) || 1
  let done = 0
  for (const name of names) {
    const wanted = data.collections[name]
    const keep = new Set(wanted.map((d) => d.id))
    const current = await getDocs(collection(db, name))
    const extra = current.docs.filter((d) => !keep.has(d.id) && !(name === 'users' && d.id === keepUid))

    const ops = [...extra.map((d) => ({ del: d.ref })), ...wanted.map((d) => ({ ref: doc(db, name, d.id), data: decode(d.data) }))]
    for (let i = 0; i < ops.length; i += 400) {
      const batch = writeBatch(db)
      for (const op of ops.slice(i, i + 400)) {
        if (op.del) batch.delete(op.del)
        else batch.set(op.ref, op.data)
      }
      await batch.commit()
      done += ops.slice(i, i + 400).filter((o) => !o.del).length
      onProgress?.(Math.min(1, done / total), name)
    }
    if (!ops.length) onProgress?.(Math.min(1, done / total), name)
  }
  onProgress?.(1)
}

export async function fetchLastBackup() {
  const s = await getDoc(doc(db, 'meta', 'backup'))
  return s.exists() ? s.data() : null
}
