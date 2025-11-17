import '../assets/style.css'
import '../../app.css'
import App from './Core.svelte'
import { mount } from 'svelte'
import { initLocalization, SUPPORTED_LOCALES } from './i18n'

/*
import * as Sentry from '@sentry/electron/renderer'
import { init as svelteInit } from '@sentry/svelte'

const sentryDSN = import.meta.env.R_VITE_SENTRY_DSN
if (sentryDSN) {
  Sentry.init(
    {
      dsn: sentryDSN,
      enableTracing: true,
      autoSessionTracking: false
    },
    svelteInit
  )
}
*/

let app: ReturnType<typeof mount> | undefined

const bootstrap = async () => {
  try {
    const userConfig = window.api.getUserConfig()
    const initialLocale = userConfig?.settings?.language ?? 'en'

    await initLocalization({
      defaultLocale: 'en',
      supportedLocales: SUPPORTED_LOCALES,
      initialLocale
    })
  } catch (error) {
    console.error('[core] Failed to initialize localization, continuing with defaults', error)
  }

  app = mount(App, {
    target: document.getElementById('app')
  })
}

bootstrap().catch((error) => {
  console.error('[core] Failed to bootstrap renderer', error)
})

export default app
