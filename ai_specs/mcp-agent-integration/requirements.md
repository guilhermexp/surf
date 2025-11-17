# Requirements: mcp-agent-integration

## 1. Overview

Goal: Enable Surf AI agents, starting with Claude Code Agent, to call external MCP (Model Context Protocol) servers as tools during AI conversations, without ainda exigir uma UI completa de configuração de servidores.
User Problem: Users want their AI agents inside Surf to orchestrate and execute complex workflows by calling external MCP tools (e.g., project-specific services, custom backends) directly from the notebook environment, instead of being limited only to built-in tools.

## 2. Functional Requirements

### 2.1 Core Features

1. WHEN an AI session uses a provider backed by Claude Agent THEN the system SHALL allow that agent runtime to invoke MCP tools exposed by configured MCP servers.
2. WHEN an MCP tool is invoked by an agent THEN the system SHALL route the request to the appropriate MCP server process and return the response back to the agent runtime.
3. WHEN MCP integration is enabled for a given model configuration THEN the system SHALL make MCP tools discoverable to the Claude Agent runtime as part of the tools it can call.
4. WHEN an MCP call fails (timeout, server error, connectivity issue) THEN the system SHALL propagate a meaningful error back to the agent and log diagnostic information.
5. WHEN MCP integration is disabled or misconfigured for a model THEN the system SHALL not expose any MCP tools and the agent SHALL continue to work with existing tools only.
6. WHEN Surf starts up THEN the system SHALL initialize the MCP integration layer (registry/adapter) so that agents can query available MCP tools during their first completion.
7. WHEN the user changes model/provider settings to a non-Claude-Agent provider THEN the system SHALL not attempt to use MCP tools for that provider in this first version.

### 2.2 User Stories

Requirement 1

User Story: As a Surf user who already uses Claude Code Agent, I want the agent to call MCP tools during my AI sessions so that I can reuse existing MCP servers and tools inside my notebook workflows.

Acceptance Criteria (EARS):

1. WHEN a chat session is created with Claude Code Agent as the active model THEN the system SHALL register the set of available MCP tools for that session.
2. IF MCP integration is correctly configured for the current model THEN the agent runtime SHALL be able to choose MCP tools as part of its normal tool-selection process.
3. WHEN the agent selects an MCP tool THEN the system SHALL execute the tool via the MCP server and stream the result back into the chat.

Requirement 2

User Story: As a developer extending Surf, I want a clear MCP integration point so that I can plug in different MCP servers without changing the core AI runtime.

Acceptance Criteria (EARS):

1. WHEN an MCP server is registered with the system THEN the system SHALL expose its tools through a stable adapter interface used by the Claude Agent runtime.
2. IF a new MCP server is added or removed at runtime (within the supported configuration flow) THEN the adapter layer SHALL update the set of available MCP tools without requiring changes to the Claude runtime logic.
3. WHEN an MCP tool definition changes on the server side THEN on the next discovery/handshake the system SHALL refresh the tool schema visible to the agent.

Requirement 3

User Story: As a Surf user, I want the system to handle MCP failures gracefully so that a broken MCP server does not crash my AI session.

Acceptance Criteria (EARS):

1. WHEN an MCP call times out THEN the system SHALL return a structured error message to the agent and SHALL keep the overall chat session alive.
2. WHEN an MCP server process is unavailable or returns an error THEN the system SHALL surface an informative error to the agent while logging details for debugging.
3. IF repeated MCP failures occur during a session THEN the system SHALL continue allowing non-MCP tools and provider calls to function.

Requirement 4

User Story: As a Surf user concerned with security, I want MCP integration to respect the same safety constraints as other tools so that external servers do not gain uncontrolled access.

Acceptance Criteria (EARS):

1. WHEN an MCP tool is invoked THEN the system SHALL enforce any existing Surf permission/confirmation model (if applicable) before executing high-risk actions.
2. IF an MCP server attempts to use capabilities outside its declared tools/schema THEN the system SHALL reject the action and log a security warning.
3. WHEN MCP integration is disabled globally THEN the system SHALL not start or contact any MCP server.

Requirement 5

User Story: As a Surf maintainer, I want the MCP integration to be observable so that I can troubleshoot issues in development and production.

Acceptance Criteria (EARS):

1. WHEN MCP integration is used in a session THEN the system SHALL emit structured logs that include server id, tool name, latency, and outcome (success/failure).
2. WHEN a critical MCP error occurs THEN the system SHALL log it with enough context (session id, model, tool) to correlate with user reports.
3. IF logging is set to debug level THEN the system SHALL include additional MCP handshake and schema-discovery details without leaking sensitive user content.

## 3. Technical Requirements

### 3.1 Performance

1. WHEN MCP tools are available THEN the system SHALL keep additional latency overhead per MCP call within an acceptable bound for interactive use (target < 3 seconds added on top of network time to the MCP server).
2. WHEN multiple MCP tools are called sequentially in a single agent turn THEN the system SHALL avoid blocking the entire UI thread and SHALL use existing async mechanisms (Rust async/worker threads) for execution.

### 3.2 Constraints

1. Technology: Reuse the existing Claude Agent bridge architecture (TypeScript Electron main process, Neon Rust runtime, Claude SDK) and extend it with an MCP adapter instead of introducing a separate AI pipeline.
2. Dependencies: MCP integration SHALL not require changes to the core data model (SQLite schemas) in this first version.
3. The first version SHALL scope MCP usage to Claude Code Agent based providers only; other providers (OpenAI, Anthropic HTTP, Google) remain unchanged.

## 4. Acceptance Criteria (End-to-End)

1. WHEN a user starts an AI session using Claude Code Agent with MCP integration enabled in configuration THEN the agent SHALL be able to call at least one MCP tool successfully and return its result in the chat.
2. WHEN MCP integration is disabled or no MCP servers are configured THEN Claude Code Agent SHALL continue to operate using only non-MCP tools without errors.
3. WHEN an MCP server used by a session becomes unavailable mid-conversation THEN the session SHALL continue functioning for non-MCP interactions and the user SHALL receive a clear error for the failed MCP call.
4. WHEN developers inspect logs for a session that used MCP THEN they SHALL see entries that allow them to trace each MCP call and its outcome.

## 5. Out of Scope

1. A full UI for managing multiple MCP servers, credentials, and tool whitelists is out of scope for this first integration; simple configuration hooks or a minimal config mechanism are sufficient.
2. Automatic discovery of MCP servers on the network or via remote registries is out of scope.
3. Complex per-notebook or per-space MCP configuration is out of scope; configuration is global or per-model for now.
4. Advanced multi-agent orchestration using MCP tools (agents calling agents) is out of scope; this feature focuses on single-agent usage of MCP tools.
5. Detailed rate limiting, quota management, and analytics for MCP calls are out of scope beyond basic logging.
