// Camera barcode scanner in a sheet (back camera). Phase 4 reuses it on the Sell screen.
// A USB/Bluetooth barcode gun does not need this — it types into the focused box like a keyboard.

import { useEffect, useRef, useState } from 'react'
import { useLang } from '../context/LangContext'
import { beepOk, unlockAudio } from '../lib/beep'
import { startScanner } from '../lib/scanner'
import { Button, IconButton, Notice, Sheet, Spinner } from './ui'

export function Viewfinder({ onResult, onError, compact = false, beep = true }) {
  const { t } = useLang()
  const video = useRef(null)
  const [starting, setStarting] = useState(true)
  const [torch, setTorch] = useState(null) // null = not supported
  const torchCtl = useRef(null)
  // keep latest callbacks without restarting the camera on every render
  const cb = useRef({ onResult, onError, beep })
  cb.current = { onResult, onError, beep }

  useEffect(() => {
    let scanner = null
    let cancelled = false
    unlockAudio()
    startScanner(video.current, (code) => {
      // the screen using the scanner can beep itself (e.g. Sell beeps only when the item is really added)
      if (cb.current.beep) beepOk()
      cb.current.onResult(code)
    })
      .then((s) => {
        scanner = s
        if (cancelled) return s.stop()
        torchCtl.current = s.torch
        if (s.torch.supported) setTorch(false)
        setStarting(false)
      })
      .catch((e) => {
        if (!cancelled) cb.current.onError(e?.name === 'NotAllowedError' ? 'denied' : 'failed')
      })
    return () => {
      cancelled = true
      scanner?.stop()
    }
  }, [])

  return (
    <div className={`relative w-full overflow-hidden rounded-2xl bg-charcoal ${compact ? 'aspect-[4/3]' : 'aspect-[3/4] sm:aspect-[4/3]'}`}>
      <video ref={video} className="h-full w-full object-cover" muted playsInline />

      {/* dark outside, clear box in the middle = where to hold the barcode */}
      <div className="pointer-events-none absolute inset-x-5 top-1/2 h-[38%] -translate-y-1/2 rounded-xl shadow-[0_0_0_2000px_rgba(0,0,0,.45)]" aria-hidden="true">
        {['top-0 start-0 border-t-4 border-s-4 rounded-ss-xl', 'top-0 end-0 border-t-4 border-e-4 rounded-se-xl', 'bottom-0 start-0 border-b-4 border-s-4 rounded-es-xl', 'bottom-0 end-0 border-b-4 border-e-4 rounded-ee-xl'].map((c) => (
          <span key={c} className={`absolute h-8 w-8 border-lime ${c}`} />
        ))}
        <span className="absolute inset-x-3 top-1/2 h-0.5 -translate-y-1/2 rounded-full bg-lime/90 shadow-[0_0_10px_2px_rgba(159,204,71,.7)]" />
      </div>

      <div className="absolute inset-x-0 bottom-3 px-4 text-center text-sm font-medium text-white">{t('holdInBox')}</div>

      {torch !== null && (
        <IconButton
          icon="flash"
          label={t('torch')}
          onClick={() => {
            const on = !torch
            setTorch(on)
            torchCtl.current?.set(on)
          }}
          className={`absolute end-3 top-3 ${torch ? 'bg-lime text-charcoal' : 'bg-black/40 text-white hover:bg-black/60'}`}
        />
      )}

      {starting && (
        <div className="absolute inset-0 flex items-center justify-center">
          <Spinner />
        </div>
      )}
    </div>
  )
}

export default function BarcodeScanner({ open, onClose, onResult, beep = true }) {
  const { t } = useLang()
  const [error, setError] = useState('')

  useEffect(() => {
    if (open) setError('')
  }, [open])

  return (
    <Sheet open={open} title={t('scanBarcode')} onClose={onClose}>
      {open && !error && (
        <Viewfinder
          beep={beep}
          onResult={(code) => {
            onResult(code)
            onClose()
          }}
          onError={(e) => setError(e)}
        />
      )}
      {error && <Notice>{error === 'denied' ? t('cameraDenied') : t('cameraFailed')}</Notice>}
      <p className="mt-3 text-sm text-muted">{t('scanTip')}</p>
      <Button variant="secondary" className="mt-4 w-full" onClick={onClose}>
        {t('typeInstead')}
      </Button>
    </Sheet>
  )
}
