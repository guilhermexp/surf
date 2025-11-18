import type { Session } from 'electron'
import path from 'path'

type PatchedSession = Session & {
  __surfPreloadOrder__?: string[]
  __surfPreloadIds__?: Map<string, string>
}

const patchedSessions = new WeakSet<Session>()

const normalizePreloadPath = (filePath: string) => {
  if (!filePath) return filePath
  if (path.isAbsolute(filePath)) return filePath
  return path.resolve(filePath)
}

export const polyfillSessionPreloadAPI = (session: Session) => {
  if (!session || typeof session.registerPreloadScript !== 'function') {
    return session
  }

  if (patchedSessions.has(session)) {
    return session
  }

  const patched = session as PatchedSession
  patched.__surfPreloadIds__ = new Map<string, string>()
  const existingScripts = session.getPreloadScripts?.() ?? []
  existingScripts.forEach((script) => {
    patched.__surfPreloadIds__?.set(script.filePath, script.id)
  })
  patched.__surfPreloadOrder__ = existingScripts.map((script) => script.filePath)

  const unregister = (filePath: string) => {
    const normalized = normalizePreloadPath(filePath)
    const id = patched.__surfPreloadIds__?.get(normalized)
    if (!id) return
    try {
      session.unregisterPreloadScript(id)
    } finally {
      patched.__surfPreloadIds__?.delete(normalized)
    }
  }

  const register = (filePath: string) => {
    const normalized = normalizePreloadPath(filePath)
    if (patched.__surfPreloadIds__?.has(normalized)) {
      return normalized
    }
    const id = session.registerPreloadScript({ filePath: normalized, type: 'frame' })
    patched.__surfPreloadIds__?.set(normalized, id)
    return normalized
  }

  session.getPreloads = () => {
    return [...(patched.__surfPreloadOrder__ ?? [])]
  }

  session.setPreloads = (preloads: string[]) => {
    const desired = preloads.map((filePath) => normalizePreloadPath(filePath))

    for (const existing of patched.__surfPreloadIds__?.keys() ?? []) {
      if (!desired.includes(existing)) {
        unregister(existing)
      }
    }

    desired.forEach((filePath) => register(filePath))
    patched.__surfPreloadOrder__ = desired
  }

  patchedSessions.add(session)
  return session
}
