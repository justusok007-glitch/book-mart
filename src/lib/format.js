// Date helpers (Firestore Timestamp or Date)
export function toDate(ts) {
  if (!ts) return null
  if (ts instanceof Date) return ts
  return ts.toDate?.() ?? null
}

export function fmtDate(ts, withTime = true) {
  const d = toDate(ts)
  if (!d) return '…'
  const day = d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: d.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined })
  return withTime ? `${day} ${d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}` : day
}
