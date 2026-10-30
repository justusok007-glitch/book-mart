// Bulk inventory: CSV upload, CSV download, and reset (Admin only, needs internet)
//
// CSV columns (header names are matched loosely — case, spaces and "_" don't matter):
//   Item Name, Item Name Ur, Category, Sub Category, Sale Price, Cost Price, Opening Stock, Low Stock
// The downloaded file has the same columns (+ Barcode and Types at the end), so it can be edited and uploaded again.

import { collection, doc, getDocs, serverTimestamp, writeBatch } from 'firebase/firestore'
import { db } from './firebase'

export const CSV_COLUMNS = ['Item Name', 'Item Name Ur', 'Category', 'Sub Category', 'Sale Price', 'Cost Price', 'Opening Stock', 'Low Stock']
const FIELD = {
  itemname: 'en', name: 'en', item: 'en',
  itemnameur: 'ur', itemnameurdu: 'ur', urduname: 'ur', nameur: 'ur', urdu: 'ur',
  category: 'cat', maincategory: 'cat',
  subcategory: 'sub', sub: 'sub',
  saleprice: 'price', price: 'price', sellingprice: 'price',
  costprice: 'cost', cost: 'cost', purchaseprice: 'cost',
  openingstock: 'stock', stock: 'stock', quantity: 'stock', qty: 'stock',
  lowstock: 'low', lowstocklimit: 'low',
}
const key = (h) => String(h || '').toLowerCase().replace(/[^a-z]/g, '')
export const norm = (s) => String(s ?? '').trim().replace(/\s+/g, ' ').toLowerCase()

/* ================= CSV text ================= */

export function parseCsv(text) {
  text = String(text || '').replace(/^﻿/, '')
  const first = text.split(/\r?\n/, 1)[0] || ''
  const count = (c) => first.split(c).length
  const sep = count('\t') > count(',') && count('\t') > count(';') ? '\t' : count(';') > count(',') ? ';' : ','
  const rows = []
  let row = []
  let cell = ''
  let quoted = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        cell += '"'
        i++
      } else if (c === '"') quoted = false
      else cell += c
    } else if (c === '"' && cell === '') quoted = true
    else if (c === sep) {
      row.push(cell)
      cell = ''
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++
      row.push(cell)
      rows.push(row)
      row = []
      cell = ''
    } else cell += c
  }
  if (cell !== '' || row.length) {
    row.push(cell)
    rows.push(row)
  }
  return rows.filter((r) => r.some((c) => String(c).trim() !== ''))
}

export function toCsv(rows) {
  const esc = (v) => {
    const s = v == null ? '' : String(v)
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  // BOM so Excel shows Urdu correctly
  return '﻿' + rows.map((r) => r.map(esc).join(',')).join('\r\n') + '\r\n'
}

export function downloadText(text, name, type = 'text/csv;charset=utf-8') {
  const url = URL.createObjectURL(new Blob([text], { type }))
  const a = document.createElement('a')
  a.href = url
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 5000)
}

export const templateCsv = () =>
  toCsv([
    CSV_COLUMNS,
    ['Ball Pen 0.7mm', 'بال پین 0.7', 'Pens', 'Ball Pens', 30, 22, 100, 10],
    ['Notebook 80 pages', 'کاپی 80 صفحات', 'Notebooks', 'Single Line', 120, 95, 50, 10],
  ])

/* ================= reading the upload (pure) ================= */

const num = (v) => {
  const s = String(v ?? '').replace(/[,\s]/g, '').replace(/^rs\.?/i, '')
  if (s === '') return null
  const n = Number(s)
  return Number.isFinite(n) ? n : NaN
}

/** CSV rows → [{ line, en, ur, cat, sub, price, cost, stock, low }] or { error } */
export function readRows(table) {
  if (!table.length) return { error: 'csvEmpty' }
  const header = table[0].map((h) => FIELD[key(h)] || null)
  const missing = ['en', 'cat', 'sub', 'price'].filter((f) => !header.includes(f))
  if (missing.length) return { error: 'csvMissingColumns', missing }
  const rows = table.slice(1).map((r, i) => {
    const o = { line: i + 2 }
    header.forEach((f, j) => f && o[f] === undefined && (o[f] = String(r[j] ?? '').trim()))
    return o
  })
  return { rows }
}

/**
 * Compares the upload with the shop and decides what happens to each row.
 * catalog: { categories, subsOf, items, variantsOf, costs }
 * Returns { rows: [{ ...row, status: 'new'|'update'|'same'|'error', msg, item?, changes }], newCats: [...] }
 */
export function planUpload(rows, catalog, { updateExisting = true } = {}) {
  const topByName = new Map(catalog.categories.map((c) => [norm(c.en), c]))
  const itemsByName = new Map()
  for (const it of catalog.items) {
    const k = norm(it.en)
    itemsByName.set(k, [...(itemsByName.get(k) || []), it])
  }
  const seen = new Set()
  const newCats = new Map() // catName → Set(subName)

  const out = rows.map((r) => {
    const price = num(r.price)
    const cost = num(r.cost)
    const stock = num(r.stock)
    const low = num(r.low)
    const res = { ...r, price, cost, stock, low, changes: [] }
    const err = (msg) => ({ ...res, status: 'error', msg })
    if (!r.en) return err('rowNoName')
    if (!r.cat || !r.sub) return err('rowNoCategory')
    if (price == null || Number.isNaN(price) || price <= 0) return err('rowBadPrice')
    if ([cost, stock, low].some((v) => Number.isNaN(v) || (v != null && v < 0))) return err('rowBadNumber')
    const k = `${norm(r.en)}|${norm(r.sub)}`
    if (seen.has(norm(r.en))) return err('rowDuplicate')
    seen.add(norm(r.en))

    const cat = topByName.get(norm(r.cat))
    const sub = cat ? catalog.subsOf(cat.id).find((s) => norm(s.en) === norm(r.sub)) : null
    if (!cat || !sub) {
      if (!newCats.has(norm(r.cat))) newCats.set(norm(r.cat), { en: r.cat.trim(), cat, subs: new Map() })
      if (!sub) newCats.get(norm(r.cat)).subs.set(norm(r.sub), r.sub.trim())
    }
    res.catRef = cat?.id || null
    res.subRef = sub?.id || null

    // existing item: same name (and same sub-category when two items share a name)
    const same = itemsByName.get(norm(r.en)) || []
    const item = same.length === 1 ? same[0] : same.find((it) => it.subId === sub?.id) || null
    if (!item) return { ...res, status: 'new', key: k }
    if (!updateExisting) return { ...res, status: 'skip', item }

    const vars = catalog.variantsOf(item.id, true)
    const curStock = vars.reduce((s, v) => s + (v.stock || 0), 0)
    const c = res.changes
    if (Number(item.price) !== price) c.push('price')
    if (r.ur && r.ur !== (item.ur || '')) c.push('ur')
    if (low != null && Number(item.lowStock || 0) !== low) c.push('low')
    if (item.catId !== cat?.id || item.subId !== sub?.id) c.push('category')
    if (cost != null && catalog.costs[item.id]?.avgCost !== cost) c.push('cost')
    if (stock != null && stock !== curStock) {
      if (vars.length === 1) c.push('stock')
      else res.msg = 'rowHasTypes' // several colours: stock is not changed from the file
    }
    res.item = item
    res.variant = vars.length === 1 ? vars[0] : null
    res.curStock = curStock
    return { ...res, status: c.length ? 'update' : 'same' }
  })

  return { rows: out, newCats: [...newCats.values()] }
}

/* ================= writing (needs internet) ================= */

async function commitInChunks(ops, onProgress) {
  for (let i = 0; i < ops.length; i += 400) {
    const batch = writeBatch(db)
    for (const op of ops.slice(i, i + 400)) op(batch)
    await batch.commit()
    onProgress?.(Math.min(1, (i + 400) / ops.length))
  }
}

export async function applyUpload(plan, catalog, user, onProgress) {
  const stamp = serverTimestamp()
  const ops = []
  const by = { by: user.uid, byName: user.name || '' }

  // 1) categories that don't exist yet
  const catIds = new Map() // norm(cat) → id
  const subIds = new Map() // norm(cat)|norm(sub) → id
  let order = Math.max(0, ...catalog.categories.map((c) => c.order || 0))
  for (const nc of plan.newCats) {
    let catId = nc.cat?.id
    if (!catId) {
      const ref = doc(collection(db, 'categories'))
      catId = ref.id
      order += 10
      const o = order
      ops.push((b) => b.set(ref, { en: nc.en, ur: '', parentId: null, order: o, createdAt: stamp }))
    }
    catIds.set(norm(nc.en), catId)
    let subOrder = Math.max(0, ...(nc.cat ? catalog.subsOf(nc.cat.id).map((s) => s.order || 0) : [0]))
    for (const [k, en] of nc.subs) {
      const ref = doc(collection(db, 'categories'))
      subOrder += 10
      const o = subOrder
      ops.push((b) => b.set(ref, { en, ur: '', parentId: catId, order: o, createdAt: stamp }))
      subIds.set(`${norm(nc.en)}|${k}`, ref.id)
    }
  }
  const catOf = (r) => r.catRef || catIds.get(norm(r.cat))
  const subOf = (r) => r.subRef || subIds.get(`${norm(r.cat)}|${norm(r.sub)}`)

  // 2) items
  let added = 0
  let updated = 0
  for (const r of plan.rows) {
    if (r.status === 'new') {
      added++
      const itemRef = doc(collection(db, 'items'))
      const vRef = doc(collection(db, 'variants'))
      const stock = Math.max(0, Math.floor(r.stock || 0))
      ops.push((b) =>
        b.set(itemRef, {
          en: r.en, ur: r.ur || '', catId: catOf(r), subId: subOf(r), price: r.price, unit: 'pc',
          lowStock: r.low ?? 0, active: true, createdAt: stamp, createdBy: user.uid, updatedAt: stamp, source: 'csv',
        }),
      )
      ops.push((b) => b.set(vRef, { en: 'Standard', ur: 'عام', dot: null, barcode: null, order: 0, active: true, itemId: itemRef.id, stock, createdAt: stamp }))
      if (stock > 0)
        ops.push((b) => b.set(doc(collection(db, 'stockMoves')), { type: 'opening', itemId: itemRef.id, variantId: vRef.id, qty: stock, unitCost: r.cost ?? null, note: 'CSV upload', ...by, at: stamp }))
      if (r.cost != null) ops.push((b) => b.set(doc(db, 'itemCosts', itemRef.id), { avgCost: r.cost, lastCost: r.cost, updatedAt: stamp }))
    } else if (r.status === 'update') {
      updated++
      const ch = new Set(r.changes)
      const data = { updatedAt: stamp, updatedBy: user.uid }
      if (ch.has('price')) data.price = r.price
      if (ch.has('ur')) data.ur = r.ur
      if (ch.has('low')) data.lowStock = r.low
      if (ch.has('category')) Object.assign(data, { catId: catOf(r), subId: subOf(r) })
      ops.push((b) => b.update(doc(db, 'items', r.item.id), data))
      if (ch.has('cost')) ops.push((b) => b.set(doc(db, 'itemCosts', r.item.id), { avgCost: r.cost, lastCost: r.cost, updatedAt: stamp }, { merge: true }))
      if (ch.has('stock') && r.variant) {
        const to = Math.max(0, Math.floor(r.stock))
        ops.push((b) => b.update(doc(db, 'variants', r.variant.id), { stock: to }))
        ops.push((b) =>
          b.set(doc(collection(db, 'stockMoves')), { type: 'adjust', itemId: r.item.id, variantId: r.variant.id, qty: to - r.curStock, reason: 'count', note: 'CSV upload', ...by, at: stamp }),
        )
      }
    }
  }
  await commitInChunks(ops, onProgress)
  return { added, updated, categories: plan.newCats.reduce((s, c) => s + (c.cat ? 0 : 1) + c.subs.size, 0) }
}

/* ================= download inventory as CSV (pure) ================= */

export function inventoryCsv(catalog) {
  const rows = [[...CSV_COLUMNS, 'Barcode', 'Types']]
  const items = [...catalog.items].sort((a, b) => {
    const ca = catalog.catById[a.catId]?.order ?? 999
    const cb = catalog.catById[b.catId]?.order ?? 999
    return ca - cb || (catalog.catById[a.subId]?.order ?? 999) - (catalog.catById[b.subId]?.order ?? 999) || (a.en || '').localeCompare(b.en || '')
  })
  for (const it of items) {
    const vars = catalog.variantsOf(it.id, true)
    const stock = vars.reduce((s, v) => s + (v.stock || 0), 0)
    rows.push([
      it.en,
      it.ur || '',
      catalog.catById[it.catId]?.en || '',
      catalog.catById[it.subId]?.en || '',
      it.price ?? '',
      catalog.costs[it.id]?.avgCost != null ? Math.round(catalog.costs[it.id].avgCost * 100) / 100 : '',
      stock,
      it.lowStock ?? 0,
      vars.map((v) => v.barcode).filter(Boolean).join(' | '),
      vars.length > 1 ? vars.map((v) => `${v.en}: ${v.stock || 0}`).join(' | ') : '',
    ])
  }
  return toCsv(rows)
}

export function inventoryFileName(ts = Date.now()) {
  const d = new Date(ts)
  const p = (n) => String(n).padStart(2, '0')
  return `book-mart-inventory-${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}.csv`
}

/* ================= reset ================= */

export const RESET_SCOPES = {
  inventory: ['categories', 'items', 'variants', 'barcodes', 'itemCosts', 'stockMoves', 'counters'],
  all: [
    'categories', 'items', 'variants', 'barcodes', 'itemCosts', 'stockMoves', 'counters',
    'suppliers', 'supplierLedger', 'purchases', 'customers', 'customerLedger', 'sales', 'returns',
    'dailyStats', 'expenses', 'cashOuts', 'investments', 'closings',
  ],
}

// Users, roles and shop settings are always kept.
export async function resetData(scope, onProgress) {
  const names = RESET_SCOPES[scope]
  let i = 0
  for (const name of names) {
    const snap = await getDocs(collection(db, name))
    const ops = snap.docs.map((d) => (b) => b.delete(d.ref))
    await commitInChunks(ops)
    onProgress?.(++i / names.length, name)
  }
}
