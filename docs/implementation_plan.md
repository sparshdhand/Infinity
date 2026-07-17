# Infinity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a multi-user, RAG-backed mental health web agent in Next.js 14, prioritizing bullet-point-only structured AI answers, warm OKLCH design variables, and a guided box breathing simulator.

**Architecture:** Monolithic Next.js (App Router) + Prisma + Supabase (PostgreSQL / Pgvector) + NextAuth + Gemini API.

## Global Constraints
- **Design Tokens:** Follow the custom hue-shifting palette and typography (Fraunces + Plus Jakarta Sans) specified in `DESIGN.md`.
- **Response Format:** Strictly enforce that agent triage and response messages use clear, double-spaced bullet points (no dense paragraph blocks).
- **Reduced Motion:** Set `@media (prefers-reduced-motion: reduce)` on all animation routines.

---

### Task 1: Scaffolding, Theme & A11y Setup
Scaffold the Next.js workspace and build out the baseline layout CSS variables and responsive rules.

**Files:**
- Create: `package.json`
- Create: `next.config.js`
- Create: `src/app/globals.css`
- Create: `src/app/layout.tsx`

- [ ] **Step 1: Setup npm packages**
Define dependencies (`next`, `react`, `@prisma/client`, `next-auth`, `@google/generative-ai`, `framer-motion`).
- [ ] **Step 2: Add global theme variable rules**
Add the OKLCH tokens, tactile glassmorphism utilities, and prefers-reduced-motion rules from `DESIGN.md` into `src/app/globals.css`.
- [ ] **Step 3: Setup App Layout**
Implement fonts loading for `Fraunces` and `Plus Jakarta Sans` in `src/app/layout.tsx`. Ensure high contrast semantic structures.

---

### Task 2: Auth and Schema Definitions
Configure user registration and JWT-based session models for regular users and developer admin pages.

**Files:**
- Create: `prisma/schema.prisma`
- Create: `src/lib/prisma.ts`
- Create: `src/app/api/auth/[...nextauth]/route.ts`

- [ ] **Step 1: Define relational models**
Define Prisma schemas for User (with roles: `user`, `admin`), Session, and Message.
- [ ] **Step 2: Initialize Prisma Client**
Set up the shared db instance in `src/lib/prisma.ts`.
- [ ] **Step 3: Configure credentials auth provider**
Write authorization checks with hashed password verification in the NextAuth handlers.

---

### Task 3: Vector DB & RAG Setup
Build out seed scripts to load NIH and WHO mental health guidelines into Pgvector and query relative matching content blocks.

**Files:**
- Create: `prisma/seed.ts`
- Create: `src/lib/vector.ts`

- [ ] **Step 1: Write guideline seed processor**
Parse medical source Markdown documents in `prisma/seed.ts` and compute sentence embeddings.
- [ ] **Step 2: Write Vector similarity checks**
Create lookup logic matching user symptom entries against indexed vector records.

---

### Task 4: API Triage and Bullet-point Prompts
Program the conversation routing, combining the RAG metadata extraction, crisis checks, and strict bulleted response formatting.

**Files:**
- Create: `src/app/api/chat/route.ts`
- Create: `src/lib/crisis.ts`

- [ ] **Step 1: Create crisis keyword interception**
Add immediate detection of life-safety risks, responding with accessible hotline resources.
- [ ] **Step 2: Set up Gemini chat completion**
Configure chat api logic with system instructions enforcing bullet-point-only formats:
```
System Instructions:
- Formulate response using double-spaced bullet points only.
- Never write text paragraph blocks.
- Synthesize diagnostic context solely based on provided RAG guidelines.
```
- [ ] **Step 3: Test API endpoints**
Verify structured markdown bulleted lists return on sample queries.

---

### Task 5: Conversational UI & Guided Breathing simulator
Create the clean chat layout and the pulsing box breathing visual component.

**Files:**
- Create: `src/app/chat/page.tsx`
- Create: `src/components/BreathingCircle.tsx`

- [ ] **Step 1: Style conversational components**
Build user and agent bubbles matching the asymmetric, rounded structures in `DESIGN.md`.
- [ ] **Step 2: Create Box Breathing simulator**
Write breathing loop cycles (4s scale up -> 4s hold -> 4s scale down -> 4s hold) on a Canvas/SVG circle.
- [ ] **Step 3: Deploy keyboard focus helpers**
Ensure keyboard-visible rings are configured.
