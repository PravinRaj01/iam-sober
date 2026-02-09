# i am sober. - AI-Powered Recovery Companion

> 🏆 **Commit To Change Hackathon Entry** | Health, Fitness & Wellness Track + Best Use of Opik

An AI-powered sobriety tracking and mental wellness application that helps users build sustainable recovery habits through intelligent coaching, mood tracking, and community support.

🔗 **Live App**: [https://i-am-sober.vercel.app/](https://i-am-sober.vercel.app/)

---

## 🎯 Problem Statement

Addiction recovery is a challenging journey that requires consistent support, self-awareness, and accountability. Traditional recovery apps offer basic tracking but lack:

- **Personalized AI guidance** that adapts to individual patterns
- **Proactive interventions** when users show signs of struggle
- **Holistic wellness integration** connecting mental and physical health data
- **Real-time observability** to ensure AI interactions are safe and effective

## 💡 Solution

'i am sober.' is a fully agentic AI recovery companion that:

1. **Tracks sobriety** with gamification (XP, levels, streaks, achievements)
2. **Provides 24/7 AI coaching** using a ReAct (Reasoning + Acting) agent architecture
3. **Detects mood patterns** and triggers through journal sentiment analysis
4. **Offers proactive interventions** based on behavioral signals
5. **Integrates wearable data** for holistic health monitoring
6. **Ensures AI safety** with crisis detection and escalation protocols

---

## 🤖 AI Agent Architecture

### Regional Hybrid Router (3-Layer)

The AI Coach uses a sophisticated **multi-model router** that combines intent classification, language detection, and specialized model selection:

```
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

### 6 Models, 3 Languages

| Model | Role | Languages | Speed |
|-------|------|-----------|-------|
| Groq Llama 3.1 8B | Intent Router | All | ~100-200ms |
| SEA-LION v4 27B | Regional Primary (Malay/Tamil) | Malay, Tamil | ~800ms |
| Sarvam-M 24B | Tamil Deep Reasoning | Tamil | ~1.2s |
| Groq Llama 3.3 70B | English Tool-Calling | All | ~400ms |
| Cerebras Llama 3.3 70B | English Chat | English | ~300ms |
| Gemini 2.5 Flash Lite | Fallback | All | ~600ms |

### 20 Agent Tools (Autonomous Selection)

| Category | Tools | Description |
|----------|-------|-------------|
| **Read (9)** | `get_user_progress`, `get_recent_moods`, `get_active_goals`, `get_recent_journal_entries`, `get_biometric_data`, `get_conversation_context`, `analyze_mood_trend`, `fetch_wearable_insights`, `summarize_weekly_progress` | Access and analyze user data for personalized responses |
| **Write (10)** | `create_goal`, `create_check_in`, `create_journal_entry`, `complete_goal`, `log_coping_activity`, `edit_journal_entry`, `delete_journal_entry`, `update_goal`, `delete_goal`, `schedule_reminder` | Take actions with user confirmation |
| **Action (5)** | `suggest_coping_activity`, `create_action_plan`, `escalate_crisis`, `generate_relapse_prevention_plan`, `log_intervention` | Proactive support and safety escalation |

### Safety Features

- **Crisis Detection**: Real-time keyword matching for suicidal ideation, self-harm, and severe relapse
- **Escalation Protocol**: Immediate resource provision with hotline numbers
- **Confirmation Flow**: Agent confirms before executing write actions
- **Input Sanitization**: Protection against prompt injection attacks

---

## 🔔 Proactive Intervention System

4 scheduled cron jobs run 24/7 to provide proactive support:

| Job | Schedule | Purpose |
|-----|----------|---------|
| Daily Reminder | Hourly (timezone-aware) | Morning motivation |
| Weekly Report | Daily 10 AM UTC | Progress summary |
| Milestone Alert | Daily 6 AM UTC | Celebrate 1/7/30/90/365 days |
| **Proactive AI Check** | Every 4 hours | Adaptive risk detection |

### Adaptive Risk Signals

- Missed check-ins (2+ days)
- Declining mood trend
- High urge intensity (≥7)
- Recent relapse (30 days)
- Multiple relapses (90 days) → **CRITICAL**
- Journal sentiment decline
- Poor sleep / High stress from wearables

---

## 📊 Opik Integration for Observability

### What We Track

Every AI interaction is logged to the `ai_observability_logs` table with:

| Metric | Description |
|--------|-------------|
| `function_name` | Which AI function was called |
| `model_used` | LLM model (Gemini, Groq, Cerebras, SEA-LION, Sarvam) |
| `input_tokens` / `output_tokens` | Token usage for cost analysis |
| `response_time_ms` | Latency monitoring |
| `intervention_triggered` | Whether proactive support was activated |
| `intervention_type` | Type of intervention (crisis, pattern, relapse, sentiment, etc.) |
| `tools_called` | JSON array of tools the agent selected |
| `router_category` | Intent classification (data/action/support/chat) |
| `error_message` | Error tracking for debugging |

### Observability Dashboard

The `/ai-observability` page provides:

- **Real-time metrics**: Response times, success rates, token usage
- **Agent performance**: Tool selection accuracy, multi-step reasoning patterns
- **Safety monitoring**: Crisis escalation tracking, intervention effectiveness
- **Cost analysis**: Token consumption trends by function and model
- **Intervention analytics**: Types breakdown (critical_outreach, recent_relapse, etc.)

### Evaluation Criteria Alignment

| Opik Criterion | Our Implementation |
|----------------|-------------------|
| Experiment tracking | All AI calls logged with timestamps, models, and parameters |
| Model performance | Response time, token usage, error rates tracked |
| Data-driven insights | Dashboard shows patterns, allows filtering by date/function |
| Safety evaluation | Crisis detection rates, false positive tracking |

---

## ✨ Features

### Core Recovery Tools

- **Sobriety Counter**: Real-time tracking with persistent storage
- **Daily Check-ins**: Mood, urge intensity, and notes logging
- **Goal Setting**: AI-suggested goals with progress tracking
- **Journal**: Private entries with AI sentiment analysis
- **Achievements**: Gamified milestones with XP and levels

### AI-Powered Features

- **24/7 AI Coach**: Conversational agent with tool-augmented reasoning
- **Mood Pattern Detection**: Automated trend analysis
- **Trigger Detection**: AI analysis of journal entries
- **Personalized Coping Strategies**: Context-aware recommendations
- **Guided Meditations**: AI-generated relaxation scripts
- **Proactive Interventions**: Outreach based on behavioral signals

### Community & Support

- **Anonymous Milestone Sharing**: Celebrate achievements safely
- **Reactions & Comments**: Peer support system
- **Online Member Count**: Real-time community presence

### Health Integration

- **Wearable Data**: Fitbit integration for biometrics
- **Sleep Analysis**: Sleep quality correlation with mood
- **Stress Monitoring**: Heart rate variability tracking

---

## 🛠 Tech Stack

| Layer | Technology |
|-------|------------|
| **Frontend** | React 18, TypeScript, Vite, Tailwind CSS, shadcn/ui |
| **State** | TanStack React Query |
| **Backend** | Supabase (PostgreSQL, Auth, Edge Functions, Storage, Cron) |
| **AI Models** | Groq (Llama 3.1/3.3), Cerebras (Llama 3.3), SEA-LION v4, Sarvam-M, Gemini 2.5 Flash |
| **Push** | Web Push API with VAPID, Service Workers |
| **Charts** | Recharts, Chart.js |
| **PWA** | Vite PWA Plugin with offline support |
| **i18n** | Custom context with English, Malay, Tamil |

---

## 📂 23 Edge Functions

- **AI Coach**: `chat-with-ai` (1,700+ lines)
- **Proactive**: `proactive-check`, `proactive-check-scheduled`
- **Notifications**: `send-daily-reminder`, `send-weekly-report`, `send-milestone-alert`, `send-push-notification`
- **Analysis**: `analyze-journal-sentiment`, `detect-mood-patterns`, `detect-triggers`, `analyze-biometrics`
- **Generation**: `generate-meditation`, `generate-motivation`, `suggest-coping-strategies`, `suggest-recovery-goals`
- **Integrations**: `fitbit-auth`, `transcribe-audio`, `moderate-content`
- **Admin**: `check-admin-status`, `check-ownership`, `reset-user-data`

---

## 📁 Project Structure

```
src/
├── components/          # Reusable UI components
│   ├── ui/             # shadcn/ui primitives
│   ├── chatbot/        # AI coach interface
│   ├── community/      # Social features
│   └── coping/         # Wellness tools
├── pages/              # Route components
│   ├── AIObservability.tsx  # Opik-style dashboard
│   └── ...
├── hooks/              # Custom React hooks
├── contexts/           # React contexts (Language, Background)
└── integrations/       # Supabase client

supabase/
├── functions/          # Edge functions
│   ├── chat-with-ai/   # ReAct agent implementation
│   ├── proactive-check/# Intervention engine
│   └── ...
└── migrations/         # Database schema
```

---

## 🚀 Getting Started

### Prerequisites

- Node.js 18+
- npm or bun

### Local Development

```bash
# Clone the repository
git clone https://github.com/yourusername/i-am-sober.git
cd i-am-sober

# Install dependencies
npm install

# Start dev server
npm run dev

# Open http://localhost:8080
```

---

## 🏆 Hackathon Submission

### Tracks

- ✅ **Health, Fitness & Wellness**: AI-powered recovery and mental wellness support
- ✅ **Best Use of Opik**: Comprehensive observability for AI agent evaluation

### Judging Criteria Alignment

| Criterion | How We Address It |
|-----------|------------------|
| **Functionality** | Fully working app with auth, data persistence, real-time features |
| **Real-world relevance** | Addresses genuine need in addiction recovery space (21M Americans) |
| **Use of LLMs/Agents** | ReAct architecture with 6-model router, 20 autonomous tools, multi-step reasoning |
| **Evaluation & Observability** | Full logging of AI interactions, metrics dashboard, safety tracking |
| **Goal Alignment** | Directly supports mental health, recovery, and wellness goals |
| **Safety & Responsibility** | Crisis detection, hotline escalation, appropriate caveats, no medical claims |

---

## 👥 Team

- **PRAVIN RAJ** - Team Lead
- **Lakxmita Pannirchelven** - Team Member

---

## 📄 License

MIT License - See [LICENSE](LICENSE) for details.

---

*Because for the battles no one talks about, you shouldn't have to fight alone*
