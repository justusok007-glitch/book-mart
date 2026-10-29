import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useLang } from '../context/LangContext'
import { fetchMoves, useCatalog } from '../lib/catalog'
import { UNITS } from '../lib/colors'
import { Badge, Button, Card, EmptyState, Field, Notice, Page, Rs, SectionTitle, Segmented, Sheet, Spinner } from '../components/ui'
import { ADJUST_REASONS, adjustStock } from '../lib/purchasing'
import { Dot, StockNumber } from '../components/ItemBits'
import Icon from '../components/Icon'

const MOVE_LABEL = {
  opening: { en: 'Opening stock', ur: 'ابتدائی اسٹاک' },
  purchase: { en: 'Bought', ur: 'خریداری' },
  sale: { en: 'Sold', ur: 'فروخت' },
  return: { en: 'Returned', ur: 'واپسی' },
  adjust: { en: 'Adjusted', ur: 'ردوبدل' },
}

function fmtDate(ts) {
  const d = ts?.toDate?.()
  if (!d) return '…'
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) + ' ' + d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}

export default function ItemDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { t, pick } = useLang()
  const { can } = useAuth()
  const { ready, itemById, catById, variantsOf, itemStock, isLow, costs } = useCatalog()
  const item = itemById[id]
  const [moves, setMoves] = useState(null)
  const [adjusting, setAdjusting] = useState(false)

  // reload history whenever stock changes
  const stockKey = item ? itemStock(id) : 0
  useEffect(() => {
    let live = true
    fetchMoves(id)
      .then((m) => live && setMoves(m))
      .catch(() => live && setMoves([]))
    return () => {
      live = false
    }
  }, [id, stockKey])

  if (!ready)
    return (
      <Page title={t('itemsTitle')}>
        <div className="flex justify-center py-16">
          <Spinner />
        </div>
      </Page>
    )
  if (!item)
    return (
      <Page title={t('itemsTitle')}>
        <EmptyState icon="package" body={t('itemNotFound')} />
      </Page>
    )

  const all = variantsOf(id, true)
  const unit = pick(UNITS.find((u) => u.key === item.unit) || UNITS[0])
  const cost = costs[id]
  const vName = Object.fromEntries(all.map((v) => [v.id, pick(v)]))
  const multi = all.length > 1 || (all[0] && all[0].en !== 'Standard')

  return (
    <Page
      title={pick(item)}
      right={
        can('manage_items') && (
          <Button size="sm" variant="secondary" className="me-1" onClick={() => navigate(`/items/${id}/edit`)}>
            <Icon name="pencil" size={16} /> {t('edit')}
          </Button>
        )
      }
    >
      <div className="space-y-5">
        {item.active === false && <Badge tone="danger">{t('hiddenFromSell')}</Badge>}

        {/* summary */}
        <Card className="p-5">
          <div className="text-sm text-muted">
            {pick(catById[item.catId] || {})} › {pick(catById[item.subId] || {})}
          </div>
          <h2 className="mt-1 text-xl font-bold text-charcoal">{pick(item)}</h2>
          {item.ur && item.en && <div className="text-muted">{pick({ en: item.ur, ur: item.en })}</div>}

          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-lime-50 p-3">
              <div className="text-sm font-semibold text-muted">{t('salePrice')}</div>
              <div>
                <Rs value={item.price} className="text-2xl font-bold text-charcoal" />
                <span className="ms-1 text-sm text-muted">/ {unit}</span>
              </div>
            </div>
            <div className="rounded-xl bg-paper p-3">
              <div className="text-sm font-semibold text-muted">{t('inStock')}</div>
              <div className="text-2xl">
                <StockNumber value={itemStock(id)} unit={unit} />
              </div>
            </div>
            {can('view_cost_price') && (
              <>
                <div className="rounded-xl bg-paper p-3">
                  <div className="text-sm font-semibold text-muted">{t('avgCost')}</div>
                  {cost ? <Rs value={cost.avgCost} className="text-lg font-bold" /> : <span className="text-muted">—</span>}
                </div>
                <div className="rounded-xl bg-paper p-3">
                  <div className="text-sm font-semibold text-muted">{t('lastCost')}</div>
                  {cost ? <Rs value={cost.lastCost} className="text-lg font-bold" /> : <span className="text-muted">—</span>}
                </div>
              </>
            )}
          </div>
          <p className="mt-3 text-sm text-muted">
            {t('lowStockLimit')}: <span className="latin font-semibold text-ink">{item.lowStock ?? 0}</span>
          </p>
        </Card>

        {/* stock per colour/type */}
        <section>
          <SectionTitle>{multi ? t('stockByType') : t('stockAndBarcode')}</SectionTitle>
          <Card className="overflow-hidden">
            <ul>
              {all.map((v) => {
                const low = isLow(v, item)
                const hidden = v.active === false
                return (
                  <li key={v.id} className={`flex min-h-16 items-center gap-3 border-b border-line/70 px-4 py-2 last:border-0 ${hidden ? 'opacity-55' : ''}`}>
                    {v.dot ? <Dot color={v.dot} size={24} /> : <Icon name="package" size={22} className="text-muted" />}
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold">
                        {multi ? pick(v) : t('standardType')}
                        {hidden && <span className="ms-2 text-sm font-normal text-muted">({t('hiddenFromSell')})</span>}
                      </div>
                      <div className="latin truncate text-sm text-muted" dir="ltr">
                        {v.barcode || t('noBarcode')}
                      </div>
                    </div>
                    {low && !hidden && <Badge tone="danger">{t('lowWord')}</Badge>}
                    <span className="text-xl">
                      <StockNumber value={v.stock ?? 0} low={low && !hidden} />
                    </span>
                  </li>
                )
              })}
            </ul>
          </Card>
          <p className="mt-2 text-sm text-muted">{t('stockChangesNote')}</p>
          {(can('buy') || can('stock_adjust')) && (
            <div className="mt-3 grid grid-cols-2 gap-3">
              {can('buy') && (
                <Button variant="accent" onClick={() => navigate(`/buy?item=${id}`)}>
                  <Icon name="truck" size={18} /> {t('buyMore')}
                </Button>
              )}
              {can('stock_adjust') && (
                <Button variant="secondary" onClick={() => setAdjusting(true)}>
                  <Icon name="sliders" size={18} /> {t('adjustStock')}
                </Button>
              )}
            </div>
          )}
        </section>

        {/* history */}
        <section>
          <SectionTitle>{t('stockHistory')}</SectionTitle>
          {moves === null ? (
            <div className="flex justify-center py-6">
              <Spinner />
            </div>
          ) : moves.length === 0 ? (
            <p className="text-muted">{t('noHistory')}</p>
          ) : (
            <Card className="overflow-hidden">
              <ul>
                {moves.map((m) => (
                  <li key={m.id} className="flex min-h-14 items-center gap-3 border-b border-line/70 px-4 py-2 last:border-0">
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold">
                        {pick(MOVE_LABEL[m.type] || { en: m.type, ur: m.type })}
                        {multi && vName[m.variantId] && <span className="font-normal text-muted"> · {vName[m.variantId]}</span>}
                      </div>
                      <div className="text-sm text-muted">
                        <span className="latin">{fmtDate(m.at)}</span>
                        {m.byName && <> · {m.byName}</>}
                        {m.reason && <> · {pick(ADJUST_REASONS.find((r) => r.key === m.reason) || { en: m.reason })}</>}
                        {m.note && <> · {m.note}</>}
                      </div>
                    </div>
                    <span className={`latin text-lg font-bold ${m.qty < 0 ? 'text-danger' : 'text-leaf'}`} dir="ltr">
                      {m.qty > 0 ? '+' : ''}
                      {m.qty}
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </section>
      </div>
      <Sheet open={adjusting} title={t('adjustStock')} onClose={() => setAdjusting(false)}>
        {adjusting && <AdjustForm item={item} variants={all.filter((v) => v.active !== false)} multi={multi} onDone={() => setAdjusting(false)} />}
      </Sheet>
    </Page>
  )
}

function AdjustForm({ item, variants, multi, onDone }) {
  const { t, pick } = useLang()
  const { user, displayName } = useAuth()
  const [variantId, setVariantId] = useState(variants[0]?.id || '')
  const [dir, setDir] = useState('remove')
  const [qty, setQty] = useState('')
  const [reason, setReason] = useState('damaged')
  const [note, setNote] = useState('')
  const [error, setError] = useState('')
  const v = variants.find((x) => x.id === variantId)
  const n = Math.floor(Number(qty) || 0)
  const after = (v?.stock ?? 0) + (dir === 'add' ? n : -n)

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault()
        if (!v || n < 1) return setError(t('enterQty'))
        adjustStock({ itemId: item.id, variantId: v.id, delta: dir === 'add' ? n : -n, reason, note, user: { uid: user.uid, name: displayName } })
        onDone()
      }}
    >
      {multi && (
        <Field label={t('colourType')}>
          <select className="field" value={variantId} onChange={(e) => setVariantId(e.target.value)}>
            {variants.map((x) => (
              <option key={x.id} value={x.id}>
                {pick(x)} — {x.stock ?? 0}
              </option>
            ))}
          </select>
        </Field>
      )}
      <Segmented
        value={dir}
        onChange={(d) => {
          setDir(d)
          setReason(d === 'add' ? 'found' : 'damaged')
        }}
        options={[
          { value: 'remove', label: t('removeStock') },
          { value: 'add', label: t('addStock') },
        ]}
      />
      <Field label={t('qty')}>
        <input
          className="field latin text-lg font-bold"
          dir="ltr"
          inputMode="numeric"
          value={qty}
          placeholder="0"
          autoFocus
          onChange={(e) => setQty(e.target.value.replace(/[^\d]/g, ''))}
        />
      </Field>
      <Field label={t('reason')}>
        <select className="field" value={reason} onChange={(e) => setReason(e.target.value)}>
          {ADJUST_REASONS.map((r) => (
            <option key={r.key} value={r.key}>
              {pick(r)}
            </option>
          ))}
        </select>
      </Field>
      <Field label={`${t('note')} (${t('optional')})`}>
        <input className="field" value={note} onChange={(e) => setNote(e.target.value)} />
      </Field>
      <div className="flex items-center justify-between rounded-xl bg-paper px-4 py-3">
        <span className="text-muted">{t('stockAfter')}</span>
        <span className={`latin text-xl font-bold ${after < 0 ? 'text-danger' : ''}`}>
          {v?.stock ?? 0} → {after}
        </span>
      </div>
      <p className="text-sm text-muted">{t('adjustNote')}</p>
      <Notice>{error}</Notice>
      <Button type="submit" size="lg" className="w-full">
        <Icon name="check" size={20} /> {t('saveAdjustment')}
      </Button>
    </form>
  )
}
