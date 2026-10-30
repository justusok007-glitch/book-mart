// Receipt: on-screen view, 58mm print page, and plain text for WhatsApp/share.
//
// Printing: the app opens the phone's print screen with a 58mm-wide receipt.
// With a Bluetooth thermal printer: install RawBT once and turn on "Print directly with RawBT"
// in Settings — Print then sends ESC/POS bytes straight to the printer (src/lib/escpos.js).

import { useLang } from '../context/LangContext'
import { toDate } from '../lib/format'
import { getPrintMode, isAndroid, receiptBytes, sendToRawbt } from '../lib/escpos'

const money = (n) => Number(n || 0).toLocaleString('en-PK', { maximumFractionDigits: 2 })
const when = (sale) => {
  const d = toDate(sale.at) || (sale.clientAt ? new Date(sale.clientAt) : new Date())
  return `${d.toLocaleDateString('en-GB')} ${d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`
}
const lineName = (l) => (l.variantName ? `${l.itemName} - ${l.variantName}` : l.itemName)

export function ReceiptView({ sale, shop }) {
  const { t } = useLang()
  return (
    <div className="mx-auto w-full max-w-[300px] rounded-lg border border-dashed border-[#b5bbae] bg-white p-4 font-mono text-[13px] leading-snug text-black" dir="ltr">
      <div className="mb-2 flex flex-col items-center text-center">
        <img src="./logo-mark.png" alt="" className="mb-1 h-10 w-10 object-contain grayscale" />
        <div className="text-base font-bold uppercase">{shop?.name || 'Book Mart'}</div>
        {shop?.address && <div className="text-[11px]">{shop.address}</div>}
        {shop?.phone && <div className="text-[11px]">{shop.phone}</div>}
        <div className="mt-1 text-[11px]">
          {when(sale)} · #{sale.receiptNo}
        </div>
        {sale.byName && <div className="text-[11px]">Cashier: {sale.byName}</div>}
      </div>
      <div className="my-2 border-t border-dashed border-black/40" />
      {sale.lines.map((l, i) => (
        <div key={i} className="mb-1">
          <div className="truncate">{lineName(l)}</div>
          <div className="flex justify-between">
            <span>
              {l.qty} x {money(l.price)}
            </span>
            <span>{money(l.qty * l.price)}</span>
          </div>
        </div>
      ))}
      <div className="my-2 border-t border-dashed border-black/40" />
      <div className="space-y-0.5">
        <div className="flex justify-between">
          <span>Subtotal</span>
          <span>{money(sale.subtotal)}</span>
        </div>
        {sale.discount > 0 && (
          <div className="flex justify-between">
            <span>Discount</span>
            <span>-{money(sale.discount)}</span>
          </div>
        )}
        <div className="flex justify-between text-[15px] font-bold">
          <span>TOTAL Rs</span>
          <span>{money(sale.total)}</span>
        </div>
        {sale.due > 0 && (
          <>
            <div className="flex justify-between">
              <span>Paid</span>
              <span>{money(sale.paid)}</span>
            </div>
            <div className="flex justify-between font-bold">
              <span>Udhaar{sale.customerName ? ` (${sale.customerName})` : ''}</span>
              <span>{money(sale.due)}</span>
            </div>
          </>
        )}
      </div>
      <div className="my-2 border-t border-dashed border-black/40" />
      <div className="text-center text-[11px]">{shop?.footer || t('receiptThanks')}</div>
    </div>
  )
}

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c])

// 58mm thermal page printed through the phone's print screen
export function printReceipt(sale, shop, thanks = 'Thank you for shopping!') {
  // this phone is set to print straight to the Bluetooth printer through RawBT
  if (getPrintMode() === 'rawbt' && isAndroid()) return sendToRawbt(receiptBytes(sale, shop, thanks, when(sale)))
  const row = (a, b, bold = false) => `<div class="r${bold ? ' b' : ''}"><span>${esc(a)}</span><span>${esc(b)}</span></div>`
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${esc(sale.receiptNo)}</title>
<style>
@page { size: 58mm auto; margin: 2mm; }
* { box-sizing: border-box; }
body { width: 54mm; margin: 0; font: 11px/1.35 "Courier New", monospace; color: #000; }
.c { text-align: center; } .b { font-weight: bold; } .big { font-size: 14px; }
.r { display: flex; justify-content: space-between; gap: 4px; }
hr { border: 0; border-top: 1px dashed #000; margin: 4px 0; }
.n { word-break: break-word; }
</style></head><body>
<div class="c b big">${esc((shop?.name || 'Book Mart').toUpperCase())}</div>
${shop?.address ? `<div class="c">${esc(shop.address)}</div>` : ''}
${shop?.phone ? `<div class="c">${esc(shop.phone)}</div>` : ''}
<div class="c">${esc(when(sale))}</div>
<div class="c">Receipt #${esc(sale.receiptNo)}</div>
${sale.byName ? `<div class="c">Cashier: ${esc(sale.byName)}</div>` : ''}
<hr>
${sale.lines.map((l) => `<div class="n">${esc(lineName(l))}</div>${row(`${l.qty} x ${money(l.price)}`, money(l.qty * l.price))}`).join('')}
<hr>
${row('Subtotal', money(sale.subtotal))}
${sale.discount > 0 ? row('Discount', '-' + money(sale.discount)) : ''}
${row('TOTAL Rs', money(sale.total), true)}
${sale.due > 0 ? row('Paid', money(sale.paid)) + row(`Udhaar${sale.customerName ? ' (' + sale.customerName + ')' : ''}`, money(sale.due), true) : ''}
<hr>
<div class="c">${esc(shop?.footer || thanks)}</div>
<br>
</body></html>`

  const frame = document.createElement('iframe')
  frame.setAttribute('aria-hidden', 'true')
  frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0'
  document.body.appendChild(frame)
  const w = frame.contentWindow
  w.document.open()
  w.document.write(html)
  w.document.close()
  setTimeout(() => {
    w.focus()
    w.print()
    setTimeout(() => frame.remove(), 2000)
  }, 250)
}

// Plain text receipt for WhatsApp / SMS
export function receiptText(sale, shop) {
  const lines = [
    `*${shop?.name || 'Book Mart'}*`,
    `${when(sale)} · #${sale.receiptNo}`,
    '',
    ...sale.lines.map((l) => `${lineName(l)}\n  ${l.qty} x ${money(l.price)} = ${money(l.qty * l.price)}`),
    '',
    sale.discount > 0 ? `Discount: -${money(sale.discount)}` : null,
    `*Total: Rs ${money(sale.total)}*`,
    sale.due > 0 ? `Paid: Rs ${money(sale.paid)}\nUdhaar: Rs ${money(sale.due)}` : null,
    shop?.footer || null,
  ]
  return lines.filter((x) => x !== null).join('\n')
}

export async function shareReceipt(sale, shop) {
  const text = receiptText(sale, shop)
  if (navigator.share) {
    try {
      await navigator.share({ text })
      return 'shared'
    } catch {
      return 'cancelled'
    }
  }
  try {
    await navigator.clipboard.writeText(text)
    return 'copied'
  } catch {
    return 'failed'
  }
}
