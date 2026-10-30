// Type-ahead product search for the Sell screen.
// Matches full or partial words in English or Urdu, across item, colour/variant,
// sub-category, category and barcode. "blu pen" finds "Ball Pen 0.7mm · Blue".
// Tapping a result adds it to the cart; the list stays open to add more.

import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { useLang } from '../context/LangContext'
import { Rs } from './ui'
import Icon from './Icon'
import { beepError, beepOk } from '../lib/beep'

const norm = (s) => (s || '').toString().toLowerCase().normalize('NFKC').trim()
const MAX = 8

const escapeRe = (x) => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

function score(e, q, tokens) {
  const name = norm(e.item.en) + ' ' + norm(e.item.ur)
  const hay = [e.item.en, e.item.ur, e.variant.en, e.variant.ur, e.sub.en, e.sub.ur, e.cat.en, e.cat.ur, e.variant.code]
    .map(norm)
    .join(' ')
  if (!tokens.every((tk) => hay.includes(tk))) return -1
  if (e.variant.code && norm(e.variant.code) === q) return 1000 // exact barcode
  let s = 0
  if (name.startsWith(q)) s += 200
  for (const tk of tokens) {
    const atWordStart = new RegExp(`(^|\\s)${escapeRe(tk)}`)
    if (atWordStart.test(name)) s += 40 // word in the item name starts with what was typed
    else if (name.includes(tk)) s += 15
    if (atWordStart.test(hay)) s += 10 // e.g. colour or category word starts with it
  }
  return s
}

// Bold the typed part inside a label
function Highlight({ text, tokens }) {
  if (!tokens.length || !text) return text
  // Urdu letters join to each other; splitting a word into a highlight breaks the shapes, so skip it
  if (/[\u0600-\u06FF]/.test(text)) return text
  const lower = text.toLowerCase()
  let best = null
  for (const tk of tokens) {
    const i = lower.indexOf(tk)
    if (i >= 0 && (!best || tk.length > best.len)) best = { i, len: tk.length }
  }
  if (!best) return text
  return (
    <>
      {text.slice(0, best.i)}
      <mark className="rounded-sm bg-lime-100 text-charcoal">{text.slice(best.i, best.i + best.len)}</mark>
      {text.slice(best.i + best.len)}
    </>
  )
}

export default function ProductSearch({ entries, qtyOf = {}, onAdd, stockOf = null }) {
  const { t, pick } = useLang()
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const boxRef = useRef(null)
  const inputRef = useRef(null)
  const listId = useId()

  const q = norm(query)
  const tokens = useMemo(() => q.split(/\s+/).filter(Boolean), [q])

  const results = useMemo(() => {
    if (!tokens.length) return []
    return entries
      .map((e) => ({ e, s: score(e, q, tokens) }))
      .filter((r) => r.s >= 0)
      .sort((a, b) => b.s - a.s || pick(a.e.item).localeCompare(pick(b.e.item)))
      .map((r) => r.e)
  }, [entries, q, tokens, pick])

  const shown = results.slice(0, MAX)

  useEffect(() => setActive(0), [q])

  // close when tapping outside
  useEffect(() => {
    const onDown = (ev) => {
      if (boxRef.current && !boxRef.current.contains(ev.target)) setOpen(false)
    }
    document.addEventListener('pointerdown', onDown)
    return () => document.removeEventListener('pointerdown', onDown)
  }, [])

  function choose(e) {
    onAdd(e.item, e.variant)
    inputRef.current?.focus()
  }

  function onKeyDown(ev) {
    if (ev.key === 'ArrowDown') {
      ev.preventDefault()
      setOpen(true)
      setActive((a) => Math.min(a + 1, shown.length - 1))
    } else if (ev.key === 'ArrowUp') {
      ev.preventDefault()
      setActive((a) => Math.max(a - 1, 0))
    } else if (ev.key === 'Enter') {
      ev.preventDefault()
      // a USB/Bluetooth barcode scanner types the code and presses Enter: beep like the camera scanner
      const exact = entries.find((e) => e.variant.code && norm(e.variant.code) === q)
      if (exact) {
        const ok = onAdd(exact.item, exact.variant)
        if (ok === false) beepError()
        else beepOk()
        setQuery('')
        inputRef.current?.focus()
      } else if (/^\d{8,14}$/.test(q)) beepError()
      else if (shown[active]) choose(shown[active])
    } else if (ev.key === 'Escape') {
      setOpen(false)
    }
  }

  const showList = open && tokens.length > 0

  return (
    <div ref={boxRef} className="relative">
      <div className="relative">
        <Icon name="search" size={22} className="pointer-events-none absolute inset-y-0 start-4 my-auto text-muted" />
        <input
          ref={inputRef}
          type="search"
          role="combobox"
          aria-expanded={showList}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={showList && shown[active] ? `${listId}-${active}` : undefined}
          aria-label={t('searchItems')}
          placeholder={t('searchItems')}
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          className="field min-h-14 rounded-2xl ps-12 pe-12 text-lg [&::-webkit-search-cancel-button]:hidden"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
        />
        {query && (
          <button
            type="button"
            aria-label={t('clearSearch')}
            onClick={() => {
              setQuery('')
              inputRef.current?.focus()
            }}
            className="absolute inset-y-0 end-1 my-auto flex h-12 w-12 cursor-pointer items-center justify-center rounded-full text-muted hover:bg-paper"
          >
            <Icon name="x" size={20} />
          </button>
        )}
      </div>

      {showList && (
        <div className="absolute inset-x-0 top-full z-40 mt-2 overflow-hidden rounded-2xl border border-line bg-white shadow-xl">
          {shown.length === 0 ? (
            <div className="flex items-center gap-3 px-4 py-5 text-muted">
              <Icon name="search" size={20} />
              <span>
                {t('noMatch')} “<span className="font-semibold text-ink">{query.trim()}</span>”
              </span>
            </div>
          ) : (
            <ul id={listId} role="listbox" aria-label={t('searchResults')} className="max-h-[55vh] overflow-y-auto">
              {shown.map((e, i) => {
                const qty = qtyOf[e.variant.id] || 0
                const many = e.item.variants.length > 1
                return (
                  <li
                    key={e.variant.id}
                    id={`${listId}-${i}`}
                    role="option"
                    aria-selected={i === active}
                    onClick={() => choose(e)}
                    onPointerEnter={() => setActive(i)}
                    className={`flex min-h-16 cursor-pointer items-center gap-3 border-b border-line/70 px-4 py-2 last:border-0 ${
                      i === active ? 'bg-paper' : 'bg-white'
                    } active:bg-lime-50`}
                  >
                    {e.variant.dot ? (
                      <span aria-hidden="true" className="h-5 w-5 shrink-0 rounded-full border border-black/15" style={{ background: e.variant.dot }} />
                    ) : (
                      <span aria-hidden="true" className="flex h-5 w-5 shrink-0 items-center justify-center text-muted">
                        <Icon name="package" size={18} />
                      </span>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="line-clamp-2 font-semibold leading-snug text-ink">
                        <Highlight text={pick(e.item)} tokens={tokens} />
                        {many && (
                          <span className="font-normal text-muted">
                            {' · '}
                            <Highlight text={pick(e.variant)} tokens={tokens} />
                          </span>
                        )}
                      </div>
                      <div className="truncate text-sm text-muted">
                        {pick(e.cat)} › {pick(e.sub)}
                      </div>
                    </div>
                    <span className="flex flex-col items-end">
                      <Rs value={e.item.price} className="font-bold text-charcoal" />
                      {stockOf && (() => {
                        const left = stockOf(e.variant.id) - qty
                        return (
                          <span className={`text-xs font-semibold ${left <= 0 || left <= (e.item.lowStock ?? 0) ? 'text-danger' : 'text-muted'}`}>
                            {left <= 0 ? t('outOfStock') : <><span className="latin">{left}</span> {t('leftWord')}</>}
                          </span>
                        )
                      })()}
                    </span>
                    {qty > 0 ? (
                      <span key={qty} className="pop latin flex h-8 min-w-8 items-center justify-center rounded-full bg-lime px-2 text-sm font-bold text-charcoal">
                        {qty}
                      </span>
                    ) : (
                      <span aria-hidden="true" className="flex h-8 w-8 items-center justify-center rounded-full bg-charcoal text-white">
                        <Icon name="plus" size={18} />
                      </span>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
          {results.length > MAX && (
            <div className="border-t border-line bg-paper px-4 py-2 text-sm text-muted">
              <span className="latin">+{results.length - MAX}</span> {t('moreResults')}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
