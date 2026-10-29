import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useLang } from '../context/LangContext'
import { useCatalog } from '../lib/catalog'
import { recordPurchase, saveSupplier, useSuppliers } from '../lib/purchasing'
import { round2 } from '../lib/costing'
import { errorText } from '../lib/errors'
import { Button, Card, EmptyState, Field, IconButton, MoneyInput, Notice, Page, Rs, Segmented, Sheet } from '../components/ui'
import ProductSearch from '../components/ProductSearch'
import BarcodeScanner from '../components/BarcodeScanner'
import { Dot } from '../components/ItemBits'
import Icon from '../components/Icon'

const intOnly = (v) => v.replace(/[^\d]/g, '')

function NewSupplierForm({ onSaved }) {
  const { t } = useLang()
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault()
        if (name.trim()) onSaved(saveSupplier({ name, phone }))
      }}
    >
      <Field label={t('supplierName')}>
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

export default function Buy() {
  const { t, pick } = useLang()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const { user, displayName, can } = useAuth()
  const catalog = useCatalog()
  const suppliers = useSuppliers(true)
  const canPrice = can('manage_items')
  const canSeeCost = can('view_cost_price') || can('buy')

  const [supplierId, setSupplierId] = useState('')
  const [billNo, setBillNo] = useState('')
  const [note, setNote] = useState('')
  const [lines, setLines] = useState([])
  const [prices, setPrices] = useState({}) // itemId -> new sale price text
  const [payType, setPayType] = useState('cash')
  const [paid, setPaid] = useState('')
  const [scan, setScan] = useState(false)
  const [newSup, setNewSup] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [lineErrors, setLineErrors] = useState({})
  const [done, setDone] = useState(null)
  const [toast, setToast] = useState('')
  const prefilled = useRef(false)

  const entries = catalog.entries
  const supplier = (suppliers || []).find((s) => s.id === supplierId) || null

  function lastCostOf(itemId) {
    const c = catalog.costs[itemId]
    return c?.lastCost ?? c?.avgCost ?? ''
  }

  function addLine(item, variant, qty = '1') {
    setLines((ls) => {
      const i = ls.findIndex((l) => l.variantId === variant.id)
      if (i >= 0) return ls.map((l, j) => (j === i ? { ...l, qty: String((Number(l.qty) || 0) + 1) } : l))
      const sameItem = ls.find((l) => l.itemId === item.id)
      return [
        ...ls,
        {
          key: variant.id,
          itemId: item.id,
          variantId: variant.id,
          item,
          variant,
          qty,
          unitCost: sameItem ? sameItem.unitCost : String(lastCostOf(item.id)),
        },
      ]
    })
  }

  // prefill from Low Stock (?low=1) or an item page (?item=ID)
  useEffect(() => {
    if (prefilled.current || !catalog.ready) return
    prefilled.current = true
    if (params.get('low')) catalog.lowList.forEach((e) => addLine(e.item, e.variant, ''))
    const itemId = params.get('item')
    if (itemId && catalog.itemById[itemId]) catalog.variantsOf(itemId).forEach((v) => addLine(catalog.itemById[itemId], v, ''))
  }, [catalog.ready])

  const supplierBox = useRef(null)
  const needSupplier = payType !== 'cash' && !supplier

  const update = (key, patch) => setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)))
  const remove = (key) => setLines((ls) => ls.filter((l) => l.key !== key))
  const total = round2(lines.reduce((s, l) => s + (Number(l.qty) || 0) * (Number(l.unitCost) || 0), 0))
  const paidNum = payType === 'cash' ? total : payType === 'credit' ? 0 : Math.min(Number(paid) || 0, total)
  const qtyOf = Object.fromEntries(lines.map((l) => [l.variantId, Number(l.qty) || 0]))
  const firstLineOfItem = new Set()

  function onScanned(code) {
    const hit = entries.find((e) => e.variant.code === code)
    if (hit) addLine(hit.item, hit.variant)
    else {
      setToast(`${t('barcodeNotFound')}: ${code}`)
      setTimeout(() => setToast(''), 2500)
    }
  }

  async function save() {
    setError('')
    const errs = {}
    // colours left with no quantity are simply skipped
    const buying = lines.filter((l) => Number(l.qty) >= 1)
    for (const l of buying) {
      if (l.unitCost === '' || Number(l.unitCost) < 0) errs[l.key] = t('enterCost')
    }
    setLineErrors(errs)
    if (!buying.length) return setError(t('addItemsToBuy'))
    if (Object.keys(errs).length) return setError(t('fixMarked'))
    if (payType !== 'cash' && !supplier) return setError(t('chooseSupplierForCredit'))
    if (!navigator.onLine) return setError(t('buyNeedsInternet'))

    const variantIdsByItem = {}
    for (const l of buying) variantIdsByItem[l.itemId] = catalog.variantsOf(l.itemId, true).map((v) => v.id)
    const priceUpdates = {}
    if (canPrice)
      for (const [itemId, p] of Object.entries(prices).filter(([id]) => buying.some((l) => l.itemId === id)))
        if (p !== '' && Number(p) > 0 && Number(p) !== catalog.itemById[itemId]?.price) priceUpdates[itemId] = Number(p)

    setBusy(true)
    try {
      const res = await recordPurchase({
        supplier,
        billNo,
        note,
        payType,
        paid,
        priceUpdates,
        variantIdsByItem,
        user: { uid: user.uid, name: displayName },
        lines: buying.map((l) => ({
          itemId: l.itemId,
          variantId: l.variantId,
          itemName: l.item.en,
          itemNameUr: l.item.ur || '',
          variantName: l.variant.en,
          variantNameUr: l.variant.ur || '',
          qty: Math.floor(Number(l.qty)),
          unitCost: Number(l.unitCost),
        })),
      })
      setDone(res)
    } catch (e) {
      setError(errorText(e, t))
    }
    setBusy(false)
  }

  function reset() {
    setLines([])
    setPrices({})
    setBillNo('')
    setNote('')
    setPaid('')
    setPayType('cash')
    setDone(null)
  }

  return (
    <div className="pb-40">
      <Page
        title={t('buy')}
        right={
          <Button size="sm" variant="secondary" className="me-1" onClick={() => navigate('/purchases')}>
            {t('history')}
          </Button>
        }
      >
        <div className="space-y-4">
          {/* supplier */}
          <Card className="space-y-4 p-4">
            <Field label={t('supplier')}>
              <div className="flex gap-2">
                <select
                  ref={supplierBox}
                  className={`field ${needSupplier ? 'border-warn' : ''}`}
                  value={supplierId}
                  onChange={(e) => setSupplierId(e.target.value)}
                >
                  <option value="">{t('noSupplier')}</option>
                  {(suppliers || []).map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                      {s.balance > 0 ? ` — ${t('owe')} Rs ${s.balance.toLocaleString('en-PK')}` : ''}
                    </option>
                  ))}
                </select>
                {can('manage_suppliers') && (
                  <IconButton icon="plus" label={t('newSupplier')} onClick={() => setNewSup(true)} className="rounded-xl border-[1.5px] border-line bg-white" />
                )}
              </div>
            </Field>
            <Field label={`${t('billNo')} (${t('optional')})`}>
              <input className="field latin" dir="ltr" value={billNo} onChange={(e) => setBillNo(e.target.value)} />
            </Field>
          </Card>

          {/* add items */}
          <div className="space-y-2">
            <ProductSearch entries={entries} qtyOf={qtyOf} onAdd={(item, variant) => addLine(item, variant)} />
            <Button variant="secondary" className="w-full" onClick={() => setScan(true)}>
              <Icon name="scan" size={20} /> {t('scanBarcode')}
            </Button>
            {toast && <Notice type="warn">{toast}</Notice>}
          </div>

          {lines.length === 0 && <EmptyState icon="truck" body={t('buyEmpty')} />}

          {/* lines */}
          <div className="space-y-3">
            {lines.map((l) => {
              const cost = catalog.costs[l.itemId]
              const multi = catalog.variantsOf(l.itemId, true).length > 1
              const liveStock = catalog.variantsOf(l.itemId, true).find((v) => v.id === l.variantId)?.stock ?? 0
              const showPrice = canPrice && !firstLineOfItem.has(l.itemId)
              firstLineOfItem.add(l.itemId)
              const salePrice = prices[l.itemId] ?? String(l.item.price ?? '')
              const lineTotal = (Number(l.qty) || 0) * (Number(l.unitCost) || 0)
              const loss = l.unitCost !== '' && Number(l.unitCost) >= Number(salePrice || l.item.price)
              return (
                <Card key={l.key} className={`p-4 ${lineErrors[l.key] ? 'border-danger' : ''}`}>
                  <div className="mb-3 flex items-start gap-3">
                    {l.variant.dot ? <Dot color={l.variant.dot} size={22} /> : <Icon name="package" size={22} className="text-muted" />}
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold leading-snug">
                        {pick(l.item)}
                        {multi && <span className="font-normal text-muted"> · {pick(l.variant)}</span>}
                      </div>
                      <div className="text-sm text-muted">
                        {t('inStock')} <span className="latin font-semibold text-ink">{liveStock}</span>
                        {canSeeCost && cost && (
                          <>
                            {' · '}
                            {t('lastCost')} <Rs value={cost.lastCost} className="font-semibold text-ink" />
                            {' · '}
                            {t('avgShort')} <Rs value={cost.avgCost} className="font-semibold text-ink" />
                          </>
                        )}
                      </div>
                    </div>
                    <IconButton icon="x" label={t('delete')} onClick={() => remove(l.key)} className="-me-2 -mt-2 text-muted" size={20} />
                  </div>
                  <div className="grid grid-cols-[1fr_1.3fr] gap-3">
                    <Field label={t('qty')}>
                      <input
                        className="field latin text-lg font-bold"
                        dir="ltr"
                        inputMode="numeric"
                        value={l.qty}
                        placeholder="0"
                        onChange={(e) => update(l.key, { qty: intOnly(e.target.value) })}
                      />
                    </Field>
                    <Field label={t('costEach')}>
                      <MoneyInput value={l.unitCost} onChange={(v) => update(l.key, { unitCost: v })} className="text-lg font-bold" />
                    </Field>
                  </div>
                  {showPrice && (
                    <div className="mt-3 grid grid-cols-[1fr_1.3fr] items-end gap-3">
                      <div className="pb-3 text-sm text-muted">{t('salePriceNow')}</div>
                      <Field label={t('salePrice')}>
                        <MoneyInput value={salePrice} onChange={(v) => setPrices((p) => ({ ...p, [l.itemId]: v }))} />
                      </Field>
                    </div>
                  )}
                  <div className="mt-3 flex items-center justify-between border-t border-line pt-2">
                    <span className={`text-sm ${loss || lineErrors[l.key] ? 'font-semibold text-danger' : 'text-muted'}`}>
                      {lineErrors[l.key] || (loss ? t('costAbovePrice') : !(Number(l.qty) >= 1) ? t('skippedNoQty') : '')}
                    </span>
                    <Rs value={lineTotal} className="text-lg font-bold" />
                  </div>
                </Card>
              )
            })}
          </div>

          {/* payment */}
          {lines.length > 0 && (
            <Card className="space-y-4 p-4">
              <div>
                <span className="mb-1.5 block text-sm font-semibold">{t('payment')}</span>
                <Segmented
                  value={payType}
                  onChange={setPayType}
                  options={[
                    { value: 'cash', label: t('paidFull') },
                    { value: 'partial', label: t('partial') },
                    { value: 'credit', label: t('onCredit') },
                  ]}
                />
                {needSupplier && (
                  <div className="mt-2">
                    <Notice type="warn">
                      {t('creditNeedsSupplier')}{' '}
                      <button
                        type="button"
                        className="cursor-pointer font-semibold underline"
                        onClick={() => {
                          supplierBox.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
                          supplierBox.current?.focus()
                        }}
                      >
                        {t('chooseSupplierNow')}
                      </button>
                    </Notice>
                  </div>
                )}
              </div>
              {payType === 'partial' && (
                <Field label={t('paidNow')}>
                  <MoneyInput value={paid} onChange={setPaid} />
                </Field>
              )}
              <Field label={`${t('note')} (${t('optional')})`}>
                <input className="field" value={note} onChange={(e) => setNote(e.target.value)} />
              </Field>
            </Card>
          )}
        </div>
      </Page>

      {/* sticky total + save */}
      <div className="safe-bottom fixed inset-x-0 bottom-0 z-30 border-t border-line bg-white shadow-[0_-4px_16px_rgba(0,0,0,.06)]">
        <div className="mx-auto max-w-3xl space-y-2 px-4 py-3">
          {error && <Notice>{error}</Notice>}
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <div className="text-sm text-muted">
                <span className="latin">{lines.filter((l) => Number(l.qty) >= 1).length}</span> {t('linesWord')}
                {payType !== 'cash' && total - paidNum > 0 && (
                  <span className="text-danger">
                    {' · '}
                    {t('due')} <Rs value={total - paidNum} />
                  </span>
                )}
              </div>
              <Rs value={total} className="text-2xl font-bold text-charcoal" />
            </div>
            <Button size="lg" onClick={save} disabled={busy || !lines.length} className="px-6">
              <Icon name="check" size={20} /> {busy ? t('saving') : t('savePurchase')}
            </Button>
          </div>
        </div>
      </div>

      <BarcodeScanner open={scan} onClose={() => setScan(false)} onResult={onScanned} />

      <Sheet open={newSup} title={t('newSupplier')} onClose={() => setNewSup(false)}>
        {newSup && (
          <NewSupplierForm
            onSaved={(id) => {
              setSupplierId(id)
              setNewSup(false)
            }}
          />
        )}
      </Sheet>

      <Sheet open={!!done} title={t('purchaseSaved')} onClose={reset}>
        {done && (
          <div className="space-y-4">
            <div className="flex flex-col items-center text-center">
              <div className="mb-2 flex h-16 w-16 items-center justify-center rounded-full bg-lime text-charcoal">
                <Icon name="check" size={34} strokeWidth={3} />
              </div>
              <Rs value={done.total} className="text-3xl font-bold text-charcoal" />
              {supplier && <div className="text-muted">{supplier.name}</div>}
            </div>
            <div className="space-y-1 rounded-2xl bg-paper p-4">
              <div className="flex justify-between">
                <span className="text-muted">{t('paidNowShort')}</span>
                <Rs value={done.paid} className="font-semibold" />
              </div>
              {done.due > 0 && (
                <div className="flex justify-between font-semibold text-danger">
                  <span>{t('addedToPayable')}</span>
                  <Rs value={done.due} />
                </div>
              )}
            </div>
            <p className="text-sm text-muted">{t('purchaseSavedBody')}</p>
            <div className="grid grid-cols-2 gap-3">
              <Button variant="secondary" size="lg" onClick={() => navigate(`/purchases/${done.id}`)}>
                {t('viewBill')}
              </Button>
              <Button size="lg" onClick={reset}>
                <Icon name="plus" size={20} /> {t('newPurchase')}
              </Button>
            </div>
          </div>
        )}
      </Sheet>
    </div>
  )
}
