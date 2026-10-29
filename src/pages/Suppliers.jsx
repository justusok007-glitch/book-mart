import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useLang } from '../context/LangContext'
import { saveSupplier, useSuppliers } from '../lib/purchasing'
import { Button, Card, EmptyState, Field, Page, Rs, Sheet, Spinner } from '../components/ui'
import Icon from '../components/Icon'

export function SupplierForm({ initial, onDone }) {
  const { t } = useLang()
  const [f, setF] = useState({ name: initial?.name || '', phone: initial?.phone || '', address: initial?.address || '', note: initial?.note || '' })
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })
  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault()
        if (!f.name.trim()) return
        onDone(saveSupplier({ id: initial?.id, ...f }))
      }}
    >
      <Field label={t('supplierName')}>
        <input className="field" value={f.name} onChange={set('name')} autoFocus />
      </Field>
      <Field label={`${t('phone')} (${t('optional')})`}>
        <input className="field latin" dir="ltr" inputMode="tel" value={f.phone} onChange={set('phone')} />
      </Field>
      <Field label={`${t('address')} (${t('optional')})`}>
        <input className="field" value={f.address} onChange={set('address')} />
      </Field>
      <Field label={`${t('note')} (${t('optional')})`}>
        <input className="field" value={f.note} onChange={set('note')} />
      </Field>
      <Button type="submit" size="lg" className="w-full" disabled={!f.name.trim()}>
        {t('save')}
      </Button>
    </form>
  )
}

export default function Suppliers() {
  const { t } = useLang()
  const { can } = useAuth()
  const list = useSuppliers(true)
  const [adding, setAdding] = useState(false)
  const totalOwed = (list || []).reduce((s, x) => s + Math.max(0, x.balance || 0), 0)

  return (
    <Page
      title={t('suppliers')}
      right={
        can('manage_suppliers') && (
          <Button size="sm" className="me-1" onClick={() => setAdding(true)}>
            <Icon name="plus" size={18} /> {t('newSupplier')}
          </Button>
        )
      }
    >
      {list === null ? (
        <div className="flex justify-center py-16">
          <Spinner />
        </div>
      ) : list.length === 0 ? (
        <EmptyState
          icon="truck"
          title={t('noSuppliers')}
          body={t('noSuppliersBody')}
          action={
            can('manage_suppliers') && (
              <Button onClick={() => setAdding(true)}>
                <Icon name="plus" size={18} /> {t('newSupplier')}
              </Button>
            )
          }
        />
      ) : (
        <>
          <Card className="mb-4 flex items-center justify-between p-4">
            <span className="font-semibold text-muted">{t('totalPayable')}</span>
            <Rs value={totalOwed} className={`text-2xl font-bold ${totalOwed > 0 ? 'text-danger' : 'text-ink'}`} />
          </Card>
          <ul className="space-y-2.5">
            {list.map((s) => (
              <li key={s.id}>
                <Link
                  to={`/suppliers/${s.id}`}
                  className="flex min-h-[72px] items-center gap-3 rounded-2xl border-[1.5px] border-line bg-white px-4 py-3 transition-colors duration-150 hover:border-charcoal-500 active:bg-paper"
                >
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-lime-100 text-charcoal">
                    <Icon name="truck" size={22} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-semibold">{s.name}</div>
                    {s.phone && (
                      <div className="latin truncate text-sm text-muted" dir="ltr">
                        {s.phone}
                      </div>
                    )}
                  </div>
                  <div className="text-end">
                    <Rs value={s.balance || 0} className={`font-bold ${(s.balance || 0) > 0 ? 'text-danger' : 'text-muted'}`} />
                    <div className="text-xs text-muted">{(s.balance || 0) > 0 ? t('weOwe') : (s.balance || 0) < 0 ? t('advancePaid') : t('settled')}</div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}

      <Sheet open={adding} title={t('newSupplier')} onClose={() => setAdding(false)}>
        {adding && <SupplierForm onDone={() => setAdding(false)} />}
      </Sheet>
    </Page>
  )
}
