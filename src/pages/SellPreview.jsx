// SELL SCREEN — DESIGN PREVIEW
// Clickable mockup with sample items so the client can approve the flow and look.
// Nothing is saved. Phase 4 connects this same UI to the real catalog, stock and sales.

import { useEffect, useMemo, useRef, useState } from 'react'
import { useLang } from '../context/LangContext'
import { useAuth } from '../context/AuthContext'
import { ALL_VARIANTS, SAMPLE_CATALOG, SAMPLE_CUSTOMERS } from '../lib/sampleCatalog'
import { Badge, Button, Field, IconButton, Notice, OfflineBanner, PageHeader, Rs, Sheet } from '../components/ui'
import Icon from '../components/Icon'
import { LangSwitch } from './Login'

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

/* ---------- receipt preview (how the 58mm thermal slip will look) ---------- */
function ReceiptPreview({ lines, subtotal, discount, total, pay, paid, customer }) {
  const { pick, t } = useLang()
  const now = new Date()
  return (
    <div className="mx-auto w-full max-w-[300px] rounded-lg border border-dashed border-[#b5bbae] bg-white p-4 font-mono text-[13px] leading-snug text-black">
      <div className="mb-2 flex flex-col items-center text-center">
        <img src="./logo-mark.png" alt="" className="mb-1 h-10 w-10 object-contain grayscale" />
        <div className="text-base font-bold">BOOK MART</div>
        <div className="text-[11px]">Okara</div>
        <div className="latin mt-1 text-[11px]" dir="ltr">
          {now.toLocaleDateString('en-GB')} {now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
        </div>
      </div>
      <div className="my-2 border-t border-dashed border-black/40" />
      {lines.map((l) => (
        <div key={l.key} className="mb-1">
          <div className="truncate">
            {pick(l.item)} {l.item.variants.length > 1 && `- ${pick(l.variant)}`}
          </div>
          <div className="latin flex justify-between" dir="ltr">
            <span>
              {l.qty} x {l.item.price}
            </span>
            <span>{(l.qty * l.item.price).toLocaleString('en-PK')}</span>
          </div>
        </div>
      ))}
      <div className="my-2 border-t border-dashed border-black/40" />
      <div className="latin space-y-0.5" dir="ltr">
        <div className="flex justify-between">
          <span>Subtotal</span>
          <span>{subtotal.toLocaleString('en-PK')}</span>
        </div>
        {discount > 0 && (
          <div className="flex justify-between">
            <span>Discount</span>
            <span>-{discount.toLocaleString('en-PK')}</span>
          </div>
        )}
        <div className="flex justify-between text-[15px] font-bold">
          <span>TOTAL Rs</span>
          <span>{total.toLocaleString('en-PK')}</span>
        </div>
        {pay !== 'cash' && (
          <>
            <div className="flex justify-between">
              <span>Paid</span>
              <span>{paid.toLocaleString('en-PK')}</span>
            </div>
            <div className="flex justify-between">
              <span>Udhaar ({customer?.name})</span>
              <span>{(total - paid).toLocaleString('en-PK')}</span>
            </div>
          </>
        )}
      </div>
      <div className="my-2 border-t border-dashed border-black/40" />
      <div className="text-center text-[11px]">{t('receiptThanks')}</div>
    </div>
  )
}

/* ---------- main screen ---------- */

export default function SellPreview({ demo = false }) {
  const { t, pick } = useLang()
  const auth = useAuth()
  const can = demo ? () => true : auth.can
  const [mode, setMode] = useState('select')
  const [catId, setCatId] = useState(SAMPLE_CATALOG[0].id)
  const [subId, setSubId] = useState(SAMPLE_CATALOG[0].subs[0].id)
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

  const cat = SAMPLE_CATALOG.find((c) => c.id === catId)
  const sub = cat.subs.find((s) => s.id === subId) || cat.subs[0]

  const count = lines.reduce((n, l) => n + l.qty, 0)
  const subtotal = lines.reduce((n, l) => n + l.qty * l.item.price, 0)
  const disc = Math.min(Number(discount) || 0, subtotal)
  const total = subtotal - disc
  const paid = pay === 'cash' ? total : pay === 'credit' ? 0 : Math.min(Number(paidInput) || 0, total)
  const qtyOf = useMemo(() => Object.fromEntries(lines.map((l) => [l.key, l.qty])), [lines])
  const customer = SAMPLE_CUSTOMERS.find((c) => c.id === customerId)

  useEffect(() => () => clearTimeout(toastTimer.current), [])

  function showToast(msg) {
    setToast(msg)
    clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(''), 1600)
  }

  function add(item, variant) {
    setLines((ls) => {
      const i = ls.findIndex((l) => l.key === variant.id)
      if (i >= 0) return ls.map((l, j) => (j === i ? { ...l, qty: l.qty + 1 } : l))
      return [...ls, { key: variant.id, item, variant, qty: 1 }]
    })
    setBump((b) => b + 1)
    showToast(`${t('added')}: ${pick(item)}${item.variants.length > 1 ? ' · ' + pick(variant) : ''}`)
  }

  function changeQty(key, delta) {
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

  function complete() {
    setError('')
    if (pay !== 'cash' && !customerId) return setError(t('chooseCustomer'))
    setSheet('done')
  }

  function newSale() {
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
          <span className="me-2 flex items-center gap-2">
            {demo && <LangSwitch />}
            <Badge tone="lime">{t('preview')}</Badge>
          </span>
        }
      />
      <OfflineBanner />

      <main className="mx-auto max-w-3xl px-4 pt-4">
        <div className="mb-4">
          <Notice type="warn">{t('demoNotice')}</Notice>
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

        {mode === 'scan' && (
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

        {mode === 'select' && (
          <div className="mt-5">
            {/* 2. Main categories — rectangular tabs */}
            <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-1" role="tablist" aria-label={t('categories')}>
              {SAMPLE_CATALOG.map((c) => {
                const active = c.id === catId
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
                return (
                  <button
                    key={item.id}
                    onClick={() => tapItem(item)}
                    className={`relative flex min-h-[124px] cursor-pointer flex-col justify-between rounded-2xl border-[1.5px] bg-white p-4 text-start transition-colors duration-150 hover:border-charcoal-500 active:bg-paper ${
                      inCart ? 'border-lime' : 'border-line'
                    }`}
                  >
                    {inCart > 0 && (
                      <span key={bump} className="pop latin absolute end-2 top-2 flex h-7 min-w-7 items-center justify-center rounded-full bg-lime px-2 text-sm font-bold text-charcoal">
                        {inCart}
                      </span>
                    )}
                    <span className="pe-8 font-semibold leading-snug text-ink">{pick(item)}</span>
                    <span>
                      <Rs value={item.price} className="block text-xl font-bold text-charcoal" />
                      <span className="text-sm text-muted">
                        {item.variants.length > 1 ? (
                          <>
                            <span className="latin">{item.variants.length}</span> {t('options')}
                          </>
                        ) : (
                          t('tapToAdd')
                        )}
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
      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-28 z-[60] flex justify-center px-4">
        {toast && (
          <div className="flex max-w-sm items-center gap-2 rounded-full bg-charcoal px-4 py-2.5 text-sm font-semibold text-white shadow-lg">
            <Icon name="checkCircle" size={18} className="text-lime" />
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
                return (
                  <button
                    key={v.id}
                    onClick={() => add(openItem, v)}
                    className={`relative flex min-h-16 cursor-pointer items-center gap-3 rounded-2xl border-[1.5px] bg-white px-4 text-start font-semibold transition-colors duration-150 hover:border-charcoal-500 active:bg-paper ${
                      q ? 'border-lime' : 'border-line'
                    }`}
                  >
                    <Swatch color={v.dot} />
                    <span className="flex-1">{pick(v)}</span>
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
                <select className="field" value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
                  <option value="">{t('chooseCustomer')}</option>
                  {SAMPLE_CUSTOMERS.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} — Rs {c.balance.toLocaleString('en-PK')}
                    </option>
                  ))}
                </select>
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
          <Button variant="accent" size="lg" className="w-full" onClick={complete}>
            <Icon name="check" size={22} /> {t('completeSale')}
          </Button>
        </div>
      </Sheet>

      {/* 7. Done + receipt */}
      <Sheet open={sheet === 'done'} title={t('saleComplete')} onClose={newSale}>
        <div className="mb-4 flex flex-col items-center text-center">
          <div className="mb-2 flex h-16 w-16 items-center justify-center rounded-full bg-lime text-charcoal">
            <Icon name="check" size={34} strokeWidth={3} />
          </div>
          <Rs value={total} className="text-3xl font-bold text-charcoal" />
          <span className="text-muted">{pay === 'cash' ? t('cash') : pay === 'credit' ? t('credit') : t('partial')}</span>
        </div>
        <p className="mb-2 text-center text-sm font-semibold text-muted">{t('receiptPreview')}</p>
        <ReceiptPreview lines={lines} subtotal={subtotal} discount={disc} total={total} pay={pay} paid={paid} customer={customer} />
        <div className="mt-5 grid grid-cols-2 gap-3">
          <Button variant="secondary" size="lg" onClick={() => showToast(t('printerLater'))}>
            <Icon name="printer" size={20} /> {t('print')}
          </Button>
          <Button size="lg" onClick={newSale}>
            <Icon name="plus" size={20} /> {t('newSale')}
          </Button>
        </div>
      </Sheet>
    </div>
  )
}
