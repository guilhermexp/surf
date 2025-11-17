import { render, fireEvent, waitFor } from '@testing-library/svelte/svelte5'
import LanguageSelector from '../components/LanguageSelector.svelte'
import { initLocalization, __i18nTesting } from '../../Core/i18n'
import type { Locale } from '@deta/types'

const createSettings = (language: Locale) => ({
  language,
  search_engine: 'google',
  teletype_default_action: 'auto',
  model_settings: [],
  selected_model: 'model-1',
  experimental_notes_chat_sidebar: false,
  experimental_notes_chat_input: false,
  app_style: 'light'
})

const mockWindowApi = (settings: ReturnType<typeof createSettings>) => {
  const updateUserConfigSettings = vi.fn(async (updated: Record<string, unknown>) => {
    Object.assign(settings, updated)
    return settings
  })

  Object.defineProperty(window, 'api', {
    value: { updateUserConfigSettings },
    writable: true
  })

  return updateUserConfigSettings
}

describe('Language selector behavior', () => {
  beforeEach(async () => {
    vi.restoreAllMocks()
    __i18nTesting.reset()
    await initLocalization({ initialLocale: 'pt' })
  })

  it('shows the configured language in the selector', async () => {
    const settings = createSettings('pt')
    mockWindowApi(settings)
    const { findByTestId } = render(LanguageSelector, { settings })

    const select = (await findByTestId('language-select')) as HTMLSelectElement
    await waitFor(() => expect(select.value).toBe('pt'))
    await waitFor(() => expect(document.querySelector('h2')?.textContent).toContain('Idioma'))
  })

  it('persists language changes and updates visible text', async () => {
    const settings = createSettings('pt')
    const updateUserConfigSettings = mockWindowApi(settings)
    const { findByTestId, findByText } = render(LanguageSelector, { settings })

    const select = (await findByTestId('language-select')) as HTMLSelectElement
    await waitFor(() => expect(select.value).toBe('pt'))
    expect(await findByText('Idioma')).toBeTruthy()

    await fireEvent.change(select, { target: { value: 'en' } })

    await waitFor(() =>
      expect(updateUserConfigSettings).toHaveBeenCalledWith(
        expect.objectContaining({ language: 'en' })
      )
    )

    await waitFor(() => expect(select.value).toBe('en'))
    await waitFor(() => expect(document.querySelector('h2')?.textContent).toContain('Language'))
  })
})
