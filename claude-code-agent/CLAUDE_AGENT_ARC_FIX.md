# Claude Agent Arc Pointer Fix - Multi-Process Registration

## Problem Summary

The Claude Agent integration was failing with the error:

```
ERROR W3 111: [Claude Agent Rust ERROR] Bridge is not registered - cannot run completion
ERROR W3 889: [LLM Client] ❌ Claude Agent completion failed: Generic error: Claude Code Agent bridge is not registered
```

## Root Cause

### Arc Pointer Analysis

The application was creating **multiple independent `WorkerTunnel` instances** across different Electron processes, each with its own `Arc<Mutex<Option<Root<JsFunction>>>>` for the Claude Agent runner:

```
Process 1 (Main):        Arc pointer 0x12c0307c8b0 ✅ Runner registered
Process 2 (Core):        Arc pointer 0x10c00bb90c0 ❌ No runner
Process 3 (Resource):    Arc pointer 0x13400ba1050 ❌ No runner
Process 4 (Window 2):    Arc pointer 0x12c00bc0920 ❌ No runner
...
```

### Why This Happened

Electron's multi-process architecture:

- **Main Process**: Runs Node.js backend
- **Renderer Processes**: One per window/webview, isolated from each other

The application calls `initBackend()` in **three separate locations**:

1. `app/src/main/sffs.ts` (main process) - ✅ Registered
2. `app/src/preload/core.ts` (core renderer) - ❌ NOT registered
3. `app/src/preload/resource.ts` (resource renderer) - ❌ NOT registered

Each `initBackend()` call:

```typescript
initBackend()
  → require('@deta/backend')
  → sffs.js__backend_tunnel_init(...) [Rust]
  → WorkerTunnel::new()
  → spawn_worker_threads() [12 workers per tunnel]
  → Each worker creates ClaudeAgentRuntime with Arc::clone()
```

**Key Insight**: While `Arc::clone()` shares the Arc within a single `WorkerTunnel`, each call to `js__backend_tunnel_init()` creates a **new Arc instance**. The runner registration in Process 1 doesn't propagate to Processes 2, 3, etc.

### The Flow Timeline

```
┌─ Main Process (sffs.ts) ─────────────────────────────┐
│ 1. initBackend()                                     │
│ 2. Creates WorkerTunnel (Arc A: 0x12c0307c8b0)      │
│ 3. Spawns 12 workers (all share Arc A)              │
│ 4. registerClaudeAgentBridge() → Registers in Arc A │
└──────────────────────────────────────────────────────┘

┌─ Core Renderer Process (core.ts) ────────────────────┐
│ 1. initBackend()                                     │
│ 2. Creates WorkerTunnel (Arc B: 0x10c00bb90c0)      │
│ 3. Spawns 12 workers (all share Arc B)              │
│ 4. ❌ NO REGISTRATION                               │
│ 5. Workers check Arc B → empty → error              │
└──────────────────────────────────────────────────────┘

┌─ Resource Renderer Process (resource.ts) ────────────┐
│ 1. initBackend()                                     │
│ 2. Creates WorkerTunnel (Arc C: 0x13400ba1050)      │
│ 3. Spawns 12 workers (all share Arc C)              │
│ 4. ❌ NO REGISTRATION                               │
│ 5. Workers check Arc C → empty → error              │
└──────────────────────────────────────────────────────┘
```

## Solution

Register the Claude Agent bridge in **all three** `initBackend()` call sites to ensure every process's workers have access to the runner.

### Changes Made

#### 1. `app/src/preload/core.ts`

```diff
+ import { registerClaudeAgentBridge } from '../main/claudeAgent'

  const { sffs, resources } = initBackend()

+ // Register Claude Agent bridge for this renderer process
+ registerClaudeAgentBridge(sffs as any)
```

#### 2. `app/src/preload/resource.ts`

```diff
+ import { registerClaudeAgentBridge } from '../main/claudeAgent'

  const { sffs, resources } = initBackend({ num_worker_threads: 4, num_processor_threads: 4 })

+ // Register Claude Agent bridge for this renderer process
+ registerClaudeAgentBridge(sffs as any)
```

#### 3. `app/src/main/sffs.ts` (already correct)

```typescript
const result = initBackend({
  num_worker_threads: 2,
  num_processor_threads: 1,
  userDataPath: app.getPath('userData'),
  appPath: `${app.getAppPath()}${isDev ? '' : '.unpacked'}`
})

registerClaudeAgentBridge(result.sffs) // ✅ Already registered
```

## Expected Behavior After Fix

All three processes will now have their runners registered:

```
Process 1 (Main):        Arc pointer 0x12c0307c8b0 ✅ Runner registered
Process 2 (Core):        Arc pointer 0x10c00bb90c0 ✅ Runner registered
Process 3 (Resource):    Arc pointer 0x13400ba1050 ✅ Runner registered
```

When a worker in **any** process attempts to execute a Claude Agent request:

1. Worker locks its local Arc
2. Finds the registered runner
3. Executes the request successfully

## Verification Steps

1. **Build the application**:

   ```bash
   npm run dev
   ```

2. **Monitor logs for successful registration**:

   ```
   [Claude Agent] ✅ Registering Claude Agent bridge...
   [WorkerTunnel] register_claude_agent_runner called
   [WorkerTunnel] ✅ Runner registered successfully in mutex
   ```

3. **Look for multiple registration messages** (one per process)

4. **Test Claude Agent execution**:

   - Open a chat
   - Select Claude Agent model (Haiku 4.5 or Sonnet 4)
   - Send a message
   - Verify no "bridge is not registered" errors

5. **Check Arc pointers in logs**:
   - Should see multiple different Arc addresses
   - Each should show runner registered
   - No mismatches between creation and usage

## Additional Notes

### Type Assertion (`as any`)

The `registerClaudeAgentBridge(sffs as any)` type assertion is necessary because:

- `initBackend()` returns an object with ALL `js__*` functions dynamically
- TypeScript can't infer the exact shape at compile time
- Runtime behavior is correct (function exists and works)

### Worker Thread Safety

The `Arc<Mutex<...>>` pattern ensures:

- Thread-safe access across all workers in a process
- Only one worker can register/access the runner at a time
- No race conditions or data corruption

### Cross-Process Isolation

This fix does **not** share a single Arc across processes (impossible in Electron). Instead, it ensures each process's independent Arc is properly initialized.

## Related Documentation

- [CLAUDE_AGENT_FINAL_STATUS.md](./CLAUDE_AGENT_FINAL_STATUS.md) - Integration status
- [CLAUDE_AGENT_DEBUGGING.md](./CLAUDE_AGENT_DEBUGGING.md) - Debugging guide
- [claude-agent-integration-analysis.md](./claude-agent-integration-analysis.md) - Architecture analysis

## Date

2025-11-16

## Status

✅ **Fixed** - Multi-process registration implemented
