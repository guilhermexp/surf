type RuntimeEnvValue = string | boolean | undefined
type RuntimeEnvRecord = Record<string, RuntimeEnvValue>

const GLOBAL_KEY = '__SURF_RUNTIME_ENV__'

const getGlobalObject = () =>
  globalThis as typeof globalThis & {
    [GLOBAL_KEY]?: RuntimeEnvRecord
    window?: typeof window & {
      api?: {
        env?: RuntimeEnvRecord
      }
    }
    process?: NodeJS.Process & {
      env?: NodeJS.ProcessEnv
    }
  }

const getEnvSources = (): RuntimeEnvRecord[] => {
  const globalObject = getGlobalObject()
  const sources: RuntimeEnvRecord[] = []

  if (globalObject[GLOBAL_KEY]) {
    sources.push(globalObject[GLOBAL_KEY] as RuntimeEnvRecord)
  }

  if (globalObject.window?.api?.env) {
    sources.push(globalObject.window.api.env)
  }

  if (globalObject.process?.env) {
    sources.push(globalObject.process.env)
  }

  return sources
}

const coerceBoolean = (value: RuntimeEnvValue, fallback: boolean) => {
  if (typeof value === 'boolean') {
    return value
  }

  if (typeof value === 'string') {
    if (value.toLowerCase() === 'true') return true
    if (value.toLowerCase() === 'false') return false
  }

  return fallback
}

const coerceString = (value: RuntimeEnvValue) => {
  if (typeof value === 'string') {
    return value
  }

  if (typeof value === 'boolean') {
    return value ? 'true' : 'false'
  }

  return undefined
}

export const getRuntimeEnvValue = (key: string): RuntimeEnvValue => {
  for (const source of getEnvSources()) {
    if (source && typeof source[key] !== 'undefined') {
      return source[key]
    }
  }
  return undefined
}

export const getRuntimeEnvString = (key: string): string | undefined => {
  return coerceString(getRuntimeEnvValue(key))
}

export const getRuntimeEnvBoolean = (key: string, fallback = false): boolean => {
  return coerceBoolean(getRuntimeEnvValue(key), fallback)
}

export const registerRuntimeEnv = (env: RuntimeEnvRecord) => {
  if (typeof env !== 'object' || !env) return

  const globalObject = getGlobalObject()
  const existing = globalObject[GLOBAL_KEY] ?? {}
  globalObject[GLOBAL_KEY] = {
    ...existing,
    ...env
  }
}

export const resolvePlatform = (): 'darwin' | 'win32' | 'linux' => {
  const envPlatform = getRuntimeEnvString('PLATFORM')
  if (envPlatform === 'darwin' || envPlatform === 'win32' || envPlatform === 'linux') {
    return envPlatform
  }

  if (typeof process !== 'undefined' && process.platform) {
    if (process.platform === 'darwin') return 'darwin'
    if (process.platform === 'win32') return 'win32'
    return 'linux'
  }

  if (typeof navigator !== 'undefined') {
    const uaData = (navigator as { userAgentData?: { platform?: string } }).userAgentData
    const platform = uaData?.platform ?? navigator.platform ?? ''
    if (/mac/i.test(platform)) return 'darwin'
    if (/win/i.test(platform)) return 'win32'
  }

  return 'linux'
}
