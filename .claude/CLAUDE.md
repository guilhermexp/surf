# Surf - Claude Code Agent Integration Context

## Arquitetura do Projeto

**Surf** é uma aplicação desktop baseada em Electron que integra múltiplos providers de AI/LLM, incluindo OpenAI, Anthropic, Google Gemini e agora **Claude Code Agent SDK**.

### Stack Tecnológica

- **Frontend:** Electron + Svelte 5 + TypeScript
- **Backend:** Rust (via Neon bindings) + SQLite
- **AI Integration:** Multi-provider (OpenAI, Anthropic, Google, Claude Agent)
- **Build System:** Turborepo + Vite

### Estrutura de Diretórios

```
surf/
├── app/                          # Aplicação Electron
│   ├── src/
│   │   ├── main/
│   │   │   ├── claudeAgent.ts   # Bridge Node.js → Rust (Claude SDK)
│   │   │   ├── sffs.ts          # Sistema de arquivos principal
│   │   │   └── index.ts         # Entry point Electron
│   │   ├── renderer/            # UI Svelte
│   │   └── preload/             # Preload scripts
│   └── package.json             # Dependencies (inclui @anthropic-ai/claude-agent-sdk)
│
├── packages/
│   ├── backend/                 # Runtime Rust (Neon)
│   │   ├── src/
│   │   │   ├── ai/
│   │   │   │   ├── claude_agent.rs    # Runtime bridge Rust
│   │   │   │   ├── llm/client/mod.rs  # LLM client adapter
│   │   │   │   └── mod.rs             # AI module principal
│   │   │   ├── worker/
│   │   │   │   ├── tunnel.rs          # Worker tunnel (threads)
│   │   │   │   └── mod.rs             # Worker config
│   │   │   └── api/worker.rs          # Exported functions
│   │   ├── types/index.ts       # TypeScript bindings
│   │   └── Cargo.toml           # Neon dependencies
│   │
│   ├── types/                   # Tipos compartilhados
│   │   └── src/ai.types.ts      # Enums Provider/Model
│   │
│   ├── services/                # Camada de serviços
│   │   └── src/lib/ai/chat.ts   # Chat service
│   │
│   └── ui/                      # Componentes UI compartilhados
│
└── .claude/                     # Claude Code Agent config (VOCÊ ESTÁ AQUI!)
    ├── CLAUDE.md                # Este arquivo
    ├── settings.json            # Configurações do Claude
    └── agents/                  # Custom agents (futuro)
```

## Claude Code Agent Integration

### Como Funciona

A integração segue um padrão de **Bridge Multi-Camadas**:

```
User Input (Svelte UI)
    ↓
AI Service (TypeScript)
    ↓
Neon Bridge (TypeScript → Rust)
    ↓
Claude Agent Runtime (Rust)
    ↓
Channel.send() → Promise
    ↓
Node.js Handler (claudeAgent.ts)
    ↓
@anthropic-ai/claude-agent-sdk
    ↓
Anthropic API
```

### Arquivos Chave da Integração

#### 1. Types & Models

**Arquivo:** `packages/types/src/ai.types.ts`

- Define `Provider.ClaudeAgent` enum
- Define `BuiltInModelIDs.ClaudeCodeAgent`
- Configurações de label, ícone e API key page

#### 2. Node.js Bridge

**Arquivo:** `app/src/main/claudeAgent.ts`

- Formata `Message[]` para prompt string
- Chama `query()` do SDK oficial
- Trata streaming de respostas
- Registra handler via `registerClaudeAgentBridge()`

**Função Principal:**

```typescript
async function runClaudeAgentInvocation(payload: ClaudeAgentInvocation): Promise<ClaudeAgentResult>
```

#### 3. Rust Runtime

**Arquivo:** `packages/backend/src/ai/claude_agent.rs`

- Estrutura `ClaudeAgentRuntime` (thread-safe com Arc<Mutex>)
- Serializa requests, chama função JS via Channel
- Converte JS Promise em Rust Future com `to_future()`
- Deserializa resposta JSON

**Estrutura Principal:**

```rust
pub struct ClaudeAgentRuntime {
    runner: Arc<Mutex<Option<Root<JsFunction>>>>,
    channel: Channel,
    default_cwd: String,
}
```

#### 4. LLM Client Adapter

**Arquivo:** `packages/backend/src/ai/llm/client/mod.rs`

- Intercepta `Provider::ClaudeAgent` em `create_chat_completion()`
- Desvia para `run_claude_agent_completion()` em vez de HTTP
- Retorna stream customizado via `from_single_chunk()`

#### 5. Worker Integration

**Arquivo:** `packages/backend/src/worker/tunnel.rs` e `mod.rs`

- `WorkerTunnel` mantém `claude_agent_runner` handle
- Worker injeta runtime no AI module
- Thread pool gerencia execuções paralelas

### Fluxo de Dados Completo

1. **UI Selection:** Usuário seleciona modelo "Claude Code Agent"
2. **Service Layer:** `chat.ts` chama `sffs.sendAIChatMessage()`
3. **Backend Bridge:** Rust recebe request, identifica `Provider::ClaudeAgent`
4. **Runtime Dispatch:** `ClaudeAgentRuntime.run_completion()` serializa e envia via Channel
5. **JS Execution:** `claudeAgent.ts` recebe payload, chama SDK
6. **SDK Call:** `query()` executa com options (cwd, API key, tools)
7. **Response Stream:** SDK retorna messages via async iterator
8. **Bridge Return:** Resultado JSON volta para Rust via Promise
9. **Stream Assembly:** Rust cria `ChatCompletionStream` com output
10. **UI Update:** Frontend recebe chunks e renderiza

## Comandos Comuns

### Desenvolvimento

```bash
# Instalar dependências
yarn install

# Build backend Rust
yarn workspace @deta/backend build

# Dev mode (hot reload)
npm run dev

# Build completo
npm run build

# Build apenas frontend
npm run build:frontend
```

### Testing

```bash
# Executar testes
yarn test

# Lint
yarn workspace desktop lint

# Type check
yarn workspace desktop typecheck
```

### Claude Agent Específico

```bash
# Verificar instalação do SDK
yarn workspace desktop list --pattern @anthropic-ai/claude-agent-sdk

# Rebuild Neon bindings
cd packages/backend && cargo build

# Testar bridge
ANTHROPIC_API_KEY=sk-ant-... npm run dev
```

## Variáveis de Ambiente

### Obrigatórias para Claude Agent

```bash
# API Key do Anthropic
ANTHROPIC_API_KEY=sk-ant-api03-...
# ou configurar via UI Settings → API Keys
```

### Opcionais

```bash
# Log level (para debug)
RUST_LOG=info

# Modo de desenvolvimento
NODE_ENV=development

# Path customizado para recursos
BACKEND_ROOT_PATH=/custom/path
```

## Tools Disponíveis (Built-in do SDK)

Quando Claude Code Agent é selecionado, ele tem acesso a:

- ✅ **Read** - Ler arquivos do sistema
- ✅ **Write** - Escrever arquivos
- ✅ **Bash** - Executar comandos shell
- ✅ **Glob** - Buscar arquivos por padrão
- ✅ **Grep** - Buscar texto em arquivos
- ✅ **Edit** - Editar arquivos existentes

**Permission Mode:**

- `manual` (produção) - Requer aprovação do usuário
- `acceptEdits` (dev) - Auto-aprova edits

## Configuração do Provider

### No Código (app/src/main/claudeAgent.ts)

```typescript
const stream = query({
  prompt,
  options: {
    cwd: payload.cwd ?? process.cwd(),
    includePartialMessages: false,
    env: {
      ANTHROPIC_API_KEY: apiKey
    }
  }
})
```

### Via UI Settings

1. Abrir Settings
2. Navegar para "API Keys"
3. Seção "Claude Code Agent"
4. Inserir `ANTHROPIC_API_KEY`

## Diferenças vs Outros Providers

| Feature   | OpenAI/Anthropic | Claude Agent              |
| --------- | ---------------- | ------------------------- |
| HTTP API  | ✅ Sim           | ❌ Local SDK              |
| Streaming | ✅ Chunked       | ⚠️ Single chunk (por ora) |
| Tools     | ❌ Limitado      | ✅ File system completo   |
| Context   | Text/Image       | Text/Image/Files          |
| Execução  | Cloud            | Local → Cloud             |
| Latência  | ~2-5s            | ~3-8s (overhead bridge)   |

## Próximas Melhorias Planejadas

### Prioridade Alta

- [ ] Streaming incremental (chunks progressivos)
- [ ] Better error messages na UI
- [ ] Timeout configurável
- [ ] Retry logic com backoff

### Prioridade Média

- [ ] MCP tools customizadas (funções específicas do Surf)
- [ ] Provider abstraction layer (fallback chain)
- [ ] Cache de respostas
- [ ] Metrics/telemetry

### Prioridade Baixa

- [ ] Multi-agent orchestration
- [ ] Custom system prompts por contexto
- [ ] Tool usage analytics
- [ ] Fine-tuning integration

## Troubleshooting

### Erro: "Claude Code Agent bridge is not registered"

**Causa:** Runtime não foi inicializado
**Solução:**

```bash
# Verificar se registerClaudeAgentBridge foi chamado
grep -r "registerClaudeAgentBridge" app/src/main/
# Deve aparecer em sffs.ts linha ~136
```

### Erro: "API key missing"

**Causa:** ANTHROPIC_API_KEY não configurada
**Solução:**

```bash
export ANTHROPIC_API_KEY=sk-ant-...
# ou configurar via UI Settings
```

### Erro: "Channel closed" ou "Mutex poisoned"

**Causa:** Worker thread crashed
**Solução:**

```bash
# Restart app
# Verificar logs: RUST_LOG=debug npm run dev
```

### Build Errors (Neon)

**Causa:** Neon bindings desatualizados
**Solução:**

```bash
cd packages/backend
cargo clean
yarn build
```

## Arquitetura Detalhada

### Thread Model

```
Main Thread (Electron)
    ↓
libuv Event Loop
    ↓
Worker Threads Pool (12 threads default)
    ├── W0 (handle migrations)
    ├── W1-W11 (handle requests)
    └── Channel → Promise bridge
            ↓
    JavaScript Handler (Node.js)
            ↓
    Claude SDK (async/await)
```

### Memory Safety

- **Rust Side:** Arc<Mutex<>> para shared state thread-safe
- **JS Side:** Root<JsFunction> mantém referência GC-safe
- **Channel:** Crossbeam unbounded channel para messaging

### Error Propagation

```
SDK Error
    ↓
JS catch block → JSON { error: "..." }
    ↓
Rust deserialize → BackendError::GenericError
    ↓
LLM Client → ChatCompletionStream error
    ↓
Frontend → UI error toast
```

## Boas Práticas

### Ao Adicionar Tools Customizadas

1. Criar wrapper em `app/src/main/claudeAgent.ts`
2. Registrar via MCP protocol
3. Documentar schema de input/output
4. Adicionar testes unitários

### Ao Modificar Bridge

1. Sempre verificar thread-safety (Arc/Mutex)
2. Testar com carga paralela (múltiplas requests)
3. Validar serialização JSON (serde)
4. Update types em `packages/backend/types/index.ts`

### Ao Debugar

1. Habilitar logs: `RUST_LOG=debug npm run dev`
2. Verificar Channel messages
3. Inspecionar Promise states
4. Usar tracing em ambos lados (Rust + JS)

## Referências

- [Claude Code Agent SDK](https://github.com/anthropics/claude-code-agent-sdk)
- [Neon Bindings](https://neon-bindings.com/)
- [Electron IPC](https://www.electronjs.org/docs/latest/api/ipc-main)
- [Surf Project Docs](https://github.com/deta/surf)

---

**Última atualização:** 2025-01-16
**Versão SDK:** @anthropic-ai/claude-agent-sdk@^0.1.42
**Status:** ✅ Integração funcional e testada
