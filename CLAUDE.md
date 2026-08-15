# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## What this is

«احسم» (Ahsem) — an Arabic-first, RTL decision assistant for hesitant people. Next.js 16 App Router, **JavaScript only (no TypeScript)**, Tailwind 4, Supabase (Postgres/Auth/Realtime/RLS), Gemini 2.5 Flash via `@google/genai`, Mailtrap for transactional email. Full feature/architecture docs live in [README.md](README.md) (Arabic) / [README.en.md](README.en.md); product framing in [PRD.md](PRD.md); live status board in [TASKS.md](TASKS.md).

## Commands

```bash
npm run dev          # dev server on :3000
npm run build        # production build — also the compile check (no TS)
npx eslint app lib   # lint; "npm run lint" runs bare eslint
```

There is no test runner. Tests are ad-hoc node scripts run against pure `lib/` modules or the live dev server. To import `@/`-aliased modules from a script outside the project, register an ESM loader that maps `@/` to the repo root and appends `.js` (see the pattern in previous sessions' scratchpad `loader.mjs`/`register.mjs`). Route testing is `fetch("http://localhost:3000/api/…")` from node with real payloads.

Database schema changes are **new timestamped files** in `supabase/migrations/`, run manually in the Supabase SQL editor, in order. **Never run `20260812020000_disable_rls_dev.sql`** — it disables RLS and exists only as a dead dev artifact (deleting it is on the pre-deploy list).

## Architecture: the parts that span files

**Two Supabase clients, never confused.** `lib/supabase.js` is the anon browser client. `lib/supabase-server.js` is the service-role client (bypasses RLS) — server routes only. Identity travels to API routes as `Authorization: Bearer <token>`, verified server-side with `admin.auth.getUser(token)`; a `userId` in a request body is never trusted.

**Every AI feature is a Gemini agent route with the same skeleton** (`app/api/*/route.js`): English SYSTEM prompt with numbered HARD RULES · `responseMimeType: "application/json"` + strict `responseSchema` · a `shape()` validator that rejects anything that would render broken (winners must match option labels verbatim after `normalizeArabic`, axes must be distinct, etc.) · measured `TIMEOUT_MS` (successful Gemini calls run 4–16s; tight timeouts fail *silently* as missing UI) · in-process `allowed(ip)` rate limiter · Arabic error messages via `fail(status, msg)` distinguishing 503-upstream-busy from 502-generic. Client wrappers live in `lib/services/`.

**No fallback content, ever.** The project's core principle: if generation fails, show an honest Arabic error with a retry button. A templated question/answer masquerading as intelligence is treated as worse than an error. Related: **numbers are computed in JS, Gemini only interprets** — see `lib/insight/stats.js` (history statistics) feeding `/api/patterns`; the model is never asked to count.

**Guest access to group votes goes through RPCs only.** Migration `…010000_fix_guest_access_rls.sql` deliberately removed direct table reads for guests (a "read all group decisions" policy leaks every `share_code` to any anon-key holder). The vote page uses `supabase.rpc("get_vote_page", {code})` and `rpc("cast_vote", …)` (security definer, vote weight pinned server-side). Consequently **Realtime is broadcast-as-ping, not `postgres_changes`**: a vote sends an empty broadcast, listeners refetch through the RPC (debounced). Pings are never trusted as data — a forged ping can only trigger a refetch of true numbers. Presence rides the same channel.

**The weighted engine** (`lib/engine/score.js`): category templates in `lib/engine/categories.js` define questions (answers → criterion *weights*) and criteria with per-criterion scales (ratings → *scores*); `score = Σ weight × rating`. `/api/decide` is the Gemini layer on top; the local computation is the always-working fallback the Result screen renders if the call fails.

## Conventions and known traps

- **`normalizeArabic` lives in `lib/text/arabic.js`** and is used by the statistics, the matchup grouping, group voting, and the third-option validator — normalize before any Arabic comparison.

- **Comments are Arabic and explain "why", never "what".** Match this in any file you touch.
- **UI renders zero decorative Latin** — the English caption tags were deliberately stripped (PR #37). `en` fields still exist in data files; don't render them. Arabic-content `<Tag>` needs `lang="ar"` (component defaults to `lang="en"`).
- **`react-hooks/set-state-in-effect` is enforced and will fail lint.** No synchronous setState in effect bodies — the codebase patterns: owner-tagged fetched state derived at render (`PatternsCard`), promise-`.then` setState (`HistorySection`), attempt-counter as effect trigger (`BreakdownFlow`).
- **StrictMode double-mounts effects in dev.** Effects with one-shot side effects (URL cleanup, timers) must survive running twice — clean up inside the timer, not before it.
- **Supabase `generateLink(type:"magiclink")` silently CREATES the account for unknown emails.** For login links use `type:"recovery"` (requires existing user; a recovery session is a full login). `type:"signup"` correctly errors with `email_exists`.
- **Times shown to users are computed in the user's IANA timezone from the browser**, never server time (3-hour Riyadh/UTC skew bites otherwise; `lib/insight/stats.js` drops the stat entirely on an invalid zone rather than lying).
- **Emails are inline table-HTML with system fonts** (`app/api/signup`, `/api/magic-link`) — email clients ignore external CSS/webfonts/flex. The Mailtrap template UUID for signup lives in the route; the Mailtrap token must be Account-Admin scoped (sandbox tokens 401 on live send).
- **Caches are in-process Maps with normalized+sorted, version-prefixed keys** — bump the version string whenever a prompt/contract changes, or stale-shaped entries get served.
- **The accessibility guide never self-voices.** `/api/guide` + `Assistant` reply in TEXT, pushed through the single app-wide `aria-live` region in `lib/a11y/ScreenContext.js` so the user's own screen reader voices it. Adding TTS would make the app talk over NVDA/VoiceOver. Pages register a snapshot and an action map with `useScreen()` — registration writes to a ref, never state, or every render re-registers and loops.
- **A11y patterns to preserve:** step headings get `tabIndex={-1} data-step-heading` (page.js moves focus on step change; self-managed flows like `BreakdownFlow` focus their own headings), `sr-only` text equivalents where the visual layout carries meaning, real `radiogroup`/`radio` roles on choice lists. (Voice mode and its self-voicing were removed — screen-reader users bring their own AT.)

## Git workflow (as actually practiced)

Branch per change (`feat/…`, `fix/…`, `docs/…`, `design/…`) from fresh `main`; commit and push the branch. **Do not open PRs unprompted** — Yazeed opens and merges them (he says "i merged it"; then sync main, delete the local branch, prune). Commit messages explain why, in prose. `.env.local` never leaves the machine; all keys are server-side (env var table in the README).
