import '../assets/style.css'
import '../assets/fonts/Bayshore.woff2'
import '../assets/fonts/Bayshore.woff'
import '../assets/fonts/Gambarino-Regular.woff'
import '../assets/fonts/Gambarino-Regular.woff2'
import '@deta/ui/src/output.css'
import '@deta/ui/src/app.css'
import Settings from './Settings.svelte'
import { mount } from 'svelte'
import { initLocalization, SUPPORTED_LOCALES } from '../Core/i18n'
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
  try {
    const userConfig = window.api.getUserConfig()
    const initialLocale = userConfig?.settings?.language ?? 'en'

    await initLocalization({
      defaultLocale: 'en',
      supportedLocales: SUPPORTED_LOCALES,
      initialLocale
    })
  } catch (error) {
    console.error('[settings] Failed to initialize localization, continuing with defaults', error)
  }

  app = mount(Settings, {
    target: document.getElementById('app')
  })
}

bootstrap().catch((error) => {
  console.error('[settings] Failed to bootstrap renderer', error)
})

export default app
