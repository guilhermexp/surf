# Relatório Técnico – Robustez de Ferramentas do Agente AI

## 1. Contexto

- Repositório: Surf Browser (`/Users/guilhermevarela/Public/surf`).
- Objetivo: avaliar por que o agente atual não escala em número/capacidade de tools (imagem, vídeo, automação via Gemini Computer Use, MCP) e propor direções concretas.
- Fontes analisadas: `packages/backend/src/ai/brain/*`, `packages/backend/src/ai/llm/client/mod.rs`, `packages/backend/src/worker/**/*`, `packages/services/src/lib/ai/**/*`, `app/src/main/claudeAgent.ts`, documentação em `ai_specs`, `.claude/`, `INTEGRACAO_CONCLUIDA.md`, etc.

## 2. Diagnóstico do Estado Atual

### 2.1 Arquitetura "Brain" inativa

- O módulo `ai::brain` só é compilado quando a feature `wip` é habilitada (`packages/backend/src/ai/mod.rs:6-7`).
- Nenhum ponto do backend inicializa `Orchestrator`, `LLMContext` ou `JSToolRegistry`. Na prática, toda a pipeline de agentes/tools descrita no relatório antigo é código morto.

### 2.2 Fluxo real: prompts monolíticos

- `worker/handlers/misc.rs` monta `ChatInput` e sempre chama diretamente `LLMClient::create_streaming_chat_completion`.
- Para conversas comuns, os flags `websearch` e `surflet` são forçados para `false`, então o prompt nunca instruirá o modelo a usar `<websearch>`/`:::surflet`.
- Não há parser para essas marcações – mesmo que aparecessem, nada dispararia tools reais.

### 2.3 UI de tools é apenas cosmética

- `AI_TOOLS` (`packages/services/src/lib/constants/tools.ts`) é uma lista estática usada na UI/teletype (`teletypeService.ts`).
- Ativar/desativar ali não liga nenhuma função no backend; serve apenas para mostrar ícones e filtrar intents.

### 2.4 Registry rígido no Rust

- `JSToolRegistry` (`packages/backend/src/ai/brain/js_tools.rs`) suporta apenas quatro tools hardcoded (`web_search_api`, `web_search_done_callback`, `scrape_url`, `surflet_done_callback`).
- Criar novas tools implica alterar enums, recompilar o módulo Neon e tocar múltiplos arquivos – processo frágil que explica o “deu problema pra caramba”.

### 2.5 Faltas específicas

- **Imagem/Vídeo**: não existe agent/tool dedicado, nem ponte com APIs externas para armazenar recursos.
- **Automação (Gemini Computer Use)**: o LLM client só expõe `Gemini20Flash` compatível com a API OpenAI; não há handler para `computerUse` nem controlador no Electron que execute ações no browser.
- **MCP**: há requisitos documentados (`ai_specs/mcp-agent-integration`), mas nenhuma linha de código inicializa MCP servers ou repassa tools MCP ao agente.
- **Claude Agent**: integração concluída, porém limitada – `run_claude_agent_completion` retorna apenas uma string final e não recebe ferramentas do `JSToolRegistry`, logo não há tool calling/mode MCP mesmo para Claude.

## 3. Consequências

1. **Inflexibilidade** – qualquer tool nova exige retrabalho no Rust/Neon, tornando experiências como "image generation" dolorosas.
2. **Experiência pobre** – o agente recorre somente ao texto do modelo escolhido; sem websearch ou surflet reais quando não se está em modo nota.
3. **Impossibilidade de automação** – nada integra com APIs do Gemini Computer Use ou MCP, então o agente não consegue operar o próprio browser nem reutilizar servidores externos.
4. **Duplicidade de esforços** – existe um arcabouço avançado (brain/orchestrator) que não é usado, gerando confusão entre o relatório arquitetural e o produto real.

## 4. Recomendações (alto nível)

1. **Promover o "Brain" para produção**

   - Remover o `cfg(feature = "wip")`, inicializar `Orchestrator` dentro do `Worker` e direcionar `ChatInput` para `execute_lead_agent` sempre que o usuário habilitar o modo avançado.
   - Reusar `LLMContext` para leitura de recursos e streaming.

2. **Manifesto dinâmico de tools**

   - Substituir `ToolName` fixo por IDs textuais e expor `js__ai_register_tool` via Neon.
   - Criar um `tools/manifest.ts` no frontend/main process descrevendo id, schema, ícone, permissões e a função JS que executa a tool.
   - Registrar/dessregistrar dinamicamente no `JSToolRegistry`, evitando recompilar o backend para novas ferramentas.

3. **Tooling multimídia**

   - Introduzir um agente `media` com tools `image.generate` e `video.generate` que falam com provedores (OpenAI Images, Stability, Luma, etc.) e salvam recursos via APIs já existentes (`js__store_*`).
   - Responder ao agente com resource IDs para permitir citações e previews.

4. **Integração com Gemini Computer Use**

   - Adicionar modelos `Gemini20ProComputerUse` e criar cliente específico que manipula as ações de automação.
   - Implementar um `BrowserAutomationController` no Electron (usar `webContents` + DevTools Protocol) e expor tool `browser.control` no manifesto.

5. **Suporte MCP**

   - Utilizar `@modelcontextprotocol/sdk` no processo main para registrar servers configurados.
   - Passar o catálogo MCP ao `ClaudeAgentRuntime` (e futuramente aos demais providers) para que tool-calls MCP sejam resolvidos automaticamente.
   - Adicionar logging/observabilidade conforme requisitos já documentados.

6. **Sequenciamento sugerido**
   1. Ativar o Brain e validar a cadeia (Lead Agent + tools atuais).
   2. Introduzir o manifesto dinâmico e migrar as tools existentes para ele.
   3. Acrescentar ferramentas multimídia.
   4. Implementar o stack Gemini Computer Use.
   5. Completar MCP.

## 5. Próximos Documentos

- **PRD** (próxima etapa solicitada): detalhar casos de uso, requisitos funcionais, métricas e critérios de aceitação para o pacote "Tooling + Automação".
- **Plano de Implementação**: após o PRD, quebrar em epics/sprints com estimativas.

---

_Elaborado em 2025-02-15 por Codex._
