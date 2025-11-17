import { derived, get, writable } from 'svelte/store'
import type { Locale, UserSettings } from '@deta/types'

type TranslationTree = Record<string, unknown>
type TranslationParams = Record<string, string | number>

export type LocalizationInitOptions = {
  defaultLocale?: Locale
  supportedLocales?: Locale[]
  initialLocale?: string | null
}

const FALLBACK_LOCALE: Locale = 'en'
export const SUPPORTED_LOCALES: Locale[] = ['en', 'pt']
const LOCALE_RESOURCE_PREFIX = '../assets/locales/'

const localeStore = writable<Locale>(FALLBACK_LOCALE)
const translationsStore = writable<TranslationTree>({})
const readyStore = writable(false)

export const locale = { subscribe: localeStore.subscribe }
export const translations = { subscribe: translationsStore.subscribe }
export const isLocalizationReady = { subscribe: readyStore.subscribe }

export const translator = derived(translationsStore, ($translations) => {
  return (key: string, params?: TranslationParams) => {
    const value = resolveKey($translations, key)

    if (typeof value === 'string') {
      return interpolate(value, params)
    }

    if (typeof value === 'number') {
      return value.toString()
    }

    return key
  }
})

export const t = (key: string, params?: TranslationParams) => {
  return get(translator)(key, params)
}

let supportedLocales: Locale[] = [...SUPPORTED_LOCALES]
let defaultLocale: Locale = FALLBACK_LOCALE
let currentLocale: Locale = FALLBACK_LOCALE
let initializationPromise: Promise<void> | null = null
let settingsListenerBound = false
const translationCache: Partial<Record<Locale, TranslationTree>> = {}

type SurfWindow = Window &
  typeof globalThis & {
    api?: import('../../preload/core').API
  }

const localeModules = import.meta.glob('../assets/locales/*.json', {
  import: 'default'
}) as Record<string, () => Promise<TranslationTree>>

export function getLocale() {
  return get(localeStore)
}

export function getSupportedLocales(): Locale[] {
  return [...supportedLocales]
}

export async function initLocalization(options?: LocalizationInitOptions) {
  if (initializationPromise) {
    return initializationPromise
  }

  initializationPromise = (async () => {
    supportedLocales = sanitizeSupportedLocales(options?.supportedLocales)

    const requestedDefault = options?.defaultLocale
    defaultLocale = isSupportedLocale(requestedDefault) ? requestedDefault : FALLBACK_LOCALE

    const targetLocale = resolveInitialLocale(options?.initialLocale)

    await applyLocale(targetLocale)
    readyStore.set(true)

    bindSettingsChangeListener()
  })()

  return initializationPromise
}

export async function setLocale(locale: Locale) {
  if (!isSupportedLocale(locale)) {
    console.warn(`[i18n] Unsupported locale "${locale}", falling back to ${currentLocale}`)
    return currentLocale
  }

  if (locale === currentLocale) {
    return currentLocale
  }

  await applyLocale(locale)
  return currentLocale
}

async function applyLocale(locale: Locale) {
  const fallbackTranslations = await loadLocaleResource(FALLBACK_LOCALE)
  const localeTranslations =
    locale === FALLBACK_LOCALE ? fallbackTranslations : await loadLocaleResource(locale)

  const mergedTranslations =
    locale === FALLBACK_LOCALE
      ? fallbackTranslations
      : deepMerge(fallbackTranslations, localeTranslations)

  translationsStore.set(mergedTranslations)
  localeStore.set(locale)
  currentLocale = locale
  setDocumentLanguage(locale)
}

async function loadLocaleResource(locale: Locale): Promise<TranslationTree> {
  if (translationCache[locale]) {
    return translationCache[locale] as TranslationTree
  }

  const loader = localeModules[`${LOCALE_RESOURCE_PREFIX}${locale}.json`]

  if (!loader) {
    console.warn(`[i18n] Missing translation file for locale "${locale}"`)
    translationCache[locale] = {}
    return {}
  }

  try {
    const data = await loader()

    if (!isPlainObject(data)) {
      console.warn(`[i18n] Invalid translation data for locale "${locale}"`)
      translationCache[locale] = {}
      return {}
    }

    translationCache[locale] = data
    return data
  } catch (error) {
    console.error(`[i18n] Failed to load translations for locale "${locale}"`, error)
    translationCache[locale] = {}
    return {}
  }
}

function resolveInitialLocale(locale?: string | null): Locale {
  if (locale && isSupportedLocale(locale)) {
    return locale
  }

  if (isSupportedLocale(defaultLocale)) {
    return defaultLocale
  }

  return FALLBACK_LOCALE
}

function sanitizeSupportedLocales(locales?: Locale[]) {
  if (!locales || locales.length === 0) {
    return [...SUPPORTED_LOCALES]
  }

  const uniqueLocales = new Set<Locale>([...locales, FALLBACK_LOCALE])
  return Array.from(uniqueLocales)
}

function isSupportedLocale(locale: unknown): locale is Locale {
  return typeof locale === 'string' && supportedLocales.includes(locale as Locale)
}

function resolveKey(translations: TranslationTree, path: string) {
  return path.split('.').reduce<unknown>((current, segment) => {
    if (current && typeof current === 'object' && segment in (current as TranslationTree)) {
      return (current as TranslationTree)[segment]
    }
    return undefined
  }, translations)
}

function interpolate(template: string, params?: TranslationParams): string {
  if (!params) {
    return template
  }

  return template.replace(/\{(\w+)\}/g, (match, key) => {
    if (params[key as keyof TranslationParams] === undefined) {
      return match
    }
    return String(params[key as keyof TranslationParams])
  })
}

function deepMerge(base: TranslationTree, override: TranslationTree): TranslationTree {
  const output: TranslationTree = { ...base }

  for (const key of Object.keys(override)) {
    const baseValue = base[key]
    const overrideValue = override[key]

    if (isPlainObject(baseValue) && isPlainObject(overrideValue)) {
      output[key] = deepMerge(baseValue as TranslationTree, overrideValue as TranslationTree)
    } else {
      output[key] = overrideValue
    }
  }

  return output
}

function isPlainObject(value: unknown): value is TranslationTree {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function bindSettingsChangeListener() {
  if (settingsListenerBound) {
    return
  }

  const surfWindow = typeof window === 'undefined' ? null : (window as SurfWindow)
  const api = surfWindow?.api

  if (!api?.onUserConfigSettingsChange) {
    return
  }

  api.onUserConfigSettingsChange((settings: UserSettings) => {
    const nextLocale = settings.language

    if (nextLocale && isSupportedLocale(nextLocale) && nextLocale !== currentLocale) {
      setLocale(nextLocale).catch((error) => {
        console.error('[i18n] Failed to apply locale from user settings change', error)
      })
    }
  })

  settingsListenerBound = true
}

function setDocumentLanguage(locale: Locale) {
  if (typeof document === 'undefined') {
    return
  }

  document.documentElement.setAttribute('lang', locale)
}

export type { Locale }

export const __i18nTesting = {
  reset() {
    supportedLocales = [...SUPPORTED_LOCALES]
    defaultLocale = FALLBACK_LOCALE
    currentLocale = FALLBACK_LOCALE
    initializationPromise = null
    settingsListenerBound = false
    Object.keys(translationCache).forEach((key) => {
      delete translationCache[key as Locale]
    })
    localeStore.set(FALLBACK_LOCALE)
    translationsStore.set({})
    readyStore.set(false)
  },
  setTranslations(locale: Locale, translations: TranslationTree) {
    translationCache[locale] = translations
  }
}
