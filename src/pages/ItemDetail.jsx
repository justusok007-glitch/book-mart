import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useLang } from '../context/LangContext'
import { fetchMoves, useCatalog } from '../lib/catalog'
import { UNITS } from '../lib/colors'
import { Badge, Button, Card, EmptyState, Page, Rs, SectionTitle, Spinner } from '../components/ui'
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
    </Page>
  )
}
