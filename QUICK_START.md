# Claude Agent Integration - Quick Start Guide

## 🚀 Get Started in 3 Steps

### Step 1: Install Dependencies

```bash
cd app
npm install
```

This will install:

- `@anthropic-ai/claude-agent-sdk` (^0.1.42)
- `@anthropic-ai/sdk` (^0.67.0)
- `zod` (^3.25.5)

### Step 2: Set API Key

```bash
export ANTHROPIC_API_KEY="sk-ant-api03-your-key-here"
```

Get your API key from: https://console.anthropic.com/settings/keys

### Step 3: Run Surf

```bash
npm run dev
```

Then in the UI:

1. Open chat
2. Select **"Claude Code Agent"** from model dropdown
3. Send a message
4. Watch the magic! ✨

---

## ✅ Verification Checklist

After starting, check for these log messages:

```
✅ Registering Claude Agent bridge...
✅ Claude Agent bridge registered successfully!
[Claude Agent] CLI found at: /path/to/cli.js
```

If you see these, the integration is working!

---

## 🔧 Troubleshooting

### Error: "Claude Agent API key is missing"

**Solution:** Set the environment variable:

```bash
export ANTHROPIC_API_KEY="sk-ant-..."
```

### Error: "CLI not found"

**Solution:** Install dependencies:

```bash
cd app
npm install
```

### Error: "Invalid API key format"

**Solution:** Make sure your key starts with `sk-ant-`

### Build fails with "Cannot find module 'zod'"

**Solution:** Install dependencies (see Step 1)

---

## 🎯 What You Can Do

The Claude Code Agent can:

- 💬 **Chat naturally** - Ask questions, get explanations
- 📝 **Write code** - Generate functions, fix bugs
- 🔍 **Analyze files** - Read and understand your project
- 🛠️ **Use tools** - Execute commands, search, manipulate data (if MCP tools enabled)
- 🧠 **Reason deeply** - Think through complex problems step-by-step

---

## 📊 System Requirements

- **Node.js**: 18+ (for Electron app)
- **Rust**: Latest stable (for backend)
- **API Key**: Active Anthropic account
- **Internet**: Required for API calls

---

## 🔐 Security Notes

⚠️ **Important:**

- The Claude Code Agent can execute code in your development environment
- Only use with trusted prompts
- Review agent actions before confirming sensitive operations
- Keep your API key secret (never commit to git)

---

## 🧪 Testing the Integration

### Test 1: Simple Chat

```
You: Hello! Can you help me understand how Surf works?
Agent: [Should respond with helpful explanation]
```

### Test 2: System Prompt Loading

```
You: What are you designed to do in Surf?
Agent: [Should reference content from .claude/CLAUDE.md]
```

### Test 3: Error Handling

Temporarily unset API key:

```bash
unset ANTHROPIC_API_KEY
```

Send message → Should see: "Claude Agent API key is missing..."

---

## 🎨 Optional: Enable MCP Tools

For advanced functionality (tab search, bookmarks, etc.):

1. Open `app/src/main/claudeAgent.ts`
2. Add import:
   ```typescript
   import { createSurfTools } from './claudeAgentTools'
   ```
3. Add to `queryOptions`:
   ```typescript
   mcpServers: {
     'surf-tools': createSurfTools(),
   }
   ```
4. Implement real tool logic in `claudeAgentTools.ts`

See `app/src/main/CLAUDE_TOOLS_README.md` for details.

---

## 📚 Documentation

- **Full Status:** `CLAUDE_AGENT_FINAL_STATUS.md`
- **Technical Analysis:** `claude-agent-integration-analysis.md`
- **Tools Guide:** `app/src/main/CLAUDE_TOOLS_README.md`
- **System Prompts:** `.claude/CLAUDE.md`

---

## 🐛 Known Limitations

1. **No streaming** - Full response collected before display
2. **No JSON mode** - Agent outputs plain text only
3. **Timeout:** Default 2 minutes (configurable)

---

## 💡 Pro Tips

1. **Verbose Logging:** Check console for detailed SDK output
2. **Custom Timeouts:** Pass `timeout` in request payload
3. **Custom Model:** Override via `model` parameter
4. **Working Directory:** Set `cwd` to control agent's file access

---

## 🎉 You're Ready!

If you followed all steps, you should now have:

✅ Dependencies installed  
✅ API key configured  
✅ Claude Code Agent running in Surf  
✅ Able to send messages and get responses

**Next:** Try building something cool! 🚀

---

## 📞 Need Help?

- Check logs in terminal for error details
- Review `CLAUDE_AGENT_FINAL_STATUS.md` for comprehensive troubleshooting
- Verify all files in `app/src/main/` are present:
  - `claudeAgent.ts` (bridge implementation)
  - `claudeAgentTools.ts` (MCP tools template)
  - `CLAUDE_TOOLS_README.md` (tools documentation)

---

**Last Updated:** November 16, 2024  
**Status:** ✅ Ready for Testing
