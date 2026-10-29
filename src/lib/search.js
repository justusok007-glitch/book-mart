// Shared partial-word matching for English + Urdu.
// Every typed word must appear somewhere; words that START a word in the name rank higher.

export const norm = (s) => (s ?? '').toString().toLowerCase().normalize('NFKC').trim()
export const tokenize = (q) => norm(q).split(/\s+/).filter(Boolean)
const escapeRe = (x) => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/**
 * @param {string[]} nameParts  main name(s) (ranked highest)
 * @param {string[]} otherParts everything else searchable (colour, category, barcode…)
 * @param {string}   q          normalised full query
 * @param {string[]} tokens     query words
 * @param {string[]} codes      barcodes for exact-match boost
 * @returns score, or -1 when it does not match
 */
export function matchScore(nameParts, otherParts, q, tokens, codes = []) {
  if (!tokens.length) return 0
  const name = nameParts.map(norm).join(' ')
  const hay = name + ' ' + otherParts.map(norm).join(' ')
  if (!tokens.every((tk) => hay.includes(tk))) return -1
  if (codes.some((c) => c && norm(c) === q)) return 1000
  let s = 0
  if (name.startsWith(q)) s += 200
  for (const tk of tokens) {
    const start = new RegExp(`(^|\\s)${escapeRe(tk)}`)
    if (start.test(name)) s += 40
    else if (name.includes(tk)) s += 15
    if (start.test(hay)) s += 10
  }
  return s
}
