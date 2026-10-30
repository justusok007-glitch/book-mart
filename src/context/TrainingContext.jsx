// Switches a trainee onto their practice copy (lib/training.js) before any screen loads,
// and back to the real shop when someone else signs in.
import { createContext, Fragment, useCallback, useContext, useEffect, useState } from 'react'
import { useAuth } from './AuthContext'
import { useLang } from './LangContext'
import { isTraining, realDb, setActiveDb } from '../lib/firebase'
import { closeTraining, openTraining, resetTraining, trainingInfo } from '../lib/training'
import Icon from '../components/Icon'

const TrainingContext = createContext(null)
export const useTraining = () => useContext(TrainingContext)

function Preparing({ progress, title }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-5 bg-white px-6 text-center">
      <img src="./logo-mark.png" alt="Book Mart" className="h-16 w-16 object-contain" />
      <div className="text-lg font-semibold text-charcoal">{title}</div>
      <div className="h-2.5 w-56 overflow-hidden rounded-full bg-paper" role="progressbar" aria-valuenow={Math.round(progress * 100)} aria-valuemin={0} aria-valuemax={100}>
        <div className="h-full rounded-full bg-leaf transition-[width] duration-200" style={{ width: `${Math.max(5, progress * 100)}%` }} />
      </div>
    </div>
  )
}

export function TrainingProvider({ children }) {
  const { user, training, loading, logout } = useAuth()
  const { t } = useLang()
  const [key, setKey] = useState(0)
  const [status, setStatus] = useState('idle') // idle | preparing | ready | error
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)
  const uid = user?.uid

  useEffect(() => {
    if (loading) return
    let live = true
    if (training && uid) {
      setStatus('preparing')
      setProgress(0)
      openTraining(uid, (p) => live && setProgress(p))
        .then((pdb) => {
          if (!live) return
          setActiveDb(pdb)
          setKey((k) => k + 1)
          setStatus('ready')
        })
        .catch((e) => {
          if (!live) return
          setError(e?.message || 'failed')
          setStatus('error')
        })
    } else {
      if (isTraining()) {
        setActiveDb(realDb)
        closeTraining()
        setKey((k) => k + 1)
      }
      setStatus('idle')
    }
    return () => {
      live = false
    }
  }, [training, uid, loading, attempt])

  const reset = useCallback(async () => {
    if (!uid) return
    setStatus('preparing')
    setProgress(0)
    // stop every screen from using the old copy before it is thrown away
    setActiveDb(realDb)
    setKey((k) => k + 1)
    try {
      const pdb = await resetTraining(uid, setProgress)
      setActiveDb(pdb)
      setKey((k) => k + 1)
      setStatus('ready')
    } catch (e) {
      setError(e?.message || 'failed')
      setStatus('error')
    }
  }, [uid])

  if (training && status === 'preparing') return <Preparing progress={progress} title={t('preparingTraining')} />
  if (training && status === 'error')
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-white px-6 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-warn-50 text-ink">
          <Icon name="wifiOff" size={26} />
        </div>
        <h1 className="text-xl font-semibold text-charcoal">{t('trainingNeedsInternet')}</h1>
        <p className="max-w-sm text-muted">{t('trainingNeedsInternetBody')}</p>
        <div className="flex gap-3">
          <button type="button" className="min-h-12 cursor-pointer rounded-xl bg-charcoal px-5 font-semibold text-white" onClick={() => setAttempt((a) => a + 1)}>
            {t('tryAgain')}
          </button>
          <button type="button" className="min-h-12 cursor-pointer rounded-xl border-[1.5px] border-line bg-white px-5 font-semibold" onClick={logout}>
            {t('signOut')}
          </button>
        </div>
        <p className="latin text-xs text-muted">{error}</p>
      </div>
    )
  if (training && status !== 'ready') return <Preparing progress={0} title={t('preparingTraining')} />

  const value = training ? { active: true, reset, info: trainingInfo(uid) } : null
  return (
    <TrainingContext.Provider value={value}>
      <Fragment key={key}>{children}</Fragment>
    </TrainingContext.Provider>
  )
}
