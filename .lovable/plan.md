

# Fix: AI Agent Confirms Before Destructive/Ambiguous Actions

## Problem

The AI agent currently executes delete and edit operations immediately without:
1. **Asking what to delete** when the user says "delete an entry" (it guesses which one)
2. **Asking what to change** when the user says "edit the entry" (it invents new content)
3. **No confirmation** before irreversible actions like deletion

This happens because the tool descriptions don't strongly enforce "ask first" behavior, and the system prompt treats edit/delete tools the same as read tools.

## Solution

A two-part fix -- stronger system prompt guardrails in the edge function, plus a confirmation-aware response flow on the frontend.

### Part 1: Edge Function System Prompt Changes

Update `supabase/functions/chat-with-ai/index.ts`:

**1a. Strengthen the system prompt (lines 1103-1119)**

Add explicit rules for destructive actions:

```
For EDIT tools (edit_journal_entry, update_goal):
   - ALWAYS ask "What would you like to change it to?" BEFORE calling the tool
   - NEVER invent or assume new content - the user MUST provide it
   - If user says "edit my entry" without specifying changes, ASK what they want to change

For DELETE tools (delete_journal_entry, delete_goal):
   - ALWAYS confirm which specific entry to delete by listing options if ambiguous
   - ALWAYS ask "Are you sure you want to delete [title]?" BEFORE calling the tool
   - Only call the delete tool AFTER the user explicitly confirms (says yes/confirm/sure/do it)
```

**1b. Update tool descriptions to reinforce the behavior (lines 171-220)**

Change `edit_journal_entry` description to:
> "Edit an existing journal entry. CRITICAL: Do NOT call this tool until the user has explicitly told you WHAT to change. If they just say 'edit', ask them what the new content or title should be first."

Change `delete_journal_entry` description to:
> "Delete a journal entry. CRITICAL: Do NOT call this tool until the user has explicitly CONFIRMED deletion. First tell the user which entry will be deleted, then ask 'Are you sure?', and only call this tool after they confirm."

Same pattern for `update_goal` and `delete_goal`.

**1c. Add a confirmation-required flag to the response (optional enhancement)**

When the AI detects an intent to delete/edit but hasn't received confirmation, it returns:
```json
{
  "response": "Which entry would you like to delete?",
  "requires_confirmation": true,
  "pending_action": { "tool": "delete_journal_entry", "entry_title": "..." }
}
```

This is tracked in the conversation naturally (no extra DB changes needed) -- the AI simply asks first and only calls the tool on the follow-up message.

### Part 2: Frontend Config File Fix

Update `supabase/config.toml` to restore all the `verify_jwt = false` entries that were accidentally removed when reconnecting to the Supabase project. Without these, edge functions may fail with JWT errors.

## Files Modified

1. **`supabase/config.toml`** -- Restore all function configurations with `verify_jwt = false`
2. **`supabase/functions/chat-with-ai/index.ts`** -- Update system prompt and tool descriptions to enforce ask-before-act behavior for destructive operations

## Why This Works

The root cause is that LLMs are "eager executors" -- given a tool, they call it immediately. The fix works at two levels:

- **Tool descriptions** act as the model's "instruction manual" -- making them say "do NOT call until user confirms" is the strongest lever
- **System prompt** reinforces the behavior as a global rule
- No frontend UI changes are needed because the confirmation happens naturally in the conversation flow (AI asks, user answers, AI acts)

## What Won't Change

- Read tools (get_user_progress, etc.) still execute immediately -- no confirmation needed
- Create tools already have "ask first" instructions that work
- The router architecture, model selection, and fallback chain remain unchanged
- No database schema changes needed

