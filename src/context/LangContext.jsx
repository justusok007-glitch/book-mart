import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { STRINGS } from '../lib/i18n'

const LangContext = createContext(null)

function readSaved() {
  try {
    return localStorage.getItem('bm-lang') === 'ur' ? 'ur' : 'en'
  } catch {
    return 'en'
  }
}

export function LangProvider({ children }) {
  const [lang, setLangState] = useState(readSaved)

  useEffect(() => {
    document.documentElement.lang = lang
    document.documentElement.dir = lang === 'ur' ? 'rtl' : 'ltr'
  }, [lang])

  const setLang = useCallback((l) => {
    setLangState(l)
    try { localStorage.setItem('bm-lang', l) } catch { /* ignore */ }
  }, [])

  // t('key') for UI strings; pick({en, ur}) for data that carries both languages
  const t = useCallback((key) => STRINGS[key]?.[lang] ?? STRINGS[key]?.en ?? key, [lang])
  const pick = useCallback((obj) => (lang === 'ur' ? obj?.ur || obj?.en : obj?.en || obj?.ur) ?? '', [lang])

  return (
    <LangContext.Provider value={{ lang, setLang, t, pick }}>
      {children}
    </LangContext.Provider>
  )
}

export const useLang = () => useContext(LangContext)
