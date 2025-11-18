# Troubleshooting: Tools e MCP Integration

## Problema Reportado

**Erro:** "IO error: No such file or directory (os error 2)"

**Sintomas:**

- Erro aparece ao usar Claude Code Agent ou outros providers (Gemini, OpenAI)
- Com tools/MCP ativados: Dá erros
- Com tools/MCP desativados: Funciona normalmente

## Causa Raiz

O Surf tem **três sistemas de tools diferentes** que foram confundidos:

### 1. AI Tools (Rust Backend) ✅ FUNCIONANDO

**Localização:** `packages/services/src/lib/ai/tools/manifest.ts`

**Tools disponíveis:**

- Web Search (DuckDuckGo)
- Scrape URL (fetch + parse HTML)
- Image Generation (DALL-E 3)
- Video Generation (placeholder)
- Browser Automation (implementado, não integrado)

**Como funcionam:**

- Registradas via `registerAITools(sffs)` no backend Rust
- Handlers em JavaScript/TypeScript no mesmo processo
- **Não causam o erro "No such file or directory"**

### 2. MCP Servers Externos ⚠️ CAUSA DO ERRO

**Localização:** `app/src/main/mcp/loader.ts`

**O que são:**

- Servidores MCP externos executados como processos separados
- Comunicação via JSON-RPC sobre stdin/stdout
- Exemplo: `@modelcontextprotocol/server-filesystem`

**Como funcionam:**

- Spawnam processos via `child_process.spawn()`
- Cada server tem: `command` (ex: "npx"), `args` (ex: ["-y", "@modelcontextprotocol/server-filesystem"])

**Problema identificado:**

- Se um server tem um `command` inválido ou não encontrado no PATH
- O `spawn()` falha com erro ENOENT (No such file or directory)
- Esse erro não era tratado adequadamente e quebrava todo o app

**Exemplo de config problemática:**

```json
{
  "id": "server-1234",
  "name": "Filesystem Server",
  "command": "npx", // ← Se 'npx' não estiver no PATH, dá erro
  "args": ["-y", "@modelcontextprotocol/server-filesystem", "/tmp"],
  "enabled": true // ← E se estiver enabled, quebra o app
}
```

### 3. Claude Agent SDK Tools ❓ NÃO IMPLEMENTADO

**Localização:** `app/src/main/claudeAgentTools.ts`

**O que são:**

- Tools MCP criadas com `createSdkMcpServer()` do Claude Agent SDK
- Rodam **no mesmo processo**, não precisam de spawn()
- Exemplo: searchTabs, getBrowserHistory, bookmarkPage

**Status atual:**

- ✅ Código criado em `claudeAgentTools.ts`
- ❌ **NÃO está sendo usado** (não integrado no `claudeAgent.ts`)
- ⚠️ Todas as tools são **placeholders** (retornam mock data, não funcionam)

**Por que não implementar agora:**

- As tools são apenas exemplos, não fazem nada útil
- Retornam dados mockados
- Precisariam ser implementadas com lógica real
- As AI Tools (sistema #1) já funcionam e são mais úteis

## Correções Aplicadas

### 1. Validação de Comando Antes do Spawn ✅

**Arquivo:** `app/src/main/mcp/loader.ts`

```typescript
// Função helper para verificar se comando existe
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

// Validação antes do spawn
if (!commandExists(config.command)) {
  const errorMsg = `Command "${config.command}" not found in PATH. Please install it or check the configuration.`
  console.error(`[MCP] ${errorMsg}`)
  state.status = 'error'
  state.error = errorMsg
  return
}
```

### 2. Error Handling Robusto ✅

**Arquivo:** `app/src/main/mcp/loader.ts`

```typescript
// Handler de erro registrado ANTES de adicionar ao processes map
proc.on('error', (error) => {
  console.error(`[MCP] Server ${config.id} spawn error:`, error.message)
  state.status = 'error'
  state.error = `Failed to start: ${error.message}`
  this.processes.delete(config.id) // Remove processo quebrado
})
```

### 3. Inicialização Segura ✅

**Arquivo:** `app/src/main/mcp/loader.ts`

```typescript
export async function initializeMCP(): Promise<void> {
  try {
    console.log('[MCP] Initializing MCP servers')
    const loader = getMCPLoader()
    await loader.loadAll()
    console.log('[MCP] MCP servers initialized')
  } catch (error) {
    // NUNCA joga erro - previne que MCP quebre o app
    console.error('[MCP] Failed to initialize MCP servers:', error)
    console.error('[MCP] App will continue without MCP servers')
  }
}
```

### 4. Funções Helper para Troubleshooting ✅

**Arquivo:** `app/src/main/mcp/loader.ts`

```typescript
// Desabilitar todos os servers
export function disableAllMCPServers(): void

// Habilitar server específico
export function enableMCPServer(serverId: string): void
```

## Como Resolver

### Opção 1: Desabilitar MCP Servers (Recomendado por enquanto)

1. Abra o DevTools no Surf (View → Developer → Toggle Developer Tools)
2. No Console, execute:

```javascript
const { disableAllMCPServers } = require('./main/mcp/loader')
disableAllMCPServers()
```

3. Reinicie o Surf

**Resultado:**

- ✅ Chat com Claude/Gemini/OpenAI funciona normalmente
- ✅ AI Tools (Web Search, etc.) continuam funcionando
- ❌ MCP Servers externos não estarão disponíveis

### Opção 2: Configurar MCP Server Corretamente

Se você realmente precisa de um MCP server externo:

1. **Instale o comando necessário**

Para `npx`:

```bash
npm install -g npx
```

Para o server filesystem:

```bash
npm install -g @modelcontextprotocol/server-filesystem
```

2. **Verifique que o comando está no PATH**

```bash
which npx  # macOS/Linux
where npx  # Windows
```

3. **Configure o server no Surf**

- Abra Settings → MCP Servers
- Adicione um server com o comando validado
- Teste antes de habilitar

### Opção 3: Usar Apenas AI Tools Nativas

As AI Tools nativas do Surf já funcionam perfeitamente:

**Como habilitar:**

1. Settings → AI
2. Ative as tools desejadas:
   - ☑️ Web Search
   - ☑️ Scrape URL
   - ☑️ Image Generation

**Vantagens:**

- Não requerem processos externos
- Mais rápidas
- Menos overhead
- Já implementadas e testadas

## Verificação Pós-Fix

Para confirmar que o problema foi resolvido:

1. **Teste com Claude Code Agent:**

```
Prompt: "Pesquise informações sobre Rust async/await"
```

Deve funcionar sem erro "No such file or directory"

2. **Teste com Gemini:**

```
Prompt: "Oi"
```

Deve responder normalmente sem erros

3. **Verifique os logs:**

```bash
# No DevTools Console, procure por:
[MCP] Command "..." not found in PATH
```

Se aparecer, o comando não está instalado ou não está no PATH

## Próximos Passos

### Curto Prazo ✅

- [x] Corrigir error handling do MCP loader
- [x] Adicionar validação de comando
- [x] Prevenir que erros MCP quebrem o app
- [x] Documentar sistemas de tools

### Médio Prazo 🔄

- [ ] Implementar tools do `createSurfTools()` com lógica real
- [ ] Integrar tools com Claude Agent SDK
- [ ] Adicionar UI para gerenciar tools ativas
- [ ] Criar biblioteca de MCP servers recomendados

### Longo Prazo 📋

- [ ] Integrar Browser Automation com AI Tools
- [ ] Suporte a video generation (Luma/Runway)
- [ ] Custom MCP servers criados pelo usuário
- [ ] Tool marketplace

## Diferenças entre os Sistemas

| Feature           | AI Tools (Rust) | MCP Servers Externos | Claude SDK Tools |
| ----------------- | --------------- | -------------------- | ---------------- |
| **Processo**      | In-process      | Spawn externo        | In-process       |
| **Performance**   | Rápido          | Mais lento           | Rápido           |
| **Setup**         | Automático      | Requer instalação    | Automático       |
| **Erro ENOENT**   | Não             | **Sim**              | Não              |
| **Implementação** | Completa        | Parcial              | Placeholder      |
| **Uso**           | Produção        | Experimental         | Não usar ainda   |

## Comandos Úteis

### Verificar se comando existe

```bash
which npx
which node
which python3
```

### Listar MCP servers configurados

```javascript
// DevTools Console
const { loadMCPConfig } = require('./main/mcp/loader')
console.log(loadMCPConfig())
```

### Ver estado dos servers

```javascript
// DevTools Console
const { getMCPLoader } = require('./main/mcp/loader')
const loader = getMCPLoader()
console.log(loader.getServers())
```

## Suporte

Se o erro persistir:

1. Capture os logs completos:

   - DevTools → Console → Save Console Output

2. Verifique a configuração:

```bash
cat ~/Library/Application\ Support/Surf/user.json | grep -A 20 "mcp_servers"
```

3. Reporte o issue com:
   - Logs completos
   - Screenshot do erro
   - Config JSON (sem dados sensíveis)
   - Sistema operacional e versão

---

**Data:** 2025-11-18
**Versão:** 1.0
**Status:** ✅ Fix aplicado, aguardando testes
