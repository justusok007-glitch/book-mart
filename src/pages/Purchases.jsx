import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useLang } from '../context/LangContext'
import { useCatalog } from '../lib/catalog'
import { fetchPurchase, fetchPurchases } from '../lib/purchasing'
import { fmtDate } from '../lib/format'
import { Badge, Button, Card, EmptyState, Page, Rs, SectionTitle, Spinner } from '../components/ui'
import { Dot } from '../components/ItemBits'
import Icon from '../components/Icon'

export function PurchasesList() {
  const { t } = useLang()
  const navigate = useNavigate()
  const { can } = useAuth()
  const [list, setList] = useState(null)

  useEffect(() => {
    fetchPurchases()
      .then(setList)
      .catch(() => setList([]))
  }, [])

  return (
    <Page
      title={t('purchases')}
      right={
        can('buy') && (
          <Button size="sm" className="me-1" onClick={() => navigate('/buy')}>
            <Icon name="plus" size={18} /> {t('buy')}
          </Button>
        )
      }
    >
      {list === null ? (
        <div className="flex justify-center py-16">
          <Spinner />
        </div>
      ) : list.length === 0 ? (
        <EmptyState icon="receipt" body={t('noPurchases')} />
      ) : (
        <ul className="space-y-2.5">
          {list.map((p) => (
            <li key={p.id}>
              <Link
                to={`/purchases/${p.id}`}
                className="flex min-h-[72px] items-center gap-3 rounded-2xl border-[1.5px] border-line bg-white px-4 py-3 transition-colors duration-150 hover:border-charcoal-500 active:bg-paper"
              >
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-lime-100 text-charcoal">
                  <Icon name="truck" size={22} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-semibold">
                    {p.supplierName || t('noSupplierShort')}
                    {p.billNo && <span className="latin font-normal text-muted"> #{p.billNo}</span>}
                  </div>
                  <div className="truncate text-sm text-muted">
                    <span className="latin">{fmtDate(p.at)}</span> · <span className="latin">{p.lines?.length || 0}</span> {t('linesWord')}
                  </div>
                </div>
                <div className="text-end">
                  <Rs value={p.total} className="font-bold" />
                  {p.due > 0 && (
                    <div className="text-xs font-semibold text-danger">
                      {t('due')} <Rs value={p.due} />
                    </div>
                  )}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Page>
  )
}

export function PurchaseDetail() {
  const { id } = useParams()
  const { t, pick } = useLang()
  const { variants } = useCatalog()
  const [p, setP] = useState(undefined)

  useEffect(() => {
    fetchPurchase(id)
      .then(setP)
      .catch(() => setP(null))
  }, [id])

  if (p === undefined)
    return (
      <Page title={t('purchase')}>
        <div className="flex justify-center py-16">
          <Spinner />
        </div>
      </Page>
    )
  if (!p)
    return (
      <Page title={t('purchase')}>
        <EmptyState icon="receipt" body={t('notFound')} />
      </Page>
    )

  const dotOf = Object.fromEntries(variants.map((v) => [v.id, v.dot]))
  return (
    <Page title={t('purchase')}>
      <div className="space-y-5">
        <Card className="p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              {p.supplierId ? (
                <Link to={`/suppliers/${p.supplierId}`} className="text-lg font-bold text-leaf underline-offset-2 hover:underline">
                  {p.supplierName}
                </Link>
              ) : (
                <div className="text-lg font-bold">{t('noSupplierShort')}</div>
              )}
              <div className="text-sm text-muted">
                <span className="latin">{fmtDate(p.at)}</span>
                {p.byName && <> · {p.byName}</>}
                {p.billNo && (
                  <>
                    {' · '}
                    {t('billNo')} <span className="latin">{p.billNo}</span>
                  </>
                )}
              </div>
            </div>
            <Badge tone={p.due > 0 ? 'danger' : 'lime'}>{p.due > 0 ? (p.paid > 0 ? t('partial') : t('onCredit')) : t('paidFull')}</Badge>
          </div>
          {p.note && <p className="mt-2 text-muted">{p.note}</p>}
        </Card>

        <section>
          <SectionTitle>{t('itemsWord')}</SectionTitle>
          <Card className="overflow-hidden">
            <ul>
              {p.lines.map((l, i) => (
                <li key={i} className="flex min-h-16 items-center gap-3 border-b border-line/70 px-4 py-2 last:border-0">
                  {dotOf[l.variantId] ? <Dot color={dotOf[l.variantId]} size={20} /> : <Icon name="package" size={20} className="text-muted" />}
                  <div className="min-w-0 flex-1">
                    <Link to={`/items/${l.itemId}`} className="font-semibold hover:underline">
                      {pick({ en: l.itemName, ur: l.itemNameUr })}
                    </Link>
                    {l.variantName && l.variantName !== 'Standard' && <span className="text-muted"> · {pick({ en: l.variantName, ur: l.variantNameUr })}</span>}
                    <div className="latin text-sm text-muted" dir="ltr">
                      {l.qty} × {Number(l.unitCost).toLocaleString('en-PK')}
                    </div>
                  </div>
                  <Rs value={l.qty * l.unitCost} className="font-bold" />
                </li>
              ))}
            </ul>
          </Card>
        </section>

        <Card className="space-y-1.5 p-5">
          <div className="flex items-center justify-between">
            <span className="text-lg font-bold">{t('total')}</span>
            <Rs value={p.total} className="text-2xl font-bold text-charcoal" />
          </div>
          <div className="flex justify-between text-muted">
            <span>{t('paidNowShort')}</span>
            <Rs value={p.paid} />
          </div>
          {p.due > 0 && (
            <div className="flex justify-between font-semibold text-danger">
              <span>{t('addedToPayable')}</span>
              <Rs value={p.due} />
            </div>
          )}
        </Card>
      </div>
    </Page>
  )
}
