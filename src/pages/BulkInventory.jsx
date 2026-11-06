import { useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useLang } from '../context/LangContext'
import { useCatalog } from '../lib/catalog'
import {
  applyUpload, downloadText, inventoryCsv, inventoryFileName, parseCsv, planUpload, readRows, templateCsv,
} from '../lib/inventoryCsv'
import { errorText } from '../lib/errors'
import { Badge, Button, Card, Notice, Page, Rs, SectionTitle, Spinner, Toggle, useOnline } from '../components/ui'
import Icon from '../components/Icon'

const STATUS = {
  new: { tone: 'lime', label: 'statusNew' },
  update: { tone: 'dark', label: 'statusUpdate' },
  same: { tone: 'neutral', label: 'statusSame' },
  skip: { tone: 'neutral', label: 'statusSkip' },
  error: { tone: 'danger', label: 'statusError' },
}

function Progress({ value, label }) {
  return (
    <div className="space-y-1.5" role="progressbar" aria-valuenow={Math.round(value * 100)} aria-valuemin={0} aria-valuemax={100}>
      <div className="flex justify-between text-sm">
        <span className="text-muted">{label}</span>
        <span className="latin font-semibold">{Math.round(value * 100)}%</span>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-paper">
        <div className="h-full rounded-full bg-leaf transition-[width] duration-200" style={{ width: `${value * 100}%` }} />
      </div>
    </div>
  )
}

/* ---------------- upload ---------------- */
function Upload() {
  const { t } = useLang()
  const { user, displayName } = useAuth()
  const catalog = useCatalog()
  const online = useOnline()
  const input = useRef(null)
  const [file, setFile] = useState(null) // { name, rows }
  const [updateExisting, setUpdateExisting] = useState(true)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(null)
  const [done, setDone] = useState('')
  const [show, setShow] = useState('all')

  const plan = useMemo(() => (file && catalog.ready ? planUpload(file.rows, catalog, { updateExisting }) : null), [file, catalog, updateExisting])
  const count = (s) => plan?.rows.filter((r) => r.status === s).length || 0
  const newCatCount = plan ? plan.newCats.reduce((s, c) => s + (c.cat ? 0 : 1) + c.subs.size, 0) : 0
  const todo = count('new') + count('update')
  const shown = plan ? plan.rows.filter((r) => show === 'all' || r.status === show) : []

  function pick(e) {
    const f = e.target.files?.[0]
    e.target.value = ''
    setError('')
    setDone('')
    if (!f) return
    const reader = new FileReader()
    reader.onload = () => {
      const res = readRows(parseCsv(reader.result))
      if (res.error === 'csvMissingColumns') return setError(`${t('csvMissingColumns')} ${res.missing.map((m) => t('col_' + m)).join(', ')}`)
      if (res.error) return setError(t(res.error))
      if (!res.rows.length) return setError(t('csvEmpty'))
      setFile({ name: f.name, rows: res.rows })
      setShow('all')
    }
    reader.readAsText(f)
  }

  async function upload() {
    setError('')
    setBusy({ value: 0 })
    try {
      const res = await applyUpload(plan, catalog, { uid: user.uid, name: displayName }, (v) => setBusy({ value: v }))
      setDone(`${t('uploadDone')} ${t('statusNew')}: ${res.added} · ${t('statusUpdate')}: ${res.updated}${res.categories ? ` · ${t('categories')}: ${res.categories}` : ''}`)
      setFile(null)
    } catch (e) {
      setError(`${t('uploadFailed')} ${errorText(e, t)}`)
    }
    setBusy(null)
  }

  return (
    <Card className="space-y-4 p-4">
      <p className="text-sm text-muted">{t('bulkHint')}</p>
      <div className="rounded-xl bg-paper p-3">
        <div className="latin text-xs font-semibold leading-relaxed text-ink" dir="ltr">
          Item Name, Item Name Ur, Category, Sub Category, Sale Price, Cost Price, Opening Stock, Low Stock
        </div>
      </div>
      <input ref={input} type="file" accept=".csv,text/csv,text/plain" className="hidden" onChange={pick} />
      {!file && (
        <div className="grid grid-cols-2 gap-3">
          <Button variant="secondary" onClick={() => downloadText(templateCsv(), 'book-mart-template.csv')}>
            <Icon name="receipt" size={18} /> {t('downloadTemplate')}
          </Button>
          <Button onClick={() => input.current?.click()} disabled={!catalog.ready || !!busy}>
            <Icon name="plus" size={18} /> {t('chooseCsv')}
          </Button>
        </div>
      )}

      {file && !plan && (
        <div className="flex justify-center py-6">
          <Spinner />
        </div>
      )}

      {plan && (
        <div className="space-y-4">
          <div className="latin truncate text-sm font-semibold" dir="ltr">
            {file.name} · {file.rows.length} rows
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[
              ['new', count('new')],
              ['update', count('update')],
              [updateExisting ? 'same' : 'skip', count(updateExisting ? 'same' : 'skip')],
              ['error', count('error')],
            ].map(([s, n]) => (
              <button
                key={s}
                type="button"
                onClick={() => setShow(show === s ? 'all' : s)}
                aria-pressed={show === s}
                className={`cursor-pointer rounded-xl border-[1.5px] p-2.5 text-start ${show === s ? 'border-charcoal' : 'border-line'} bg-white`}
              >
                <div className="text-xs font-semibold text-muted">{t(STATUS[s].label)}</div>
                <div className={`latin text-xl font-bold ${s === 'error' && n ? 'text-danger' : ''}`}>{n}</div>
              </button>
            ))}
          </div>
          {newCatCount > 0 && (
            <Notice type="info">
              {t('newCategoriesMade')}{' '}
              {plan.newCats
                .map((c) => `${c.cat ? c.cat.en : c.en}${c.subs.size ? ' › ' + [...c.subs.values()].join(', ') : ''}`)
                .join('; ')}
            </Notice>
          )}
          <div className="flex items-center justify-between gap-3 rounded-xl border border-line ps-4 pe-1">
            <span className="text-sm font-semibold">{t('updateExisting')}</span>
            <Toggle checked={updateExisting} onChange={setUpdateExisting} label={t('updateExisting')} />
          </div>

          <div className="max-h-[420px] overflow-y-auto rounded-xl border border-line">
            <ul className="divide-y divide-line">
              {shown.slice(0, 200).map((r) => (
                <li key={r.line} className="flex items-start gap-3 px-3 py-2.5 text-sm">
                  <span className="latin w-8 shrink-0 pt-0.5 text-xs text-muted">{r.line}</span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-semibold">{r.en || '—'}</div>
                    <div className="truncate text-muted">
                      {r.cat || '—'} › {r.sub || '—'}
                      {r.stock != null && !Number.isNaN(r.stock) && <> · {t('qty')} <span className="latin">{r.stock}</span></>}
                    </div>
                    {r.status === 'error' && <div className="font-medium text-danger">{t(r.msg)}</div>}
                    {r.status === 'update' && <div className="text-muted">{t('willChange')}: {r.changes.map((c) => t('chg_' + c)).join(', ')}</div>}
                    {r.msg === 'rowHasTypes' && r.status !== 'error' && <div className="text-muted">{t('rowHasTypes')}</div>}
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    {r.price > 0 && <Rs value={r.price} className="font-semibold" />}
                    <Badge tone={STATUS[r.status].tone}>{t(STATUS[r.status].label)}</Badge>
                  </div>
                </li>
              ))}
            </ul>
          </div>
          {count('error') > 0 && <p className="text-sm text-muted">{t('errorsSkipped')}</p>}

          {busy ? (
            <Progress value={busy.value} label={t('uploading')} />
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <Button variant="secondary" size="lg" onClick={() => setFile(null)}>
                {t('cancel')}
              </Button>
              <Button variant="accent" size="lg" onClick={upload} disabled={!todo || !online}>
                <Icon name="check" size={20} /> {t('uploadItems')} <span className="latin">({todo})</span>
              </Button>
            </div>
          )}
        </div>
      )}
      {!online && <Notice type="warn">{t('backupNeedsInternet')}</Notice>}
      <Notice>{error}</Notice>
      {done && <Notice type="ok">{done}</Notice>}
    </Card>
  )
}

export default function BulkInventory() {
  const { t } = useLang()
  const catalog = useCatalog()
  const navigate = useNavigate()
  return (
    <Page title={t('bulkInventory')}>
      <div className="space-y-6">
        <section>
          <SectionTitle>{t('uploadCsv')}</SectionTitle>
          <Upload />
        </section>

        <section>
          <SectionTitle>{t('inventoryCsv')}</SectionTitle>
          <Card className="space-y-3 p-4">
            <p className="text-sm text-muted">{t('inventoryCsvHint')}</p>
            <Button variant="secondary" size="lg" className="w-full" disabled={!catalog.ready} onClick={() => downloadText(inventoryCsv(catalog), inventoryFileName())}>
              <Icon name="package" size={20} /> {t('downloadInventoryCsv')} <span className="latin">({catalog.items.length})</span>
            </Button>
          </Card>
        </section>

        <section>
          <SectionTitle>{t('resetData')}</SectionTitle>
          <Card className="space-y-3 p-4">
            <p className="text-sm text-muted">{t('resetMovedHint')}</p>
            <Button variant="secondary" size="lg" className="w-full" onClick={() => navigate('/reset')}>
              <Icon name="trash" size={20} /> {t('resetData')}
            </Button>
          </Card>
        </section>
      </div>
    </Page>
  )
}
