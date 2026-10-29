import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useLang } from '../context/LangContext'
import { BarcodeTakenError, generateBarcode, saveItem, useCatalog } from '../lib/catalog'
import { COLOR_PRESETS, UNITS } from '../lib/colors'
import { Button, Card, EmptyState, Field, IconButton, Notice, Page, Rs, Sheet, Spinner, Toggle } from '../components/ui'
import BarcodeScanner from '../components/BarcodeScanner'
import Icon from '../components/Icon'

const BARCODE_RE = /^[A-Za-z0-9-]{4,32}$/
const STANDARD = { en: 'Standard', ur: 'عام' }
let keySeq = 0
const newKey = () => `r${++keySeq}`

function Section({ title, hint, children, right }) {
  return (
    <Card className="p-4 sm:p-5">
      <div className="mb-4 flex items-start justify-between gap-2">
        <div>
          <h2 className="text-lg font-bold text-charcoal">{title}</h2>
          {hint && <p className="text-sm text-muted">{hint}</p>}
        </div>
        {right}
      </div>
      <div className="space-y-4">{children}</div>
    </Card>
  )
}

const numInput = (v) => v.replace(/[^\d.]/g, '').replace(/(\..*)\./g, '$1')
const intInput = (v) => v.replace(/[^\d]/g, '')

function BarcodeField({ value, onChange, onScan, error, showHint }) {
  const { t } = useLang()
  const [busy, setBusy] = useState(false)
  const [genError, setGenError] = useState('')
  async function gen() {
    setGenError('')
    if (!navigator.onLine) return setGenError(t('needsInternet'))
    setBusy(true)
    try {
      onChange(await generateBarcode())
    } catch {
      setGenError(t('somethingWrong'))
    }
    setBusy(false)
  }
  return (
    <Field label={t('barcode')} hint={showHint ? t('barcodeHint') : undefined} error={error || genError}>
      <div className="flex gap-2">
        <input
          className="field latin min-w-0 flex-1"
          dir="ltr"
          inputMode="text"
          autoCapitalize="none"
          autoCorrect="off"
          value={value || ''}
          placeholder="—"
          onChange={(e) => onChange(e.target.value.trim())}
        />
        <IconButton icon="scan" label={t('scanBarcode')} onClick={onScan} className="rounded-xl border-[1.5px] border-line bg-white" />
        <Button type="button" variant="secondary" onClick={gen} disabled={busy} className="shrink-0 px-3">
          {busy ? '…' : t('newCode')}
        </Button>
      </div>
    </Field>
  )
}

export default function ItemForm() {
  const { id } = useParams()
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const { t, pick } = useLang()
  const { user, displayName, can } = useAuth()
  const { ready, categories, subsOf, itemById, variantsOf, costs } = useCatalog()
  const editing = !!id
  const existing = editing ? itemById[id] : null
  const originalVariants = useMemo(() => (editing ? variantsOf(id, true) : []), [editing, id, variantsOf])
  const showCost = can('view_cost_price')

  // --- state (initialised once the catalog is ready) ---
  const initDone = useRef(false)
  const [form, setForm] = useState(null)
  const [rows, setRows] = useState([])
  const [hasTypes, setHasTypes] = useState(false)
  const [cost, setCost] = useState('')
  const [scanFor, setScanFor] = useState(null)
  const [dotFor, setDotFor] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [rowErrors, setRowErrors] = useState({})

  useEffect(() => {
    if (initDone.current || !ready || (editing && !existing)) return

    initDone.current = true
    if (editing) {
      setForm({
        catId: existing.catId,
        subId: existing.subId,
        en: existing.en,
        ur: existing.ur || '',
        price: String(existing.price ?? ''),
        unit: existing.unit || 'pc',
        lowStock: String(existing.lowStock ?? 0),
        active: existing.active !== false,
      })
      const r = originalVariants.map((v) => ({ key: newKey(), id: v.id, en: v.en, ur: v.ur || '', dot: v.dot, barcode: v.barcode || '', stock: v.stock || 0, active: v.active !== false }))
      setRows(r)
      setHasTypes(r.length > 1 || (r[0] && r[0].en !== STANDARD.en))
    } else {
      const catId = params.get('cat') || ''
      setForm({ catId, subId: params.get('sub') || '', en: '', ur: '', price: '', unit: 'pc', lowStock: '5', active: true })
      setRows([{ key: newKey(), ...STANDARD, dot: null, barcode: '', opening: '', active: true }])
    }
  }, [ready, editing, existing, originalVariants, params])

  if (!form) {
    return (
      <Page title={editing ? t('editItem') : t('addItem')}>
        {ready && editing && !existing ? (
          <EmptyState icon="package" body={t('itemNotFound')} />
        ) : (
          <div className="flex justify-center py-16">
            <Spinner />
          </div>
        )}
      </Page>
    )
  }

  if (categories.length === 0) {
    return (
      <Page title={t('addItem')}>
        <EmptyState
          icon="grid"
          title={t('noCategories')}
          body={t('addCategoriesFirst')}
          action={<Button onClick={() => navigate('/categories')}>{t('categories')}</Button>}
        />
      </Page>
    )
  }

  const set = (k) => (v) => setForm((f) => ({ ...f, [k]: v }))
  const subs = form.catId ? subsOf(form.catId) : []
  const updateRow = (key, patch) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)))
  const removeRow = (key) => setRows((rs) => rs.filter((r) => r.key !== key))
  const activeRows = rows.filter((r) => r.active !== false)

  function toggleTypes(on) {
    if (on) {
      setHasTypes(true)
      // a brand-new default "Standard" row is replaced by the colours they pick
      setRows((rs) => (rs.length === 1 && !rs[0].id && rs[0].en === STANDARD.en ? [] : rs))
    } else {
      if (rows.length > 1) return setError(t('removeTypesFirst'))
      setHasTypes(false)
      setRows((rs) => (rs.length ? [{ ...rs[0], ...(rs[0].id ? {} : STANDARD) }] : [{ key: newKey(), ...STANDARD, dot: null, barcode: '', opening: '', active: true }]))
    }
  }

  function addPreset(p) {
    if (rows.some((r) => r.en.toLowerCase() === p.en.toLowerCase())) return
    setRows((rs) => [...rs, { key: newKey(), en: p.en, ur: p.ur, dot: p.dot, barcode: '', opening: '', active: true }])
  }

  function addCustom() {
    setRows((rs) => [...rs, { key: newKey(), en: '', ur: '', dot: null, barcode: '', opening: '', active: true }])
  }

  function validate() {
    const errs = {}
    if (!form.catId || !form.subId || !form.en.trim() || !(Number(form.price) > 0)) return [t('fillItemRequired'), errs]
    if (activeRows.length === 0) return [t('needOneType'), errs]
    const names = new Set()
    const codes = new Map()
    for (const r of rows) {
      const name = r.en.trim().toLowerCase()
      if (!name) errs[r.key] = { name: t('fillRequired') }
      else if (names.has(name)) errs[r.key] = { name: t('duplicateName') }
      names.add(name)
      const code = (r.barcode || '').trim()
      if (code) {
        if (!BARCODE_RE.test(code)) errs[r.key] = { ...errs[r.key], barcode: t('barcodeInvalid') }
        else if (codes.has(code)) errs[r.key] = { ...errs[r.key], barcode: t('barcodeRepeated') }
        codes.set(code, r.key)
      }
    }
    if (Object.keys(errs).length) return [t('fixMarked'), errs]
    return [null, errs]
  }

  async function save() {
    const [msg, errs] = validate()
    setRowErrors(errs)
    setError(msg || '')
    if (msg) return
    if (!navigator.onLine) return setError(t('itemNeedsInternet'))
    setBusy(true)
    try {
      const newId = await saveItem({
        itemId: editing ? id : null,
        item: form,
        rows,
        cost: !editing && showCost ? cost : null,
        original: originalVariants,
        user: { uid: user.uid, name: displayName },
      })
      navigate(`/items/${newId}`, { replace: true })
    } catch (e) {
      setBusy(false)
      if (e instanceof BarcodeTakenError) {
        const row = rows.find((r) => (r.barcode || '').trim() === e.barcode)
        if (row) setRowErrors({ [row.key]: { barcode: t('barcodeTaken') } })
        setError(`${t('barcodeTaken')} (${e.barcode})`)
      } else setError(t('somethingWrong') + (e?.code ? ` (${e.code})` : ''))
    }
  }

  const unitLabel = pick(UNITS.find((u) => u.key === form.unit) || UNITS[0])

  return (
    <div className="pb-28">
      <Page title={editing ? t('editItem') : t('addItem')}>
        <div className="space-y-4">
          {/* 1. Where it goes */}
          <Section title={t('category')}>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t('mainCategory')}>
                <select
                  className="field"
                  value={form.catId}
                  onChange={(e) => setForm((f) => ({ ...f, catId: e.target.value, subId: '' }))}
                >
                  <option value="">{t('choose')}</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {pick(c)}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label={t('subCategory')}>
                <select className="field" value={form.subId} onChange={(e) => set('subId')(e.target.value)} disabled={!form.catId}>
                  <option value="">{t('choose')}</option>
                  {subs.map((s) => (
                    <option key={s.id} value={s.id}>
                      {pick(s)}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            {form.catId && subs.length === 0 && (
              <Notice type="warn">
                {t('noSubsYet')}{' '}
                <button type="button" className="cursor-pointer font-semibold underline" onClick={() => navigate('/categories')}>
                  {t('categories')}
                </button>
              </Notice>
            )}
          </Section>

          {/* 2. Name & price */}
          <Section title={t('itemDetails')} hint={t('itemDetailsHint')}>
            <Field label={t('nameEn')}>
              <input className="field latin" dir="ltr" value={form.en} onChange={(e) => set('en')(e.target.value)} placeholder="Ball Pen 0.7mm" />
            </Field>
            <Field label={t('nameUr')}>
              <input className="field font-urdu" dir="rtl" value={form.ur} onChange={(e) => set('ur')(e.target.value)} placeholder="بال پین" />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label={t('salePrice')}>
                <div className="relative">
                  <span className="latin pointer-events-none absolute inset-y-0 start-0 flex items-center ps-4 text-muted" dir="ltr">
                    Rs
                  </span>
                  <input className="field latin ps-12 text-lg font-bold" dir="ltr" inputMode="decimal" value={form.price} onChange={(e) => set('price')(numInput(e.target.value))} placeholder="0" />
                </div>
              </Field>
              <Field label={t('unit')}>
                <select className="field" value={form.unit} onChange={(e) => set('unit')(e.target.value)}>
                  {UNITS.map((u) => (
                    <option key={u.key} value={u.key}>
                      {pick(u)}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            <Field label={t('lowStockLimit')} hint={t('lowStockHint')}>
              <input className="field latin" dir="ltr" inputMode="numeric" value={form.lowStock} onChange={(e) => set('lowStock')(intInput(e.target.value))} />
            </Field>
            {showCost &&
              (editing ? (
                <div className="rounded-xl bg-paper px-4 py-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted">{t('avgCost')}</span>
                    <Rs value={costs[id]?.avgCost ?? 0} className="font-semibold" />
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted">{t('lastCost')}</span>
                    <Rs value={costs[id]?.lastCost ?? 0} className="font-semibold" />
                  </div>
                  <p className="mt-1 text-muted">{t('costChangesViaBuy')}</p>
                </div>
              ) : (
                <Field label={`${t('costPrice')} (${t('optional')})`} hint={t('costPriceHint')}>
                  <div className="relative">
                    <span className="latin pointer-events-none absolute inset-y-0 start-0 flex items-center ps-4 text-muted" dir="ltr">
                      Rs
                    </span>
                    <input className="field latin ps-12" dir="ltr" inputMode="decimal" value={cost} onChange={(e) => setCost(numInput(e.target.value))} placeholder="0" />
                  </div>
                </Field>
              ))}
          </Section>

          {/* 3. Colours / types with the same price */}
          <Section
            title={t('typesTitle')}
            hint={
              <>
                {t('typesHint')} <Rs value={form.price || 0} /> / {unitLabel}
              </>
            }
          >
            <label className="flex min-h-14 cursor-pointer items-center justify-between gap-3 rounded-xl border border-line bg-paper/60 ps-4 pe-1">
              <span className="font-semibold">{t('hasTypes')}</span>
              <Toggle checked={hasTypes} onChange={toggleTypes} label={t('hasTypes')} />
            </label>

            {hasTypes && (
              <div>
                <div className="mb-2 text-sm font-semibold text-muted">{t('quickColours')}</div>
                <div className="flex flex-wrap gap-2">
                  {COLOR_PRESETS.map((p) => {
                    const used = rows.some((r) => r.en.toLowerCase() === p.en.toLowerCase())
                    return (
                      <button
                        key={p.en}
                        type="button"
                        disabled={used}
                        onClick={() => addPreset(p)}
                        className="flex min-h-11 cursor-pointer items-center gap-2 rounded-full border-[1.5px] border-line bg-white ps-2 pe-3.5 text-sm font-semibold transition-colors duration-150 hover:border-charcoal-500 disabled:cursor-default disabled:opacity-35"
                      >
                        <span className="h-6 w-6 rounded-full border border-black/15" style={{ background: p.dot }} aria-hidden="true" />
                        {pick(p)}
                        {used ? <Icon name="check" size={14} /> : <Icon name="plus" size={14} />}
                      </button>
                    )
                  })}
                  <button
                    type="button"
                    onClick={addCustom}
                    className="flex min-h-11 cursor-pointer items-center gap-1.5 rounded-full border-[1.5px] border-dashed border-charcoal-500 px-4 text-sm font-semibold text-charcoal hover:bg-paper"
                  >
                    <Icon name="plus" size={16} /> {t('customType')}
                  </button>
                </div>
              </div>
            )}

            {hasTypes && rows.length === 0 && <Notice type="info">{t('pickColoursAbove')}</Notice>}

            <div className="space-y-3">
              {rows.map((r, idx) => {
                const errs = rowErrors[r.key] || {}
                const hidden = r.active === false
                return (
                  <div key={r.key} className={`rounded-2xl border-[1.5px] p-4 ${hidden ? 'border-line bg-paper opacity-70' : 'border-line bg-white'}`}>
                    {hasTypes && (
                      <div className="mb-3 flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setDotFor(r.key)}
                          aria-label={t('pickColour')}
                          className="flex h-12 w-12 shrink-0 cursor-pointer items-center justify-center rounded-xl border-[1.5px] border-line hover:border-charcoal-500"
                        >
                          {r.dot ? (
                            <span className="h-7 w-7 rounded-full border border-black/15" style={{ background: r.dot }} />
                          ) : (
                            <Icon name="package" size={20} className="text-muted" />
                          )}
                        </button>
                        <div className="grid min-w-0 flex-1 grid-cols-2 gap-2">
                          <input
                            className={`field latin ${errs.name ? 'border-danger' : ''}`}
                            dir="ltr"
                            aria-label={t('nameEn')}
                            placeholder={t('typeNameEn')}
                            value={r.en}
                            onChange={(e) => updateRow(r.key, { en: e.target.value })}
                          />
                          <input
                            className="field font-urdu"
                            dir="rtl"
                            aria-label={t('nameUr')}
                            placeholder={t('typeNameUr')}
                            value={r.ur}
                            onChange={(e) => updateRow(r.key, { ur: e.target.value })}
                          />
                        </div>
                        {!r.id && <IconButton icon="trash" label={t('delete')} onClick={() => removeRow(r.key)} className="text-danger" size={18} />}
                      </div>
                    )}
                    {errs.name && <p className="-mt-1 mb-2 text-sm font-medium text-danger">{errs.name}</p>}

                    <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
                      <BarcodeField
                        value={r.barcode}
                        error={errs.barcode}
                        showHint={idx === 0}
                        onChange={(v) => updateRow(r.key, { barcode: v })}
                        onScan={() => setScanFor(r.key)}
                      />
                      {r.id ? (
                        <div className="sm:w-36">
                          <span className="mb-1.5 block text-sm font-semibold">{t('inStock')}</span>
                          <div className="latin flex min-h-12 items-center rounded-xl bg-paper px-4 text-lg font-bold">{r.stock}</div>
                        </div>
                      ) : (
                        <div className="sm:w-36">
                          <Field label={t('openingStock')}>
                            <input
                              className="field latin text-lg font-bold"
                              dir="ltr"
                              inputMode="numeric"
                              value={r.opening}
                              placeholder="0"
                              onChange={(e) => updateRow(r.key, { opening: intInput(e.target.value) })}
                            />
                          </Field>
                        </div>
                      )}
                    </div>

                    {r.id && hasTypes && (
                      <label className="mt-3 flex cursor-pointer items-center justify-between gap-2 border-t border-line pt-2">
                        <span className="text-sm font-semibold">{hidden ? t('hiddenFromSell') : t('showInSell')}</span>
                        <Toggle checked={!hidden} onChange={(on) => updateRow(r.key, { active: on })} label={t('showInSell')} />
                      </label>
                    )}
                  </div>
                )
              })}
            </div>
          </Section>

          {/* 4. Show / hide whole item */}
          {editing && (
            <Card className="flex items-center justify-between gap-3 py-2 ps-4 pe-1">
              <div>
                <div className="font-semibold">{form.active ? t('showInSell') : t('hiddenFromSell')}</div>
                <div className="text-sm text-muted">{t('hideItemHint')}</div>
              </div>
              <Toggle checked={form.active} onChange={set('active')} label={t('showInSell')} />
            </Card>
          )}
        </div>
      </Page>

      {/* sticky save bar */}
      <div className="safe-bottom fixed inset-x-0 bottom-0 z-30 border-t border-line bg-white">
        <div className="mx-auto max-w-3xl space-y-2 px-4 py-3">
          {error && <Notice>{error}</Notice>}
          <div className="flex gap-3">
            <Button variant="secondary" size="lg" onClick={() => navigate(-1)} disabled={busy}>
              {t('cancel')}
            </Button>
            <Button size="lg" className="flex-1" onClick={save} disabled={busy}>
              {busy ? t('saving') : t('saveItem')}
            </Button>
          </div>
        </div>
      </div>

      <BarcodeScanner
        open={!!scanFor}
        onClose={() => setScanFor(null)}
        onResult={(code) => scanFor && updateRow(scanFor, { barcode: code })}
      />

      <Sheet open={!!dotFor} title={t('pickColour')} onClose={() => setDotFor(null)}>
        <div className="grid grid-cols-4 gap-3">
          <button
            type="button"
            onClick={() => {
              updateRow(dotFor, { dot: null })
              setDotFor(null)
            }}
            className="flex min-h-20 cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-[1.5px] border-line text-xs font-semibold hover:border-charcoal-500"
          >
            <Icon name="x" size={22} className="text-muted" />
            {t('noColour')}
          </button>
          {COLOR_PRESETS.map((p) => (
            <button
              key={p.en}
              type="button"
              onClick={() => {
                updateRow(dotFor, { dot: p.dot })
                setDotFor(null)
              }}
              className="flex min-h-20 cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-[1.5px] border-line text-xs font-semibold hover:border-charcoal-500"
            >
              <span className="h-8 w-8 rounded-full border border-black/15" style={{ background: p.dot }} />
              {pick(p)}
            </button>
          ))}
        </div>
      </Sheet>
    </div>
  )
}
