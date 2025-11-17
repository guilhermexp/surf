# Claude Code Agent SDK - Guia de Integração e Uso

## 📋 Índice

1. [Visão Geral](#visão-geral)
2. [Instalação e Setup](#instalação-e-setup)
3. [Como Usar](#como-usar)
4. [Arquitetura](#arquitetura)
5. [Testes](#testes)
6. [Troubleshooting](#troubleshooting)
7. [Próximas Melhorias](#próximas-melhorias)

---

## Visão Geral

Esta integração adiciona o **Claude Code Agent SDK** como um provider adicional no Surf, permitindo que o Claude execute tarefas complexas com acesso ao sistema de arquivos local.

### Principais Recursos

✅ **Multi-Provider**: Mantém compatibilidade total com OpenAI, Anthropic API, Google Gemini
✅ **File System Access**: Claude pode ler/escrever arquivos via SDK oficial
✅ **Thread-Safe**: Bridge Rust-Node.js com Arc/Mutex para segurança
✅ **Error Handling**: Mensagens detalhadas e timeouts configuráveis
✅ **Type-Safe**: Tipos compartilhados entre TypeScript e Rust

---

## Instalação e Setup

### 1. Pré-requisitos

```bash
# Node.js 18+
node --version

# Rust toolchain
rustc --version

# Yarn
yarn --version
```

### 2. Instalar Dependências

```bash
# No diretório raiz do projeto
yarn install

# Build do backend Rust (Neon)
yarn workspace @deta/backend build
```

### 3. Configurar API Key

**Opção A: Variável de Ambiente**

```bash
export ANTHROPIC_API_KEY=sk-ant-api03-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

**Opção B: Via UI (Recomendado para produção)**

1. Abrir Surf
2. Settings → API Keys
3. Seção "Claude Code Agent"
4. Colar API key
5. Salvar

### 4. Verificar Instalação

```bash
# Verificar SDK instalado
yarn workspace desktop list --pattern @anthropic-ai/claude-agent-sdk
# Deve mostrar: @anthropic-ai/claude-agent-sdk@^0.1.42

# Verificar build do Neon
ls packages/backend/*.node
# Deve existir: backend.node ou backend.darwin-arm64.node
```

---

## Como Usar

### No Surf UI

1. **Criar Nova Conversa**

   - Clicar em "New Chat"

2. **Selecionar Modelo**

   - No dropdown de modelos, selecionar **"Claude Code Agent"**
   - Ícone: Claude (mesmo do Anthropic)
   - Tier: Premium

3. **Enviar Mensagem**

   ```
   Analise o arquivo package.json do projeto e me diga quais
   dependências estão desatualizadas.
   ```

4. **Claude Executa com Tools**
   - Claude Code Agent lê arquivos locais
   - Executa análise
   - Retorna resposta estruturada

### Exemplos de Prompts

#### Exemplo 1: Análise de Código

```
Leia o arquivo app/src/main/claudeAgent.ts e explique
como funciona o bridge entre Node.js e Rust.
```

#### Exemplo 2: Refatoração

```
Analise o arquivo packages/backend/src/ai/llm/client/mod.rs
e sugira melhorias de performance no método create_streaming_chat_completion.
```

#### Exemplo 3: Debug

```
O erro "Claude Code Agent bridge is not registered" está acontecendo.
Verifique se o registerClaudeAgentBridge está sendo chamado corretamente
em app/src/main/sffs.ts.
```

#### Exemplo 4: Documentação

```
Crie um diagrama de sequência explicando o fluxo completo
desde a UI até a chamada da API do Claude, passando pelo bridge Rust.
```

---

## Arquitetura

### Fluxo Completo

```mermaid
sequenceDiagram
    participant UI as Svelte UI
    participant Service as AI Service
    participant Neon as Neon Bridge
    participant Rust as Rust Runtime
    participant JS as Node.js Handler
    participant SDK as Claude SDK
    participant API as Anthropic API

    UI->>Service: sendMessage("analyze code")
    Service->>Neon: createChatCompletion(messages, ClaudeCodeAgent)
    Neon->>Rust: Worker receives request
    Rust->>Rust: Identify Provider::ClaudeAgent
    Rust->>Rust: Serialize ClaudeAgentRequest
    Rust->>JS: Channel.send(json_payload)
    JS->>SDK: query({ prompt, options })
    SDK->>API: HTTP POST /v1/messages
    API-->>SDK: Stream response
    SDK-->>JS: AsyncIterator<Message>
    JS-->>Rust: Promise.resolve(json_result)
    Rust-->>Neon: ChatCompletionStream
    Neon-->>Service: Stream chunks
    Service-->>UI: Update UI
```

### Componentes Principais

#### 1. TypeScript Bridge (`app/src/main/claudeAgent.ts`)

```typescript
export const registerClaudeAgentBridge = (backend: any) => {
  backend.js__claude_agent_register_runner(async (rawPayload: string) => {
    const payload = JSON.parse(rawPayload)
    const result = await runClaudeAgentInvocation(payload)
    return JSON.stringify(result)
  })
}
```

**Responsabilidades:**

- Receber payload JSON do Rust
- Chamar Claude SDK
- Retornar resultado como JSON

#### 2. Rust Runtime (`packages/backend/src/ai/claude_agent.rs`)

```rust
pub struct ClaudeAgentRuntime {
    runner: Arc<Mutex<Option<Root<JsFunction>>>>,
    channel: Channel,
    default_cwd: String,
}

impl ClaudeAgentRuntime {
    pub fn run_completion(&self, request: ClaudeAgentRequest) -> BackendResult<String> {
        // Serialize request
        let payload = serde_json::to_string(&request)?;

        // Send to JS via Channel
        self.channel.send(move |mut cx| {
            let runner = /* get function */;
            let promise = runner.call(&mut cx, this, [payload])?;

            // Convert Promise to Future
            promise.to_future(&mut cx, |mut cx, result| {
                // Handle result
            })
        })

        // Wait for response
        let response = rx.recv()??;
        response.into_result()
    }
}
```

**Responsabilidades:**

- Thread-safe storage do JS handler
- Serialização de requests
- Promise → Future conversion
- Error propagation

#### 3. LLM Client (`packages/backend/src/ai/llm/client/mod.rs`)

```rust
impl LLMClient {
    pub fn create_streaming_chat_completion(
        &self,
        messages: Vec<Message>,
        model: &Model,
        custom_key: Option<String>,
        response_format: Option<serde_json::Value>,
    ) -> BackendResult<ChatCompletionStream> {
        let normalized_messages = truncate_messages(
            filter_unsupported_content(messages, model),
            model
        );

        if matches!(model.provider(), Provider::ClaudeAgent) {
            let output = self.run_claude_agent_completion(
                normalized_messages,
                custom_key
            )?;
            return Ok(ChatCompletionStream::from_single_chunk(
                Ok(output),
                Provider::ClaudeAgent,
            ));
        }

        // ... HTTP providers
    }
}
```

**Responsabilidades:**

- Detectar `Provider::ClaudeAgent`
- Desviar para runtime em vez de HTTP
- Criar stream customizado

---

## Testes

### Teste Manual Básico

1. **Start Dev Server**

   ```bash
   export ANTHROPIC_API_KEY=sk-ant-api03-...
   npm run dev
   ```

2. **No Surf UI**

   - Criar nova conversa
   - Selecionar "Claude Code Agent"
   - Enviar: `"Hello, can you read files?"`
   - ✅ Deve responder confirmando capacidade de leitura

3. **Teste com File Access**
   - Enviar: `"Read the file .claude/CLAUDE.md and summarize its content"`
   - ✅ Deve ler e resumir o arquivo

### Teste de Error Handling

#### Teste 1: API Key Inválida

```bash
# Remover API key
unset ANTHROPIC_API_KEY
npm run dev
```

**Esperado:** Erro claro na UI: "Claude Agent API key is missing. Please set..."

#### Teste 2: Timeout

```typescript
// Em claudeAgent.ts, modificar temporariamente:
const DEFAULT_TIMEOUT_MS = 1000 // 1 segundo
```

**Esperado:** "Request timed out after 1 seconds. Try again..."

#### Teste 3: Formato de Key Incorreto

```bash
export ANTHROPIC_API_KEY=invalid-key
npm run dev
```

**Esperado:** "Invalid Claude API key format. Key should start with 'sk-ant-'."

### Teste de Carga (Opcional)

```bash
# Script de teste de múltiplas requisições paralelas
node scripts/test-claude-agent-load.js
```

---

## Troubleshooting

### ❌ Erro: "Claude Code Agent bridge is not registered"

**Causa:** O handler JavaScript não foi registrado com o Rust.

**Diagnóstico:**

```bash
# Verificar se registerClaudeAgentBridge é chamado
grep -n "registerClaudeAgentBridge" app/src/main/sffs.ts
# Deve aparecer na linha ~136
```

**Solução:**

1. Verificar que `initBackend()` retorna `sffs` corretamente
2. Confirmar que `registerClaudeAgentBridge(sffs)` é executado
3. Restart completo do app

---

### ❌ Erro: "API key missing"

**Causa:** Variável de ambiente não está configurada.

**Solução:**

```bash
# Opção 1: Variável de ambiente
export ANTHROPIC_API_KEY=sk-ant-api03-...

# Opção 2: Via UI Settings
# Settings → API Keys → Claude Code Agent
```

**Verificar:**

```bash
echo $ANTHROPIC_API_KEY
# Deve mostrar a key
```

---

### ❌ Erro: "Channel closed" ou "Mutex poisoned"

**Causa:** Worker thread crashou ou panic ocorreu.

**Diagnóstico:**

```bash
# Rodar com logs detalhados
RUST_LOG=debug npm run dev
# Procurar por "panic" ou "poisoned" nos logs
```

**Solução:**

1. Verificar logs do Rust para panic stack trace
2. Reiniciar aplicação
3. Se persistir, reportar issue com stack trace

---

### ❌ Build Errors: "Cannot find module 'backend.node'"

**Causa:** Neon bindings não foram compilados.

**Solução:**

```bash
cd packages/backend
cargo clean
yarn build

# Verificar se criou o .node
ls *.node
```

---

### ❌ Erro: "Request timed out after 120 seconds"

**Causa:** Requisição muito complexa ou API lenta.

**Solução:**

```typescript
// Aumentar timeout em claudeAgent.ts
const DEFAULT_TIMEOUT_MS = 300000 // 5 minutos
```

Ou configurar por request (requer modificação):

```typescript
interface ClaudeAgentInvocation {
  timeout?: number // em ms
}
```

---

### ⚠️ Streaming Não Incremental

**Comportamento Atual:** Resposta retorna tudo de uma vez.

**Causa:** `from_single_chunk()` cria stream com chunk único.

**Workaround:** Aguardar implementação de streaming incremental (planejado).

**Para Desenvolvedores:**

```rust
// Futuro: Implementar VecDeque queue
fn create_incremental_stream() -> ChatCompletionStream {
    let mut queue = VecDeque::new();
    // ... push chunks progressivamente
    ChatCompletionStream::from_queue(queue)
}
```

---

## Próximas Melhorias

### ✅ Concluído

- [x] Integração básica funcional
- [x] Error handling robusto
- [x] Timeouts configuráveis
- [x] Documentação completa
- [x] Thread-safety (Arc/Mutex)

### 🚧 Em Progresso

- [ ] Streaming incremental (chunks progressivos)
- [ ] MCP tools customizadas
- [ ] Provider abstraction layer

### 📋 Planejado

- [ ] Cache de respostas
- [ ] Retry logic com exponential backoff
- [ ] Metrics/telemetry
- [ ] Custom system prompts por contexto
- [ ] Tool usage analytics
- [ ] Multi-agent orchestration

---

## Recursos Adicionais

### Documentação

- [Claude Code Agent SDK Docs](https://github.com/anthropics/claude-code-agent-sdk)
- [Neon Bindings Guide](https://neon-bindings.com/docs/intro)
- [Anthropic API Reference](https://docs.anthropic.com/claude/reference)

### Arquivos de Configuração

- `.claude/CLAUDE.md` - Contexto completo do projeto
- `.claude/settings.json` - Configurações do Claude Agent
- `app/src/main/claudeAgent.ts` - Bridge Node.js
- `packages/backend/src/ai/claude_agent.rs` - Runtime Rust

### Suporte

- GitHub Issues: [deta/surf/issues](https://github.com/deta/surf/issues)
- Documentação do Surf: Consultar `.claude/CLAUDE.md`

---

**Última atualização:** 2025-01-16
**Versão:** 1.0.0
**Status:** ✅ Produção-ready
