# Infinity Health

> A calm, organic web sanctuary for mental health triage — not a clinical service, but a thoughtful first step.

### Sections
[#showcase-problem](#showcase-problem) &middot; [#present-solution](#present-solution) &middot; [#real-world-impact](#real-world-impact) &middot; [#technical-implementation](#technical-implementation)

---

## <a name="showcase-problem"></a>Showcase Problem

Mental health support systems are often fragmented, difficult to navigate during moments of high distress, or rely on cold, clinical interfaces that increase cognitive friction. When individuals face panic attacks, acute anxiety, burnout, or grief, they need a calm, non-judgmental, and immediate first step rather than clinical jargon or diagnostic walls of text.

At the same time, AI tools in health-adjacent contexts face risks of hallucination, lack of grounding, and inadequate safety rails for crisis situations.

---

## <a name="present-solution"></a>Present Solution

Infinity Health bridges this gap with an empathetic, organic web sanctuary that provides:
- **Calm Conversational Triage**: Gathers context gradually without overwhelming the user (max 7 diagnostic questions).
- **In-the-moment De-escalation**: An interactive, animated box breathing guide helps lower physiological distress instantly.
- **Crisis Detection**: Actively intercepts safety-critical triggers and redirects users to immediate human resources.

---

## Features

- 🌿 **Conversational triage** — structured symptom narrowing without walls of text or alarmist language
- 📚 **RAG-backed responses** — answers grounded in embedded clinical guidelines via `pgvector` cosine similarity search
- 🫁 **Box breathing panel** — animated guided breathing circle (inhale → hold → exhale → hold) to de-escalate in real time
- 🔐 **Authentication** — Google OAuth + email/password via NextAuth.js
- 🚨 **Crisis detection** — keyword interceptor that flags life-safety triggers before inference
- 💬 **Multi-session chat history** — sidebar with Today / Yesterday / Earlier grouping

---

## <a name="real-world-impact"></a>Real World Impact

Infinity Health is designed to lower the barrier to mental health support:
1. **Immediate De-escalation**: Gives users a tangible tool (box breathing) to focus on when experiencing acute distress.
2. **Context-Aware Assistance**: Reduces diagnostic delay by helping users formulate their experiences using accurate, grounded concepts before they reach out to professional clinical care.
3. **Safety Integration**: Intercepts potential self-harm indicators immediately, providing helpful helpline redirects when they matter most.

---

## <a name="technical-implementation"></a>Technical Implementation

### Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 14 (App Router, TypeScript) |
| Styling | Tailwind CSS + custom OKLCH design tokens |
| Animation | Framer Motion |
| Database | PostgreSQL (Supabase) via Prisma + `pgvector` |
| Embeddings | `gemini-embedding-2` (768-dim) |
| Chat Model | `gemini-3.1-flash-lite` |
| Auth | NextAuth.js — Google OAuth + Credentials |

### Data Flow

```
User message → POST /api/chat
  → Crisis keyword check          (src/lib/crisis.ts)
  → Embed message                 (gemini-embedding-2)
  → pgvector similarity search    (src/lib/vector.ts)
  → Build system prompt + context
  → Gemini inference              (gemini-3.1-flash-lite)
  → Persist session + messages    (Prisma)
  → Return { content, sessionId, isCrisis }
```

### Key Files

```
src/
├── app/
│   ├── chat/page.tsx          # Monolithic page — landing (unauthed) + chat dashboard (authed)
│   ├── api/chat/route.ts      # Core API: inference, RAG, session CRUD, crisis detection
│   └── globals.css            # Full OKLCH design token system + glass/animation classes
├── lib/
│   ├── auth.ts                # NextAuth config (providers, JWT strategy)
│   ├── vector.ts              # Embedding generation + cosine similarity retrieval
│   ├── crisis.ts              # Life-safety regex keyword interceptor
│   └── prisma.ts              # Lazy-loaded Prisma client with env fallback chain
├── components/
│   └── BreathingCircle.tsx    # Box breathing animated component
prisma/
├── schema.prisma              # Schema: User, Session, Message, GuidelineChunk
└── seed.ts                    # Seeds clinical guidelines with vector embeddings
```

### Environment Variables

```env
DATABASE_URL=          # Supabase PostgreSQL connection string
GEMINI_API_KEY=        # Google AI Studio key
NEXTAUTH_URL=          # e.g. https://your-domain.com
NEXTAUTH_SECRET=       # Random 64-char hex secret
GOOGLE_CLIENT_ID=      # Google OAuth client ID
GOOGLE_CLIENT_SECRET=  # Google OAuth client secret
```

---

## Getting Started

```bash
# Install dependencies
npm install

# Set up environment variables (copy and fill in .env.example)
cp .env.example .env

# Push the Prisma schema and seed clinical guidelines
npx prisma db push
npx ts-node prisma/seed.ts

# Start the dev server
npm run dev
```

---

## Deployment

- **Hosting:** Vercel (auto-deploys from `main`)
- **Database:** Supabase PostgreSQL with `pgvector` extension

---

> **Disclaimer:** Infinity Health is not a medical service and is not a substitute for emergency care. If you are in crisis, please contact a local emergency service or a mental health helpline.

