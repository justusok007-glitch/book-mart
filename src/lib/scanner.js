// Barcode scanning engine (used by item form now, Sell screen in Phase 4).
//
// 1st choice: the phone's built-in BarcodeDetector (Chrome on Android) — fast and reliable.
// Fallback: ZXing, reading the middle band of the picture (where the user holds the barcode)
// at good resolution, alternating with the full frame.

const NATIVE_FORMATS = ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39', 'code_93', 'itf', 'codabar', 'qr_code']

async function nativeDetector() {
  if (!('BarcodeDetector' in window)) return null
  try {
    const supported = await window.BarcodeDetector.getSupportedFormats()
    const formats = NATIVE_FORMATS.filter((f) => supported.includes(f))
    if (!formats.length) return null
    const det = new window.BarcodeDetector({ formats })
    return async (video) => {
      const found = await det.detect(video)
      return found[0]?.rawValue || null
    }
  } catch {
    return null
  }
}

async function zxingDetector() {
  const { BrowserMultiFormatReader } = await import('@zxing/browser')
  const { BarcodeFormat, DecodeHintType } = await import('@zxing/library')
  const hints = new Map()
  hints.set(DecodeHintType.TRY_HARDER, true)
  hints.set(DecodeHintType.POSSIBLE_FORMATS, [
    BarcodeFormat.EAN_13,
    BarcodeFormat.EAN_8,
    BarcodeFormat.UPC_A,
    BarcodeFormat.UPC_E,
    BarcodeFormat.CODE_128,
    BarcodeFormat.CODE_39,
    BarcodeFormat.ITF,
    BarcodeFormat.QR_CODE,
  ])
  const reader = new BrowserMultiFormatReader(hints)
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  let pass = 0
  return async (video) => {
    const vw = video.videoWidth
    const vh = video.videoHeight
    if (!vw || !vh) return null
    pass = (pass + 1) % 3
    // 0: middle band (the box on screen) · 1: zoomed centre (small/far barcodes) · 2: full frame
    let sx = 0
    let sw = vw
    let sh = vh
    if (pass === 0) sh = Math.round(vh * 0.5)
    if (pass === 1) {
      sw = Math.round(vw * 0.6)
      sx = Math.round((vw - sw) / 2)
      sh = Math.round(vh * 0.4)
    }
    const sy = Math.round((vh - sh) / 2)
    const scale = Math.min(pass === 1 ? 2 : 1, 1280 / sw)
    canvas.width = Math.round(sw * scale)
    canvas.height = Math.round(sh * scale)
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(video, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height)
    try {
      return reader.decodeFromCanvas(canvas).getText()
    } catch {
      return null // nothing found in this frame
    }
  }
}

/**
 * Start the back camera in `video` and call onCode(text) once a barcode is read.
 * Returns { stop, torch: { supported, set(on) }, engine }.
 */
export async function startScanner(video, onCode) {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: false,
    video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } },
  })
  const track = stream.getVideoTracks()[0]
  let stopped = false
  let timer = null
  const stop = () => {
    stopped = true
    clearInterval(timer)
    stream.getTracks().forEach((t) => t.stop())
    if (video.srcObject === stream) video.srcObject = null
  }

  video.srcObject = stream
  video.setAttribute('playsinline', '')
  video.muted = true
  try {
    await video.play()
  } catch {
    /* autoplay quirks: frames still arrive */
  }

  // keep the lens focusing (many phones start in fixed focus = blurry barcodes)
  let caps = {}
  try {
    caps = track.getCapabilities?.() || {}
    if (caps.focusMode?.includes('continuous')) await track.applyConstraints({ advanced: [{ focusMode: 'continuous' }] })
  } catch {
    /* not supported */
  }

  let detect = await nativeDetector()
  const engine = detect ? 'native' : 'zxing'
  if (!detect) detect = await zxingDetector()

  let busy = false
  if (stopped) return { stop, engine, torch: { supported: false, set: () => {} } }
  timer = setInterval(async () => {
    if (stopped || busy || video.readyState < 2) return
    busy = true
    try {
      const code = await detect(video)
      if (code && !stopped) {
        stop()
        onCode(code.trim())
      }
    } catch {
      /* ignore one bad frame */
    }
    busy = false
  }, engine === 'native' ? 100 : 150)

  return {
    stop,
    engine,
    torch: {
      supported: !!caps.torch,
      set: (on) => track.applyConstraints({ advanced: [{ torch: on }] }).catch(() => {}),
    },
  }
}
