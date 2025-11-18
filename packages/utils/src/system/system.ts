import { RendererType } from '@deta/types'
import { getRuntimeEnvBoolean, resolvePlatform } from './runtimeEnv'

export const isMac = () => {
  return resolvePlatform() === 'darwin'
}

export const isWindows = () => {
  return resolvePlatform() === 'win32'
}

export const isLinux = () => {
  return resolvePlatform() === 'linux'
}

export const isDev = getRuntimeEnvBoolean('DEV', false)

export const isOffline = () => {
  return !navigator.onLine
}

export const isMainRenderer = () => window.RENDERER_TYPE === RendererType.Main
