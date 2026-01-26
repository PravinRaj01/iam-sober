# I AM Sober - AI-Powered Recovery Companion

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

I AM Sober is a fully agentic AI recovery companion that:
1. **Tracks sobriety** with gamification (XP, levels, streaks, achievements)
2. **Provides 24/7 AI coaching** using a ReAct (Reasoning + Acting) agent architecture
3. **Detects mood patterns** and triggers through journal sentiment analysis
4. **Offers proactive interventions** based on behavioral signals
5. **Integrates wearable data** for holistic health monitoring
6. **Ensures AI safety** with crisis detection and escalation protocols

---

## 🤖 AI Agent Architecture

### ReAct Pattern Implementation
The AI Coach uses a **ReAct (Reasoning + Acting)** loop with autonomous tool selection:

```
User Message → Crisis Detection → LLM Reasoning → Tool Selection → Action Execution → Response
                     ↓                                    ↑
              Safety Layer                         Multi-Step Loop (up to 5 iterations)
```

### Agent Capabilities

| Category | Tools | Description |
|----------|-------|-------------|
| **Read** | `get_user_progress`, `get_recent_moods`, `get_active_goals`, `get_recent_journal_entries`, `get_biometric_data`, `get_conversation_context` | Access and analyze user data for personalized responses |
| **Write** | `create_goal`, `create_check_in`, `create_journal_entry`, `complete_goal`, `log_coping_activity` | Take actions with user confirmation |
| **Action** | `suggest_coping_activity`, `create_action_plan`, `escalate_crisis` | Proactive support and safety escalation |
| **Meta** | `log_intervention` | Observability and analytics tracking |

### Safety Features
- **Crisis Detection**: Real-time keyword matching for suicidal ideation, self-harm, and severe relapse
- **Escalation Protocol**: Immediate resource provision with hotline numbers
- **Confirmation Flow**: Agent confirms before executing write actions
- **Input Sanitization**: Protection against prompt injection attacks

---

## 📊 Opik Integration for Observability

### What We Track

Every AI interaction is logged to the `ai_observability_logs` table with:

| Metric | Description |
|--------|-------------|
| `function_name` | Which AI function was called |
| `model_used` | LLM model (Gemini 2.5 Flash) |
| `input_tokens` / `output_tokens` | Token usage for cost analysis |
| `response_time_ms` | Latency monitoring |
| `intervention_triggered` | Whether proactive support was activated |
| `intervention_type` | Type of intervention (crisis, pattern, etc.) |
| `tool_calls_made` | JSON array of tools the agent selected |
| `error_message` | Error tracking for debugging |

### Observability Dashboard

The `/ai-observability` page provides:
- **Real-time metrics**: Response times, success rates, token usage
- **Agent performance**: Tool selection accuracy, multi-step reasoning patterns
- **Safety monitoring**: Crisis escalation tracking, intervention effectiveness
- **Cost analysis**: Token consumption trends by function

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
| **Backend** | Supabase (PostgreSQL, Auth, Edge Functions, Storage) |
| **AI** | Google Gemini 2.5 Flash via Edge Functions |
| **Charts** | Recharts, Chart.js |
| **PWA** | Vite PWA Plugin with offline support |

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
git clone https://github.com/yourusername/iams-sober-path.git
cd iams-sober-path

# Install dependencies
npm install

# Start dev server
npm run dev

# Open http://localhost:8080
```

---

## 🏆 Hackathon Submission

### Tracks
- **Health, Fitness & Wellness**: AI-powered recovery and mental wellness support
- **Best Use of Opik**: Comprehensive observability for AI agent evaluation

### Judging Criteria Alignment

| Criterion | How We Address It |
|-----------|------------------|
| **Functionality** | Fully working app with auth, data persistence, real-time features |
| **Real-world relevance** | Addresses genuine need in addiction recovery space |
| **Use of LLMs/Agents** | ReAct architecture with autonomous tool selection, multi-step reasoning |
| **Evaluation & Observability** | Full logging of AI interactions, metrics dashboard, safety tracking |
| **Goal Alignment** | Directly supports mental health, recovery, and wellness goals |
| **Safety & Responsibility** | Crisis detection, appropriate caveats, no medical claims |

---

## 👥 Team

- **PRAVIN RAJ** - Team Lead
- **Lakxmita Pannirchelven** - Team Member

---

## 📄 License

MIT License - See [LICENSE](LICENSE) for details.

---

*Stay strong. Every day counts.* 💪
