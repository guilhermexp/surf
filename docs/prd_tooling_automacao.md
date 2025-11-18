# PRD – Plataforma de Tools & Automação do Agente Surf

## 1. Visão Geral

- **Problema**: O agente atual não possui arquitetura funcional para chamadas de tools, limitando-se a respostas textuais. A criação de novas ferramentas exige alterações no core Rust/Neon, inviabilizando integrações como geração de imagem/vídeo, Gemini Computer Use e MCP.
- **Objetivo**: Entregar uma plataforma robusta de tools plugáveis que habilite automações internas (controlar o browser) e externas (MCP, serviços de mídia) com mínimo atrito para times de produto.
- **Stakeholders**: Time AI/Browser, plataforma (Electron), produto (UX de chat/Surflets), comunidade (MCP servers).

## 2. Escopo

1. **Ativar Orchestrator** – Migrar o fluxo principal do chat para o Brain multitagens, com suporte a streaming, contexto e tool-calls.
2. **Manifesto Dinâmico de Tools** – Registro em tempo de execução de ferramentas JS, sem recompilar Rust.
3. **Tooling Multimídia** – Entregar ferramentas oficiais para geração de imagens e vídeos com armazenamento automático em `resources`.
4. **Automação via Gemini Computer Use** – Permitir que modelos com capacidade de automação controlem o browser para executar ações do usuário.
5. **Integração MCP** – Expor ferramentas de servidores MCP ao agente (inicialmente para Claude Code Agent) com observabilidade.

## 3. Fora de Escopo

- UI completa de gestão de MCP (primeira versão usará config simples).
- Gestão avançada de quotas/custos das APIs externas.
- Execução concorrente de múltiplas automações simultâneas (limitar a 1 sessão por usuário inicialmente).

## 4. Requisitos Detalhados

### 4.1 Orchestrator e Contexto

- R1: `Worker::new` deve inicializar `Orchestrator` e direcionar `ChatInput` para `execute_lead_agent` quando o usuário habilitar ferramentas avançadas.
- R2: `LLMContext` precisa ser instanciado com as mesmas fontes (resources, inline images, histórico) hoje usadas no fluxo tradicional.
- R3: Streaming parcial deve continuar funcionando (chunks + citations).

### 4.2 Manifesto de Tools

- R4: Disponibilizar export Neon `js__ai_register_tool(id, metadata, callback)` para registrar/desregistrar tools em runtime.
- R5: `JSToolRegistry` passa a mapear strings → callbacks, sem enum fixo.
- R6: Frontend/Main process mantém um manifesto (TS) com nome, descrição, schema JSON e handler de cada tool (websearch, surflet, scrape, etc.).
- R7: A UI de `AI_TOOLS` consome o manifesto para refletir disponibilidade real.

### 4.3 Ferramentas Multimídia

- R8: Criar agente `media` com tools `image.generate` e `video.generate`.
- R9: Handlers devem chamar provedores externos configuráveis e salvar saídas via APIs do backend (`js__store_*`).
- R10: Respostas precisam retornar IDs de recursos para permitir citações/preview automático no chat.

### 4.4 Gemini Computer Use

- R11: Adicionar modelos `Gemini20ProComputerUse` (ou equivalente) e cliente específico no backend.
- R12: Implementar `BrowserAutomationController` (Electron main) que recebe comandos (open_url, click, type, etc.) e opera via `webContents`/CDP.
- R13: Expor tool `browser.control` no manifesto. Modelos compatíveis devem enxergá-lo automaticamente.
- R14: Registrar logs de ações executadas, com limites e interrupção manual.

### 4.5 MCP

- R15: Conectar `@modelcontextprotocol/sdk` para registrar servidores MCP a partir de config local.
- R16: Integrar MCP ao `ClaudeAgentRuntime`, permitindo tool-calls MCP durante sessões.
- R17: Adicionar logs estruturados contendo server id, tool, duração, resultado.
- R18: Implementar fallback seguro (se MCP falhar, ferramenta volta erro mas a sessão continua).

## 5. Sucesso e Métricas

- **Ativação**: % de chats que utilizam pelo menos 1 tool (meta 40% para usuários beta).
- **Cobertura**: 100% das tools existentes migradas ao manifesto dinâmico.
- **Robustez**: <2% de falhas por tool execution (tracking nos logs).
- **Automação**: pelo menos um fluxo completo “abrir site + interagir” concluído em testes de QA.
- **MCP**: capacidade de invocar ao menos 1 servidor MCP externo (teste com server de exemplo).

## 6. Dependências e Riscos

- Dependência de APIs externas (custos/limites) para imagem/vídeo.
- Autorização/segurança ao permitir automação do browser – necessidade de prompts de consentimento e sandbox.
- Complexidade do Neon/IPC: mexer no pipeline exige coordenação entre TS (main/preload) e Rust.

## 7. Cronograma Alto Nível

1. **Sprint 1**: Ativar Orchestrator + pipeline de tools atual.
2. **Sprint 2**: Manifesto dinâmico e migração das tools existentes.
3. **Sprint 3**: Tools de imagem/vídeo.
4. **Sprint 4**: Gemini Computer Use + controlador.
5. **Sprint 5**: MCP + observabilidade.

---

_Atualizado em 2025-02-15._
