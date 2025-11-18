export type MCPServerConfig = {
  id: string
  name: string
  command: string
  args?: string[]
  env?: Record<string, string>
  enabled: boolean
}

export type MCPToolDefinition = {
  serverId: string
  name: string
  description: string
  inputSchema: any
}

export type MCPToolCall = {
  serverId: string
  toolName: string
  arguments: any
}

export type MCPToolResult = {
  success: boolean
  data?: any
  error?: string
}

export type MCPServerStatus = 'idle' | 'starting' | 'running' | 'error' | 'stopped'

export type MCPServerState = {
  id: string
  status: MCPServerStatus
  tools: MCPToolDefinition[]
  error?: string
  pid?: number
  startedAt?: number
}

export type MCPTelemetryEntry = {
  serverId: string
  toolName: string
  startTime: number
  endTime: number
  duration: number
  success: boolean
  error?: string
}
