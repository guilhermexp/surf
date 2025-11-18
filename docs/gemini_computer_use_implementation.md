# Gemini 2.5 Computer Use - Implementação Correta

## O que foi implementado (baseado na documentação oficial)

### 1. Modelo Adicionado

✅ **`gemini-2.5-computer-use-preview-10-2025`** em `packages/types/src/ai.types.ts`

- Provider: Google
- Tier: Premium
- Vision: Sim
- Supports JSON format: Não (usa function calling)

### 2. Como Gemini Computer Use Funciona (Documentação Oficial)

**NÃO é uma API de automação local**. É um **MODELO DE VISÃO** que:

1. **Recebe screenshots** da tela atual
2. **Analisa visualmente** o que está na tela usando visão computacional
3. **Retorna function_calls** com ações sugeridas (click_at, type_text_at, etc)
4. **Você executa** essas ações localmente (Playwright/Puppeteer/Electron)
5. **Captura novo screenshot** e fecha o loop

### 3. Arquitetura Implementada

```
┌─────────────────────────────────────────────────────────────┐
│                  Gemini Computer Use Agent                   │
│                (geminiComputerUse.ts)                       │
└─────────────────────────────────────────────────────────────┘
                           │
          ┌────────────────┼────────────────┐
          │                │                │
          ▼                ▼                ▼
   Capture          Send to           Execute
  Screenshot       Gemini API        Function Call
                        │
                        ▼
              gemini-2.5-computer-use
                        │
                        ▼
                  Function Calls:
                  - click_at(x, y)
                  - type_text_at(x, y, text)
                  - navigate(url)
                  - scroll_document(direction)
                  - wait_5_seconds()
                        │
                        ▼
           BrowserAutomationController
           (Executa via Electron WebContents)
```

### 4. Componentes Implementados

#### A. GeminiComputerUseAgent (`app/src/main/automation/geminiComputerUse.ts`)

**Responsabilidades:**

- Gerencia o loop de agent: screenshot → API → function_call → execute
- Converte coordenadas normalizadas (0-1000) para pixels reais
- Mantém histórico de conversa
- Comunica com a API do Gemini

**Métodos principais:**

```typescript
async executeTask(goal: string): Promise<string>
```

Executa uma tarefa completa usando o loop de agent.

**Loop de Agent:**

```typescript
for (let turn = 0; turn < maxTurns; turn++) {
  // 1. Envia screenshot + histórico para Gemini
  const response = await this.sendToGemini()

  // 2. Recebe function_calls
  const candidate = response.candidates[0]

  // 3. Executa as ações localmente
  const results = await this.executeFunctionCalls(candidate.content.parts)

  // 4. Captura novo screenshot
  const newScreenshot = await this.captureScreenshot()

  // 5. Envia function_response de volta
  this.conversationHistory.push(functionResponses)
}
```

**Conversão de Coordenadas:**

```typescript
// Gemini usa coordenadas normalizadas (0-1000)
const denormalizeX = (x: number) => Math.round((x / 1000) * this.screenWidth)
const denormalizeY = (y: number) => Math.round((y / 1000) * this.screenHeight)
```

#### B. BrowserAutomationController (`app/src/main/automation/controller.ts`)

**Aprimoramentos:**

- ✅ Suporte a **cliques baseados em coordenadas** (não apenas seletores CSS)
- ✅ **Digitação baseada em coordenadas** (clica, foca, digita)
- ✅ Comandos de navegação: `go_back`, `go_forward`
- ✅ Opção `pressEnter` para submeter forms

**Novos comandos:**

```typescript
// Click por coordenadas
{ type: 'click', x: 500, y: 300 }

// Type por coordenadas
{ type: 'type', text: 'hello', x: 400, y: 250, pressEnter: true }

// Navegação
{ type: 'go_back' }
{ type: 'go_forward' }
```

### 5. Funções Suportadas pelo Gemini Computer Use

Conforme documentação oficial em https://ai.google.dev/gemini-api/docs/computer-use#supported-actions:

| Função             | Descrição                         | Argumentos                                                     |
| ------------------ | --------------------------------- | -------------------------------------------------------------- |
| `open_web_browser` | Abre o navegador                  | Nenhum                                                         |
| `wait_5_seconds`   | Pausa por 5 segundos              | Nenhum                                                         |
| `go_back`          | Navega para página anterior       | Nenhum                                                         |
| `go_forward`       | Navega para próxima página        | Nenhum                                                         |
| `search`           | Abre Google                       | Nenhum                                                         |
| `navigate`         | Navega para URL específica        | `url: string`                                                  |
| `click_at`         | Clica em coordenada (0-1000 grid) | `x: int`, `y: int`                                             |
| `hover_at`         | Hover em coordenada               | `x: int`, `y: int`                                             |
| `type_text_at`     | Digita texto em coordenada        | `x: int`, `y: int`, `text: string`, `press_enter?: bool`       |
| `key_combination`  | Pressiona combinação de teclas    | `keys: string` (ex: "Control+C")                               |
| `scroll_document`  | Rola a página inteira             | `direction: "up" \| "down" \| "left" \| "right"`               |
| `scroll_at`        | Rola elemento específico          | `x: int`, `y: int`, `direction: string`, `magnitude?: int`     |
| `drag_and_drop`    | Arrasta elemento                  | `x: int`, `y: int`, `destination_x: int`, `destination_y: int` |

**✅ Implementados:** open_web_browser, wait_5_seconds, go_back, go_forward, search, navigate, click_at, type_text_at, scroll_document

**⚠️ Pendentes:** hover_at, key_combination, scroll_at, drag_and_drop

### 6. Formato da Requisição à API

```typescript
const requestBody = {
  contents: [
    {
      role: 'user',
      parts: [
        { text: 'User goal/task description' },
        {
          inline_data: {
            mime_type: 'image/png',
            data: '<base64_screenshot>'
          }
        }
      ]
    }
  ],
  generationConfig: {
    tools: [
      {
        computer_use: {
          environment: 'ENVIRONMENT_BROWSER'
        }
      }
    ]
  }
}
```

### 7. Formato da Resposta

```json
{
  "candidates": [
    {
      "content": {
        "parts": [
          {
            "text": "I will click the search button at coordinates (500, 300)"
          },
          {
            "function_call": {
              "name": "click_at",
              "args": {
                "x": 500,
                "y": 300
              }
            }
          }
        ]
      },
      "safetyDecision": {
        "decision": "regular"
      }
    }
  ]
}
```

### 8. Safety & Best Practices

Conforme documentação oficial:

1. **Human-in-the-Loop**: Implementar confirmação quando `safetyDecision` = `require_confirmation`
2. **Secure Environment**: Executar em sandbox/VM
3. **Input Sanitization**: Sanitizar prompts do usuário
4. **Allowlists/Blocklists**: Controlar quais sites podem ser acessados
5. **Observability**: Logar todas ações e screenshots
6. **Environment Management**: Estado consistente, sem pop-ups inesperados

### 9. Como Usar (Exemplo)

```typescript
import { GeminiComputerUseAgent } from './automation/geminiComputerUse'
import { BrowserWindow } from 'electron'

// 1. Criar agent
const agent = new GeminiComputerUseAgent({
  apiKey: process.env.GOOGLE_API_KEY,
  maxTurns: 10,
  screenWidth: 1440,
  screenHeight: 900
})

// 2. Definir target window
const window = BrowserWindow.getFocusedWindow()
agent.setTarget(window)

// 3. Executar tarefa
const result = await agent.executeTask(
  'Search for smart fridges under $4000 on Google Shopping and list the 3 cheapest'
)

console.log('Result:', result)
```

### 10. Limitações Atuais

1. **Requer API Key do Google** com acesso ao modelo `gemini-2.5-computer-use-preview-10-2025`
2. **Preview Model**: Pode ter erros e vulnerabilidades de segurança
3. **Algumas funções não implementadas**: hover_at, key_combination, scroll_at, drag_and_drop
4. **Sem UI**: Não há interface para testar diretamente (apenas via código)
5. **Sem IPC Bridge**: Não está exposto via IPC para uso no renderer process

### 11. Próximos Passos Recomendados

1. **Implementar funções faltantes**: hover_at, key_combination, scroll_at, drag_and_drop
2. **Adicionar Safety System**: Implementar confirmação quando `require_confirmation`
3. **Criar UI de teste**: Interface para testar o agent visualmente
4. **Adicionar IPC Bridge**: Expor via IPC para uso no frontend
5. **Implementar logging**: Salvar todas interações para debug
6. **Adicionar allowlist/blocklist**: Controlar quais sites podem ser acessados

## Referências

- **Documentação Oficial**: https://ai.google.dev/gemini-api/docs/computer-use
- **Modelo**: `gemini-2.5-computer-use-preview-10-2025`
- **Reference Implementation**: https://github.com/google/computer-use-preview/
- **Demo Environment**: http://gemini.browserbase.com
