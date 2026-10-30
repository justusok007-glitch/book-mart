// ESC/POS receipt for 58mm thermal printers (32 characters per line),
// sent straight to the RawBT app — no print screen, one tap.

const W = 32
const ESC = 0x1b
const GS = 0x1d

const money = (n) => Number(n || 0).toLocaleString('en-PK', { maximumFractionDigits: 2 })
// thermal printers only know plain letters; anything else (e.g. Urdu) becomes "?"
const ascii = (s) => String(s ?? '').replace(/[‘’]/g, "'").replace(/[^\x20-\x7e]/g, '?')

export function padRow(left, right, width = W) {
  left = ascii(left)
  right = ascii(right)
  const space = width - right.length
  if (left.length >= space) return [left.slice(0, width), ' '.repeat(Math.max(0, width - right.length)) + right]
  return [left + ' '.repeat(space - left.length) + right]
}

export function wrap(text, width = W) {
  const words = ascii(text).split(/\s+/)
  const out = []
  let line = ''
  for (const w of words) {
    if (!line) line = w
    else if ((line + ' ' + w).length <= width) line += ' ' + w
    else {
      out.push(line)
      line = w
    }
    while (line.length > width) {
      out.push(line.slice(0, width))
      line = line.slice(width)
    }
  }
  if (line) out.push(line)
  return out
}

/** Builds the printer bytes for one sale */
export function receiptBytes(sale, shop, thanks = 'Thank you for shopping!', when = '') {
  const bytes = []
  const raw = (...b) => bytes.push(...b)
  const text = (s) => {
    for (const ch of ascii(s)) bytes.push(ch.charCodeAt(0))
    bytes.push(0x0a)
  }
  const center = (on) => raw(ESC, 0x61, on ? 1 : 0)
  const bold = (on) => raw(ESC, 0x45, on ? 1 : 0)
  const big = (on) => raw(GS, 0x21, on ? 0x11 : 0x00)
  const rule = () => text('-'.repeat(W))

  raw(ESC, 0x40) // reset
  center(true)
  bold(true)
  big(true)
  for (const l of wrap((shop?.name || 'Book Mart').toUpperCase(), 16)) text(l)
  big(false)
  bold(false)
  if (shop?.address) wrap(shop.address).forEach(text)
  if (shop?.phone) text(shop.phone)
  if (when) text(when)
  text(`Receipt #${sale.receiptNo}`)
  if (sale.byName) text(`Cashier: ${sale.byName}`)
  center(false)
  rule()
  for (const l of sale.lines) {
    wrap(l.variantName ? `${l.itemName} - ${l.variantName}` : l.itemName).forEach(text)
    padRow(`  ${l.qty} x ${money(l.price)}`, money(l.qty * l.price)).forEach(text)
  }
  rule()
  padRow('Subtotal', money(sale.subtotal)).forEach(text)
  if (sale.discount > 0) padRow('Discount', '-' + money(sale.discount)).forEach(text)
  bold(true)
  padRow('TOTAL Rs', money(sale.total)).forEach(text)
  bold(false)
  if (sale.due > 0) {
    padRow('Paid', money(sale.paid)).forEach(text)
    bold(true)
    padRow(`Udhaar${sale.customerName ? ' (' + sale.customerName + ')' : ''}`, money(sale.due)).forEach(text)
    bold(false)
  }
  rule()
  center(true)
  wrap(shop?.footer || thanks).forEach(text)
  center(false)
  raw(0x0a, 0x0a, 0x0a)
  raw(GS, 0x56, 0x42, 0x00) // cut (ignored by printers without a cutter)
  return Uint8Array.from(bytes)
}

export function toBase64(bytes) {
  let s = ''
  for (const b of bytes) s += String.fromCharCode(b)
  return btoa(s)
}

/* ---------- this phone's printing choice (stored on the phone) ---------- */

export const isAndroid = () => /android/i.test(navigator.userAgent)
export const isNativeApp = () => !!window.Capacitor?.isNativePlatform?.()

export function getPrintMode() {
  try {
    return localStorage.getItem('bm-print') === 'rawbt' ? 'rawbt' : 'system'
  } catch {
    return 'system'
  }
}
export function setPrintMode(mode) {
  try {
    localStorage.setItem('bm-print', mode)
  } catch {
    /* ignore */
  }
}

/** Opens RawBT with the receipt. In Chrome, Android sends you to Play Store if RawBT is missing. */
export function sendToRawbt(bytes) {
  const b64 = toBase64(bytes)
  const url = isNativeApp() ? `rawbt:base64,${b64}` : `intent:base64,${b64}#Intent;scheme=rawbt;package=ru.a402d.rawbtprinter;end;`
  window.location.href = url
}
