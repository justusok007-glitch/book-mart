import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useLang } from '../context/LangContext'
import { RESET_PARTS, resetData } from '../lib/inventoryCsv'
import { makeBackup, saveBackupFile } from '../lib/backup'
import { errorText } from '../lib/errors'
import { Button, Card, Checkbox, Field, Notice, Page, useOnline } from '../components/ui'
import Icon from '../components/Icon'

// Admin only (route guard + Firestore rules). Each part can be reset on its own or together.
const PART_ICON = { inventory: 'package', sales: 'receipt', udhaar: 'user', money: 'cash', roles: 'shield' }

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

export default function ResetData() {
  const { t } = useLang()
  const { displayName } = useAuth()
  const online = useOnline()
  const [parts, setParts] = useState([])
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(null)
  const [error, setError] = useState('')
  const [done, setDone] = useState('')

  const toggle = (p, on) => setParts((ps) => (on ? [...ps, p] : ps.filter((x) => x !== p)))
  const allData = RESET_PARTS.filter((p) => p !== 'roles')
  const allPicked = allData.every((p) => parts.includes(p))

  async function run() {
    setError('')
    setDone('')
    const chosen = RESET_PARTS.filter((p) => parts.includes(p))
    try {
      setBusy({ value: 0, label: t('savingSafetyCopy') })
      const safety = await makeBackup({ by: displayName })
      await saveBackupFile(safety)
      setBusy({ value: 0, label: t('resetting') })
      await resetData(chosen, (v, name) => setBusy({ value: v, label: `${t('resetting')} · ${name}` }))
      setConfirm('')
      setParts([])
      setDone(`${t('resetPartsDone')} ${chosen.map((p) => t('reset_' + p)).join(', ')}`)
    } catch (e) {
      setError(`${t('resetFailed')} ${errorText(e, t)}`)
    }
    setBusy(null)
  }

  return (
    <Page title={t('resetData')}>
      <div className="space-y-4">
        <p className="text-sm text-muted">{t('resetPickHint')}</p>
        <Card className="overflow-hidden">
          <ul>
            {RESET_PARTS.map((p) => {
              const checked = parts.includes(p)
              return (
                <li key={p} className="border-b border-line/70 last:border-0">
                  <label className="flex min-h-16 cursor-pointer items-start gap-3 px-4 py-3 hover:bg-paper/60 active:bg-paper">
                    <input type="checkbox" className="peer sr-only" checked={checked} disabled={!!busy} onChange={(e) => toggle(p, e.target.checked)} />
                    <span className="pt-0.5">
                      <Checkbox checked={checked} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2 font-semibold text-ink">
                        <Icon name={PART_ICON[p]} size={18} className="text-muted" /> {t('reset_' + p)}
                      </span>
                      <span className="mt-0.5 block text-sm text-muted">{t('reset_' + p + 'Hint')}</span>
                    </span>
                  </label>
                </li>
              )
            })}
          </ul>
        </Card>
        <Button variant="secondary" size="sm" disabled={!!busy} onClick={() => setParts(allPicked ? parts.filter((p) => !allData.includes(p)) : [...new Set([...parts, ...allData])])}>
          <Icon name={allPicked ? 'x' : 'check'} size={16} /> {allPicked ? t('resetClearAll') : t('resetPickAllData')}
        </Button>

        <Card className="space-y-4 p-4">
          <p className="text-sm text-muted">{t('resetKeptHint')}</p>
          <Notice type="error">{t('resetWarning')}</Notice>
          <Field label={t('typeReset')}>
            <input className="field latin text-lg font-bold tracking-widest" dir="ltr" value={confirm} onChange={(e) => setConfirm(e.target.value.toUpperCase())} placeholder="RESET" autoCapitalize="characters" autoComplete="off" />
          </Field>
          {busy ? (
            <Progress value={busy.value} label={busy.label} />
          ) : (
            <Button variant="danger" size="lg" className="w-full" onClick={run} disabled={!parts.length || confirm !== 'RESET' || !online}>
              <Icon name="trash" size={20} /> {t('resetNow')} {parts.length > 0 && <span className="latin">({parts.length})</span>}
            </Button>
          )}
          {!online && <Notice type="warn">{t('backupNeedsInternet')}</Notice>}
          <Notice>{error}</Notice>
          {done && <Notice type="ok">{done}</Notice>}
        </Card>
      </div>
    </Page>
  )
}
