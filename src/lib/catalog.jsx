// Catalog: categories → sub-categories → items (one sale price) → variants (same-price colours/types)
//
// Firestore collections
//   categories/{id}  { en, ur, parentId: null | categoryId, order }
//   items/{id}       { en, ur, catId, subId, price, unit, lowStock, active }
//   variants/{id}    { itemId, en, ur, dot, barcode, stock, order, active }   ← stock lives here (per colour)
//   barcodes/{code}  { variantId, itemId }                                    ← keeps every barcode unique
//   itemCosts/{itemId} { avgCost, lastCost }                                  ← only "See cost price" can read
//   stockMoves/{id}  { type, itemId, variantId, qty, unitCost, by, byName, at }
//   counters/barcode { next }                                                 ← for shop-made barcodes

import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  increment,
  limit,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore'
import { db, runTx } from './firebase'
import { useAuth } from '../context/AuthContext'
import { STARTER_CATEGORIES } from './colors'

export const CatalogContext = createContext(null)

const byOrder = (a, b) => (a.order ?? 0) - (b.order ?? 0) || (a.en || '').localeCompare(b.en || '')

export function CatalogProvider({ children }) {
  const { user, loading, blocked, can } = useAuth()
  const enabled = !!user && !loading && !blocked
  // sellers and buyers load costs too (to store cost with each sale / purchase); screens show costs only with view_cost_price
  const canCost = enabled && (can('view_cost_price') || can('buy') || can('sell'))
  const [cats, setCats] = useState(null)
  const [items, setItems] = useState(null)
  const [variants, setVariants] = useState(null)
  const [costs, setCosts] = useState({})

  useEffect(() => {
    if (!enabled) {
      setCats(null)
      setItems(null)
      setVariants(null)
      return
    }
    const list = (snap) => snap.docs.map((d) => ({ id: d.id, ...d.data() }))
    const u1 = onSnapshot(collection(db, 'categories'), (s) => setCats(list(s)), () => setCats([]))
    const u2 = onSnapshot(collection(db, 'items'), (s) => setItems(list(s)), () => setItems([]))
    const u3 = onSnapshot(collection(db, 'variants'), (s) => setVariants(list(s)), () => setVariants([]))
    return () => {
      u1()
      u2()
      u3()
    }
  }, [enabled])

  useEffect(() => {
    if (!canCost) {
      setCosts({})
      return
    }
    return onSnapshot(
      collection(db, 'itemCosts'),
      (s) => setCosts(Object.fromEntries(s.docs.map((d) => [d.id, d.data()]))),
      () => setCosts({}),
    )
  }, [canCost])

  const value = useMemo(() => buildCatalog(cats, items, variants, costs), [cats, items, variants, costs])

  return <CatalogContext.Provider value={value}>{children}</CatalogContext.Provider>
}


// Pure: turns raw collections into lookups used by the screens
export function buildCatalog(cats, items, variants, costs) {
    const allCats = cats || []
    const allItems = items || []
    const allVariants = variants || []
    const catById = Object.fromEntries(allCats.map((c) => [c.id, c]))
    const itemById = Object.fromEntries(allItems.map((i) => [i.id, i]))
    const topCats = allCats.filter((c) => !c.parentId).sort(byOrder)
    const subsByCat = {}
    for (const c of allCats) if (c.parentId) (subsByCat[c.parentId] ||= []).push(c)
    for (const k in subsByCat) subsByCat[k].sort(byOrder)
    const varsByItem = {}
    for (const v of allVariants) (varsByItem[v.itemId] ||= []).push(v)
    for (const k in varsByItem) varsByItem[k].sort(byOrder)

    const variantsOf = (itemId, includeHidden = false) =>
      (varsByItem[itemId] || []).filter((v) => includeHidden || v.active !== false)
    const isLow = (v, item = itemById[v.itemId]) => (v.stock ?? 0) <= (item?.lowStock ?? 0)
    const itemStock = (itemId) => variantsOf(itemId).reduce((n, v) => n + (v.stock || 0), 0)

    const activeItems = allItems.filter((i) => i.active !== false)
    const lowList = []
    const entries = []
    for (const item of activeItems) {
      const cat = catById[item.catId] || { en: '—', ur: '—' }
      const sub = catById[item.subId] || { en: '—', ur: '—' }
      // item node carries its colours (and barcode as `code`) for search/sell/buy screens
      const node = { ...item, variants: variantsOf(item.id).map((v) => ({ ...v, code: v.barcode })) }
      for (const v of node.variants) {
        entries.push({ cat, sub, item: node, variant: v })
        if (isLow(v, item)) lowList.push({ cat, sub, item: node, variant: v })
      }
    }
    lowList.sort((a, b) => (a.variant.stock ?? 0) - (b.variant.stock ?? 0))

    return {
      ready: cats !== null && items !== null && variants !== null,
      categories: topCats,
      subsOf: (catId) => subsByCat[catId] || [],
      catById,
      items: allItems,
      itemById,
      variants: allVariants,
      variantsOf,
      itemStock,
      isLow,
      lowList,
      entries,
      costs,
    }
}

export const useCatalog = () => useContext(CatalogContext)

/* ================= categories (work offline, sync later) ================= */

export function saveCategory({ id, en, ur, parentId = null, order = 0 }) {
  const ref = id ? doc(db, 'categories', id) : doc(collection(db, 'categories'))
  const data = { en: en.trim(), ur: ur.trim() }
  if (id) updateDoc(ref, { ...data, updatedAt: serverTimestamp() })
  else setDoc(ref, { ...data, parentId, order, createdAt: serverTimestamp() })
  return ref.id
}

export function deleteCategory(id) {
  deleteDoc(doc(db, 'categories', id))
}

export function swapOrder(a, b) {
  const batch = writeBatch(db)
  // give both a distinct order even if they were equal
  const ao = a.order ?? 0
  const bo = b.order ?? 0
  batch.update(doc(db, 'categories', a.id), { order: ao === bo ? bo + 1 : bo })
  batch.update(doc(db, 'categories', b.id), { order: ao })
  batch.commit()
}

export function loadStarterCategories() {
  const batch = writeBatch(db)
  STARTER_CATEGORIES.forEach((c, i) => {
    const ref = doc(collection(db, 'categories'))
    batch.set(ref, { en: c.en, ur: c.ur, parentId: null, order: (i + 1) * 10, createdAt: serverTimestamp() })
    c.subs.forEach(([en, ur], j) => {
      batch.set(doc(collection(db, 'categories')), { en, ur, parentId: ref.id, order: (j + 1) * 10, createdAt: serverTimestamp() })
    })
  })
  batch.commit()
}

/* ================= barcodes ================= */

// EAN-13 check digit
export function ean13(first12) {
  const d = first12.split('').map(Number)
  const sum = d.reduce((s, n, i) => s + n * (i % 2 ? 3 : 1), 0)
  return first12 + ((10 - (sum % 10)) % 10)
}

// Shop-made barcode in the in-store range 200xxxxxxxxxC (never clashes with real product barcodes)
export async function generateBarcode() {
  const ref = doc(db, 'counters', 'barcode')
  return runTx(async (tx) => {
    const snap = await tx.get(ref)
    const next = (snap.exists() ? snap.data().next : 1) || 1
    tx.set(ref, { next: next + 1 })
    return ean13('200' + String(next).padStart(9, '0'))
  })
}

export class BarcodeTakenError extends Error {
  constructor(code) {
    super('barcode-taken')
    this.code = 'barcode-taken'
    this.barcode = code
  }
}

/* ================= items (need internet: one all-or-nothing save) ================= */

const cleanItem = (it) => ({
  en: it.en.trim(),
  ur: (it.ur || '').trim(),
  catId: it.catId,
  subId: it.subId,
  price: Number(it.price),
  unit: it.unit || 'pc',
  lowStock: Number(it.lowStock) || 0,
  active: it.active !== false,
})

const cleanVariant = (v, i) => ({
  en: v.en.trim(),
  ur: (v.ur || '').trim(),
  dot: v.dot || null,
  barcode: (v.barcode || '').trim() || null,
  order: i,
  active: v.active !== false,
})

/**
 * Create or update an item with its variants in one transaction.
 * rows: [{ id?, en, ur, dot, barcode, opening, active }]  — id present = existing variant
 * original: { variants } current variants for an edit (to free old barcodes)
 */
export async function saveItem({ itemId, item, rows, cost, original = [], user }) {
  const isNew = !itemId
  const itemRef = isNew ? doc(collection(db, 'items')) : doc(db, 'items', itemId)
  const oldById = Object.fromEntries(original.map((v) => [v.id, v]))

  // barcodes that need claiming
  const claims = rows
    .map((r) => ({ r, code: (r.barcode || '').trim() }))
    .filter(({ r, code }) => code && (!r.id || oldById[r.id]?.barcode !== code))

  await runTx(async (tx) => {
    // 1) reads first
    const snaps = await Promise.all(claims.map(({ code }) => tx.get(doc(db, 'barcodes', code))))
    snaps.forEach((s, i) => {
      if (s.exists()) {
        const owner = s.data().variantId
        const r = claims[i].r
        if (!r.id || owner !== r.id) throw new BarcodeTakenError(claims[i].code)
      }
    })

    // 2) writes
    const stamp = serverTimestamp()
    if (isNew) tx.set(itemRef, { ...cleanItem(item), createdAt: stamp, createdBy: user.uid, updatedAt: stamp })
    else tx.update(itemRef, { ...cleanItem(item), updatedAt: stamp, updatedBy: user.uid })

    rows.forEach((r, i) => {
      const data = cleanVariant(r, i)
      if (r.id) {
        const old = oldById[r.id]
        tx.update(doc(db, 'variants', r.id), { ...data, updatedAt: stamp })
        if (old?.barcode && old.barcode !== data.barcode) tx.delete(doc(db, 'barcodes', old.barcode))
        if (data.barcode && old?.barcode !== data.barcode)
          tx.set(doc(db, 'barcodes', data.barcode), { variantId: r.id, itemId: itemRef.id })
      } else {
        const vRef = doc(collection(db, 'variants'))
        const opening = Math.max(0, Math.floor(Number(r.opening) || 0))
        tx.set(vRef, { ...data, itemId: itemRef.id, stock: opening, createdAt: stamp })
        if (data.barcode) tx.set(doc(db, 'barcodes', data.barcode), { variantId: vRef.id, itemId: itemRef.id })
        if (opening > 0) {
          tx.set(doc(collection(db, 'stockMoves')), {
            type: 'opening',
            itemId: itemRef.id,
            variantId: vRef.id,
            qty: opening,
            unitCost: cost != null && cost !== '' ? Number(cost) : null,
            by: user.uid,
            byName: user.name || '',
            at: stamp,
          })
        }
      }
    })

    if (isNew && cost != null && cost !== '') {
      tx.set(doc(db, 'itemCosts', itemRef.id), { avgCost: Number(cost), lastCost: Number(cost), updatedAt: stamp })
    }
  })
  return itemRef.id
}

/* ================= history ================= */

export async function fetchMoves(itemId) {
  const snap = await getDocs(query(collection(db, 'stockMoves'), where('itemId', '==', itemId), limit(100)))
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (b.at?.toMillis?.() ?? 0) - (a.at?.toMillis?.() ?? 0))
}

// re-exported so later phases (buy/sell) share one place for stock maths
export { increment }
