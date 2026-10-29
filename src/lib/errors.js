// Turn Firebase error codes into a message the shop staff can act on
export function errorText(e, t) {
  const code = (e?.code || '').replace(/^firestore\//, '')
  if (code === 'permission-denied') return t('permissionDenied')
  if (code === 'unavailable' || code === 'auth/network-request-failed') return t('needsInternet')
  return t('somethingWrong') + (code ? ` (${code})` : '')
}
