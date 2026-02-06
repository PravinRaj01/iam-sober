

# Multi-Model Router Architecture for "i am sober."

## Overview

Replace the single-model, all-tools-at-once approach with a 3-layer architecture using **Groq**, **Cerebras**, and **Gemini** -- each playing to its strengths.

## Architecture

```text
                     User Message
                          |
                          v
                 +------------------+
                 |   INTENT ROUTER  |
                 |  Groq (Llama 3   |
                 |     8B)          |
                 |  ~100-200ms      |
                 +------------------+
                          |
          +-------+-------+-------+-------+
          |       |               |       |
          v       v               v       v
       DATA    ACTION          SUPPORT   CHAT
       AGENT   AGENT           AGENT    AGENT
      6 tools  5 tools        3 tools  0 tools
          |       |               |       |
          v       v               v       v
       Gemini 2.5 Flash Lite           Cerebras
       (primary, via GOOGLE_API_KEY)   Llama 3.1 70B
          |       |               |
          v       v               v
       Groq (fallback on 429)
       Llama 3.1 70B with tools
```

## Model Assignments

| Layer | Model | Platform | Why |
|---|---|---|---|
| Router | Llama 3 8B | Groq | Near-instant intent classification, cheapest |
| Chat Agent | Llama 3.1 70B | Cerebras | Fast, natural conversation, no tools needed |
| Data/Action/Support | Gemini 2.5 Flash Lite | Google API (existing) | Best tool-calling support, already working |
| Fallback Worker | Llama 3.1 70B | Groq | OpenAI-compatible tool calling when Gemini hits 429 |

## Tool Categories

**Data Agent** (read-only, 6 tools):
- get_user_progress, get_recent_moods, get_active_goals
- get_recent_journal_entries, get_biometric_data, get_conversation_context

**Action Agent** (write operations, 5 tools):
- create_goal, create_check_in, create_journal_entry
- complete_goal, log_coping_activity

**Support Agent** (emotional/crisis, 3 tools):
- suggest_coping_activity, create_action_plan, escalate_crisis
- (plus log_intervention as meta-tool)

**Chat Agent** (0 tools):
- General conversation, encouragement, motivation
- Powered by Cerebras Llama 3.1 70B for fast, natural responses

## Latency Comparison

- **Current**: 1 Gemini call with 14 tools = ~800-1500ms (+ frequent 429 errors)
- **Proposed**: Router (~150ms) + Worker with 3-6 tools (~500-800ms) = ~650-950ms
- **Chat path**: Router (~150ms) + Cerebras (~200-400ms) = ~350-550ms (fastest path)

## Implementation Steps

### Step 0: Add API Key Secrets
- Add `CEREBRAS_API_KEY` as a Supabase secret
- Add `GROQ_API_KEY` as a Supabase secret
- Both are needed before any code changes

### Step 1: Refactor `supabase/functions/chat-with-ai/index.ts`

Major refactor of the main edge function:

1. **Add `classifyIntent()` function** -- Calls Groq's OpenAI-compatible API (`https://api.groq.com/openai/v1/chat/completions`) with `llama3-8b-8192` model. Simple system prompt: classify into `data | action | support | chat`. Returns a single word.

2. **Split `geminiTools` into 4 groups** -- `dataTools`, `actionTools`, `supportTools`, and empty array for chat. The `executeTool()` function stays unchanged (handles all tools via switch/case).

3. **Add `callCerebrasChat()` function** -- For the chat agent path. Calls `https://api.cerebras.ai/v1/chat/completions` with `llama3.1-70b` model. No tools, just conversation with the system prompt.

4. **Add `callGroqWithTools()` function** -- Fallback worker when Gemini returns 429. Calls Groq's API with the same tool subset but in OpenAI tool-calling format. Uses `llama-3.1-70b-versatile` model.

5. **Convert Gemini tool definitions to OpenAI format** -- Create parallel OpenAI-format tool definitions for the Groq fallback path. Same tool names and parameters, different JSON structure.

6. **Update main request handler flow**:
   - Classify intent via Groq router
   - If `chat`: call Cerebras directly, return response
   - If `data/action/support`: select tool subset, call Gemini (primary)
   - If Gemini 429: retry with Groq fallback using same tool subset
   - Execute tools in ReAct loop as before (up to 5 iterations)

7. **Update observability logging** -- Add `router_category` and `model_used` (now dynamic) to the log entry so the admin dashboard shows routing distribution.

### Step 2: Add Fallbacks to Other Edge Functions

For each of these 4 functions, add a fallback path when the primary Gemini call returns 429:

**`supabase/functions/generate-motivation/index.ts`**
- Primary: Gemini 2.5 Flash Lite (existing)
- Fallback: Cerebras Llama 3.1 70B (simple text generation, no tools)

**`supabase/functions/suggest-coping-strategies/index.ts`**
- Primary: Gemini 2.5 Flash Lite (existing)
- Fallback: Groq Llama 3.1 70B (JSON output for structured strategies)

**`supabase/functions/proactive-check/index.ts`**
- Primary: Gemini 2.5 Flash Lite (existing)
- Fallback: Cerebras Llama 3.1 70B (text generation for intervention messages)

**`supabase/functions/suggest-recovery-goals/index.ts`**
- Primary: Gemini 2.5 Flash Lite (existing)
- Fallback: Groq Llama 3.1 70B (JSON output for structured goals)

Each fallback follows the same pattern:
```text
try Gemini -> if 429 -> try fallback model -> if also fails -> use hardcoded fallback
```

### Step 3: No Config Changes Needed

All modifications are to existing edge functions. No new functions are being created, so `supabase/config.toml` stays as-is.

## API Endpoints Used

| Platform | Endpoint | Model |
|---|---|---|
| Groq | `https://api.groq.com/openai/v1/chat/completions` | `llama3-8b-8192` (router), `llama-3.1-70b-versatile` (fallback worker) |
| Cerebras | `https://api.cerebras.ai/v1/chat/completions` | `llama3.1-70b` (chat agent, motivation fallback) |
| Google | `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent` | `gemini-2.5-flash-lite` (primary worker, unchanged) |

## Files Modified

1. `supabase/functions/chat-with-ai/index.ts` -- Major refactor (router + tool splitting + chat agent + fallback)
2. `supabase/functions/generate-motivation/index.ts` -- Add Cerebras fallback
3. `supabase/functions/suggest-coping-strategies/index.ts` -- Add Groq fallback
4. `supabase/functions/proactive-check/index.ts` -- Add Cerebras fallback
5. `supabase/functions/suggest-recovery-goals/index.ts` -- Add Groq fallback

## Risk Mitigation

- If Groq router fails: fall back to sending all tools to Gemini (current behavior)
- If Cerebras chat fails: fall back to Gemini for chat responses
- If all models fail: hardcoded empathetic fallback messages (already exist in some functions)
- Crisis detection stays client-side AND server-side -- never skipped regardless of model failures

