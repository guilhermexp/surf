# Research Report: Claude Code Agent Integration with Surf Browser

**Research Date:** 2025-11-16 (November 16, 2025)  
**Researcher:** Research Agent  
**Context:** Integration of Claude Agent SDK as a new provider option in Surf Browser  
**Codebase Areas:** Backend LLM Client, Brain Orchestrator, Frontend AIService

---

## Executive Summary

The Claude Agent SDK can be integrated into Surf Browser as a new provider option while maintaining all existing functionality. The SDK offers block-based streaming, built-in tool capabilities, and MCP integration that align well with Surf's existing architecture. Implementation requires creating a new provider adapter in the backend Rust layer that bridges between Claude Agent SDK's TypeScript implementation and Surf's orchestrator pattern.

---

## Current State Analysis

### What We Have Now

- **Backend Architecture:** Rust-based Brain Orchestrator managing multiple specialized agents
- **LLM Integration:** Multi-provider support (OpenAI, Anthropic standard API, Google, Custom)
- **Tool System:** Extensible tool framework with WebSearch, Surflet, and Context Management
- **Streaming:** XML-based incremental response parsing
- **Frontend:** TypeScript/Svelte with IPC communication to backend

### Identified Integration Points

1. **LLM Client & Model Manager** - Where provider logic resides
2. **Orchestrator** - Coordinates agent execution
3. **Tool Registry** - Maps Surf tools to Claude Agent capabilities
4. **IPC Channel** - Communication between TypeScript frontend and Rust backend

---

## Migration Path

### Phase 1: Foundation (Week 1)

1. Set up Node.js bridge infrastructure
2. Create basic ClaudeAgentProvider
3. Test simple query execution
4. Implement response conversion

### Phase 2: Integration (Week 2)

1. Add provider to model configuration
2. Map core tools (WebSearch)
3. Integrate with Orchestrator
4. Test streaming responses

## Detailed Implementation Plan

### 1. Shared Types & Configuration

1. Extend the shared model/provider enums so the new option flows end-to-end:
   - `packages/types/src/ai.types.ts`: add a `Provider.ClaudeAgent` entry, map it in `ProviderLabels/Icons`, and add a corresponding built-in model descriptor inside `BUILT_IN_MODELS`.
   - `packages/backend/types/index.ts`: include the new provider literal so the generated TypeScript bindings expose it to the preload/main processes.
2. Update Surf’s user settings defaults (`packages/services/src/lib/ai/ai.ts` and `app/src/main/config.ts`) to recognize the Claude agent entry and keep backwards compatibility for existing selections.

### 2. Node Bridge for Claude Agent SDK

1. Add the official Claude Code Agent SDK to `packages/backend/package.json` (and lockfile) plus any MCP/tool dependencies it requires.
2. Under `packages/backend/scripts` (or a new `bridge/` dir), implement a TypeScript module that:
   - Instantiates the Claude agent client with API key + tool configuration read from the worker config.
   - Exposes functions for `runTask`, `streamTask`, tool registration, and cleanup. Keep the API surface minimal so the Rust side can call into a single Neon-exported function per operation.
3. Export those bridge functions through Neon:
   - In `packages/backend/src/api/worker.rs`, add new exports like `js__claude_agent_invoke` / `js__claude_agent_stream` that call the TS bridge.
   - Extend `WorkerTunnel` (`packages/backend/src/worker/tunnel.rs`) to keep the JS callback roots for these bridge calls just like it already does for the event bus.

### 3. Backend Rust Provider Adapter

1. Create a dedicated module (e.g. `packages/backend/src/ai/llm/providers/claude_agent.rs`) that wraps the Neon bridge. It should accept Surf’s `Message` structs, call the bridge, and translate back to strings/streams.
2. Update `Provider`/`Model` enums in `packages/backend/src/ai/llm/client/mod.rs` to include `ClaudeAgent`. In `send_completion_request` route this variant to the new adapter instead of the HTTP code path.
3. Teach `LLMClient::handle_streaming_response` and `ChatCompletionStream` to consume the block-based streaming events emitted by the SDK, emitting Surf’s existing incremental chunks so the renderer sees the same interface.
4. Register the Claude agent as an additional option in the orchestrator pipeline:
   - Pass the Node bridge handles into `JSToolRegistry` (see `packages/backend/src/ai/brain/js_tools.rs`) so Claude can call Surf tools (search, surflet) when the SDK requests them.
   - Ensure `Orchestrator::new` accepts the `Provider::ClaudeAgent` default model without affecting the existing Anthropic/OpenAI logic.

### 4. Tool & MCP Mapping

1. In the bridge module, map Surf’s built-in tools to Claude Agent’s tool schema:
   - Web search → proxy to `SearchEngineCaller` via the existing IPC.
   - Surflet/resource actions → expose limited Surf APIs (reuse `JSToolRegistry::execute_tool`).
2. Provide a manifest describing which tools are enabled so the SDK knows what to call. Keep the mapping configurable so we can add/remove tools without rebuilding the SDK wrapper.

### 5. Frontend (AIService)

1. Surface the new provider/model in the UI:
   - `packages/services/src/lib/constants/chat.ts`: add a mention shortcut (e.g. “@Claude Agent”).
   - `packages/services/src/lib/ai/ai.ts`: ensure `getMatchingBackendModel` can select the Claude agent entry and send it through `createAIChatCompletion` without extra switches.
2. Update any model-picker components (settings panes, chat sidebar) to show the new option, using the existing provider label/icon infrastructure.

### 6. Testing & Rollout

1. Unit-test the provider adapter by mocking the bridge responses (add tests under `packages/backend/src/ai/llm/providers/tests`).
2. Add integration tests that spin up the Neon bridge and ensure streaming + tool calls behave.
3. Gate the feature behind a config flag so we can roll it out gradually; default it off in production builds until validation is complete.
4. Document the new provider in the README / release notes and ensure API keys can be configured via the existing settings UI.

---

## Conclusion

Integrating Claude Agent SDK into Surf Browser is technically feasible and offers significant advantages. The main challenge is bridging TypeScript SDK with Rust backend, solved through a Node.js bridge. The integration preserves all existing functionality while adding Claude Code Agent autonomous capabilities as a new provider option.

**Next Steps:** Create POC with minimal bridge implementation
