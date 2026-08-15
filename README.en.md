# Ahsem (احسم) — the decision assistant for the hesitant

**النسخة العربية: [README.md](README.md)**

An Arabic-first web app that helps hesitant people decide — from "burger or sushi?" to "should I quit my job?" to "where are we eating tonight?" with the whole group. It pairs a transparent weighted-scoring engine with purpose-built Gemini agents for every language task, on top of Supabase for data, auth, and realtime.

📄 Original concept in [PRD.md](PRD.md) · historical task breakdown in [TASKS.md](TASKS.md)

---

## Features

### 1 — Solo decisions (the core flow)
Write 2–5 options, pick a decision type (food, entertainment, shopping, time, life), answer three quick questions that set each criterion's **weight** (in a rush? speed weighs more), then a quick rating pass sets each option's **score** — every criterion gets its own scale (flavor: light/medium/strong, not weak/excellent). The result:

- A Gemini recommendation in Ahsem's voice — a witty friend explaining *why*, not a robot
- "Your weighted math": percentages genuinely computed from your answers (`score = Σ weight × rating`), with a plain-language breakdown on demand
- If the API call fails, the local computation carries the screen — it never breaks
- "I'm really torn": a weighted dice roll — the higher-scored option is favored but not guaranteed

### 2 — Mood
Changes the whole page's color theme and adds +1 to exactly one criterion's weight — and its influence is disclosed in the result explanation.

### 3 — The option you didn't think of
As you type, an agent reads the trade-off between your options and suggests a third that breaks it: "burger or sushi… **or grills?**". Five moves: the middle, the escape, the smaller version, doing both, doing neither. It appears only when there's a real suggestion — no loading state, no noise.

### 4 — Breaking down oversized decisions
"Should I quit?" can't be settled by three quick questions. A local detector (keyword list, zero API calls) spots life-sized decisions and offers a breakdown: an agent converts the big question into factual checks answerable *today* (six months of savings? tried it alongside the job?), then composes a verdict — **go**, or **not yet** with exactly what would flip it and one step doable this week.

### 5 — Group voting
"Make it a group vote" creates a poll with a short link and a locally-generated QR code (the link *is* the secret — it never touches a third-party QR service). Guests vote by name with no accounts; the bars move on every open screen in real time, with a live presence count. On close, Gemini announces the result in the group's register — and on a tie it **breaks the tie itself and takes the blame**: "nobody could settle it, so I did."

### 6 — A history that learns
Under every saved decision: "was it the right call?". The answers feed your **decision personality**: regret rate by category, the option you keep listing but never pick, the matchup you keep reopening (Al Baik vs shawarma, four times!), and when your indecision strikes — in *your* timezone. All statistics are computed in code; Gemini interprets, it never counts.

### 8 — Day planner (`/plan`)
Pick mood, vibe, budget, and duration; the agent builds a real schedule: venues from Google Places (actually open at visit time), travel times from the Routes API, and Open-Meteo weather that steers outdoor stops away from peak heat — and a weather failure never breaks the plan.

### 9 — Risk analysis (`/analyze`)
For one big decision: a SWOT analysis and a sourced decision tree, saved to the `analyses` table.

### 10 — Accounts & verification
Supabase Auth sign-up, with the confirmation email sent from **our own Arabic template** through Mailtrap on our domain — not Supabase's English default. If the send fails, the half-created account is deleted automatically so retries stay clean. Signing out asks for a confirming second tap.

---

## Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 16 (App Router) · React 19 · Tailwind CSS 4 · JavaScript |
| AI | Gemini 2.5 Flash via `@google/genai` — JSON outputs under strict schemas |
| Data | Supabase: PostgreSQL · Auth · Realtime (Broadcast + Presence) · RLS |
| Email | Mailtrap (Transactional API) |
| Maps & weather | Google Places (New) · Google Routes · Open-Meteo (keyless) |
| QR | `uqr` — local, zero-dependency QR generation |
| Deploy target | Vercel |

## Project layout

```
app/
  page.js                 main flow (landing → questions → ratings → result)
  how/ plan/ analyze/     explainer page + the planner and analysis agents
  login/ signup/ settings/
  vote/[code]/            the live group-voting page
  components/             UI components (hand-drawn Lucide icons included)
  api/                    routes — table below
lib/
  engine/                 scoring, categories, mood, oversized-decision detector, explanations
  insight/                history statistics + decision-personality prompt
  services/               client-side wrappers for routes and tables
  text/                   Arabic normalization for comparisons
  plan/ places/ routing/ weather/   day-planner building blocks
  supabase.js             browser client (anon) · supabase-server.js server client (service role)
supabase/migrations/      schema + policies — run in order (see the warning below)
email send/               the verification template in Supabase syntax
```

## API routes

| Route | Role | Protection |
|---|---|---|
| `POST /api/decide` | final recommendation in Ahsem's voice + user history | optional token |
| `POST /api/third` | third-option suggestion while typing | 20/min + 12h cache |
| `POST /api/breakdown` | oversized-decision breakdown (questions/verdict phases) | 10/min |
| `GET/POST /api/group` | group-vote verdict / close (creator's token) | 20 / 5 per min + 24h cache |
| `GET /api/patterns` | decision personality from your history | **token required** + browser timezone |
| `POST /api/signup` | account creation + Mailtrap verification | 5/min + compensating delete |
| `POST /api/plan` | day plan (Places + Routes + weather) | — |
| `POST /api/analyze` | SWOT + decision tree | — |

All keys live server-side only; identity travels as `Authorization: Bearer`, never in the body.

## Data & security

- **Seven tables**: `profiles`, `decisions`, `options`, `answers`, `votes`, `feedback`, `analyses` — all behind RLS.
- **Guests never touch tables**: the vote page goes through two `security definer` RPCs — `get_vote_page(code)` and `cast_vote(code, …)` — so nothing is exposed except what you hold the link to, and vote weight is pinned in the database.
- **Realtime as a doorbell**: casting a vote broadcasts an *empty* ping and every listener refetches through the RPC — broadcasts are never trusted as data, so an attacker can ring the bell but can't forge a bar. Presence rides the same channel.
- Voter names are hidden from guests — they surface only in the final announcement.

### Environment variables (`.env.local`)

| Variable | For |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` · `NEXT_PUBLIC_SUPABASE_ANON_KEY` | browser client |
| `SUPABASE_SERVICE_ROLE_KEY` | server only — bypasses RLS |
| `GEMINI_API_KEY` | all AI agents |
| `GOOGLE_MAPS_API_KEY` | Places + Routes for the day planner |
| `MAILTRAP_API_TOKEN` | verification emails (Account Admin token — a sandbox token gets 401) |
| `MAILTRAP_FROM_EMAIL` | optional — defaults to `no-reply@yazeed.store` |

## Running from scratch

1. Create a Supabase project and run the files in `supabase/migrations/` **in order** in the SQL Editor.
   ⚠️ **Skip `20260812020000_disable_rls_dev.sql`** — a stale dev artifact that disables RLS. Never run it.
2. Fill `.env.local` per the table above.
3. Then:

```bash
npm install
npm run dev
```

The email template lives in Mailtrap (its UUID is in `app/api/signup/route.js`) — if you recreate it there, update the UUID.

## Design principles

- **Arabic-first, spoken register** — agents write like a friend; fully RTL UI with isolated Latin runs.
- **Honest failure** — no fallback questions masquerading as intelligence: if generation fails, you get a plain error and a retry button. A disguised template is worse than an error.
- **Numbers are computed, never invented** — every statistic is calculated in code and Gemini only interprets; every model output passes strict validation (winners must match the list verbatim, axes must be distinct…).
- **Timeouts are measured** — every timeout is based on observed latency, because a tight one fails *silently*.
- **Cost discipline** — caches with normalized, version-prefixed keys; typing debounce; rate limits; expensive calls behind buttons, never automatic.
- **Accessibility** — focus management per step, screen-reader announcements, proper radio groups, documented shortcuts.

## Status & next steps

**Unmerged branches**: `feat/devils-advocate` (a counsel for the losing option — built, awaiting review) · `feat/photo-options` (options from a photo — parked).

**Before deploying**: rate-limit the original routes (`decide`, `plan`, `analyze`) · delete the RLS-disable migration · Vercel env vars · Supabase Auth Site URL · finish the sending-domain DNS (DMARC).

**Candidate ideas**: a daily "was it the right call?" email (feeds the decision personality) · shareable result cards · a `closes_at` deadline for group votes.
