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

**Every LLM route is rate limited, and the caps follow cost.** `lib/rate-limit.js` exports `createLimiter({ max })`, which returns an `allowed(ip)` closure with its own counter so no route spends another's allowance. `plan` and `patterns` get 6/min (each `plan` request also spends Google Places *and* weather quota), `analyze` 8 (one request is a pipeline of model calls, not one call), `decide` 15, `frame` 8 (a full model call on the critical path), `assist` 20 because it is interactive and users retype. `patterns` checks the limit *before* verifying the token — otherwise the identity check itself becomes the flood target. `frame` and `third` do the opposite and read their cache *first*: the cap exists to guard the call that costs money, and `frame` will fire on every blur of the last option field, so charging a real user for free cache hits throttles exactly the person the early launch is meant to help.

Two things to know before trusting it. The five older routes (`signup`, `magic-link`, `third`, `breakdown`, `group`) still hold hand-written copies of the same logic; migrating them onto the factory is pending and touches the auth paths. And **the counters live in one process** — on Vercel each instance keeps its own tally, so the effective ceiling multiplies by instance count and resets on restart. This blocks a casual loop, not a determined attacker; a real ceiling needs shared storage (Vercel KV / Upstash).

**No fallback content, ever.** The project's core principle: if generation fails, show an honest Arabic error with a retry button. A templated question/answer masquerading as intelligence is treated as worse than an error. Related: **numbers are computed in JS, Gemini only interprets** — see `lib/insight/stats.js` (history statistics) feeding `/api/patterns`; the model is never asked to count.

**Guest access to group votes goes through RPCs only.** Migration `…010000_fix_guest_access_rls.sql` deliberately removed direct table reads for guests (a "read all group decisions" policy leaks every `share_code` to any anon-key holder). The vote page uses `supabase.rpc("get_vote_page", {code})` and `rpc("cast_vote", …)` (security definer, vote weight pinned server-side). Consequently **Realtime is broadcast-as-ping, not `postgres_changes`**: a vote sends an empty broadcast, listeners refetch through the RPC (debounced). Pings are never trusted as data — a forged ping can only trigger a refetch of true numbers. Presence rides the same channel.

**The winner is a pointer plus a record, and three writers must keep both.** `decisions.winner_option_id` answers "who wins now" in one read — `get_vote_page` hands it to guests, and history/`/api/decide`/`/api/patterns` join on it — but it is overwritten, so the verdict a discussion overturned used to vanish. `decision_winners` logs every ruling (`option_label` snapshotted beside `option_id`, `source` in `decide`/`discuss`/`vote`, the `reason` shown to the user), append-only with no update/delete policy, exactly like `votes`. Three places write the winner and each must also log: `saveDecision` and `updateWinner` in `lib/services/decisions.js`, and the close branch of `/api/group`. The log is **always additive** — `logWinner` warns and returns rather than failing the save, because the column is what the screen reads.

**The weighted engine** (`lib/engine/score.js`): a template defines questions (answers → criterion *weights*) and criteria with per-criterion scales (ratings → *scores*); `score = Σ weight × rating`. `/api/decide` is the Gemini layer on top; the local computation is the always-working fallback the Result screen renders if the call fails.

**The template is generated per decision, and the engine cannot tell.** `score.js` never learns where its `category` came from — it only knows the shape (`criteria[]`, `questions[]`, `moodCriteria`). So `/api/frame` generates that shape for the user's actual options and `frameToCategory()` hands it over; **`score.js` did not change by one line, and must not.** If you find yourself editing it to fit a frame, the frame is wrong. Numbers stay in JS, the model only interprets — the same rule as everywhere else.

`lib/engine/categories.js` still exists but no longer drives the UI: the five ids are an internal classification dictionary (the `CHECK` constraint on `decisions.category`, the history label, the `looksOversized` signal). Asking "what kind of decision is this?" *after* the user typed «كبسة ولا برجر» admitted we hadn't read it, so the picker is gone and the model infers `frame.category`. `VoiceMode` is the one holdout still sending a static `categoryId`; `app/page.js` keeps a separate `voiceCategoryId` for it rather than faking a frame.

**A generated frame carries a branch tree, and its second question must be counted before it is chosen.** `frame.branches` holds the next question for each possible answer to `frame.first`, so the second question is read from memory instead of fetched. But `QuestionStep.pick` calls `setAnswers(...)` and `onAnswer()` in the same handler, so `onAnswer` reads the question count from a render the answer has not entered yet. `pathQuestions()` therefore returns the first branch as a stand-in before any answer — with a variable length the flow saw "one question", jumped to ratings, and swallowed the branch question whole. The stand-in is never rendered (only index 0 is) and never weighted (its key is not in `answers`). Its sibling `pathAnswers()` drops answers belonging to a branch the user backed out of, which would otherwise reach the model as a position they had abandoned.

**Two options get a duel, three or more keep the grid.** With exactly two options the winner is `Σ w×(rA − rB)` — only the *difference* counts — and a 1–3 scale yields exactly five possible differences, so one handle per criterion (`-2..+2`) loses nothing that six cells carried. `lib/engine/duel.js` holds that table plus `withPriors()`, which seeds each handle from the model's estimate so the user corrects rather than fills. Above three options the absolute value re-enters the sum and `RatingGrid` stays. `score.js` never learns any of this — the duel emits ordinary ratings.

**The duel's slider ends are the two options, not the criterion's poles**, and the direction is pinned twice over. `input[type=range]` inside `dir="rtl"` flips in Chrome and Firefox and historically did not in Safari, so the input carries an explicit `dir="ltr"` and positive always means the *first* option. The first option is also written **first in the DOM** so RTL places it on the right, under the slider's positive end — reverse either one and the live tally points opposite the handle the user is dragging. The criterion's `low`/`high` are not wasted; they carry into the Result breakdown.

**`::-webkit-slider-thumb` and its siblings are the exception to the never-hand-write-a-prefix rule.** That rule is about *properties*, where Lightning CSS drops the standard line if you write the prefixed one yourself. These are *selectors* for pseudo-elements that have no standard equivalent at all — they must be written by hand, once per engine, and the build leaves them alone. Inside the block, still write only standard properties.

**The frame is fetched on blur and tagged with the options it was built for.** `app/page.js` keys it (`framed.key === optionsKey`) and derives the usable frame at render, so editing an option silently retires the frame built for the old text instead of asking questions about a decision that no longer exists. The in-flight request lives in a ref, not state: pressing «احسمها لي» mid-flight awaits the same promise rather than starting a second call, and a ref causes no render. When the prefetch has landed, pressing goes straight to the first question with no waiting screen at all.

**`/api/decide` takes the frame, and that repair is not optional polish.** It builds its answer lines by looking each answer's key up among the template's questions — and generated keys never appear among a *static* category's questions, so once the picker went the model started reading `- where_will_you_eat: on_the_go` instead of `- وين بتاكل؟ ← وأنا ماشي`. Nothing broke, because the generated keys happen to be readable English, which is exactly why it could have gone unnoticed. Passing the frame restores the Arabic the model wrote itself. `categoryId` is still accepted for the paths not yet migrated — `VoiceMode` is the one that still sends it.

**The four depth fields are additive and never fatal.** `decisive_criterion`, `edge`, `cost_of_switching` and `flip_condition` are required in the *schema* so the model reliably produces them, and optional in `depth()` so a miss costs one card rather than the whole verdict. `decisive_criterion` is dropped unless it names a real criterion — without a frame there is nothing to check it against, so it is dropped wholesale rather than trusted. `flip_condition` is the one that earns its tokens: it hands the user a rule they can reuse without the app.

**Throttling from Gemini surfaces as a 502, and it will lie to a test harness.** The route maps `AbortError` to 504 and everything else to 502, so an upstream rate-limit is indistinguishable from a bad model response. A burst of route tests produced 502s that moved between cases on every run and passed in isolation — `test-decide-depth.mjs` therefore paces its calls. When a route test fails only at the tail of a burst, suspect the quota before the code.

**The third question is generated while the second is on screen.** The frame's tree covers question two; question three is a second call (`refine` mode on `/api/frame`) fired the moment question two renders, for the three answers to *that* question only — three branches, not nine. The user spends the call reading, so it lands in about 3s and the question then costs zero network. It is optional in the strongest sense: failure returns `{ok: true, deeper: null}`, the flow shows two questions and moves to ratings, and nothing tells the user anything — they never asked for a third question. The request sends criteria keys, the answered question and the shown question rather than the whole frame, because every input token is latency.

**Anything grafted onto the frame after it is built goes onto the frame object, not beside it.** `withRefinement()` returns a new frame carrying `deeper`, so `pathQuestions`, `pathAnswers`, `/api/decide` and `saveDecision` all keep reading one object and none of them learns that a second call exists. The same stand-in rule applies at level three as at level two, and for the same reason.

**A guard ref must be released when its request is aborted.** The refine effect marks its key before fetching so a re-render cannot double-fire it — but the cleanup aborts in-flight work, and without clearing the key on an unsettled abort the guard would lock the door behind itself and no later attempt could ever run. StrictMode's double-mount is the case that makes this bite.

## The design language: aurora, glass, and ink

Tokens live in `app/globals.css`; the shared kit is `app/components/ui.js`. The login/signup screen (`AuthPanel`) is the one holdout — it paints opaque literal colours inline and keeps its own full-bleed split.

**Three rules carry the whole system.** *The page is a lit surface, not a sheet* — `Aurora` paints two fixed layers behind everything: four blurred colour blobs drifting over the parchment (`--background`), and a 6% grain. *Work happens on glass* — panels are translucent white (`--card`) plus a `.glass` / `.glass-deep` backdrop blur, sunken blocks are ink at 5% (`--card-sunken`), and `Field`s stay underlines rather than boxes. *Ink is where judgment happens* — the same dark surface delivers the solo result, the group verdict, the patterns reading, the analyze conclusion, and the breakdown ruling; the hero's verdict card uses `.ink-glass`, the translucent form of it. Anything selected or confirmed fills with **ink**, not colour, so the one gradient action per screen (`.action`) never competes with itself. `Choice`, `OutcomeAsk`, and question rows all follow this.

**Glass is only legible because nothing sharp sits behind it.** The backdrop is four 40px-blurred blobs and low-opacity noise, so 62% white is enough to carry body text without the blur doing any work. Put an image, a photo, or text behind a glass panel and that guarantee is gone.

**Mood lives in `MoodProvider` at the root layout, never in a page.** `useMoodTheme` deletes `data-mood` on unmount, so when the state lived in `app/page.js` navigating away actively *stripped* the colour rather than merely failing to apply it — plan/analyze/vote were never themed. The provider mounts above the router, so every route inherits it. Mood is tagged with the account that owns it and derived at render (sign-out drops it without a setState-in-effect). Settings previews via `setPreview` from the click handler, with `undefined` = no preview and `null` = previewing «بدون» — a bare `??` collapses those two and shows the saved colour instead of clearing it.

**Named mood tokens** (`--mood-default`, `--mood-hyped`, …) are the single source for the five accents; each `:root[data-mood=…]` block consumes its own. A mood block now also swaps the four aurora blobs (`--mesh-1…4`, RGB triples) and the five gradient stops (`--grad-a…e`). Everything gradient in the app — the action button, the hero headline, the step numerals, the feature badges — is *built from those stops*, never from a literal hex, which is the only reason the primary action still changes with mood. Mood tints the paper slightly and swaps the colour family; the aurora/glass/ink identity stays fixed so a mood change never reads as a different product.

**The aurora and grain mount once, in the root layout.** Both layers are `position: fixed`, so a page-level mount would vanish on navigation — the same reason mood lives at the root. `Aurora` is a plain server component (all colour comes from CSS variables), so it ships inside the first HTML.

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
- **A full-bleed element that is rotated or scaled overflows the page — unless it is `position: fixed`.** The old tilted marquee was `-rotate-1 scale-[1.02]`, which made its box 931px wide in a 912px viewport and gave the whole landing page a horizontal scrollbar into blank space; it needed a wrapper with `overflow-hidden` **plus vertical padding**, because `overflow-hidden` clips against the *layout* box and transforms never enter layout. The aurora scales to 1.15 and is inset -15% with no wrapper at all: fixed-position boxes are excluded from the document's scrollable overflow, so they cannot create a scrollbar. Nothing looks wrong until you scroll sideways, so this hides easily either way — to check for a regression, `document.documentElement.scrollWidth` must equal `clientWidth`.
- **Never hand-write a `-webkit-` prefix — Lightning CSS drops the standard property when you do.** Writing `backdrop-filter` followed by `-webkit-backdrop-filter` compiled to *only* the `-webkit-` line, so every glass surface silently rendered unblurred in Chrome; computed `backdrop-filter` read `none` while the class was plainly on the element. Write the standard property alone and let the build add prefixes (it does this correctly for `background-clip: text`, among others).
- **`--background` is now lighter than `--card`, so `bg-background` no longer reads as sunken.** Nested blocks that want to recede take `bg-card-sunken` (ink at 5%); `bg-background/60` inside a glass card makes the block look *raised* instead.
- **Supabase `generateLink(type:"magiclink")` silently CREATES the account for unknown emails.** For login links use `type:"recovery"` (requires existing user; a recovery session is a full login). `type:"signup"` correctly errors with `email_exists`.
- **Times shown to users are computed in the user's IANA timezone from the browser**, never server time (3-hour Riyadh/UTC skew bites otherwise; `lib/insight/stats.js` drops the stat entirely on an invalid zone rather than lying).
- **Emails are inline table-HTML** — clients ignore external CSS and flex. Two of them, and they are edited in different places: the **signup verification email is a stored Mailtrap template** (UUID `28bf46a1-…` lives in `app/api/signup/route.js`, edited in Mailtrap's UI, variable `{{confirmation_url}}`), while the **magic-link email is inline HTML in `app/api/magic-link/route.js`**. Both carry the ink/parchment palette. **Almarai is requested three ways** — `<link>`, `@import` inside `<style>`, and inline `font-family` on the heading — because clients honour different ones; measured in Mailtrap's preview, the `<link>` alone did *not* load it and the `@import` did. Gmail and Outlook strip webfonts regardless and fall back to Tahoma; that is accepted, colour and layout still arrive. The Mailtrap token must be Account-Admin scoped (sandbox tokens 401 on live send).
- **Response caches are in-process Maps with normalized+sorted, version-prefixed keys** (`third`, and a 24h verdict cache in `group`) — bump the version string whenever a prompt/contract changes, or stale-shaped entries get served. The similar-looking `hits` Maps in other routes are rate limiters, not caches.
- **A11y patterns to preserve:** step headings get `tabIndex={-1} data-step-heading` (page.js moves focus on step change; self-managed flows like `BreakdownFlow` focus their own headings), `useScreenAnnounce` for spoken results (the duel debounces it — announcing every slider pixel buries the previous line), real `radiogroup`/`radio` roles on choice lists, and `aria-valuetext` in words rather than a bare number on the duel handles.
- **`app/page.js` renders `Thinking` and `Result` outside the glass `Card`** — both bring their own ink surface, and nesting them in a card would double-frame the verdict.

## Where the shared pieces live

| Concern | File |
| --- | --- |
| Design tokens, mood themes, aurora/glass/gradient classes, `.display`, splash/reveal keyframes | `app/globals.css` |
| Buttons, `Field`, `Card`/`InkCard`, `Choice`, `Progress`, `hindi` | `app/components/ui.js` |
| App-wide mood state + `data-mood` | `lib/theme/MoodProvider.js` (mounted in `app/layout.js`) |
| Low-level `data-mood` writer — call it **only** from the provider | `lib/theme/useMoodTheme.js` |
| Arabic-Indic digit conversion (UI *and* model output) | `lib/text/digits.js` |
| Per-route request caps (`createLimiter`, `clientIp`) | `lib/rate-limit.js` |
| Arabic normalization for matching | `lib/voice/match.js` (`normalizeArabic`) |
| Generated-frame contract, `shapeFrame`, `frameToCategory` | `lib/engine/frame.js` (+ `test-frame-shape.mjs`) |
| Two-option duel: handle↔ratings table, `withPriors` | `lib/engine/duel.js` (+ `test-duel.mjs`), `app/components/Duel.js` |
| Depth fields on the verdict (`decisive_criterion`, `flip_condition`, …) | `app/api/decide/route.js` `depth()` (+ `test-decide-depth.mjs`) |
| Opening screen, scroll reveal | `app/components/Splash.js`, `Reveal.js` |
| Fixed aurora + grain layers (mounted in `app/layout.js`) | `app/components/Aurora.js` |

## Git workflow (as actually practiced)

Branch per change (`feat/…`, `fix/…`, `docs/…`, `design/…`) from fresh `main`; commit and push the branch. **Do not open PRs unprompted** — Yazeed opens and merges them (he says "i merged it"; then sync main, delete the local branch, prune). Commit messages explain why, in prose. `.env.local` never leaves the machine; all keys are server-side (env var table in the README).
