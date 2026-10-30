// SELL SCREEN
// Signed in: real items, sales are saved (works offline), stock goes down, receipt can be printed/shared.
// Public demo link (#/demo/sell): sample items, nothing is saved.

import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLang } from '../context/LangContext'
import { useAuth } from '../context/AuthContext'
import { ALL_VARIANTS, SAMPLE_CATALOG, SAMPLE_CUSTOMERS } from '../lib/sampleCatalog'
import { useCatalog } from '../lib/catalog'
import { Viewfinder } from '../components/BarcodeScanner'
import { Badge, Button, EmptyState, Field, IconButton, Notice, OfflineBanner, PageHeader, Rs, Sheet, Spinner } from '../components/ui'
import Icon from '../components/Icon'
import { LangSwitch } from './Login'
import ProductSearch from '../components/ProductSearch'
import { recordSale, saveCustomer, useCustomers, useReceiptCounter, useShopSettings } from '../lib/selling'
import { saleTotals, makeReceiptNo } from '../lib/saleMath'
import { printReceipt, ReceiptView, shareReceipt } from '../components/Receipt'
import { errorText } from '../lib/errors'

/* ---------- small pieces ---------- */

function Segmented({ options, value, onChange, size = 'md' }) {
  return (
    <div role="radiogroup" className="grid gap-2" style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}>
      {options.map((o) => {
        const active = value === o.value
        return (
          <button
            key={o.value}
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.value)}
            className={`flex cursor-pointer items-center justify-center gap-2 rounded-2xl border-[1.5px] px-3 font-semibold transition-colors duration-150 ${
              size === 'lg' ? 'min-h-14 text-lg' : 'min-h-12'
            } ${active ? 'border-charcoal bg-charcoal text-white' : 'border-line bg-white text-ink hover:border-charcoal-500'}`}
          >
            {o.icon && <Icon name={o.icon} size={size === 'lg' ? 24 : 20} />}
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

function Swatch({ color }) {
  if (!color) return null
  return <span aria-hidden="true" className="h-5 w-5 shrink-0 rounded-full border border-black/15" style={{ background: color }} />
}

function Stepper({ qty, onMinus, onPlus, labelMinus, labelPlus }) {
  return (
    <div className="flex items-center rounded-xl border border-line bg-white">
      <IconButton icon={qty === 1 ? 'trash' : 'minus'} label={labelMinus} onClick={onMinus} size={18} className="rounded-xl" />
      <span className="latin w-8 text-center text-lg font-bold tabular-nums">{qty}</span>
      <IconButton icon="plus" label={labelPlus} onClick={onPlus} size={18} className="rounded-xl" />
    </div>
  )
}

// "47 left" — stock minus what is already in the cart; red when at/below the low-stock alert
function LeftTag({ left, low }) {
  const { t } = useLang()
  const cls = left <= 0 ? 'bg-danger-50 text-danger' : low ? 'bg-warn-50 text-danger' : 'bg-paper text-muted'
  return (
    <span className={`inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-semibold ${cls}`}>
      {left <= 0 ? (
        t('outOfStock')
      ) : (
        <>
          <span className="latin">{left}</span>&nbsp;{t('leftWord')}
        </>
      )}
    </span>
  )
}

function NewCustomerForm({ onSaved }) {
  const { t } = useLang()
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault()
        if (name.trim()) onSaved(saveCustomer({ name, phone }), name.trim())
      }}
    >
      <Field label={t('customerName')}>
        <input className="field" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
      </Field>
      <Field label={`${t('phone')} (${t('optional')})`}>
        <input className="field latin" dir="ltr" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
      </Field>
      <Button type="submit" size="lg" className="w-full" disabled={!name.trim()}>
        {t('save')}
      </Button>
    </form>
  )
}

/* ---------- main screen ---------- */

export default function SellPreview({ demo = false }) {
  const { t, pick } = useLang()
  const auth = useAuth()
  const can = demo ? () => true : auth.can
  const catalog = useCatalog()
  const live = !demo
  useReceiptCounter(live ? auth?.user?.uid : null)
  const [mode, setMode] = useState('select')
  const [catId, setCatId] = useState('')
  const [subId, setSubId] = useState('')
  const [scanKey, setScanKey] = useState(0)
  const [openItem, setOpenItem] = useState(null)
  const [lines, setLines] = useState([])
  const [sheet, setSheet] = useState(null) // null | 'cart' | 'done'
  const [toast, setToast] = useState('')
  const [bump, setBump] = useState(0)
  const [discount, setDiscount] = useState('')
  const [pay, setPay] = useState('cash')
  const [customerId, setCustomerId] = useState('')
  const [paidInput, setPaidInput] = useState('')
  const [error, setError] = useState('')
  const toastTimer = useRef(null)
  const navigate = useNavigate()
  const shop = useShopSettings()
  const realCustomers = useCustomers(live && can('sell_credit'))
  const customers = live ? realCustomers || [] : SAMPLE_CUSTOMERS
  const [doneSale, setDoneSale] = useState(null)
  const [failed, setFailed] = useState([])
  const [newCust, setNewCust] = useState(false)
  const [busy, setBusy] = useState(false)

  // Real shop items when signed in; sample items on the public demo link.
  // Shape: [{ category, subs: [{ sub, items: [{ item, variants }] }] }]
  const { tree, entries } = useMemo(() => {
    if (!live) return { tree: SAMPLE_CATALOG, entries: ALL_VARIANTS }
    const tree = []
    const entries = []
    for (const c of catalog.categories) {
      const subs = []
      for (const sb of catalog.subsOf(c.id)) {
        const items = catalog.items
          .filter((i) => i.subId === sb.id && i.active !== false)
          .map((i) => ({ ...i, variants: catalog.variantsOf(i.id).map((v) => ({ ...v, code: v.barcode })) }))
          .filter((i) => i.variants.length > 0)
          .sort((a, b) => (a.en || '').localeCompare(b.en || ''))
        if (!items.length) continue
        const subNode = { ...sb, items }
        subs.push(subNode)
        for (const item of items) for (const variant of item.variants) entries.push({ cat: c, sub: sb, item, variant })
      }
      if (subs.length) tree.push({ ...c, subs })
    }
    return { tree, entries }
  }, [live, catalog])

  const cat = tree.find((c) => c.id === catId) || tree[0]
  const sub = cat ? cat.subs.find((s) => s.id === subId) || cat.subs[0] : null

  const count = lines.reduce((n, l) => n + l.qty, 0)
  const subtotal = lines.reduce((n, l) => n + l.qty * l.item.price, 0)
  const disc = Math.min(Number(discount) || 0, subtotal)
  const total = subtotal - disc
  const paid = pay === 'cash' ? total : pay === 'credit' ? 0 : Math.min(Number(paidInput) || 0, total)
  const qtyOf = useMemo(() => Object.fromEntries(lines.map((l) => [l.key, l.qty])), [lines])
  const customer = customers.find((c) => c.id === customerId)
  const stockOf = (variantId) => (live ? catalog.variants.find((v) => v.id === variantId)?.stock ?? 0 : 99)

  useEffect(() => () => clearTimeout(toastTimer.current), [])

  function showToast(msg) {
    setToast(msg)
    clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(''), 1600)
  }

  // how many more of this colour can go in the cart (stock minus what is already in it)
  const availableOf = (variantId) => stockOf(variantId) - (qtyOf[variantId] || 0)

  function add(item, variant) {
    if (live && availableOf(variant.id) <= 0) {
      showToast(`${t('noMoreStock')}: ${pick(item)}${item.variants.length > 1 ? ' · ' + pick(variant) : ''}`)
      if (navigator.vibrate) navigator.vibrate([40, 60, 40])
      return
    }
    setLines((ls) => {
      const i = ls.findIndex((l) => l.key === variant.id)
      if (i >= 0) return ls.map((l, j) => (j === i ? { ...l, qty: l.qty + 1 } : l))
      return [...ls, { key: variant.id, item, variant, qty: 1 }]
    })
    setBump((b) => b + 1)
    showToast(`${t('added')}: ${pick(item)}${item.variants.length > 1 ? ' · ' + pick(variant) : ''}`)
  }

  function changeQty(key, delta) {
    if (live && delta > 0 && availableOf(key) <= 0) return showToast(t('noMoreStock'))
    setLines((ls) => ls.flatMap((l) => (l.key !== key ? [l] : l.qty + delta <= 0 ? [] : [{ ...l, qty: l.qty + delta }])))
  }

  function tapItem(item) {
    if (item.variants.length === 1) add(item, item.variants[0])
    else setOpenItem(item)
  }

  function chooseCategory(c) {
    setCatId(c.id)
    setSubId(c.subs[0].id)
  }

  function simulateScan() {
    const pick1 = ALL_VARIANTS[Math.floor(Math.random() * ALL_VARIANTS.length)]
    add(pick1.item, pick1.variant)
  }

  // real camera: find the scanned barcode, add it, then get ready for the next one
  // the same barcode is ignored for 3 seconds so a barcode left in view is not added again and again;
  // to add 2 of the same, scan again after a moment or use + in the cart
  const lastScan = useRef({ code: '', at: 0 })
  function onScanned(code) {
    const now = Date.now()
    const repeat = lastScan.current.code === code && now - lastScan.current.at < 3000
    lastScan.current = { code, at: now }
    if (!repeat) {
      const hit = entries.find((e) => e.variant.code && e.variant.code === code)
      if (hit) add(hit.item, hit.variant)
      else showToast(`${t('barcodeNotFound')}: ${code}`)
    }
    setTimeout(() => setScanKey((k) => k + 1), repeat ? 600 : 1200)
  }

  function complete() {
    setError('')
    if (busy || !lines.length) return
    if (pay !== 'cash' && !customerId) return setError(t('chooseCustomer'))
    if (!live) {
      // demo: build the receipt only
      const cartLines = lines.map((l) => ({
        itemName: l.item.en,
        variantName: l.item.variants.length > 1 ? l.variant.en : '',
        qty: l.qty,
        price: l.item.price,
        unitCost: null,
      }))
      setDoneSale({ receiptNo: makeReceiptNo(), lines: cartLines, ...saleTotals(cartLines, discount, pay, paidInput), customerName: customer?.name || '', clientAt: Date.now() })
      return setSheet('done')
    }
    setBusy(true)
    const sale = recordSale({
      cartLines: lines,
      discount: can('sell_discount') ? discount : 0,
      payType: pay,
      paidInput,
      customer: pay !== 'cash' ? customer : null,
      costs: catalog.costs,
      user: { uid: auth.user.uid, name: auth.displayName, letter: auth.profile?.receiptLetter || null },
      onFail: (e, s) => setFailed((f) => [...f, { receiptNo: s.receiptNo, total: s.total, msg: errorText(e, t) }]),
    })
    setDoneSale(sale)
    setBusy(false)
    setSheet('done')
  }

  function newSale() {
    setDoneSale(null)
    setLines([])
    setDiscount('')
    setPay('cash')
    setCustomerId('')
    setPaidInput('')
    setSheet(null)
  }

  return (
    <div className="min-h-screen pb-36">
      <PageHeader
        title={t('sell')}
        back={!demo}
        right={
          demo ? (
            <span className="me-2 flex items-center gap-2">
              <LangSwitch />
              <Badge tone="lime">{t('preview')}</Badge>
            </span>
          ) : (
            can('view_sales') && <IconButton icon="receipt" label={t('salesHistory')} onClick={() => navigate('/sales')} className="me-1 text-charcoal" />
          )
        }
      />
      <OfflineBanner />

      <main className="mx-auto max-w-3xl px-4 pt-4">
        {!live && (
          <div className="mb-4">
            <Notice type="warn">{t('demoNotice')}</Notice>
          </div>
        )}
        {failed.length > 0 && (
          <div className="mb-4 space-y-2">
            {failed.map((f) => (
              <Notice key={f.receiptNo}>
                <b>
                  {t('saleNotSaved')} #{f.receiptNo} (Rs {Number(f.total).toLocaleString('en-PK')})
                </b>
                <br />
                {f.msg}
              </Notice>
            ))}
          </div>
        )}

        {/* 0. Search — type full or part of a name, colour or barcode */}
        <div className="mb-4">
          <ProductSearch entries={entries} qtyOf={qtyOf} onAdd={add} stockOf={live ? stockOf : null} />
        </div>

        {/* 1. Scan / Select */}
        <Segmented
          size="lg"
          value={mode}
          onChange={setMode}
          options={[
            { value: 'scan', label: t('scan'), icon: 'scan' },
            { value: 'select', label: t('select'), icon: 'grid' },
          ]}
        />

        {mode === 'scan' && live && (
          <div className="mx-auto mt-5 max-w-md">
            <Viewfinder key={scanKey} compact onResult={onScanned} onError={() => showToast(t('cameraFailed'))} />
            <p className="mt-3 text-sm text-muted">{t('scanTip')}</p>
          </div>
        )}

        {mode === 'scan' && !live && (
          <div className="mt-5">
            <div className="relative mx-auto aspect-[4/3] w-full max-w-md overflow-hidden rounded-3xl bg-charcoal">
              {/* corner marks */}
              {['top-5 start-5 border-t-4 border-s-4 rounded-ss-xl', 'top-5 end-5 border-t-4 border-e-4 rounded-se-xl', 'bottom-5 start-5 border-b-4 border-s-4 rounded-es-xl', 'bottom-5 end-5 border-b-4 border-e-4 rounded-ee-xl'].map((c) => (
                <span key={c} className={`absolute h-10 w-10 border-lime ${c}`} aria-hidden="true" />
              ))}
              <span className="scanline absolute inset-x-8 h-0.5 rounded-full bg-lime shadow-[0_0_12px_2px_rgba(159,204,71,.7)]" aria-hidden="true" />
              <div className="absolute inset-x-0 bottom-8 flex items-center justify-center gap-2 text-sm font-medium text-white/85">
                <Icon name="scan" size={18} /> {t('scanHint')}
              </div>
            </div>
            <div className="mx-auto mt-4 max-w-md">
              <Button variant="secondary" className="w-full" onClick={simulateScan}>
                <Icon name="scan" size={20} /> {t('simulateScan')}
              </Button>
            </div>
          </div>
        )}

        {mode === 'select' && live && !catalog.ready && (
          <div className="flex justify-center py-12">
            <Spinner />
          </div>
        )}

        {mode === 'select' && live && catalog.ready && tree.length === 0 && (
          <EmptyState icon="package" title={t('noItems')} body={t('noItemsToSell')} />
        )}

        {mode === 'select' && cat && (
          <div className="mt-5">
            {/* 2. Main categories — rectangular tabs */}
            <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-1" role="tablist" aria-label={t('categories')}>
              {tree.map((c) => {
                const active = c.id === cat.id
                return (
                  <button
                    key={c.id}
                    role="tab"
                    aria-selected={active}
                    onClick={() => chooseCategory(c)}
                    className={`min-h-14 shrink-0 cursor-pointer rounded-xl border-[1.5px] px-5 text-base font-bold transition-colors duration-150 ${
                      active ? 'border-charcoal bg-charcoal text-white' : 'border-line bg-white text-ink hover:border-charcoal-500'
                    }`}
                  >
                    {pick(c)}
                  </button>
                )
              })}
            </div>

            {/* 3. Sub-categories */}
            <div className="no-scrollbar -mx-4 mt-3 flex gap-2 overflow-x-auto px-4 pb-1" role="tablist" aria-label={t('subCategories')}>
              {cat.subs.map((s) => {
                const active = s.id === sub.id
                return (
                  <button
                    key={s.id}
                    role="tab"
                    aria-selected={active}
                    onClick={() => setSubId(s.id)}
                    className={`min-h-12 shrink-0 cursor-pointer rounded-full border-[1.5px] px-4 font-semibold transition-colors duration-150 ${
                      active ? 'border-lime bg-lime text-charcoal' : 'border-line bg-white text-ink hover:border-charcoal-500'
                    }`}
                  >
                    {pick(s)}
                  </button>
                )
              })}
            </div>

            {/* 4. Main items */}
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
              {sub.items.map((item) => {
                const inCart = item.variants.reduce((n, v) => n + (qtyOf[v.id] || 0), 0)
                const left = item.variants.reduce((n, v) => n + Math.max(0, stockOf(v.id)), 0) - inCart
                const low = left <= (item.lowStock ?? 0)
                return (
                  <button
                    key={item.id}
                    onClick={() => tapItem(item)}
                    aria-disabled={live && left <= 0}
                    className={`relative flex min-h-[124px] cursor-pointer flex-col justify-between rounded-2xl border-[1.5px] bg-white p-4 text-start transition-colors duration-150 hover:border-charcoal-500 active:bg-paper ${
                      inCart ? 'border-lime' : 'border-line'
                    } ${live && left <= 0 ? 'opacity-60' : ''}`}
                  >
                    {inCart > 0 && (
                      <span key={bump} className="pop latin absolute end-2 top-2 flex h-7 min-w-7 items-center justify-center rounded-full bg-lime px-2 text-sm font-bold text-charcoal">
                        {inCart}
                      </span>
                    )}
                    <span className="pe-8 font-semibold leading-snug text-ink">{pick(item)}</span>
                    <span className="block">
                      <span className="block">
                        <Rs value={item.price} className="text-xl font-bold text-charcoal" />
                      </span>
                      <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted">
                        {item.variants.length > 1 ? (
                          <span>
                            <span className="latin">{item.variants.length}</span> {t('options')}
                          </span>
                        ) : (
                          !live && <span>{t('tapToAdd')}</span>
                        )}
                        {live && <LeftTag left={left} low={low} />}
                      </span>
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        )}
      </main>

      {/* toast */}
      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 top-20 z-[60] flex justify-center px-4">
        {toast && (
          <div className="flex max-w-sm items-center gap-2 rounded-full bg-charcoal px-4 py-2.5 text-sm font-semibold text-white shadow-lg">
            {toast.startsWith(t('noMoreStock')) || toast.startsWith(t('barcodeNotFound')) ? (
              <Icon name="alert" size={18} className="text-warn" />
            ) : (
              <Icon name="checkCircle" size={18} className="text-lime" />
            )}
            <span className="truncate">{toast}</span>
          </div>
        )}
      </div>

      {/* cart bar */}
      <div className="safe-bottom fixed inset-x-0 bottom-0 z-30 border-t border-line bg-white shadow-[0_-4px_16px_rgba(0,0,0,.06)]">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3">
          <button
            onClick={() => count && setSheet('cart')}
            disabled={!count}
            className="flex min-h-14 flex-1 cursor-pointer items-center gap-3 rounded-2xl px-2 text-start transition-colors duration-150 hover:bg-paper disabled:cursor-default disabled:hover:bg-transparent"
          >
            <span className="relative flex h-11 w-11 items-center justify-center rounded-xl bg-paper text-charcoal">
              <Icon name="cart" size={22} />
              {count > 0 && (
                <span key={bump} className="pop latin absolute -end-1.5 -top-1.5 flex h-6 min-w-6 items-center justify-center rounded-full bg-charcoal px-1.5 text-xs font-bold text-white">
                  {count}
                </span>
              )}
            </span>
            <span>
              <span className="block text-sm text-muted">{count ? t('viewCart') : t('emptyCart')}</span>
              <Rs value={subtotal} className="block text-xl font-bold text-charcoal" />
            </span>
          </button>
          <Button variant="accent" size="lg" disabled={!count} onClick={() => setSheet('cart')} className="px-6">
            {t('checkout')}
            <Icon name="chevron" size={20} className="rtl:rotate-180" />
          </Button>
        </div>
      </div>

      {/* 5. Same-price items (variants) */}
      <Sheet open={!!openItem} title={openItem ? pick(openItem) : ''} onClose={() => setOpenItem(null)}>
        {openItem && (
          <>
            <div className="mb-4 flex items-center gap-2 rounded-xl bg-lime-50 px-4 py-3">
              <span className="text-sm font-semibold text-muted">{t('samePrice')}</span>
              <Rs value={openItem.price} className="ms-auto text-xl font-bold text-charcoal" />
              <span className="text-sm text-muted">{t('each')}</span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {openItem.variants.map((v) => {
                const q = qtyOf[v.id] || 0
                const vLeft = stockOf(v.id) - q
                return (
                  <button
                    key={v.id}
                    onClick={() => add(openItem, v)}
                    aria-disabled={live && vLeft <= 0}
                    className={`relative flex min-h-16 cursor-pointer items-center gap-3 rounded-2xl border-[1.5px] bg-white px-4 text-start font-semibold transition-colors duration-150 hover:border-charcoal-500 active:bg-paper ${
                      q ? 'border-lime' : 'border-line'
                    } ${live && vLeft <= 0 ? 'opacity-50' : ''}`}
                  >
                    <Swatch color={v.dot} />
                    <span className="flex-1">
                      <span className="block leading-snug">{pick(v)}</span>
                      {live && <LeftTag left={vLeft} low={vLeft <= (openItem.lowStock ?? 0)} />}
                    </span>
                    {q > 0 && (
                      <span key={`${v.id}-${q}`} className="pop latin flex h-7 min-w-7 items-center justify-center rounded-full bg-lime px-2 text-sm font-bold text-charcoal">
                        {q}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
            <p className="mt-3 text-sm text-muted">{t('tapMore')}</p>
            <Button className="mt-4 w-full" size="lg" onClick={() => setOpenItem(null)}>
              {t('done')}
            </Button>
          </>
        )}
      </Sheet>

      {/* 6. Cart & payment */}
      <Sheet open={sheet === 'cart'} title={t('cart')} onClose={() => setSheet(null)}>
        <ul className="divide-y divide-line">
          {lines.map((l) => (
            <li key={l.key} className="flex items-center gap-3 py-3">
              <Swatch color={l.variant.dot} />
              <div className="min-w-0 flex-1">
                <div className="truncate font-semibold">{pick(l.item)}</div>
                <div className="text-sm text-muted">
                  {l.item.variants.length > 1 && <>{pick(l.variant)} · </>}
                  <Rs value={l.item.price} />
                </div>
                {live && l.qty > stockOf(l.variant.id) && (
                  <div className="text-sm font-semibold text-danger">
                    {t('onlyInStock')} <span className="latin">{Math.max(0, stockOf(l.variant.id))}</span>
                  </div>
                )}
              </div>
              <Stepper
                qty={l.qty}
                onMinus={() => changeQty(l.key, -1)}
                onPlus={() => changeQty(l.key, 1)}
                labelMinus={t('less')}
                labelPlus={t('more')}
              />
            </li>
          ))}
        </ul>

        <div className="mt-4 space-y-4">
          {can('sell_discount') && (
            <Field label={t('discount')}>
              <div className="relative">
                <span className="latin pointer-events-none absolute inset-y-0 start-0 flex items-center ps-4 text-muted" dir="ltr">Rs</span>
                <input
                  className="field latin ps-12"
                  dir="ltr"
                  inputMode="numeric"
                  value={discount}
                  onChange={(e) => setDiscount(e.target.value.replace(/[^\d]/g, ''))}
                  placeholder="0"
                />
              </div>
            </Field>
          )}

          <div>
            <span className="mb-1.5 block text-sm font-semibold">{t('payment')}</span>
            <Segmented
              value={pay}
              onChange={(v) => {
                setPay(v)
                setError('')
              }}
              options={[
                { value: 'cash', label: t('cash') },
                ...(can('sell_credit')
                  ? [
                      { value: 'partial', label: t('partial') },
                      { value: 'credit', label: t('credit') },
                    ]
                  : []),
              ]}
            />
          </div>

          {pay !== 'cash' && (
            <>
              <Field label={t('customer')}>
                <div className="flex gap-2">
                  <select className="field" value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
                    <option value="">{t('chooseCustomer')}</option>
                    {customers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                        {(c.balance || 0) > 0 ? ` — ${t('owes')} Rs ${Number(c.balance).toLocaleString('en-PK')}` : ''}
                      </option>
                    ))}
                  </select>
                  {live && (
                    <IconButton icon="plus" label={t('newCustomer')} onClick={() => setNewCust(true)} className="rounded-xl border-[1.5px] border-line bg-white" />
                  )}
                </div>
              </Field>
              {pay === 'partial' && (
                <Field label={t('paidNow')}>
                  <input
                    className="field latin"
                    dir="ltr"
                    inputMode="numeric"
                    value={paidInput}
                    onChange={(e) => setPaidInput(e.target.value.replace(/[^\d]/g, ''))}
                    placeholder="0"
                  />
                </Field>
              )}
            </>
          )}

          <div className="space-y-1.5 rounded-2xl bg-paper p-4">
            <div className="flex justify-between text-muted">
              <span>{t('subtotal')}</span>
              <Rs value={subtotal} />
            </div>
            {disc > 0 && (
              <div className="flex justify-between text-muted">
                <span>{t('discount')}</span>
                <span className="latin" dir="ltr">- Rs {disc.toLocaleString('en-PK')}</span>
              </div>
            )}
            <div className="flex items-center justify-between border-t border-line pt-2">
              <span className="text-lg font-bold">{t('total')}</span>
              <Rs value={total} className="text-2xl font-bold text-charcoal" />
            </div>
            {pay !== 'cash' && (
              <div className="flex justify-between font-semibold text-danger">
                <span>{t('toUdhaar')}</span>
                <Rs value={total - paid} />
              </div>
            )}
          </div>

          <Notice>{error}</Notice>
          <Button variant="accent" size="lg" className="w-full" onClick={complete} disabled={busy}>
            <Icon name="check" size={22} /> {t('completeSale')}
          </Button>
        </div>
      </Sheet>

      {/* 7. Done + receipt */}
      <Sheet open={sheet === 'done' && !!doneSale} title={t('saleComplete')} onClose={newSale}>
        {doneSale && (
          <>
            <div className="mb-4 flex flex-col items-center text-center">
              <div className="mb-2 flex h-16 w-16 items-center justify-center rounded-full bg-lime text-charcoal">
                <Icon name="check" size={34} strokeWidth={3} />
              </div>
              <Rs value={doneSale.total} className="text-3xl font-bold text-charcoal" />
              <span className="text-muted">
                {doneSale.due > 0 ? `${t('credit')} · ${doneSale.customerName}` : t('cash')}
              </span>
              {live && !navigator.onLine && <span className="mt-1 text-sm font-semibold text-leaf">{t('savedOffline')}</span>}
            </div>
            <ReceiptView sale={doneSale} shop={shop} />
            <div className="mt-5 grid grid-cols-2 gap-3">
              <Button variant="secondary" size="lg" onClick={() => printReceipt(doneSale, shop, t('receiptThanks'))}>
                <Icon name="printer" size={20} /> {t('print')}
              </Button>
              <Button
                variant="secondary"
                size="lg"
                onClick={async () => {
                  const r = await shareReceipt(doneSale, shop)
                  if (r === 'copied') showToast(t('copied'))
                }}
              >
                <Icon name="share" size={20} /> {t('share')}
              </Button>
            </div>
            <Button size="lg" className="mt-3 w-full" onClick={newSale}>
              <Icon name="plus" size={20} /> {t('newSale')}
            </Button>
          </>
        )}
      </Sheet>

      <Sheet open={newCust} title={t('newCustomer')} onClose={() => setNewCust(false)}>
        {newCust && (
          <NewCustomerForm
            onSaved={(id) => {
              setCustomerId(id)
              setNewCust(false)
            }}
          />
        )}
      </Sheet>
    </div>
  )
}
