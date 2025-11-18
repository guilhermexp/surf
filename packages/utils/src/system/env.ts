import { getRuntimeEnvString } from './runtimeEnv'

const readEnv = (key: string, fallback: string) => {
  return getRuntimeEnvString(key) ?? fallback
}

export const CHEAT_SHEET_URL = readEnv(
  'R_VITE_CHEAT_SHEET_URL',
  'https://deta.notion.site/surf-alpha'
)
export const SHORTCUTS_PAGE_URL = readEnv(
  'R_VITE_SHORTCUTS_PAGE_URL',
  'https://deta.notion.site/keyboard-shortcuts'
)
export const CHANGELOG_URL = readEnv('R_VITE_CHANGELOG_URL', 'https://deta.notion.site/changelogs')
export const MAIN_ONBOARDING_VIDEO_URL = readEnv(
  'R_VITE_MAIN_ONBOARDING_VIDEO_URL',
  'https://www.youtube.com/embed/-FJf3qaVsCA'
)
