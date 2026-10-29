import { Link } from 'react-router-dom'
import { useLang } from '../context/LangContext'
import { useCatalog } from '../lib/catalog'
import { Badge, EmptyState, Page, Spinner } from '../components/ui'
import { Dot, StockNumber } from '../components/ItemBits'
import Icon from '../components/Icon'

export default function LowStock() {
  const { t, pick } = useLang()
  const { ready, lowList } = useCatalog()

  return (
    <Page title={t('lowStock')}>
      {!ready && (
        <div className="flex justify-center py-16">
          <Spinner />
        </div>
      )}
      {ready && lowList.length === 0 && <EmptyState icon="checkCircle" title={t('allStocked')} body={t('allStockedBody')} />}
      {ready && lowList.length > 0 && (
        <>
          <p className="mb-3 text-muted">
            <span className="latin font-semibold text-danger">{lowList.length}</span> {t('lowStockIntro')}
          </p>
          <ul className="space-y-2.5">
            {lowList.map(({ item, variant, cat, sub }) => {
              const out = (variant.stock ?? 0) <= 0
              const multi = variant.en !== 'Standard'
              return (
                <li key={variant.id}>
                  <Link
                    to={`/items/${item.id}`}
                    className="flex min-h-[72px] items-center gap-3 rounded-2xl border-[1.5px] border-danger/30 bg-white px-4 py-3 transition-colors duration-150 hover:border-danger active:bg-paper"
                  >
                    {variant.dot ? <Dot color={variant.dot} size={24} /> : <Icon name="package" size={22} className="text-muted" />}
                    <div className="min-w-0 flex-1">
                      <div className="line-clamp-2 font-semibold leading-snug">
                        {pick(item)}
                        {multi && <span className="font-normal text-muted"> · {pick(variant)}</span>}
                      </div>
                      <div className="truncate text-sm text-muted">
                        {pick(cat)} › {pick(sub)} · {t('limit')} <span className="latin">{item.lowStock ?? 0}</span>
                      </div>
                    </div>
                    {out && <Badge tone="danger">{t('outOfStock')}</Badge>}
                    <span className="text-2xl">
                      <StockNumber value={variant.stock ?? 0} low />
                    </span>
                  </Link>
                </li>
              )
            })}
          </ul>
        </>
      )}
    </Page>
  )
}
