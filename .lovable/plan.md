

# Multilingual App + Regional AI Router (Updated)

## What Changed From the Previous Plan

1. **English tool path stays Groq PRIMARY** -- the previous plan mistakenly put Gemini as primary for English tools. Groq Llama 3.3 70B remains the primary tool-caller for English (matching the current codebase), with Gemini as fallback only if Groq fails/429s.

2. **Tamil uses SEA-LION too** -- SEA-LION v4 supports Tamil and Tanglish natively, so both Malay AND Tamil tool paths use SEA-LION as the regional primary. Sarvam-M is used only for deep reasoning (support route "Thinking Mode") and as a secondary fallback for Tamil chat.

3. **Consistent tool-calling combo** -- All three languages now follow the same pattern: Regional/Fast model with tools first, then Groq fallback, then Gemini last resort.

## Updated Router Architecture

```text
                       User Message
                            |
                            v
                  +--------------------+
                  |   INTENT ROUTER    |
                  |  Groq Llama 3.1    |
                  |     8B Instant     |
                  |  ~100-200ms        |
                  +--------------------+
                            |
           +--------+-------+--------+--------+
           |        |                |        |
           v        v                v        v
        DATA     ACTION           SUPPORT    CHAT
        6 tools   5 tools         3 tools   0 tools
           |        |                |        |
           +--------+----------------+--------+
                            |
                            v
                  +--------------------+
                  | LANGUAGE DETECTOR   |
                  | 1. Profile pref     |
                  | 2. Message regex    |
                  +--------------------+
                            |
               +------------+------------+
               |            |            |
               v            v            v
             MALAY        TAMIL       ENGLISH
               |            |            |
        +------+------+  +-+------+  +--+------+
        | TOOL  | CHAT |  |TOOL|CHAT|  |TOOL|CHAT|
        +------+------+  +----+----+  +----+----+
           |       |        |     |      |     |
           v       v        v     v      v     v
        SEA-LION SEA-LION SEA-LION Sarvam Groq  Cerebras
        (tools)  (chat)  (tools)  -M     3.3   70B
           |       |        |    (deep)  70B
           v       v        v     |      |     |
         Groq   Cerebras  Groq   SEA-   Gemini Groq
         3.3    (fallback) 3.3   LION   Flash  (fallback)
         70B       |      70B   (fall.) Lite
           |       v        |            |
           v     Groq       v            v
         Gemini  3.3      Gemini       Static
         Flash   70B      Flash
         Lite              Lite
```

## Model Roster

| Model | API | Role | Languages |
|-------|-----|------|-----------|
| Groq Llama 3.1 8B | api.groq.com | Intent Router | All |
| SEA-LION v4 27B-IT | api.sea-lion.ai | Regional Primary (tools + chat) | Malay, Tamil, Tanglish, Manglish |
| Sarvam-M 24B | api.sarvam.ai | Tamil Deep Reasoning (support chat) | Tamil, Tanglish, Hindi |
| Groq Llama 3.3 70B | api.groq.com | English Primary (tools) + Universal Fallback | All |
| Cerebras Llama 3.3 70B | api.cerebras.ai | English Primary (chat) | English |
| Gemini 2.5 Flash Lite | Google API | Last-resort fallback for tools | All |

## Fallback Chains (Updated and Consistent)

| Language | Tool Path | Chat Path |
|----------|-----------|-----------|
| Malay | SEA-LION (tools) -> Groq 3.3 70B -> Gemini Flash Lite -> Static | SEA-LION -> Cerebras -> Groq 3.3 70B |
| Tamil | SEA-LION (tools) -> Groq 3.3 70B -> Gemini Flash Lite -> Static | Sarvam-M (Thinking Mode for support) -> SEA-LION -> Cerebras -> Groq |
| English | Groq 3.3 70B (tools) -> Gemini Flash Lite -> Static | Cerebras -> Groq 3.3 70B -> Gemini |

Key consistency: All tool paths follow the same 3-tier pattern (Primary -> Groq fallback -> Gemini last resort). English keeps Groq as primary since Gemini has rate limit issues.

## Part 1: i18n Framework (No Changes From Previous Plan)

### Translation Files

Create `src/i18n/` with:
- `en.ts` -- English (default)
- `ms.ts` -- Bahasa Melayu
- `ta.ts` -- Tamil
- `index.ts` -- Exports translations map and `Language` type

Approximately 80-120 translation keys covering navigation, page headers, buttons, form labels, settings, toast messages, and onboarding text.

### Language Context

Create `src/contexts/LanguageContext.tsx`:
- Stores `language` state (`"en" | "ms" | "ta"`)
- Reads from `localStorage` on mount, syncs with user's profile `preferred_language` column
- Provides `setLanguage(lang)` and `t(key)` functions
- Falls back to English if a key is missing

### Wrap App

Update `src/main.tsx` to add `<LanguageProvider>` around `<App />`.

## Part 2: Database Change

### Migration

```sql
ALTER TABLE profiles
ADD COLUMN preferred_language text DEFAULT 'en'
CHECK (preferred_language IN ('en', 'ms', 'ta'));
```

## Part 3: UI Changes

### Settings Page -- Language Selector

Add a "Language" card to `src/pages/Settings.tsx` with three options: English, Bahasa Melayu, Tamil. Saving updates both the profile and the LanguageContext.

### Translate All User-Facing Pages

Update these files to use `t()` from `useLanguage()`:
- `AppSidebar.tsx` -- Nav labels
- `Dashboard.tsx` -- Greeting, stats, section headers
- `Settings.tsx` -- Card titles, labels, descriptions
- `CheckIn.tsx` -- Mood labels, form prompts
- `Journal.tsx` -- Page headers, empty states, buttons
- `Goals.tsx` -- Goal form labels, status text
- `CopingTools.tsx` -- Strategy names, categories
- `Achievements.tsx` -- Badge descriptions, progress text
- `Progress.tsx` -- Chart labels, stat descriptions
- `Community.tsx` -- Post labels, interaction buttons
- `OnboardingWizard.tsx` -- Addiction type labels, step instructions
- `Auth.tsx` -- Login/signup form labels

Admin pages and AI Observability stay English-only.

## Part 4: AI Router Integration (Updated)

### Pass Language to Edge Function

Update `src/pages/AIAgent.tsx` and chatbot components to include `preferred_language` in the request body.

### Edge Function Changes (`supabase/functions/chat-with-ai/index.ts`)

**1. Add `detectLanguage()` function (~40 lines)**
- Priority: Profile `preferred_language` -> Tamil script detection (U+0B80-U+0BFF) -> Malay keyword count >= 2 -> Tamil romanized keyword count >= 2 -> Default English

**2. Add `callSeaLion()` function (~60 lines)**
- API: `https://api.sea-lion.ai/v1/chat/completions` (OpenAI-compatible)
- Model: `aisingapore/Gemma-SEA-LION-v4-27B-IT`
- Auth: `Authorization: Bearer {SEALION_API_KEY}`
- Supports tool-calling in OpenAI format (used for BOTH Malay and Tamil tool paths)
- Wraps system prompt with regional context

**3. Add `callSarvamChat()` function (~50 lines)**
- API: `https://api.sarvam.ai/v1/chat/completions`
- Model: `sarvam-m`
- Auth: `api-subscription-key: {SARVAM_API_KEY}`
- Used ONLY for Tamil deep reasoning on the support/chat path (Thinking Mode with `reasoning_effort: "medium"`)
- No tool-calling needed (chat-only use)

**4. Update CHAT path (lines ~1131-1215)**
- After intent router classifies as "chat", run `detectLanguage()`
- Malay -> `callSeaLion()` -> Cerebras -> Groq
- Tamil -> `callSarvamChat()` (support route, Thinking Mode) or `callSeaLion()` (general chat) -> Cerebras -> Groq
- English -> Cerebras -> Groq -> Gemini (unchanged)

**5. Update TOOL path (lines ~1217-1332)**
- After intent router classifies as data/action/support, run `detectLanguage()`
- Malay -> `callSeaLion()` with tools -> Groq with tools -> Gemini with tools
- Tamil -> `callSeaLion()` with tools -> Groq with tools -> Gemini with tools (same pattern, SEA-LION handles Tamil natively)
- English -> Groq with tools -> Gemini with tools (unchanged, Groq stays primary)

**6. Update system prompt (lines ~1103-1126)**
- Add language-aware instructions based on detected language:
  - Malay: "Respond in Bahasa Melayu/Manglish. Be warm and use local expressions like 'lah', 'kan'."
  - Tamil: "Respond in Tamil script or Tanglish. Use culturally appropriate references."
  - English: Unchanged

**7. Update observability logging**
- Add `detected_language` field to the log entry metadata

### Why SEA-LION for Both Malay AND Tamil Tools

- SEA-LION v4 natively supports Tamil and Tanglish alongside Malay
- It uses OpenAI-compatible tool format, so the same `callSeaLion()` function works for both languages
- This makes the tool path consistent: one regional model handles both Southeast Asian languages
- Sarvam-M is reserved for its strength: deep reasoning with "Thinking Mode" on the Tamil support/chat path where empathy matters more than tool execution

## Files Modified/Created

| File | Action | Purpose |
|------|--------|---------|
| `src/i18n/en.ts` | Create | English translations |
| `src/i18n/ms.ts` | Create | Bahasa Melayu translations |
| `src/i18n/ta.ts` | Create | Tamil translations |
| `src/i18n/index.ts` | Create | Translation map and type exports |
| `src/contexts/LanguageContext.tsx` | Create | Language context with `t()` function |
| `src/main.tsx` | Edit | Wrap with LanguageProvider |
| `src/pages/Settings.tsx` | Edit | Add language selector |
| `src/components/AppSidebar.tsx` | Edit | Use `t()` for nav labels |
| `src/pages/Dashboard.tsx` | Edit | Translate strings |
| `src/pages/CheckIn.tsx` | Edit | Translate strings |
| `src/pages/Journal.tsx` | Edit | Translate strings |
| `src/pages/Goals.tsx` | Edit | Translate strings |
| `src/pages/CopingTools.tsx` | Edit | Translate strings |
| `src/pages/Progress.tsx` | Edit | Translate strings |
| `src/pages/Achievements.tsx` | Edit | Translate strings |
| `src/pages/Community.tsx` | Edit | Translate strings |
| `src/pages/Auth.tsx` | Edit | Translate strings |
| `src/components/OnboardingWizard.tsx` | Edit | Translate strings |
| `src/pages/AIAgent.tsx` | Edit | Pass `preferred_language` to edge function |
| `src/components/chatbot/ChatbotDrawer.tsx` | Edit | Pass `preferred_language` to edge function |
| `supabase/migrations/xxx.sql` | Create | Add `preferred_language` column |
| `supabase/functions/chat-with-ai/index.ts` | Edit | Language detection + SEA-LION + Sarvam |

## What Won't Change

- Intent router (Groq 8B) stays the same
- English tool path keeps Groq as PRIMARY (no Gemini swap)
- Tool definitions and executor functions unchanged
- Crisis detection runs before everything (language-independent)
- Database schema for other tables unchanged
- `supabase/config.toml` unchanged
- Admin pages stay English-only

