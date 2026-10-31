// Item photos (one per item) — free-plan friendly.
//
// Firestore:  itemImages/{itemId} { data: 'data:image/webp;base64,…' (~200×200, ≤ ~45 KB), v, by, at }
//             items/{itemId}.imageV = v   (the version; changes when the photo changes)
// Each phone keeps photos in its own IndexedDB store ('bm-images'), so a photo is downloaded once and
// again only when its version changes. Item lists never download photos in bulk.

import { useEffect, useState } from 'react'
import { deleteField, doc, getDoc, serverTimestamp, writeBatch } from 'firebase/firestore'
import { db, realDb } from './firebase'

/* ---------- phone storage (IndexedDB) ---------- */
const IDB = 'bm-images'
const STORE = 'img'
let idbP = null
function idb() {
  if (!idbP)
    idbP = new Promise((res, rej) => {
      const r = indexedDB.open(IDB, 1)
      r.onupgradeneeded = () => r.result.createObjectStore(STORE)
      r.onsuccess = () => res(r.result)
      r.onerror = () => rej(r.error)
    })
  return idbP
}
async function cacheGet(id) {
  try {
    const d = await idb()
    return await new Promise((res) => {
      const q = d.transaction(STORE).objectStore(STORE).get(id)
      q.onsuccess = () => res(q.result || null)
      q.onerror = () => res(null)
    })
  } catch {
    return null
  }
}
async function cachePut(id, val) {
  try {
    const d = await idb()
    const tx = d.transaction(STORE, 'readwrite')
    if (val) tx.objectStore(STORE).put(val, id)
    else tx.objectStore(STORE).delete(id)
  } catch {
    /* ignore */
  }
}

/* ---------- loading, at most 4 downloads at a time ---------- */
const mem = new Map() // itemId → { v, data }
const pending = new Map()
let running = 0
const queue = []
function slot(fn) {
  return new Promise((res, rej) => {
    queue.push(() =>
      fn()
        .then(res, rej)
        .finally(() => {
          running--
          pump()
        }),
    )
    pump()
  })
}
function pump() {
  while (running < 4 && queue.length) {
    running++
    queue.shift()()
  }
}

export async function loadItemImage(itemId, v) {
  if (!itemId || !v) return null
  const m = mem.get(itemId)
  if (m && m.v === v) return m.data
  const key = `${itemId}:${v}`
  if (pending.has(key)) return pending.get(key)
  const p = (async () => {
    const c = await cacheGet(itemId)
    if (c && c.v === v) {
      mem.set(itemId, c)
      return c.data
    }
    // download once — always read from the real shop (read only; trainees see the real photos too)
    const snap = await slot(() => getDoc(doc(realDb, 'itemImages', itemId))).catch(() => null)
    const d = snap?.exists() ? snap.data() : null
    if (!d?.data) return c?.data || null // keep showing the old photo if the new one can't be fetched yet
    const val = { v: d.v, data: d.data }
    mem.set(itemId, val)
    cachePut(itemId, val)
    return val.data
  })()
  pending.set(key, p)
  p.finally(() => pending.delete(key))
  return p
}

/** Photo for an item (data URL) or null. Re-checks when the item's photo version changes. */
export function useItemImage(item) {
  const id = item?.id
  const v = item?.imageV
  const [src, setSrc] = useState(() => (id && v && mem.get(id)?.v === v ? mem.get(id).data : null))
  useEffect(() => {
    let live = true
    if (!id || !v) {
      setSrc(null)
      return
    }
    const m = mem.get(id)
    if (m && m.v === v) setSrc(m.data)
    else loadItemImage(id, v).then((s) => live && setSrc(s))
    return () => {
      live = false
    }
  }, [id, v])
  return src
}

/* ---------- saving (works offline; syncs later) ---------- */

/** dataUrl = new photo, or null to remove the photo */
export function saveItemImage(itemId, dataUrl, user) {
  const v = Date.now()
  const b = writeBatch(db)
  if (dataUrl) {
    b.set(doc(db, 'itemImages', itemId), { data: dataUrl, v, by: user.uid, at: serverTimestamp() })
    b.update(doc(db, 'items', itemId), { imageV: v })
    const val = { v, data: dataUrl }
    mem.set(itemId, val)
    cachePut(itemId, val)
  } else {
    b.delete(doc(db, 'itemImages', itemId))
    b.update(doc(db, 'items', itemId), { imageV: deleteField() })
    mem.delete(itemId)
    cachePut(itemId, null)
  }
  b.commit().catch(() => {})
}

/* ---------- making the small square photo ---------- */

function loadImg(file) {
  return new Promise((res, rej) => {
    const url = URL.createObjectURL(file)
    const im = new Image()
    im.onload = () => {
      URL.revokeObjectURL(url)
      res(im)
    }
    im.onerror = (e) => {
      URL.revokeObjectURL(url)
      rej(e)
    }
    im.src = url
  })
}

/** Centre-crops to a square and shrinks to `size`×`size`, WebP (JPEG on old phones), ≤ ~45 KB */
export async function makeThumb(file, size = 200) {
  let src
  try {
    src = window.createImageBitmap ? await createImageBitmap(file, { imageOrientation: 'from-image' }) : await loadImg(file)
  } catch {
    src = await loadImg(file)
  }
  const w = src.width
  const h = src.height
  const s = Math.min(w, h)
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, size, size)
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(src, (w - s) / 2, (h - s) / 2, s, s, 0, 0, size, size)
  const webp = canvas.toDataURL('image/webp', 0.75).startsWith('data:image/webp')
  const type = webp ? 'image/webp' : 'image/jpeg'
  let q = webp ? 0.75 : 0.8
  let url = canvas.toDataURL(type, q)
  while (url.length > 45000 && q > 0.35) {
    q -= 0.1
    url = canvas.toDataURL(type, q)
  }
  return url
}
