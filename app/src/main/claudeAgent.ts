import { query } from '@anthropic-ai/claude-agent-sdk'
import type { Message } from '@deta/backend/types'
import { access } from 'node:fs/promises'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { EventEmitter } from 'node:events'

// Polyfill to fix AbortSignal.setMaxListeners compatibility issue in Electron
// The SDK tries to call setMaxListeners on AbortSignal which is not an EventEmitter
if (typeof AbortSignal !== 'undefined' && !(AbortSignal.prototype as any).setMaxListeners) {
  Object.defineProperty(AbortSignal.prototype, 'setMaxListeners', {
    value: function () {
      // AbortSignal doesn't need max listeners management, so this is a no-op
      return this
    },
    writable: true,
    configurable: true
  })
}

// Also patch EventEmitter.setMaxListeners to handle AbortSignal gracefully
const originalSetMaxListeners = EventEmitter.setMaxListeners
if (originalSetMaxListeners) {
  EventEmitter.setMaxListeners = function (n: number, ...eventTargets: any[]) {
    const validTargets = eventTargets.filter((target) => {
      // Filter out AbortSignal instances as they don't support setMaxListeners
      return !(target instanceof AbortSignal)
    })
    if (validTargets.length > 0) {
      return originalSetMaxListeners.call(this, n, ...validTargets)
    }
  }
}

// Enable detailed logging for Claude Agent
const DEBUG_CLAUDE_AGENT = true
const log = (message: string, ...args: any[]) => {
  if (DEBUG_CLAUDE_AGENT) {
    console.log(`[Claude Agent] ${message}`, ...args)
  }
}
const logError = (message: string, ...args: any[]) => {
  console.error(`[Claude Agent ERROR] ${message}`, ...args)
}

interface ClaudeAgentInvocation {
  messages: Message[]
  custom_key?: string
  cwd?: string
  timeout?: number
  model?: string
  onChunk?: (chunk: string) => void
}

interface ClaudeAgentResult {
  output: string
  error?: string
}

// Configuration constants
const DEFAULT_TIMEOUT_MS = 120000 // 2 minutes
const MAX_TIMEOUT_MS = 300000 // 5 minutes

// CLI path cache
let cachedCliPath: string | null = null

/**
 * Resolve the path to the Claude Code CLI executable
 * Based on working implementation from supermemory
 */
async function resolveClaudeCodeCliPath(): Promise<string> {
  log('Resolving Claude Code CLI path...')

  if (cachedCliPath) {
    log('Using cached CLI path:', cachedCliPath)
    return cachedCliPath
  }

  const moduleDir = fileURLToPath(new URL('.', import.meta.url))
  const candidateBases = [
    process.cwd(),
    resolve(process.cwd(), '..'),
    moduleDir,
    resolve(moduleDir, '..'),
    resolve(moduleDir, '..', '..'),
    resolve(moduleDir, '..', '..', '..'),
    resolve(moduleDir, '..', '..', '..', '..')
  ]

  const candidatePaths = Array.from(
    new Set(
      candidateBases.map((base) =>
        resolve(base, 'node_modules/@anthropic-ai/claude-agent-sdk/cli.js')
      )
    )
  )

  const tried: string[] = []
  log('Checking CLI paths:', candidatePaths.length, 'candidates')

  for (const candidate of candidatePaths) {
    tried.push(candidate)
    log('Trying CLI path:', candidate)
    try {
      await access(candidate)
      cachedCliPath = candidate
      log('✅ CLI found at:', candidate)
      return candidate
    } catch (error) {
      log('❌ Not found at:', candidate)
    }
  }

  const errorMsg = `CLI not found. Paths checked: ${tried.join(', ')}`
  logError(errorMsg)
  throw new Error(errorMsg)
}

function formatPrompt(messages: Message[]): string {
  return messages
    .map((message) => {
      const textContent = message.content
        .filter((item) => item.type === 'text')
        .map((item) => item.text)
        .join('\n')

      if (!textContent) return ''
      const role = message.role.toUpperCase()
      return `${role}:\n${textContent}`
    })
    .filter(Boolean)
    .join('\n\n')
}

async function runClaudeAgentInvocation(
  payload: ClaudeAgentInvocation
): Promise<ClaudeAgentResult> {
  log('=== Starting Claude Agent Invocation ===')
  log('Payload:', {
    messageCount: payload.messages?.length,
    hasCustomKey: !!payload.custom_key,
    cwd: payload.cwd,
    timeout: payload.timeout,
    model: payload.model
  })

  // Validate API key
  const apiKey = payload.custom_key || process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    logError('API key is missing')
    logError('Environment ANTHROPIC_API_KEY:', process.env.ANTHROPIC_API_KEY ? 'SET' : 'NOT SET')
    return {
      output: '',
      error:
        'Claude Agent API key is missing. Please set ANTHROPIC_API_KEY environment variable or provide custom_key in the request.'
    }
  }

  log('API key validation: OK (starts with sk-ant-)')

  if (!apiKey.startsWith('sk-ant-')) {
    logError('Invalid API key format. Expected sk-ant-*, got:', apiKey.substring(0, 7) + '...')
    return {
      output: '',
      error: 'Invalid Claude API key format. Key should start with "sk-ant-".'
    }
  }

  // Validate messages
  if (!payload.messages || payload.messages.length === 0) {
    logError('No messages provided')
    return {
      output: '',
      error: 'No messages provided to Claude Agent.'
    }
  }

  log('Messages validation: OK (' + payload.messages.length + ' messages)')

  const prompt = formatPrompt(payload.messages)
  log('Formatted prompt length:', prompt.length, 'characters')
  log('Prompt preview:', prompt.substring(0, 200) + (prompt.length > 200 ? '...' : ''))

  if (!prompt || prompt.trim().length === 0) {
    logError('Failed to format messages into valid prompt')
    return {
      output: '',
      error: 'Failed to format messages into a valid prompt.'
    }
  }

  let output = ''
  const timeout = Math.min(payload.timeout ?? DEFAULT_TIMEOUT_MS, MAX_TIMEOUT_MS)
  log('Timeout configured:', timeout / 1000, 'seconds')

  try {
    log('Starting query execution...')

    // Resolve CLI path (critical for cross-environment compatibility)
    const pathToClaudeCodeExecutable = await resolveClaudeCodeCliPath()
    log('CLI path resolved:', pathToClaudeCodeExecutable)

    // Complete query options based on working supermemory implementation
    const queryOptions: Record<string, unknown> = {
      model: payload.model || 'claude-sonnet-4-5-20250929',

      // 🔴 CRITICAL: Enable loading .claude/CLAUDE.md for system prompts
      settingSources: ['project'],
      cwd: payload.cwd ?? process.cwd(),
      pathToClaudeCodeExecutable,

      // Security and permissions
      permissionMode: 'bypassPermissions',
      allowDangerouslySkipPermissions: true,
      disallowedTools: [
        'Bash',
        'bash',
        'Grep',
        'grep',
        'KillShell',
        'killshell',
        'Agent',
        'agent',
        'BashOutput',
        'bashoutput',
        'ExitPlanMode',
        'exitplanmode'
      ],

      // Streaming and debugging
      includePartialMessages: false,
      stderr: (data: string) => {
        const output = data.trim()
        if (output.length > 0) {
          logError('[Claude CLI stderr]', output)
        }
      },

      // Environment - API key configuration and PATH for node executable
      env: {
        ANTHROPIC_API_KEY: apiKey,
        // Include PATH so the SDK can find the 'node' executable
        PATH: process.env.PATH || '/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin'
      }
    }

    log('Query options configured:', {
      model: queryOptions.model,
      cwd: queryOptions.cwd,
      settingSources: queryOptions.settingSources,
      permissionMode: queryOptions.permissionMode,
      hasPathToExecutable: !!pathToClaudeCodeExecutable,
      disallowedToolsCount: (queryOptions.disallowedTools as string[]).length
    })

    log('Calling query() with prompt and options...')
    const stream = query({
      prompt,
      options: queryOptions
    })
    log('Stream created, starting iteration...')

    let messageCount = 0
    const startTime = Date.now()

    try {
      for await (const msg of stream) {
        const message = msg as any
        // Check timeout manually
        if (Date.now() - startTime > timeout) {
          logError('Request timed out after', timeout, 'ms')
          throw new Error(`Claude Agent request timed out after ${timeout}ms`)
        }

        messageCount++
        log('Received message #' + messageCount + ':', {
          type: message.type,
          subtype: message.subtype,
          hasResult: !!message.result,
          isError: message.is_error,
          hasContent: !!message.content,
          fullMessage: message
        })

        // Handle streaming content deltas
        if (message.type === 'content' && message.content) {
          const chunk = message.content
          log('Got content chunk, length:', chunk.length)
          output += chunk

          // Send incremental update via callback if provided
          if (payload.onChunk) {
            payload.onChunk(chunk)
          }
        }

        if (message.type === 'result') {
          log('Got result message, subtype:', message.subtype)
          if (message.subtype === 'success') {
            // If result has content and we haven't accumulated anything, use it
            if (message.result && !output) {
              output = message.result
            }
            log('Success! Total output length:', output.length)
            // Break early on success to avoid process exit errors
            break
          } else if (message.is_error) {
            const errorMsg = `Claude Agent error: ${message.subtype}`
            logError(errorMsg)
            throw new Error(errorMsg)
          }
        }
      }
    } catch (streamError) {
      // If we got output before the error, that's OK - process exit errors are common
      if (output && output.trim().length > 0) {
        log('Stream ended with error but we have output, continuing...')
        log('Stream error was:', streamError instanceof Error ? streamError.message : streamError)
      } else {
        // No output captured, this is a real error
        throw streamError
      }
    }

    log('Stream iteration complete. Total messages:', messageCount)
    log('Query completed, output length:', output.length)

    if (!output || output.trim().length === 0) {
      logError('Empty response from Claude Agent')
      return {
        output: '',
        error: 'Claude Agent returned empty response.'
      }
    }

    log('✅ Success! Returning output')
    log('=== Claude Agent Invocation Complete ===')
    return { output }
  } catch (error) {
    logError('Exception caught:', error)
    logError('Error stack:', error instanceof Error ? error.stack : 'N/A')

    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'

    // Enhanced error messages
    let userFriendlyError = errorMessage

    if (errorMessage.includes('timeout')) {
      userFriendlyError = `Request timed out after ${timeout / 1000} seconds. Try again or increase the timeout.`
    } else if (errorMessage.includes('API key')) {
      userFriendlyError = 'Invalid or expired API key. Please check your Anthropic API key.'
    } else if (errorMessage.includes('network') || errorMessage.includes('ECONNREFUSED')) {
      userFriendlyError =
        'Network error: Unable to connect to Anthropic API. Check your internet connection.'
    } else if (errorMessage.includes('rate limit')) {
      userFriendlyError = 'Rate limit exceeded. Please wait a moment before trying again.'
    }

    logError('User-friendly error:', userFriendlyError)
    log('=== Claude Agent Invocation Failed ===')

    return {
      output,
      error: userFriendlyError
    }
  }
}

export const registerClaudeAgentBridge = (backend: {
  js__claude_agent_register_runner?: (handler: (payload: string) => Promise<string>) => void
}) => {
  log('registerClaudeAgentBridge called')
  log('Backend object type:', typeof backend)
  log('Has js__claude_agent_register_runner:', typeof backend?.js__claude_agent_register_runner)

  if (typeof backend?.js__claude_agent_register_runner !== 'function') {
    logError(
      '❌ Claude Agent bridge NOT available - js__claude_agent_register_runner is not a function'
    )
    logError('Backend object keys:', Object.keys(backend || {}))
    logError('Backend object:', backend)
    return
  }

  log('✅ Registering Claude Agent bridge...')

  backend.js__claude_agent_register_runner(async (rawPayload: string) => {
    log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    log('🔄 BRIDGE INVOKED - Claude Agent request received')
    log('Raw payload length:', rawPayload.length)
    log('Raw payload preview:', rawPayload.substring(0, 100) + '...')

    let payload: ClaudeAgentInvocation
    try {
      payload = JSON.parse(rawPayload) as ClaudeAgentInvocation
      log('Payload parsed successfully')
    } catch (error) {
      logError('Failed to parse payload:', error)
      return JSON.stringify({ output: '', error: 'Invalid Claude Agent payload' })
    }

    const result = await runClaudeAgentInvocation(payload)

    log('Bridge invocation completed')
    log('Result:', {
      hasOutput: !!result.output,
      outputLength: result.output?.length,
      hasError: !!result.error,
      error: result.error
    })
    log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

    return JSON.stringify(result)
  })

  log('✅ Claude Agent bridge registered successfully!')
  log('Bridge is now ready to receive requests from Rust backend')
}
