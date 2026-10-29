// Camera barcode scanner in a sheet. Uses the phone's back camera.
// Phase 4 reuses this for the Sell screen. A USB/Bluetooth barcode gun works without this
// (it types into the focused field like a keyboard).

import { useEffect, useRef, useState } from 'react'
import { useLang } from '../context/LangContext'
import { Button, Notice, Sheet, Spinner } from './ui'

function Viewfinder({ onResult, onError }) {
  const video = useRef(null)
  const [starting, setStarting] = useState(true)
  // keep latest callbacks without restarting the camera on every render
  const cb = useRef({ onResult, onError })
  cb.current = { onResult, onError }

  useEffect(() => {
    let controls = null
    let stopped = false
    ;(async () => {
      try {
        const { BrowserMultiFormatReader } = await import('@zxing/browser')
        const reader = new BrowserMultiFormatReader()
        controls = await reader.decodeFromConstraints(
          { video: { facingMode: { ideal: 'environment' } } },
          video.current,
          (result, _err, ctrl) => {
            if (result && !stopped) {
              stopped = true
              ctrl.stop()
              if (navigator.vibrate) navigator.vibrate(60)
              cb.current.onResult(result.getText())
            }
          },
        )
        if (stopped) controls.stop()
        setStarting(false)
      } catch (e) {
        cb.current.onError(e?.name === 'NotAllowedError' ? 'denied' : 'failed')
      }
    })()
    return () => {
      stopped = true
      controls?.stop()
    }
  }, [])

  return (
    <div className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl bg-charcoal">
      <video ref={video} className="h-full w-full object-cover" muted playsInline />
      {['top-4 start-4 border-t-4 border-s-4 rounded-ss-xl', 'top-4 end-4 border-t-4 border-e-4 rounded-se-xl', 'bottom-4 start-4 border-b-4 border-s-4 rounded-es-xl', 'bottom-4 end-4 border-b-4 border-e-4 rounded-ee-xl'].map((c) => (
        <span key={c} className={`absolute h-9 w-9 border-lime ${c}`} aria-hidden="true" />
      ))}
      <span className="scanline absolute inset-x-8 h-0.5 rounded-full bg-lime shadow-[0_0_12px_2px_rgba(159,204,71,.7)]" aria-hidden="true" />
      {starting && (
        <div className="absolute inset-0 flex items-center justify-center">
          <Spinner />
        </div>
      )}
    </div>
  )
}

export default function BarcodeScanner({ open, onClose, onResult }) {
  const { t } = useLang()
  const [error, setError] = useState('')

  useEffect(() => {
    if (open) setError('')
  }, [open])

  return (
    <Sheet open={open} title={t('scanBarcode')} onClose={onClose}>
      {open && !error && (
        <Viewfinder
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
