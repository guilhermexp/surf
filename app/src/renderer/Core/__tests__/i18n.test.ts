import { describe, it, expect, beforeEach } from 'vitest'
import { getLocale, initLocalization, setLocale, t, __i18nTesting } from '../i18n'

const delay = () => new Promise((resolve) => setTimeout(resolve, 0))

describe('i18n', () => {
  beforeEach(() => {
    __i18nTesting.reset()
  })

  it('initializes with a supported locale', async () => {
    await initLocalization({ initialLocale: 'pt' })
    expect(getLocale()).toBe('pt')
    expect(t('settings.tabs.general')).toBe('Geral')
  })

  it('falls back to English when locale is unsupported', async () => {
    await initLocalization({ initialLocale: 'es' })
    expect(getLocale()).toBe('en')
    expect(t('settings.tabs.general')).toBe('General')
  })

  it('switches locales at runtime', async () => {
    await initLocalization({ initialLocale: 'en' })
    expect(getLocale()).toBe('en')
    await setLocale('pt')
    await delay()
    expect(getLocale()).toBe('pt')
    expect(t('settings.tabs.general')).toBe('Geral')
  })

  it('falls back to English for missing keys', async () => {
    __i18nTesting.setTranslations('pt', {
      settings: {
        tabs: {
          general: 'Geral'
        }
      }
    })

    await initLocalization({ supportedLocales: ['en', 'pt'], initialLocale: 'pt' })
    expect(t('settings.tabs.general')).toBe('Geral')
    expect(t('core.navigation.askButton')).toBe('Ask')
  })

  it('returns key name when a translation does not exist anywhere', async () => {
    await initLocalization({ initialLocale: 'en' })
    expect(t('nonexistent.key')).toBe('nonexistent.key')
  })
})
