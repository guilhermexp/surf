import { spawn, execSync } from 'child_process'
import type { ChildProcess } from 'child_process'
import type {
  MCPServerConfig,
  MCPServerState,
  MCPServerStatus,
  MCPToolDefinition,
  MCPToolCall,
  MCPToolResult,
  MCPTelemetryEntry
} from './types'

/**
 * Check if a command exists in the system PATH
 */
function commandExists(command: string): boolean {
  try {
    const isWindows = process.platform === 'win32'
    const cmd = isWindows ? 'where' : 'which'
    execSync(`${cmd} ${command}`, { stdio: 'ignore' })
    return true
  } catch {
    return false
  }
}

type PendingRequest = {
  resolve: (value: any) => void
  reject: (error: Error) => void
}

export class MCPServerLoader {
  private servers: Map<string, MCPServerState> = new Map()
  private processes: Map<string, ChildProcess> = new Map()
  private telemetry: MCPTelemetryEntry[] = []
  private maxTelemetrySize = 1000
  private messageId = 0
  private pendingRequests: Map<string, Map<number, PendingRequest>> = new Map()
  private responseBuffers: Map<string, string> = new Map()

  constructor(private configs: MCPServerConfig[]) {}

  async loadAll(): Promise<void> {
    const promises = this.configs
      .filter((config) => config.enabled)
      .map((config) => this.loadServer(config))

    await Promise.allSettled(promises)
  }

  private async loadServer(config: MCPServerConfig): Promise<void> {
    console.log(`[MCP] Loading server: ${config.name} (${config.id})`)

    const state: MCPServerState = {
      id: config.id,
      status: 'starting',
      tools: []
    }

    this.servers.set(config.id, state)
    this.pendingRequests.set(config.id, new Map())
    this.responseBuffers.set(config.id, '')

    try {
      // CRITICAL: Validate command exists before spawning
      if (!commandExists(config.command)) {
        const errorMsg = `Command "${config.command}" not found in PATH. Please install it or check the configuration.`
        console.error(`[MCP] ${errorMsg}`)
        state.status = 'error'
        state.error = errorMsg
        return
      }

      console.log(`[MCP] Command "${config.command}" validated, spawning process...`)

      // Spawn the MCP server process
      const proc = spawn(config.command, config.args || [], {
        env: { ...process.env, ...config.env },
        stdio: ['pipe', 'pipe', 'pipe']
      })

      // CRITICAL: Handle spawn errors immediately to prevent unhandled errors
      proc.on('error', (error) => {
        console.error(`[MCP] Server ${config.id} spawn error:`, error.message)
        state.status = 'error'
        state.error = `Failed to start: ${error.message}`
        // Remove from processes map so we don't try to use this broken process
        this.processes.delete(config.id)
      })

      this.processes.set(config.id, proc)
      state.pid = proc.pid
      state.startedAt = Date.now()

      // Handle process events (moved after error handler to ensure it's registered first)

      proc.on('exit', (code) => {
        console.log(`[MCP] Server ${config.id} exited with code ${code}`)
        state.status = 'stopped'
        this.processes.delete(config.id)
        this.pendingRequests.delete(config.id)
        this.responseBuffers.delete(config.id)
      })

      // Handle JSON-RPC responses
      proc.stdout?.on('data', (data) => {
        this.handleServerOutput(config.id, data.toString())
      })

      proc.stderr?.on('data', (data) => {
        console.error(`[MCP] Server ${config.id} stderr:`, data.toString())
      })

      // Initialize the MCP server
      await this.sendRequest(config.id, 'initialize', {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: {
          name: 'surf',
          version: '1.0.0'
        }
      })

      // List available tools
      const toolsResponse = await this.sendRequest(config.id, 'tools/list', {})
      if (toolsResponse?.tools && Array.isArray(toolsResponse.tools)) {
        state.tools = toolsResponse.tools.map((tool: any) => ({
          serverId: config.id,
          name: tool.name,
          description: tool.description || '',
          inputSchema: tool.inputSchema || {}
        }))
        console.log(`[MCP] Server ${config.id} loaded ${state.tools.length} tools`)
      }

      state.status = 'running'
      console.log(`[MCP] Server ${config.id} started successfully`)
    } catch (error) {
      console.error(`[MCP] Failed to load server ${config.id}:`, error)
      state.status = 'error'
      state.error = error instanceof Error ? error.message : String(error)
    }
  }

  async executeToolCall(call: MCPToolCall): Promise<MCPToolResult> {
    const startTime = Date.now()
    const server = this.servers.get(call.serverId)

    if (!server) {
      return {
        success: false,
        error: `Server ${call.serverId} not found`
      }
    }

    if (server.status !== 'running') {
      return {
        success: false,
        error: `Server ${call.serverId} is not running (status: ${server.status})`
      }
    }

    try {
      const response = await this.sendRequest(call.serverId, 'tools/call', {
        name: call.toolName,
        arguments: call.arguments || {}
      })

      const result: MCPToolResult = {
        success: true,
        data: response
      }

      const endTime = Date.now()
      this.recordTelemetry({
        serverId: call.serverId,
        toolName: call.toolName,
        startTime,
        endTime,
        duration: endTime - startTime,
        success: true
      })

      return result
    } catch (error) {
      const endTime = Date.now()
      const errorMessage = error instanceof Error ? error.message : String(error)

      this.recordTelemetry({
        serverId: call.serverId,
        toolName: call.toolName,
        startTime,
        endTime,
        duration: endTime - startTime,
        success: false,
        error: errorMessage
      })

      return {
        success: false,
        error: errorMessage
      }
    }
  }

  getServerState(serverId: string): MCPServerState | undefined {
    return this.servers.get(serverId)
  }

  getAllServers(): MCPServerState[] {
    return Array.from(this.servers.values())
  }

  getAllTools(): MCPToolDefinition[] {
    const tools: MCPToolDefinition[] = []
    for (const server of this.servers.values()) {
      if (server.status === 'running') {
        tools.push(...server.tools)
      }
    }
    return tools
  }

  getTelemetry(): MCPTelemetryEntry[] {
    return [...this.telemetry]
  }

  getTelemetryStats() {
    const stats = {
      totalCalls: this.telemetry.length,
      successRate: 0,
      averageDuration: 0,
      failureRate: 0,
      byServer: {} as Record<string, { calls: number; successes: number; failures: number }>
    }

    if (this.telemetry.length === 0) {
      return stats
    }

    const successCount = this.telemetry.filter((t) => t.success).length
    stats.successRate = (successCount / this.telemetry.length) * 100
    stats.failureRate = 100 - stats.successRate

    const totalDuration = this.telemetry.reduce((sum, t) => sum + t.duration, 0)
    stats.averageDuration = totalDuration / this.telemetry.length

    for (const entry of this.telemetry) {
      if (!stats.byServer[entry.serverId]) {
        stats.byServer[entry.serverId] = { calls: 0, successes: 0, failures: 0 }
      }
      stats.byServer[entry.serverId].calls++
      if (entry.success) {
        stats.byServer[entry.serverId].successes++
      } else {
        stats.byServer[entry.serverId].failures++
      }
    }

    return stats
  }

  private recordTelemetry(entry: MCPTelemetryEntry) {
    this.telemetry.push(entry)

    // Keep telemetry size under limit
    if (this.telemetry.length > this.maxTelemetrySize) {
      this.telemetry = this.telemetry.slice(-this.maxTelemetrySize)
    }
  }

  private sendRequest(serverId: string, method: string, params: any): Promise<any> {
    return new Promise((resolve, reject) => {
      const proc = this.processes.get(serverId)
      if (!proc || !proc.stdin) {
        reject(new Error(`Server ${serverId} not running or stdin not available`))
        return
      }

      const id = ++this.messageId
      const request = {
        jsonrpc: '2.0',
        id,
        method,
        params
      }

      const pending = this.pendingRequests.get(serverId)
      if (pending) {
        pending.set(id, { resolve, reject })
      }

      try {
        proc.stdin.write(JSON.stringify(request) + '\n')
      } catch (error) {
        pending?.delete(id)
        reject(error)
      }
    })
  }

  private handleServerOutput(serverId: string, data: string) {
    const buffer = this.responseBuffers.get(serverId) || ''
    const newBuffer = buffer + data
    const lines = newBuffer.split('\n')

    // Keep the last incomplete line in the buffer
    this.responseBuffers.set(serverId, lines.pop() || '')

    for (const line of lines) {
      if (!line.trim()) continue

      try {
        const message = JSON.parse(line)

        if (message.id !== undefined) {
          // This is a response to a request
          const pending = this.pendingRequests.get(serverId)
          const handler = pending?.get(message.id)

          if (handler) {
            pending?.delete(message.id)

            if (message.error) {
              handler.reject(new Error(message.error.message || 'MCP request failed'))
            } else {
              handler.resolve(message.result)
            }
          }
        } else if (message.method) {
          // This is a notification from the server (we can log it)
          console.log(`[MCP] Server ${serverId} notification:`, message.method, message.params)
        }
      } catch (error) {
        console.error(`[MCP] Failed to parse message from ${serverId}:`, line, error)
      }
    }
  }

  async stopAll(): Promise<void> {
    console.log('[MCP] Stopping all servers')
    for (const [id, proc] of this.processes.entries()) {
      console.log(`[MCP] Stopping server ${id}`)
      proc.kill()
    }
    this.processes.clear()
    this.servers.clear()
  }

  async stopServer(serverId: string): Promise<void> {
    const proc = this.processes.get(serverId)
    if (proc) {
      proc.kill()
      this.processes.delete(serverId)
    }

    const state = this.servers.get(serverId)
    if (state) {
      state.status = 'stopped'
    }
  }
}

// Load MCP config from user settings
export function loadMCPConfig(): MCPServerConfig[] {
  const { getUserConfig } = require('../config')
  const userConfig = getUserConfig()

  // Return user-configured servers or empty array if none configured
  return userConfig.settings.mcp_servers || []
}

// Save MCP config to user settings
export function saveMCPConfig(configs: MCPServerConfig[]): void {
  const { getUserConfig, setUserConfig } = require('../config')
  const userConfig = getUserConfig()

  userConfig.settings.mcp_servers = configs
  setUserConfig(userConfig)

  console.log('[MCP] Saved', configs.length, 'server configurations')
}

// Update a single server config
export function updateMCPServer(config: MCPServerConfig): void {
  const configs = loadMCPConfig()
  const index = configs.findIndex((c) => c.id === config.id)

  if (index >= 0) {
    configs[index] = config
  } else {
    configs.push(config)
  }

  saveMCPConfig(configs)
}

// Delete a server config
export function deleteMCPServer(serverId: string): void {
  const configs = loadMCPConfig()
  const filtered = configs.filter((c) => c.id !== serverId)
  saveMCPConfig(filtered)
}

// Disable all MCP servers (useful for troubleshooting)
export function disableAllMCPServers(): void {
  const configs = loadMCPConfig()
  const disabled = configs.map((c) => ({ ...c, enabled: false }))
  saveMCPConfig(disabled)
  console.log('[MCP] All servers have been disabled')
}

// Enable a specific server
export function enableMCPServer(serverId: string): void {
  const configs = loadMCPConfig()
  const updated = configs.map((c) => (c.id === serverId ? { ...c, enabled: true } : c))
  saveMCPConfig(updated)
  console.log(`[MCP] Server ${serverId} has been enabled`)
}

// Singleton instance
let mcpLoader: MCPServerLoader | null = null

export function getMCPLoader(): MCPServerLoader {
  if (!mcpLoader) {
    const configs = loadMCPConfig()
    mcpLoader = new MCPServerLoader(configs)
  }
  return mcpLoader
}

export async function initializeMCP(): Promise<void> {
  try {
    console.log('[MCP] Initializing MCP servers')
    const loader = getMCPLoader()
    await loader.loadAll()
    console.log('[MCP] MCP servers initialized')
  } catch (error) {
    // CRITICAL: Never throw errors from MCP initialization
    // This prevents MCP issues from breaking the entire app
    console.error('[MCP] Failed to initialize MCP servers:', error)
    console.error('[MCP] App will continue without MCP servers')
  }
}

export async function shutdownMCP(): Promise<void> {
  if (mcpLoader) {
    await mcpLoader.stopAll()
    mcpLoader = null
  }
}
