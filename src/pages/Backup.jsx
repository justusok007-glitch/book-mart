import { useEffect, useRef, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useLang } from '../context/LangContext'
import { fetchLastBackup, inspectBackup, makeBackup, noteBackupMade, restoreBackup, saveBackupFile } from '../lib/backup'
import { errorText } from '../lib/errors'
import { fmtDate } from '../lib/format'
import { Button, Card, Field, Notice, Page, SectionTitle, useOnline } from '../components/ui'
import Icon from '../components/Icon'

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

export default function Backup() {
  const { t } = useLang()
  const { user, displayName } = useAuth()
  const online = useOnline()
  const [last, setLast] = useState(undefined)
  const [busy, setBusy] = useState(null) // { kind, value, label }
  const [msg, setMsg] = useState('')
  const [error, setError] = useState('')
  const [file, setFile] = useState(null) // { name, data, info }
  const [confirm, setConfirm] = useState('')
  const input = useRef(null)

  useEffect(() => {
    fetchLastBackup()
      .then(setLast)
      .catch(() => setLast(null))
  }, [])

  async function backup(share) {
    setMsg('')
    setError('')
    setBusy({ kind: 'backup', value: 0, label: t('readingData') })
    try {
      const data = await makeBackup({ by: displayName, onProgress: (v) => setBusy({ kind: 'backup', value: v, label: t('readingData') }) })
      const res = await saveBackupFile(data, { share })
      if (res !== 'cancelled') {
        noteBackupMade(data).catch(() => {})
        setLast({ lastAt: data.createdAt, by: data.by })
        setMsg(`${t('backupDone')} (${Object.values(data.collections).reduce((s, l) => s + l.length, 0)} ${t('recordsWord')})`)
      }
    } catch (e) {
      setError(errorText(e, t))
    }
    setBusy(null)
  }

  function pickFile(e) {
    const f = e.target.files?.[0]
    e.target.value = ''
    setError('')
    setMsg('')
    setConfirm('')
    if (!f) return
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result)
        const info = inspectBackup(data)
        if (!info.ok) return setError(t('notBackupFile'))
        setFile({ name: f.name, data, info })
      } catch {
        setError(t('notBackupFile'))
      }
    }
    reader.readAsText(f)
  }

  async function restore() {
    setError('')
    setMsg('')
    try {
      // safety copy of today's data first, so a wrong restore can be undone
      setBusy({ kind: 'restore', value: 0, label: t('savingSafetyCopy') })
      const safety = await makeBackup({ by: displayName })
      await saveBackupFile(safety)
      setBusy({ kind: 'restore', value: 0, label: t('restoring') })
      await restoreBackup(file.data, { keepUid: user.uid, onProgress: (v, name) => setBusy({ kind: 'restore', value: v, label: `${t('restoring')} · ${name || ''}` }) })
      setFile(null)
      setConfirm('')
      setMsg(t('restoreDone'))
    } catch (e) {
      setError(`${t('restoreFailed')} ${errorText(e, t)}`)
    }
    setBusy(null)
  }

  const days = last?.lastAt ? Math.floor((Date.now() - last.lastAt) / 864e5) : null

  return (
    <Page title={t('backupRestore')}>
      <div className="space-y-6">
        {!online && <Notice type="warn">{t('backupNeedsInternet')}</Notice>}

        {/* backup */}
        <section>
          <SectionTitle>{t('backupTitle')}</SectionTitle>
          <Card className="space-y-4 p-4">
            <div className="flex items-start gap-3">
              <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${days == null || days > 7 ? 'bg-warn-50 text-ink' : 'bg-lime-100 text-charcoal'}`}>
                <Icon name={days == null || days > 7 ? 'alert' : 'check'} size={22} />
              </div>
              <div className="min-w-0">
                <div className="font-semibold">{t('lastBackup')}</div>
                <div className="text-sm text-muted">
                  {last === undefined ? '…' : last?.lastAt ? (
                    <>
                      <span className="latin">{fmtDate(new Date(last.lastAt))}</span>
                      {last.by && <> · {last.by}</>}
                    </>
                  ) : (
                    t('neverBackedUp')
                  )}
                </div>
              </div>
            </div>
            <p className="text-sm text-muted">{t('backupHint')}</p>
            {busy?.kind === 'backup' ? (
              <Progress value={busy.value} label={busy.label} />
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <Button size="lg" variant="accent" onClick={() => backup(false)} disabled={!online || !!busy}>
                  <Icon name="check" size={20} /> {t('downloadBackup')}
                </Button>
                <Button size="lg" variant="secondary" onClick={() => backup(true)} disabled={!online || !!busy}>
                  <Icon name="share" size={20} /> {t('shareBackup')}
                </Button>
              </div>
            )}
          </Card>
        </section>

        {/* restore */}
        <section>
          <SectionTitle>{t('restoreTitle')}</SectionTitle>
          <Card className="space-y-4 p-4">
            <p className="text-sm text-muted">{t('restoreHint')}</p>
            <input ref={input} type="file" accept="application/json,.json" className="hidden" onChange={pickFile} />
            {!file && (
              <Button size="lg" variant="secondary" className="w-full" onClick={() => input.current?.click()} disabled={!!busy}>
                <Icon name="rotate" size={20} /> {t('chooseBackupFile')}
              </Button>
            )}

            {file && (
              <div className="space-y-4">
                <div className="rounded-xl bg-paper p-3 text-sm">
                  <div className="latin truncate font-semibold" dir="ltr">
                    {file.name}
                  </div>
                  <div className="text-muted">
                    {t('backupFrom')} <span className="latin">{file.info.createdAt ? fmtDate(new Date(file.info.createdAt)) : '—'}</span>
                    {file.info.by && <> · {file.info.by}</>}
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-0.5 text-muted">
                    {[
                      ['items', 'itemsWord'],
                      ['sales', 'salesCount'],
                      ['customers', 'customers'],
                      ['suppliers', 'suppliers'],
                      ['purchases', 'purchases'],
                      ['expenses', 'expenses'],
                    ].map(([k, label]) => (
                      <div key={k} className="flex justify-between">
                        <span>{t(label)}</span>
                        <span className="latin font-semibold text-ink">{file.info.counts[k] ?? 0}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <Notice type="error">{t('restoreWarning')}</Notice>
                <Field label={t('typeRestore')}>
                  <input className="field latin text-lg font-bold tracking-widest" dir="ltr" value={confirm} onChange={(e) => setConfirm(e.target.value.toUpperCase())} placeholder="RESTORE" autoCapitalize="characters" autoComplete="off" />
                </Field>
                {busy?.kind === 'restore' ? (
                  <Progress value={busy.value} label={busy.label} />
                ) : (
                  <div className="grid grid-cols-2 gap-3">
                    <Button size="lg" variant="secondary" onClick={() => setFile(null)}>
                      {t('cancel')}
                    </Button>
                    <Button size="lg" variant="danger" onClick={restore} disabled={confirm !== 'RESTORE' || !online}>
                      <Icon name="rotate" size={20} /> {t('restoreNow')}
                    </Button>
                  </div>
                )}
              </div>
            )}
          </Card>
        </section>

        <Notice>{error}</Notice>
        {msg && <Notice type="ok">{msg}</Notice>}
      </div>
    </Page>
  )
}
