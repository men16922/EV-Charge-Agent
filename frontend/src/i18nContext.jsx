import { createContext, useContext, useState, useCallback, useMemo } from 'react'
import { I18N } from './i18n.js'

const I18nContext = createContext(null)

export function I18nProvider({ children }) {
  const [lang, setLang] = useState(() => localStorage.getItem('lang') || 'en')

  const t = useCallback((k) => (I18N[lang] && I18N[lang][k]) || I18N.en[k] || k, [lang])

  const setLanguage = useCallback((l) => {
    localStorage.setItem('lang', l)
    document.documentElement.lang = l
    setLang(l)
  }, [])

  const toggle = useCallback(() => setLanguage(lang === 'en' ? 'ko' : 'en'), [lang, setLanguage])

  const value = useMemo(() => ({ lang, t, setLanguage, toggle }), [lang, t, setLanguage, toggle])
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n() {
  const ctx = useContext(I18nContext)
  if (!ctx) throw new Error('useI18n must be used within I18nProvider')
  return ctx
}
