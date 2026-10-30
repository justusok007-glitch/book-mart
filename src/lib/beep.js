// Scanner sounds, made with the phone's audio (no sound files needed).
//   beepOk()    short high beep — barcode read and accepted
//   beepError() two low beeps — barcode not found / nothing more in stock

let ctx = null
function audio() {
  try {
    const AC = window.AudioContext || window.webkitAudioContext
    if (!AC) return null
    if (!ctx) ctx = new AC()
    if (ctx.state === 'suspended') ctx.resume()
    return ctx
  } catch {
    return null
  }
}

function tone(freq, start, length, volume = 0.25, type = 'square') {
  const a = audio()
  if (!a) return
  const t0 = a.currentTime + start
  const osc = a.createOscillator()
  const gain = a.createGain()
  osc.type = type
  osc.frequency.setValueAtTime(freq, t0)
  // quick fade in/out so it clicks less
  gain.gain.setValueAtTime(0.0001, t0)
  gain.gain.exponentialRampToValueAtTime(volume, t0 + 0.01)
  gain.gain.setValueAtTime(volume, t0 + length - 0.02)
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + length)
  osc.connect(gain).connect(a.destination)
  osc.start(t0)
  osc.stop(t0 + length + 0.02)
}

export function beepOk() {
  tone(2400, 0, 0.12, 0.2)
  if (navigator.vibrate) navigator.vibrate(60)
}

export function beepError() {
  tone(330, 0, 0.14, 0.3, 'sawtooth')
  tone(250, 0.19, 0.2, 0.3, 'sawtooth')
  if (navigator.vibrate) navigator.vibrate([40, 60, 40])
}

// call from a tap (e.g. opening the scanner) so the phone allows sound later
export function unlockAudio() {
  audio()
}
