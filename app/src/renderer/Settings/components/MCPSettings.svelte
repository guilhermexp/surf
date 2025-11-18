<script lang="ts">
  import { onMount } from 'svelte'
  import { writable } from 'svelte/store'
  import { Icon } from '@deta/icons'
  import { Button, openDialog, Dropdown } from '@deta/ui'
  import { FormField, Expandable } from '@deta/ui/legacy'
  import { translator as t } from '../../Core/i18n'
  import { IPC_EVENTS_RENDERER as IPC_EVENTS } from '@deta/services/ipc'

  type MCPServerState = {
    id: string
    status: 'idle' | 'starting' | 'running' | 'error' | 'stopped'
    tools: MCPToolDefinition[]
    error?: string
    pid?: number
    startedAt?: number
  }

  type MCPToolDefinition = {
    name: string
    description?: string
    inputSchema: any
  }

  type MCPServerConfig = {
    id: string
    name: string
    command: string
    args?: string[]
    env?: Record<string, string>
    enabled?: boolean
  }

  const servers = writable<MCPServerState[]>([])
  const serverConfigs = writable<MCPServerConfig[]>([])
  const loading = writable(true)
  const statusMessage = writable('')
  let statusTimeout: number | null = null

  const showStatus = (message: string) => {
    statusMessage.set(message)
    if (statusTimeout) clearTimeout(statusTimeout)
    statusTimeout = setTimeout(() => {
      statusMessage.set('')
      statusTimeout = null
    }, 3000) as unknown as number
  }

  const loadMCPServers = async () => {
    try {
      loading.set(true)
      const result = await IPC_EVENTS.getMCPServers()
      if (result) {
        servers.set(result)
      }
    } catch (error) {
      console.error('Failed to load MCP servers:', error)
      showStatus('Failed to load MCP servers')
    } finally {
      loading.set(false)
    }
  }

  const getStatusColor = (status: MCPServerState['status']) => {
    switch (status) {
      case 'running':
        return 'text-green-600 dark:text-green-400'
      case 'error':
        return 'text-red-600 dark:text-red-400'
      case 'starting':
        return 'text-yellow-600 dark:text-yellow-400'
      default:
        return 'text-gray-600 dark:text-gray-400'
    }
  }

  const getStatusIcon = (status: MCPServerState['status']) => {
    switch (status) {
      case 'running':
        return 'check.circle'
      case 'error':
        return 'alert.circle'
      case 'starting':
        return 'clock'
      default:
        return 'circle'
    }
  }

  const handleAddServer = async () => {
    // TODO: Create a dialog to collect server config
    // For now, adding a sample server
    const newServer: MCPServerConfig = {
      id: `server-${Date.now()}`,
      name: 'New MCP Server',
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-filesystem', '/tmp'],
      enabled: false
    }

    try {
      const result = await IPC_EVENTS.addMCPServer(newServer)
      if (result.success) {
        showStatus('Server added successfully')
        await loadMCPServers()
      } else {
        showStatus(`Failed to add server: ${result.error}`)
      }
    } catch (error) {
      console.error('Failed to add MCP server:', error)
      showStatus('Failed to add server')
    }
  }

  const handleDeleteServer = async (serverId: string) => {
    const server = $servers.find((s) => s.id === serverId)
    if (!server) return

    const { closeType: confirmed } = await openDialog({
      icon: 'trash',
      title: `Delete MCP Server`,
      message: `Are you sure you want to delete "${serverId}"? This action cannot be undone.`,
      actions: [
        { title: 'Cancel', type: 'reset' },
        { title: 'Delete', type: 'submit', kind: 'danger' }
      ]
    })

    if (!confirmed) return

    try {
      const result = await IPC_EVENTS.deleteMCPServer({ serverId })
      if (result.success) {
        showStatus(`Server ${serverId} deleted`)
        await loadMCPServers()
      } else {
        showStatus(`Failed to delete server: ${result.error}`)
      }
    } catch (error) {
      console.error('Failed to delete MCP server:', error)
      showStatus('Failed to delete server')
    }
  }

  onMount(() => {
    loadMCPServers()

    // Refresh servers every 5 seconds
    const interval = setInterval(loadMCPServers, 5000)

    return () => {
      clearInterval(interval)
      if (statusTimeout) clearTimeout(statusTimeout)
    }
  })
</script>

<div class="wrapper">
  <div class="dev-wrapper">
    <div class="space-y-3">
      <div class="w-full flex items-center justify-between">
        <h2 class="text-xl font-medium">MCP Servers</h2>
        <Button size="sm" class="add-server-button" onclick={handleAddServer}>
          <Icon name="add" />
          Add Server
        </Button>
      </div>

      <div class="details-text">
        <p>
          Model Context Protocol (MCP) allows AI models to connect to external data sources and
          tools. Configure MCP servers to enhance your AI assistant with custom capabilities.
        </p>
        <p>
          <a href="https://modelcontextprotocol.io" target="_blank">Learn more about MCP</a>
        </p>
      </div>
    </div>

    {#if $loading}
      <div class="loading-state">
        <Icon name="loading" className="animate-spin" />
        <span>Loading MCP servers...</span>
      </div>
    {:else if $servers.length === 0}
      <div class="empty-state">
        <Icon name="server" size="48" className="opacity-30" />
        <p>No MCP servers configured</p>
        <p class="text-sm opacity-60">Add your first MCP server to get started</p>
      </div>
    {:else}
      <div class="server-list">
        {#each $servers as server}
          <Expandable title="" expanded={false}>
            <div slot="title" class="flex items-center gap-3 w-full">
              <div class="server-status-indicator {getStatusColor(server.status)}">
                <Icon name={getStatusIcon(server.status)} size="16" />
              </div>
              <div class="flex-1">
                <span class="font-medium">{server.id}</span>
                <span class="text-sm opacity-60 ml-2">
                  ({server.tools.length}
                  {server.tools.length === 1 ? 'tool' : 'tools'})
                </span>
              </div>
            </div>

            <div slot="header">
              <Button
                size="md"
                onclick={() => handleDeleteServer(server.id)}
                class="delete-server-button"
              >
                <Icon name="trash" size="1em" />
              </Button>
            </div>

            <div class="server-config">
              <div class="server-info">
                <div class="info-row">
                  <span class="info-label">Status:</span>
                  <span class="{getStatusColor(server.status)} font-medium">
                    {server.status}
                  </span>
                </div>

                {#if server.pid}
                  <div class="info-row">
                    <span class="info-label">Process ID:</span>
                    <span>{server.pid}</span>
                  </div>
                {/if}

                {#if server.startedAt}
                  <div class="info-row">
                    <span class="info-label">Started:</span>
                    <span>{new Date(server.startedAt).toLocaleString()}</span>
                  </div>
                {/if}

                {#if server.error}
                  <div class="error-message">
                    <Icon name="alert.circle" size="16" />
                    <span>{server.error}</span>
                  </div>
                {/if}
              </div>

              {#if server.tools.length > 0}
                <div class="tools-section">
                  <h3 class="tools-title">Available Tools</h3>
                  <div class="tools-list">
                    {#each server.tools as tool}
                      <div class="tool-item">
                        <div class="tool-header">
                          <Icon name="wrench" size="14" />
                          <span class="tool-name">{tool.name}</span>
                        </div>
                        {#if tool.description}
                          <p class="tool-description">{tool.description}</p>
                        {/if}
                      </div>
                    {/each}
                  </div>
                </div>
              {/if}
            </div>
          </Expandable>
        {/each}
      </div>
    {/if}
  </div>
</div>

{#if $statusMessage}
  <div class="status-message">
    <Icon name="check.circle" />
    <span>{$statusMessage}</span>
  </div>
{/if}

<style lang="scss">
  .status-message {
    position: absolute;
    left: 1rem;
    top: 1rem;
    right: 1rem;
    z-index: 999999;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.75rem 1rem;
    background: light-dark(#ecfdf5, #064e3b);
    border: 1px solid light-dark(#10b981, #059669);
    border-radius: 0.5rem;
    color: light-dark(#065f46, #d1fae5);
    font-size: 0.875rem;
    animation: slideIn 0.3s ease-out;
  }

  @keyframes slideIn {
    from {
      opacity: 0;
      transform: translateY(-10px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .wrapper {
    position: relative;
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;

    h2 {
      color: light-dark(#1f2937, #e4e7f2);
    }

    p {
      color: light-dark(#374151, var(--text-subtle-dark, #9da4c4));
      line-height: 1.6;
    }

    a {
      color: light-dark(#0284c7, var(--accent-dark));
      text-decoration: underline;

      &:hover {
        color: light-dark(#0369a1, var(--accent));
      }
    }
  }

  .dev-wrapper {
    position: relative;
    width: 100%;
    background: radial-gradient(
      290.88% 100% at 50% 0%,
      rgba(237, 246, 255, 0.96) 0%,
      rgba(246, 251, 255, 0.93) 100%
    );
    border: 0.5px solid rgba(255, 255, 255, 0.8);
    border-radius: 11px;
    padding: 1.25rem;
    margin: 1rem 0;
    box-shadow:
      0 -0.5px 1px 0 rgba(255, 255, 255, 0.1) inset,
      0 1px 1px 0 #fff inset,
      0 3px 3px 0 rgba(62, 71, 80, 0.02),
      0 1px 2px 0 rgba(62, 71, 80, 0.02),
      0 1px 1px 0 rgba(0, 0, 0, 0.05),
      0 0 1px 0 rgba(0, 0, 0, 0.09);
    transition:
      background-color 90ms ease-out,
      box-shadow 90ms ease-out;
    display: flex;
    flex-direction: column;
    gap: 1.5rem;

    @media (prefers-color-scheme: dark) {
      background: var(--settings-dark-card);
      border: 0.5px solid var(--settings-dark-border);
      box-shadow: var(--settings-dark-card-shadow);
    }
  }

  .details-text {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;

    p {
      color: light-dark(#374151, var(--text-subtle-dark, #9da4c4));
      line-height: 1.6;
    }

    a {
      color: light-dark(#0284c7, var(--accent-dark));

      &:hover {
        color: light-dark(#0369a1, var(--accent));
      }
    }
  }

  .loading-state,
  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 1rem;
    padding: 3rem 1rem;
    color: light-dark(#6b7280, var(--text-subtle-dark, #9da4c4));
  }

  .server-list {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .server-status-indicator {
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .server-config {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
    padding: 1rem 0;
  }

  .server-info {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .info-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.875rem;
  }

  .info-label {
    font-weight: 500;
    color: light-dark(#6b7280, var(--text-subtle-dark, #9da4c4));
    min-width: 100px;
  }

  .error-message {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.75rem;
    background: light-dark(#fef2f2, #7f1d1d);
    border: 1px solid light-dark(#fecaca, #991b1b);
    border-radius: 0.5rem;
    color: light-dark(#991b1b, #fecaca);
    font-size: 0.875rem;
  }

  .tools-section {
    padding-top: 1rem;
    border-top: 1px solid light-dark(rgba(0, 0, 0, 0.1), rgba(255, 255, 255, 0.1));
  }

  .tools-title {
    font-size: 0.875rem;
    font-weight: 500;
    color: light-dark(#374151, var(--text-subtle-dark, #9da4c4));
    margin-bottom: 0.75rem;
  }

  .tools-list {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .tool-item {
    padding: 0.75rem;
    background: light-dark(rgba(255, 255, 255, 0.5), rgba(0, 0, 0, 0.2));
    border-radius: 0.5rem;
    border: 1px solid light-dark(rgba(0, 0, 0, 0.05), rgba(255, 255, 255, 0.05));
  }

  .tool-header {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 0.25rem;
  }

  .tool-name {
    font-weight: 500;
    font-size: 0.875rem;
    color: light-dark(#1f2937, #e4e7f2);
  }

  .tool-description {
    font-size: 0.8125rem;
    color: light-dark(#6b7280, var(--text-subtle-dark, #9da4c4));
    margin: 0;
    line-height: 1.5;
  }

  :global(.add-server-button[data-button-root]) {
    display: flex;
    align-items: center;
    gap: 0.375rem;
  }

  :global(.delete-server-button[data-button-root]) {
    background-color: light-dark(oklch(96.5% 0 0), oklch(15% 0.05 250));
    color: light-dark(oklch(55.3% 0 0), oklch(70.3% 0 0));
    padding: 8px;
    border-radius: 10px;

    &:hover {
      background-color: light-dark(oklch(0.93 0.05 17.43), oklch(25% 0.05 250));
      color: light-dark(#b91c1c, oklch(80.3% 0 0));
    }
  }
</style>
