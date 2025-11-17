# Claude Code Agent Integration - Complete Documentation

## 📋 Table of Contents

1. [Status Overview](#status-overview)
2. [Integration Architecture](#integration-architecture)
3. [Implementation Timeline](#implementation-timeline)
4. [Current Limitations](#current-limitations)
5. [Files Modified](#files-modified)
6. [Testing Guide](#testing-guide)
7. [Next Steps: Streaming Implementation](#next-steps-streaming-implementation)

---

## Status Overview

**Current Status:** ✅ **FUNCTIONAL** (Non-streaming)

The Claude Code Agent integration is working successfully with the following caveats:

- ✅ **Bridge Registration**: All processes register successfully
- ✅ **API Communication**: Requests reach Claude API correctly
- ✅ **Response Handling**: Full responses are received and displayed
- ⚠️ **Streaming**: Messages arrive as single chunk (not incremental)

**Last Updated:** 2025-11-17

---

## Integration Architecture

### Multi-Process Flow

```
┌─ Main Process (sffs.ts) ─────────────────────────────┐
│ 1. initBackend()                                     │
│ 2. Creates WorkerTunnel (Arc A: 0x10c00d07d60)      │
│ 3. Spawns 12 workers (all share Arc A)              │
│ 4. registerClaudeAgentBridge() → Registers in Arc A │ ✅
└──────────────────────────────────────────────────────┘

┌─ Core Renderer Process (core.ts) ────────────────────┐
│ 1. initBackend()                                     │
│ 2. Creates WorkerTunnel (Arc B: 0x10c00bb1780)      │
│ 3. Spawns 12 workers (all share Arc B)              │
│ 4. registerClaudeAgentBridge() → Registers in Arc B │ ✅
└──────────────────────────────────────────────────────┘

┌─ Resource Renderer Process (resource.ts) ────────────┐
│ 1. initBackend()                                     │
│ 2. Creates WorkerTunnel (Arc C: 0x12400b49520)      │
│ 3. Spawns 12 workers (all share Arc C)              │
│ 4. registerClaudeAgentBridge() → Registers in Arc C │ ✅
└──────────────────────────────────────────────────────┘
```

### Request Flow

```
User Input
    ↓
Frontend (Svelte)
    ↓
Rust Backend (LLMClient)
    ↓
Worker Thread (ClaudeAgentRuntime)
    ↓
Neon Bridge (to JavaScript)
    ↓
claudeAgent.ts (runClaudeAgentInvocation)
    ↓
@anthropic-ai/claude-agent-sdk
    ↓
Claude API
    ↓
Response (currently single chunk)
    ↓
Frontend Display
```

---

## Implementation Timeline

### Phase 1: Initial Integration ✅

**Files Created:**

- `app/src/main/claudeAgent.ts` - Bridge implementation
- `packages/backend/src/ai/claude_agent.rs` - Rust runtime

**Key Achievements:**

- Type system integration (Provider.ClaudeAgent, Model enums)
- CLI path resolution with cross-environment support
- Query options configuration
- Comprehensive logging system

### Phase 2: Bug Fixes ✅

**Issues Resolved:**

1. **Missing Dependencies** ✅

   - Added `@anthropic-ai/sdk` and `zod` to package.json

2. **API Key Variable** ✅

   - Corrected `CLAUDE_API_KEY` → `ANTHROPIC_API_KEY`

3. **Multi-Process Arc Registration** ✅

   - **Root Cause**: Each Electron process creates independent `Arc<Mutex<...>>` instances
   - **Solution**: Register bridge in all 3 processes (main, core, resource)
   - **Files Modified**: `app/src/preload/core.ts`, `app/src/preload/resource.ts`

4. **AbortSignal Compatibility** ✅

   - **Root Cause**: SDK tries to call `setMaxListeners()` on AbortSignal
   - **Solution**: Polyfill `AbortSignal.prototype.setMaxListeners`
   - **Location**: `app/src/main/claudeAgent.ts` lines 10-32

5. **Node Executable Not Found** ✅

   - **Root Cause**: Electron child processes don't inherit PATH
   - **Solution**: Added PATH to queryOptions.env
   - **Location**: `app/src/main/claudeAgent.ts` line 242

6. **Process Exit Code 1** ✅
   - **Root Cause**: SDK process exits after sending result
   - **Solution**: Break early on success, handle exit errors gracefully
   - **Location**: `app/src/main/claudeAgent.ts` lines 264-305

### Phase 3: Current State ⚠️

**Working:**

- ✅ All bridge registrations successful
- ✅ Request/response cycle complete
- ✅ Error handling robust

**Not Working:**

- ⚠️ Incremental streaming (messages arrive all at once)

---

## Current Limitations

### 1. No Incremental Streaming

**Problem Location:** `packages/backend/src/ai/llm/client/mod.rs:742-745`

```rust
let output = self.run_claude_agent_completion(normalized_messages, model, custom_key)?;
tracing::info!("[LLM Client] Got output from Claude Agent, creating single chunk stream");
return Ok(ChatCompletionStream::from_single_chunk(
    Ok(output),
    Provider::ClaudeAgent,
));
```

**Why It Happens:**

- Rust calls `run_claude_agent_completion()` which waits for **complete output**
- Creates artificial stream with `from_single_chunk()`
- No progressive updates during generation

**User Experience:**

- Long wait with no feedback
- Entire response appears at once
- No ability to start reading while generation continues

### 2. SDK Message Types Not Fully Utilized

The `@anthropic-ai/claude-agent-sdk` sends multiple message types during execution:

```javascript
// Current handling (claudeAgent.ts:276-305)
if (message.type === 'content' && message.content) {
  const chunk = message.content
  output += chunk
  if (payload.onChunk) {
    payload.onChunk(chunk)  // ❌ No callback provided from Rust
  }
}

if (message.type === 'result') {
  if (message.subtype === 'success') {
    output = message.result
    break  // Returns all at once
  }
}
```

**Available but Unused:**

- `message.type === 'content'` - Incremental content
- `message.type === 'thinking'` - Model reasoning steps
- `message.type === 'tool_use'` - Tool execution events

---

## Files Modified

### TypeScript Files

#### 1. `app/src/main/claudeAgent.ts` (NEW - 420 lines)

**Purpose:** Bridge between Rust and Claude SDK

**Key Sections:**

- Lines 10-32: AbortSignal polyfill
- Lines 66-110: CLI path resolution
- Lines 112-132: Message formatting
- Lines 134-320: Main invocation logic with streaming preparation
- Lines 366-414: Bridge registration

**Critical Configurations:**

```typescript
const queryOptions = {
  model: 'claude-haiku-4-5-20251001',
  settingSources: ['project'],  // Loads .claude/CLAUDE.md
  pathToClaudeCodeExecutable,
  permissionMode: 'bypassPermissions',
  disallowedTools: ['Bash', 'grep', ...],
  env: {
    ANTHROPIC_API_KEY: apiKey,
    PATH: process.env.PATH  // Critical for node executable
  }
}
```

#### 2. `app/src/preload/core.ts` (MODIFIED)

**Changes:**

```typescript
// Line 43: Added import
import { registerClaudeAgentBridge } from '../main/claudeAgent'

// Line 784: Added registration
const { sffs, resources } = initBackend()
registerClaudeAgentBridge(sffs as any) // ✅ Now registers
```

#### 3. `app/src/preload/resource.ts` (MODIFIED)

**Changes:**

```typescript
// Line 27: Added import
import { registerClaudeAgentBridge } from '../main/claudeAgent'

// Line 188: Added registration
const { sffs, resources } = initBackend({ num_worker_threads: 4, num_processor_threads: 4 })
registerClaudeAgentBridge(sffs as any) // ✅ Now registers
```

#### 4. `app/package.json` (MODIFIED)

**Dependencies Added:**

```json
{
  "dependencies": {
    "@anthropic-ai/claude-agent-sdk": "^0.1.42",
    "@anthropic-ai/sdk": "^0.67.0",
    "zod": "^3.23.8"
  }
}
```

### Rust Files

#### 5. `packages/backend/src/ai/claude_agent.rs` (NEW - 350 lines)

**Purpose:** Rust runtime for Claude Agent integration

**Key Components:**

- `ClaudeAgentRuntime` struct with Arc<Mutex<...>> for thread-safe runner
- Neon FFI bridge for JavaScript communication
- Channel-based async communication
- Comprehensive logging (DEBUG_CLAUDE_AGENT flag)

**Critical Code:**

```rust
pub struct ClaudeAgentRuntime {
    runner: Arc<Mutex<Option<Root<JsFunction>>>>,
    channel: Channel,
    default_cwd: String,
}

pub fn run_completion(&self, messages: Vec<Message>, ...) -> BackendResult<String> {
    // Serialize request → Send to JS → Wait for response via channel
}
```

#### 6. `packages/backend/src/ai/llm/client/mod.rs` (MODIFIED)

**Changes:**

- Line 732-745: Claude Agent detection and routing
- Line 742: **⚠️ Single chunk stream creation** (streaming limitation)

#### 7. `packages/backend/src/worker/tunnel.rs` (MODIFIED)

**Changes:**

- Added `claude_agent_runner: ClaudeAgentRunnerHandle` field
- Lines 258-272: `register_claude_agent_runner()` method with logging
- Workers receive runner handle at creation

#### 8. `packages/backend/src/worker/mod.rs` (MODIFIED)

**Changes:**

- Line 120-125: Pass runner to `ClaudeAgentRuntime::new()`
- Each worker gets Arc clone (shared within process)

---

## Testing Guide

### Prerequisites

1. **API Key Configuration**

   ```bash
   export ANTHROPIC_API_KEY="sk-ant-..."
   ```

2. **Start Development Server**
   ```bash
   npm run dev
   ```

### Test Steps

1. **Verify Registrations**

   Look for these logs on startup:

   ```
   [Claude Agent] ✅ Registering Claude Agent bridge...
   [WorkerTunnel] register_claude_agent_runner called
   [WorkerTunnel] Arc pointer being written to: 0x...
   [WorkerTunnel] ✅ Runner registered successfully in mutex
   ```

   Should appear **3 times** (once per process)

2. **Send Test Message**

   - Open Surf application
   - Create new note
   - Select **Claude Code Agent Haiku 4.5** model
   - Send message: "oi" or "hello"

3. **Verify Successful Response**

   Expected logs:

   ```
   [Claude Agent Rust] has_runner check result: true
   [Claude Agent Rust] Bridge is registered, proceeding with completion
   [Claude Agent Rust] Serialized payload length: 5612 bytes
   [Claude Agent] Calling query() with prompt and options...
   [Claude Agent] Stream created, starting iteration...
   [Claude Agent] Received message #1: ...
   [Claude Agent] Received message #2: ...
   [Claude Agent] Received message #3: ...
   [Claude Agent] Got result message, subtype: success
   [Claude Agent] Success! Total output length: 39
   [Claude Agent Rust] Response OK, output length: 39
   [LLM Client] ✅ Claude Agent completion successful
   ```

4. **Verify Output Display**

   Message should appear in the UI (all at once, not streaming)

### Common Issues

**Issue: "Bridge is not registered"**

- **Cause:** Worker from unregistered process
- **Solution:** Verify all 3 `registerClaudeAgentBridge()` calls exist

**Issue: "spawn node ENOENT"**

- **Cause:** PATH not set in queryOptions
- **Solution:** Check line 242 in claudeAgent.ts has `PATH: process.env.PATH`

**Issue: "AbortSignal" error**

- **Cause:** Polyfill not loaded
- **Solution:** Check lines 10-32 in claudeAgent.ts are present

---

## Next Steps: Streaming Implementation

### Option A: Rust Channel-Based Streaming (Recommended)

**Architecture:**

```rust
// New method in claude_agent.rs
pub fn run_completion_streaming(
    &self,
    messages: Vec<Message>,
    callback: impl Fn(String) + Send + 'static
) -> BackendResult<String>

// In llm/client/mod.rs
pub fn create_streaming_chat_completion(...) -> ChatCompletionStream {
    if matches!(model.provider(), Provider::ClaudeAgent) {
        // Instead of from_single_chunk:
        return self.run_claude_agent_completion_streaming(...)?;
    }
}
```

**Implementation Steps:**

1. Create `mpsc::channel()` in Rust for chunk communication
2. Modify `claudeAgent.ts` to send chunks via separate channel
3. Update `ChatCompletionStream` to yield from channel
4. Add timeout/completion detection

**Pros:**

- True streaming experience
- Leverages existing Rust streaming infrastructure
- Consistent with other providers

**Cons:**

- Requires significant Rust changes
- Complex async coordination between Rust ↔ JS
- Need to handle backpressure

### Option B: JavaScript Callback with Events

**Architecture:**

```typescript
// claudeAgent.ts
interface ClaudeAgentInvocation {
  messages: Message[]
  onChunk?: (chunk: string) => void // Already added!
}

// Bridge registration
backend.js__claude_agent_register_runner_streaming(
  async (payload: string, chunkCallback: (chunk: string) => void) => {
    const parsedPayload = JSON.parse(payload)
    parsedPayload.onChunk = chunkCallback
    await runClaudeAgentInvocation(parsedPayload)
  }
)
```

**Pros:**

- Simpler to implement
- Reuses existing callback infrastructure
- Less Rust modification needed

**Cons:**

- Requires new FFI function signature
- May have threading issues with callbacks
- Not consistent with existing streaming patterns

### Option C: Hybrid Approach (Quick Win)

**Concept:** Simulate streaming by chunking complete output

```typescript
// In claudeAgent.ts after getting full output
function simulateStreaming(fullOutput: string, callback: (chunk: string) => void) {
  const words = fullOutput.split(' ')
  for (let i = 0; i < words.length; i += 3) {
    const chunk = words.slice(i, i + 3).join(' ') + ' '
    setTimeout(() => callback(chunk), i * 50)
  }
}
```

**Pros:**

- Quick to implement (< 1 hour)
- Immediate UX improvement
- No Rust changes needed

**Cons:**

- Not true streaming (full latency remains)
- Fake progressive display
- Wastes the SDK's actual streaming capability

### Recommended: Option A

For production-quality implementation, **Option A** is the best choice because:

1. Utilizes SDK's actual streaming messages
2. Provides real-time feedback during generation
3. Consistent with other LLM providers in the codebase
4. Leverages Rust's channel/stream infrastructure

**Estimated Effort:** 8-12 hours
**Priority:** Medium (functional but not optimal UX)

---

## Additional Resources

### Related Documentation

- `CLAUDE_AGENT_FINAL_STATUS.md` - Detailed status before Arc fix
- `CLAUDE_AGENT_DEBUGGING.md` - Complete debugging guide
- `CLAUDE_AGENT_ARC_FIX.md` - Multi-process Arc issue analysis
- `claude-agent-integration-analysis.md` - Original integration thread analysis

### Useful Links

- [Claude Agent SDK Docs](https://github.com/anthropics/anthropic-sdk-typescript)
- [Neon FFI Docs](https://neon-bindings.com/)
- [Electron Multi-Process Architecture](https://www.electronjs.org/docs/latest/tutorial/process-model)

### Environment Variables

```bash
# Required
ANTHROPIC_API_KEY=sk-ant-...

# Optional (debugging)
DEBUG_CLAUDE_AGENT=true  # Enable verbose logging
RUST_LOG=info           # Rust logging level
```

---

## Maintenance Notes

### Logging

**JavaScript (claudeAgent.ts):**

- Set `DEBUG_CLAUDE_AGENT = true` (line 36) for verbose logs
- Logs prefixed with `[Claude Agent]` or `[Claude Agent ERROR]`

**Rust:**

- Set `DEBUG_CLAUDE_AGENT = true` (line 11 in claude_agent.rs)
- Logs prefixed with `[Claude Agent Rust]`
- Use `RUST_LOG=info` for tracing

### Monitoring Arc Pointers

If Arc registration issues reoccur:

```
# Look for these patterns in logs:
Arc pointer: 0x...  # Should match within process
Runner present at creation: true/false
Runner registered successfully in mutex
```

All workers in same process should share same Arc pointer.

---

## License

Part of the Surf Browser project.

**Last Updated:** 2025-11-17 00:07 UTC
**Status:** Functional (Non-streaming)
**Next Milestone:** Implement Option A streaming
