import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useLang } from '../context/LangContext'
import { useCatalog } from '../lib/catalog'
import { matchScore, norm, tokenize } from '../lib/search'
import { UNITS } from '../lib/colors'
import { Badge, Button, EmptyState, IconButton, Page, Rs, Spinner } from '../components/ui'
import { DotStack, StockNumber } from '../components/ItemBits'
import Icon from '../components/Icon'

const chip = (active, tone = 'dark') =>
  `min-h-11 shrink-0 cursor-pointer rounded-full border-[1.5px] px-4 text-sm font-semibold transition-colors duration-150 ${
    active
      ? tone === 'dark'
        ? 'border-charcoal bg-charcoal text-white'
        : 'border-lime bg-lime text-charcoal'
      : 'border-line bg-white text-ink hover:border-charcoal-500'
  }`

export default function Items() {
  const { t, pick } = useLang()
  const { can } = useAuth()
  const navigate = useNavigate()
  const { ready, categories, subsOf, catById, items, variantsOf, itemStock, isLow } = useCatalog()
  const [q, setQ] = useState('')
  const [catId, setCatId] = useState('')
  const [subId, setSubId] = useState('')
  const [showHidden, setShowHidden] = useState(false)
  const canEdit = can('manage_items')

  const list = useMemo(() => {
    const query = norm(q)
    const tokens = tokenize(q)
    return items
      .filter((i) => (showHidden ? true : i.active !== false))
      .filter((i) => !catId || i.catId === catId)
      .filter((i) => !subId || i.subId === subId)
      .map((i) => {
        const vs = variantsOf(i.id)
        const s = matchScore(
          [i.en, i.ur],
          [...vs.flatMap((v) => [v.en, v.ur, v.barcode]), catById[i.catId]?.en, catById[i.catId]?.ur, catById[i.subId]?.en, catById[i.subId]?.ur],
          query,
          tokens,
          vs.map((v) => v.barcode),
        )
        return { i, vs, s }
      })
      .filter((r) => r.s >= 0)
      .sort((a, b) => b.s - a.s || (a.i.en || '').localeCompare(b.i.en || ''))
  }, [items, q, catId, subId, showHidden, variantsOf, catById])

  const lowCount = list.filter((r) => r.vs.some((v) => isLow(v, r.i))).length
  const subs = catId ? subsOf(catId) : []

  return (
    <Page
      title={t('itemsTitle')}
      right={
        canEdit && (
          <div className="flex items-center gap-1 pe-1">
            <IconButton icon="grid" label={t('categories')} onClick={() => navigate('/categories')} className="text-charcoal" />
            <Button size="sm" onClick={() => navigate(`/items/new${catId ? `?cat=${catId}${subId ? `&sub=${subId}` : ''}` : ''}`)}>
              <Icon name="plus" size={18} /> {t('addItem')}
            </Button>
          </div>
        )
      }
    >
      {/* search */}
      <div className="relative mb-3">
        <Icon name="search" size={22} className="pointer-events-none absolute inset-y-0 start-4 my-auto text-muted" />
        <input
          type="search"
          className="field min-h-14 rounded-2xl ps-12 pe-12 text-lg [&::-webkit-search-cancel-button]:hidden"
          placeholder={t('searchItems')}
          aria-label={t('searchItems')}
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        {q && (
          <IconButton icon="x" label={t('clearSearch')} onClick={() => setQ('')} className="absolute inset-y-0 end-1 my-auto text-muted" size={20} />
        )}
      </div>

      {/* category filter */}
      <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
        <button className={chip(!catId)} onClick={() => (setCatId(''), setSubId(''))}>
          {t('all')}
        </button>
        {categories.map((c) => (
          <button key={c.id} className={chip(catId === c.id)} onClick={() => (setCatId(c.id), setSubId(''))}>
            {pick(c)}
          </button>
        ))}
      </div>
      {subs.length > 0 && (
        <div className="no-scrollbar -mx-4 mt-2 flex gap-2 overflow-x-auto px-4 pb-1">
          {subs.map((s) => (
            <button key={s.id} className={chip(subId === s.id, 'lime')} onClick={() => setSubId(subId === s.id ? '' : s.id)}>
              {pick(s)}
            </button>
          ))}
        </div>
      )}

      {/* summary */}
      {ready && items.length > 0 && (
        <div className="mt-4 mb-2 flex items-center justify-between gap-2 text-sm text-muted">
          <span>
            <span className="latin font-semibold text-ink">{list.length}</span> {t('itemsWord')}
            {lowCount > 0 && (
              <>
                {' · '}
                <span className="font-semibold text-danger">
                  <span className="latin">{lowCount}</span> {t('lowWord')}
                </span>
              </>
            )}
          </span>
          {canEdit && (
            <button className="cursor-pointer font-semibold text-leaf underline-offset-2 hover:underline" onClick={() => setShowHidden((v) => !v)}>
              {showHidden ? t('hideHidden') : t('showHidden')}
            </button>
          )}
        </div>
      )}

      {!ready && (
        <div className="flex justify-center py-16">
          <Spinner />
        </div>
      )}

      {ready && items.length === 0 && (
        <EmptyState
          icon="package"
          title={t('noItems')}
          body={categories.length ? t('noItemsBody') : t('addCategoriesFirst')}
          action={
            canEdit &&
            (categories.length ? (
              <Button onClick={() => navigate('/items/new')}>
                <Icon name="plus" size={18} /> {t('addItem')}
              </Button>
            ) : (
              <Button onClick={() => navigate('/categories')}>{t('categories')}</Button>
            ))
          }
        />
      )}

      {ready && items.length > 0 && list.length === 0 && <EmptyState icon="search" body={t('noMatch')} />}

      <ul className="space-y-2.5">
        {list.map(({ i, vs }) => {
          const low = vs.some((v) => isLow(v, i))
          const hidden = i.active === false
          const unit = pick(UNITS.find((u) => u.key === i.unit) || UNITS[0])
          return (
            <li key={i.id}>
              <Link
                to={`/items/${i.id}`}
                className={`flex min-h-[76px] items-center gap-3 rounded-2xl border-[1.5px] bg-white px-4 py-3 transition-colors duration-150 hover:border-charcoal-500 active:bg-paper ${
                  low ? 'border-danger/40' : 'border-line'
                } ${hidden ? 'opacity-60' : ''}`}
              >
                <DotStack variants={vs} />
                <div className="min-w-0 flex-1">
                  <div className="line-clamp-2 font-semibold leading-snug">{pick(i)}</div>
                  <div className="flex flex-wrap items-center gap-x-2 text-sm text-muted">
                    <span className="truncate">
                      {pick(catById[i.catId] || {})} › {pick(catById[i.subId] || {})}
                    </span>
                    {vs.length > 1 && (
                      <span>
                        · <span className="latin">{vs.length}</span> {t('options')}
                      </span>
                    )}
                    {hidden && <Badge>{t('hiddenFromSell')}</Badge>}
                  </div>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-0.5">
                  <Rs value={i.price} className="font-bold text-charcoal" />
                  <span className="flex items-center gap-1 text-sm">
                    {low && <Icon name="alert" size={14} className="text-danger" />}
                    <StockNumber value={itemStock(i.id)} low={low} unit={unit} />
                  </span>
                </div>
              </Link>
            </li>
          )
        })}
      </ul>
    </Page>
  )
}
