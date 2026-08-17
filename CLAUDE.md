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

**Every AI feature is a Gemini agent route with the same skeleton** (`app/api/*/route.js`): English SYSTEM prompt with numbered HARD RULES · `responseMimeType: "application/json"` + strict `responseSchema` · a `shape()` validator that rejects anything that would render broken (winners must match option labels verbatim after `normalizeArabic` from `lib/voice/match.js`, axes must be distinct, etc.) · measured `TIMEOUT_MS` (successful Gemini calls run 4–16s; tight timeouts fail *silently* as missing UI) · Arabic error messages via `fail(status, msg)` distinguishing 503-upstream-busy from 502-generic. Client wrappers live in `lib/services/`.

**`shape()` is the last gate before the screen, so guarantees belong there, not in the prompt.** A HARD RULE is a request the model can miss; `shape()` is code that always runs. `/api/patterns` asks for Arabic-Indic digits *and* converts them in `shape()` — do the same for anything that must always hold.

Only `breakdown`, `third`, `group`, `signup`, and `magic-link` carry the in-process `allowed(ip)` rate limiter. **`decide`, `assist`, `patterns`, `plan`, and `analyze` are unmetered** — that is a known pre-deploy blocker, not a pattern to copy.

**No fallback content, ever.** The project's core principle: if generation fails, show an honest Arabic error with a retry button. A templated question/answer masquerading as intelligence is treated as worse than an error. Related: **numbers are computed in JS, Gemini only interprets** — see `lib/insight/stats.js` (history statistics) feeding `/api/patterns`; the model is never asked to count.

**Guest access to group votes goes through RPCs only.** Migration `…010000_fix_guest_access_rls.sql` deliberately removed direct table reads for guests (a "read all group decisions" policy leaks every `share_code` to any anon-key holder). The vote page uses `supabase.rpc("get_vote_page", {code})` and `rpc("cast_vote", …)` (security definer, vote weight pinned server-side). Consequently **Realtime is broadcast-as-ping, not `postgres_changes`**: a vote sends an empty broadcast, listeners refetch through the RPC (debounced). Pings are never trusted as data — a forged ping can only trigger a refetch of true numbers. Presence rides the same channel.

**The weighted engine** (`lib/engine/score.js`): category templates in `lib/engine/categories.js` define questions (answers → criterion *weights*) and criteria with per-criterion scales (ratings → *scores*); `score = Σ weight × rating`. `/api/decide` is the Gemini layer on top; the local computation is the always-working fallback the Result screen renders if the call fails.

## The design language: ink and parchment

Extended from the login screen across every surface. Tokens live in `app/globals.css`; the shared kit is `app/components/ui.js`.

**Three rules carry the whole system.** *Paper is where you work* — parchment page (`--background`), panel cards (`--card`), sunken blocks (`--card-sunken`), underline `Field`s instead of boxed inputs. *Ink is where judgment happens* — the same dark card delivers the solo result, the group verdict, the patterns reading, the analyze conclusion, and the breakdown ruling. *Terracotta is one action per screen* — anything selected or confirmed fills with **ink**, not accent, so the accent never competes with itself. `Choice`, `OutcomeAsk`, and question rows all follow this.

**Mood lives in `MoodProvider` at the root layout, never in a page.** `useMoodTheme` deletes `data-mood` on unmount, so when the state lived in `app/page.js` navigating away actively *stripped* the colour rather than merely failing to apply it — plan/analyze/vote were never themed. The provider mounts above the router, so every route inherits it. Mood is tagged with the account that owns it and derived at render (sign-out drops it without a setState-in-effect). Settings previews via `setPreview` from the click handler, with `undefined` = no preview and `null` = previewing «بدون» — a bare `??` collapses those two and shows the saved colour instead of clearing it.

**Named mood tokens** (`--mood-default`, `--mood-hyped`, …) are the single source for the five accents; each `:root[data-mood=…]` block consumes its own. Mood tints the paper slightly and swaps the accent family — the ink/parchment identity stays fixed so a mood change never reads as a different product.

**`Splash` is server-rendered in the root layout**, outside the providers. It ships inside the first HTML so it covers before any JS runs; waiting for mount would flash the page and *then* cover it. Living in the layout means it plays once per real page load — App Router navigation never unmounts the layout. `Reveal` handles scroll-in animation by toggling a class on the DOM directly, with no React state.

## Arabic typography: the traps that actually bit

- **`.display` sits at `line-height: 1.25`, not tighter.** Latin display type tolerates 1.15 because its ascenders stop at the cap height; the hamza above alef (أ) and the shadda climb *past* the line box and collide with whatever sits above. At 60px this put the hamza on top of the label above it.
- **Every number the UI writes goes through `toArabicDigits`** (`lib/text/digits.js`, re-exported as `hindi` from `ui.js`). The Arabic font converts *some* Latin digits and not others, so untreated counters render half in each system («١ / 3»). This includes `Intl`: use `new Intl.RelativeTimeFormat("ar-u-nu-arab")` — locale `"ar"` alone lets the platform choose, and Chrome on Windows chooses Latin.
- **Model output is converted too, in `shape()`.** `/api/patterns` asks for Arabic-Indic digits in a HARD RULE *and* converts on the way out; the prompt is the request, `shape()` is the guarantee.
- **Bidi mirrors `<` and `>`.** A stray `>` inside a `dir="rtl"` document renders as `<` — worth remembering when a mystery character appears in email HTML.

## Conventions and known traps

- **Comments are Arabic and explain "why", never "what".** Match this in any file you touch.
- **UI renders no decorative text at all — Latin or Arabic.** The English caption tags went first (PR #37); the Arabic eyebrows that replaced them were stripped too, along with both "you can use Ahsem without an account" lines. The test is whether the label says anything the heading below it doesn't. `en` fields still exist in data files; don't render them. `Eyebrow` remains in the kit but is currently unused; Arabic-content `<Tag>` needs `lang="ar"` (it defaults to `lang="en"` so screen readers don't read Latin with an Arabic voice).
- **`react-hooks/set-state-in-effect` is enforced and will fail lint.** No synchronous setState in effect bodies — the codebase patterns: owner-tagged fetched state derived at render (`PatternsCard`), promise-`.then` setState (`HistorySection`), attempt-counter as effect trigger (`BreakdownFlow`).
- **StrictMode double-mounts effects in dev.** Effects with one-shot side effects (URL cleanup, timers) must survive running twice — clean up inside the timer, not before it.
- **A full-bleed element that is rotated or scaled needs a clipping wrapper.** The tilted marquee (`Landing.js`) is `-rotate-1 scale-[1.02]` — the scale is deliberate, since the tilt otherwise leaves empty wedges at the screen edges — but that made its box 931px wide in a 912px viewport and gave the whole landing page a horizontal scrollbar into blank space. Nothing looks wrong until you scroll sideways, so it hides easily. The wrapper takes `overflow-hidden` **plus vertical padding**: `overflow-hidden` clips against the *layout* box and transforms never enter layout, so without the padding the tilted corners get sliced and the band's ends read as cut straight. To check for a regression: `document.documentElement.scrollWidth` must equal `clientWidth`.
- **Supabase `generateLink(type:"magiclink")` silently CREATES the account for unknown emails.** For login links use `type:"recovery"` (requires existing user; a recovery session is a full login). `type:"signup"` correctly errors with `email_exists`.
- **Times shown to users are computed in the user's IANA timezone from the browser**, never server time (3-hour Riyadh/UTC skew bites otherwise; `lib/insight/stats.js` drops the stat entirely on an invalid zone rather than lying).
- **Emails are inline table-HTML** — clients ignore external CSS and flex. Two of them, and they are edited in different places: the **signup verification email is a stored Mailtrap template** (UUID `28bf46a1-…` lives in `app/api/signup/route.js`, edited in Mailtrap's UI, variable `{{confirmation_url}}`), while the **magic-link email is inline HTML in `app/api/magic-link/route.js`**. Both carry the ink/parchment palette. **Almarai is requested three ways** — `<link>`, `@import` inside `<style>`, and inline `font-family` on the heading — because clients honour different ones; measured in Mailtrap's preview, the `<link>` alone did *not* load it and the `@import` did. Gmail and Outlook strip webfonts regardless and fall back to Tahoma; that is accepted, colour and layout still arrive. The Mailtrap token must be Account-Admin scoped (sandbox tokens 401 on live send).
- **Response caches are in-process Maps with normalized+sorted, version-prefixed keys** (`third`, and a 24h verdict cache in `group`) — bump the version string whenever a prompt/contract changes, or stale-shaped entries get served. The similar-looking `hits` Maps in other routes are rate limiters, not caches.
- **A11y patterns to preserve:** step headings get `tabIndex={-1} data-step-heading` (page.js moves focus on step change; self-managed flows like `BreakdownFlow` focus their own headings), `useScreenAnnounce` for spoken results, real `radiogroup`/`radio` roles on choice lists.
- **`app/page.js` renders `Thinking` and `Result` outside the paper `Card`** — both bring their own ink surface, and nesting them in a card would double-frame the verdict.

## Where the shared pieces live

| Concern | File |
| --- | --- |
| Design tokens, mood themes, `.display`, splash/reveal keyframes | `app/globals.css` |
| Buttons, `Field`, `Card`/`InkCard`, `Choice`, `Progress`, `hindi` | `app/components/ui.js` |
| App-wide mood state + `data-mood` | `lib/theme/MoodProvider.js` (mounted in `app/layout.js`) |
| Low-level `data-mood` writer — call it **only** from the provider | `lib/theme/useMoodTheme.js` |
| Arabic-Indic digit conversion (UI *and* model output) | `lib/text/digits.js` |
| Arabic normalization for matching | `lib/voice/match.js` (`normalizeArabic`) |
| Opening screen, scroll reveal | `app/components/Splash.js`, `Reveal.js` |

## Git workflow (as actually practiced)

Branch per change (`feat/…`, `fix/…`, `docs/…`, `design/…`) from fresh `main`; commit and push the branch. **Do not open PRs unprompted** — Yazeed opens and merges them (he says "i merged it"; then sync main, delete the local branch, prune). Commit messages explain why, in prose. `.env.local` never leaves the machine; all keys are server-side (env var table in the README).
