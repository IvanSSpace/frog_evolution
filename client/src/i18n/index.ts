import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import ru from './ru.json'
import en from './en.json'
import es from './es.json'

const LANG_KEY = 'frog_lang'
export type Lang = 'ru' | 'en' | 'es'

function getSavedLang(): Lang {
  try {
    const saved = localStorage.getItem(LANG_KEY)
    if (saved === 'en' || saved === 'es') return saved
  } catch {
    /* ignore */
  }
  return 'ru'
}

export function setLang(lang: Lang) {
  try {
    localStorage.setItem(LANG_KEY, lang)
  } catch {
    /* ignore */
  }
  i18n.changeLanguage(lang)
}

i18n.use(initReactI18next).init({
  resources: {
    ru: { translation: ru },
    en: { translation: en },
    es: { translation: es },
  },
  lng: getSavedLang(),
  fallbackLng: 'ru',
  interpolation: { escapeValue: false },
})

export default i18n
