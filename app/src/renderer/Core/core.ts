import '../assets/style.css'
import '../../app.css'
import App from './Core.svelte'
import { mount } from 'svelte'
import { initLocalization, SUPPORTED_LOCALES } from './i18n'
import { registerRuntimeEnv } from '@deta/utils/system/runtimeEnv'

registerRuntimeEnv(import.meta.env)

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
  console.log('[core] Starting bootstrap...')

  try {
    console.log('[core] Getting user config...')
    const userConfig = window.api.getUserConfig()
    console.log('[core] User config:', userConfig)

    const initialLocale = userConfig?.settings?.language ?? 'en'
    console.log('[core] Initial locale:', initialLocale)

    console.log('[core] Initializing localization...')
    await initLocalization({
      defaultLocale: 'en',
      supportedLocales: SUPPORTED_LOCALES,
      initialLocale
    })
    console.log('[core] Localization initialized')
  } catch (error) {
    console.error('[core] Failed to initialize localization, continuing with defaults', error)
  }

  console.log('[core] Mounting App component...')
  const appElement = document.getElementById('app')
  console.log('[core] App element:', appElement)

  try {
    app = mount(App, {
      target: appElement
    })
    console.log('[core] App mounted successfully!')
  } catch (error) {
    console.error('[core] Failed to mount app:', error)
    throw error
  }
}

console.log('[core] Calling bootstrap...')
bootstrap().catch((error) => {
  console.error('[core] Failed to bootstrap renderer', error)
  document.body.innerHTML = `<div style="color: red; padding: 20px; font-family: monospace;">
    <h1>Bootstrap Error</h1>
    <pre>${error.message}\n\n${error.stack}</pre>
  </div>`
})

export default app
