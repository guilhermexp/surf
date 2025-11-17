# Claude Agent Integration - Debugging Guide

## 🔍 Comprehensive Logging System

Para facilitar o debug da integração do Claude Agent, foram adicionados logs detalhados em **todos os pontos críticos** da arquitetura.

---

## 📊 Camadas de Logging

### 1️⃣ **TypeScript Bridge Layer** (`app/src/main/claudeAgent.ts`)

**Logs ativados por padrão:** `DEBUG_CLAUDE_AGENT = true`

#### Pontos de Log:

**Inicialização:**

```
[Claude Agent] registerClaudeAgentBridge called
[Claude Agent] Backend object type: object
[Claude Agent] Has js__claude_agent_register_runner: function
[Claude Agent] ✅ Registering Claude Agent bridge...
[Claude Agent] ✅ Claude Agent bridge registered successfully!
[Claude Agent] Bridge is now ready to receive requests from Rust backend
```

**Resolução do CLI:**

```
[Claude Agent] Resolving Claude Code CLI path...
[Claude Agent] Checking CLI paths: 7 candidates
[Claude Agent] Trying CLI path: /path/to/candidate
[Claude Agent] ✅ CLI found at: /path/to/node_modules/@anthropic-ai/claude-agent-sdk/cli.js
```

**Quando uma requisição chega:**

```
[Claude Agent] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[Claude Agent] 🔄 BRIDGE INVOKED - Claude Agent request received
[Claude Agent] Raw payload length: 1234
[Claude Agent] Raw payload preview: {"messages":[...
[Claude Agent] Payload parsed successfully
[Claude Agent] === Starting Claude Agent Invocation ===
[Claude Agent] Payload: { messageCount: 2, hasCustomKey: false, ... }
[Claude Agent] API key validation: OK (starts with sk-ant-)
[Claude Agent] Messages validation: OK (2 messages)
[Claude Agent] Formatted prompt length: 456 characters
[Claude Agent] Timeout configured: 120 seconds
```

**Durante execução:**

```
[Claude Agent] Starting query promise...
[Claude Agent] CLI path resolved: /path/to/cli.js
[Claude Agent] Query options configured: { model: 'claude-sonnet-4-5-20250929', ... }
[Claude Agent] Calling query() with prompt and options...
[Claude Agent] Stream created, starting iteration...
[Claude Agent] Received message #1: { type: 'text', ... }
[Claude Agent] Received message #2: { type: 'result', subtype: 'success', ... }
[Claude Agent] Got result message, subtype: success
[Claude Agent] Success! Output length: 789
[Claude Agent] Stream iteration complete. Total messages: 2
[Claude Agent] ✅ Success! Returning output
[Claude Agent] === Claude Agent Invocation Complete ===
[Claude Agent] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

**Erros:**

```
[Claude Agent ERROR] API key is missing
[Claude Agent ERROR] Environment ANTHROPIC_API_KEY: NOT SET
[Claude Agent ERROR] Invalid API key format. Expected sk-ant-*, got: sk-foo...
[Claude Agent ERROR] CLI not found. Paths checked: /path1, /path2, ...
[Claude Agent ERROR] Exception caught: Error message
[Claude Agent ERROR] Error stack: ...
```

---

### 2️⃣ **Rust Runtime Layer** (`packages/backend/src/ai/claude_agent.rs`)

**Logs ativados por padrão:** `DEBUG_CLAUDE_AGENT = true`

#### Pontos de Log:

**Criação do Runtime:**

```
[Claude Agent Rust] Creating new ClaudeAgentRuntime with cwd: /path/to/app
```

**Verificação do Bridge:**

```
[Claude Agent Rust] has_runner check: true
```

**Construção da Requisição:**

```
[Claude Agent Rust] Building Claude Agent request:
[Claude Agent Rust]   - Messages count: 2
[Claude Agent Rust]   - Has custom key: false
[Claude Agent Rust]   - Model: Some("claude-sonnet-4-5-20250929")
[Claude Agent Rust]   - CWD: /path/to/app
[Claude Agent Rust]   - Custom key validated (starts with: sk-ant-...)
```

**Execução:**

```
[Claude Agent Rust] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[Claude Agent Rust] run_completion called
[Claude Agent Rust] Bridge is registered, proceeding with completion
[Claude Agent Rust] Serializing request to JSON...
[Claude Agent Rust] Serialized payload length: 1234 bytes
[Claude Agent Rust] Sending task to Neon event channel...
[Claude Agent Rust] Inside Neon event handler
[Claude Agent Rust] Runner function found in mutex
[Claude Agent Rust] Preparing to call JS runner function
[Claude Agent Rust] Calling JS runner with payload...
[Claude Agent Rust] JS runner returned a Promise
[Claude Agent Rust] Converting Promise to Future...
[Claude Agent Rust] Promise resolved successfully
[Claude Agent Rust] Got JSON response, length: 789
[Claude Agent Rust] Sending result back through channel
[Claude Agent Rust] Waiting for response from JS bridge via channel...
[Claude Agent Rust] Received response from JS bridge
[Claude Agent Rust] Converting response to result...
[Claude Agent Rust] ✅ Success! Output length: 789 characters
[Claude Agent Rust] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

**Erros:**

```
[Claude Agent Rust ERROR] Bridge is not registered - cannot run completion
[Claude Agent Rust ERROR] Failed to serialize request: ...
[Claude Agent Rust ERROR] Mutex poisoned
[Claude Agent Rust ERROR] Runner not registered in mutex
[Claude Agent Rust ERROR] Promise downcast failed
[Claude Agent Rust ERROR] Promise rejected: ...
[Claude Agent Rust ERROR] Channel closed while waiting for response: ...
```

---

### 3️⃣ **LLM Client Layer** (`packages/backend/src/ai/llm/client/mod.rs`)

#### Pontos de Log:

**Configuração do Runtime:**

```
[LLM Client] ✅ Claude Agent runtime set successfully
```

**Detecção do Provider:**

```
[LLM Client] create_chat_completion called with model: ClaudeCodeAgent
[LLM Client] Provider detected: ClaudeAgent
[LLM Client] ✅ Claude Agent provider detected - routing to run_claude_agent_completion
[LLM Client] Messages count: 2, Has custom key: false
```

**Execução:**

```
[LLM Client] run_claude_agent_completion started
[LLM Client] Model: ClaudeCodeAgent
[LLM Client] Messages: 2
[LLM Client] ✅ Runtime is available
[LLM Client] Model name for SDK: None
[LLM Client] Building request and delegating to runtime...
[LLM Client] ✅ Claude Agent completion successful, output length: 789
```

**Streaming:**

```
[LLM Client] create_streaming_chat_completion called with model: ClaudeCodeAgent
[LLM Client] ✅ Claude Agent provider detected in streaming - routing to run_claude_agent_completion
[LLM Client] Got output from Claude Agent, creating single chunk stream
```

**Erros:**

```
[LLM Client] ❌ Claude Code Agent runtime is not available!
[LLM Client] Runtime was never set or failed to initialize
[LLM Client] ❌ Claude Agent completion failed: ...
```

---

## 🔧 Como Ler os Logs

### Fluxo Normal (Sucesso)

1. **Inicialização (uma vez no startup):**

   ```
   [Claude Agent] ✅ Claude Agent bridge registered successfully!
   [LLM Client] ✅ Claude Agent runtime set successfully
   ```

2. **Por cada mensagem do usuário:**
   ```
   [LLM Client] Provider detected: ClaudeAgent
   [LLM Client] ✅ Claude Agent provider detected
   [Claude Agent Rust] run_completion called
   [Claude Agent] 🔄 BRIDGE INVOKED
   [Claude Agent] === Starting Claude Agent Invocation ===
   [Claude Agent] Calling query() with prompt and options...
   [Claude Agent] ✅ Success! Output length: 789
   [Claude Agent Rust] ✅ Success! Output length: 789 characters
   [LLM Client] ✅ Claude Agent completion successful
   ```

---

## 🚨 Troubleshooting - Cenários Comuns

### Cenário 1: Bridge Não Registrado

**Sintoma:**

```
[Claude Agent ERROR] ❌ Claude Agent bridge NOT available
[Claude Agent ERROR] Backend object: [object Object]
```

**Causa:** `registerClaudeAgentBridge()` não foi chamado ou falhou

**Solução:**

1. Verificar que `app/src/main/sffs.ts` chama `registerClaudeAgentBridge(result.sffs)`
2. Verificar que o backend Rust exporta `js__claude_agent_register_runner`
3. Recompilar backend: `yarn workspace @deta/backend build`

---

### Cenário 2: Runtime Não Disponível

**Sintoma:**

```
[LLM Client] ❌ Claude Code Agent runtime is not available!
```

**Causa:** Runtime não foi injetado no LLMClient

**Solução:**

1. Verificar `packages/backend/src/worker/mod.rs` - `Worker::new()` cria o runtime
2. Verificar `packages/backend/src/ai/mod.rs` - `AI::new()` recebe o runtime
3. Verificar que `set_claude_agent_runtime()` foi chamado

---

### Cenário 3: API Key Inválida

**Sintoma:**

```
[Claude Agent ERROR] API key is missing
[Claude Agent ERROR] Environment ANTHROPIC_API_KEY: NOT SET
```

**Solução:**

```bash
export ANTHROPIC_API_KEY="sk-ant-api03-..."
```

---

### Cenário 4: CLI Não Encontrado

**Sintoma:**

```
[Claude Agent ERROR] CLI not found. Paths checked: /path1, /path2, ...
```

**Solução:**

```bash
cd app
npm install @anthropic-ai/claude-agent-sdk
```

---

### Cenário 5: Timeout

**Sintoma:**

```
[Claude Agent ERROR] Request timed out after 120000 ms
```

**Solução:**

- Query muito complexa → Dividir em partes menores
- Aumentar timeout no payload: `{ timeout: 300000 }` (5 min)
- Verificar conexão de internet

---

### Cenário 6: Provider Não Detectado

**Sintoma:**

```
[LLM Client] Provider detected: OpenAI
```

(Quando deveria ser `ClaudeAgent`)

**Causa:** Modelo errado selecionado na UI ou configuração incorreta

**Solução:**

1. Verificar que o modelo selecionado é "Claude Code Agent"
2. Verificar `packages/types/src/ai.types.ts` - `BuiltInModelIDs.ClaudeCodeAgent`
3. Verificar que o provider está mapeado: `provider: Provider.ClaudeAgent`

---

## 📋 Checklist de Debug

Quando algo não funcionar, verifique os logs nesta ordem:

### ✅ Passo 1: Inicialização

- [ ] `[Claude Agent] ✅ Claude Agent bridge registered successfully!`
- [ ] `[LLM Client] ✅ Claude Agent runtime set successfully`

Se falharem → Problema na inicialização (ver Cenários 1 e 2)

### ✅ Passo 2: Detecção do Provider

- [ ] `[LLM Client] Provider detected: ClaudeAgent`
- [ ] `[LLM Client] ✅ Claude Agent provider detected`

Se falhar → Modelo errado ou configuração incorreta (ver Cenário 6)

### ✅ Passo 3: Bridge Invocado

- [ ] `[Claude Agent] 🔄 BRIDGE INVOKED`
- [ ] `[Claude Agent] Payload parsed successfully`

Se falhar → Problema na comunicação Rust ↔ JS

### ✅ Passo 4: API Key

- [ ] `[Claude Agent] API key validation: OK`

Se falhar → Ver Cenário 3

### ✅ Passo 5: CLI Resolution

- [ ] `[Claude Agent] ✅ CLI found at: /path/to/cli.js`

Se falhar → Ver Cenário 4

### ✅ Passo 6: Execução do SDK

- [ ] `[Claude Agent] Calling query() with prompt and options...`
- [ ] `[Claude Agent] Stream created, starting iteration...`
- [ ] `[Claude Agent] Received message #1: ...`

Se falhar aqui → Problema no SDK ou configuração de query options

### ✅ Passo 7: Sucesso

- [ ] `[Claude Agent] ✅ Success! Output length: XXX`
- [ ] `[LLM Client] ✅ Claude Agent completion successful`

---

## 🎯 Logs Críticos para Reportar Bugs

Se encontrar um problema, inclua no report:

1. **Logs de Inicialização:**

   ```
   grep "Claude Agent.*registered" logs.txt
   grep "Claude Agent runtime set" logs.txt
   ```

2. **Logs da Requisição Falhada:**

   ```
   grep "BRIDGE INVOKED" -A 50 logs.txt
   ```

3. **Erros:**

   ```
   grep "Claude Agent.*ERROR" logs.txt
   ```

4. **Contexto do Sistema:**
   ```bash
   node --version
   npm list @anthropic-ai/claude-agent-sdk
   echo $ANTHROPIC_API_KEY | cut -c1-10
   ```

---

## 🔧 Controlar Nível de Logging

### Desativar Logs Detalhados (TypeScript)

Em `app/src/main/claudeAgent.ts`:

```typescript
const DEBUG_CLAUDE_AGENT = false // ← Mudar para false
```

### Desativar Logs Detalhados (Rust)

Em `packages/backend/src/ai/claude_agent.rs`:

```rust
const DEBUG_CLAUDE_AGENT: bool = false;  // ← Mudar para false
```

### Filtrar Logs no Console

```bash
# Apenas Claude Agent
npm run dev 2>&1 | grep "Claude Agent"

# Apenas erros
npm run dev 2>&1 | grep "ERROR"

# Salvar logs em arquivo
npm run dev 2>&1 | tee debug.log
```

---

## 📊 Métricas nos Logs

Os logs também capturam métricas úteis:

- **Payload size:** `Serialized payload length: 1234 bytes`
- **Message count:** `Messages count: 2`
- **Output size:** `Output length: 789 characters`
- **Stream messages:** `Total messages: 5`
- **Timeout usado:** `Timeout configured: 120 seconds`

Use para otimização e troubleshooting de performance.

---

## ✅ Exemplo de Fluxo Completo (Sucesso)

```
[Claude Agent] registerClaudeAgentBridge called
[Claude Agent] Backend object type: object
[Claude Agent] Has js__claude_agent_register_runner: function
[Claude Agent] ✅ Registering Claude Agent bridge...
[Claude Agent] ✅ Claude Agent bridge registered successfully!
[LLM Client] ✅ Claude Agent runtime set successfully

--- User sends message ---

[LLM Client] create_chat_completion called with model: ClaudeCodeAgent
[LLM Client] Provider detected: ClaudeAgent
[LLM Client] ✅ Claude Agent provider detected - routing to run_claude_agent_completion
[LLM Client] Messages count: 2, Has custom key: false
[LLM Client] run_claude_agent_completion started
[LLM Client] ✅ Runtime is available
[Claude Agent Rust] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[Claude Agent Rust] run_completion called
[Claude Agent Rust] Bridge is registered, proceeding with completion
[Claude Agent Rust] Serialized payload length: 456 bytes
[Claude Agent Rust] Inside Neon event handler
[Claude Agent Rust] Calling JS runner with payload...
[Claude Agent] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[Claude Agent] 🔄 BRIDGE INVOKED - Claude Agent request received
[Claude Agent] Payload parsed successfully
[Claude Agent] === Starting Claude Agent Invocation ===
[Claude Agent] API key validation: OK (starts with sk-ant-)
[Claude Agent] Messages validation: OK (2 messages)
[Claude Agent] Resolving Claude Code CLI path...
[Claude Agent] ✅ CLI found at: /app/node_modules/@anthropic-ai/claude-agent-sdk/cli.js
[Claude Agent] Calling query() with prompt and options...
[Claude Agent] Stream created, starting iteration...
[Claude Agent] Received message #1: { type: 'text', ... }
[Claude Agent] Received message #2: { type: 'result', subtype: 'success', ... }
[Claude Agent] Success! Output length: 789
[Claude Agent] ✅ Success! Returning output
[Claude Agent] === Claude Agent Invocation Complete ===
[Claude Agent] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[Claude Agent Rust] Promise resolved successfully
[Claude Agent Rust] Got JSON response, length: 789
[Claude Agent Rust] ✅ Success! Output length: 789 characters
[Claude Agent Rust] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[LLM Client] ✅ Claude Agent completion successful, output length: 789
```

---

**Status:** ✅ Sistema de logging completo implementado  
**Última atualização:** November 16, 2024
