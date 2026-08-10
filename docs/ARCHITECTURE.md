# Architecture — Quran Quiz Platform

Audit date: 2026-08-10 · Base: QuizCast frontend (fork, repo `quran-quiz2`)

This document captures the **current** state of the codebase, the **actual** Supabase schema it must eventually serve, and the **proposed** architecture. It is the source of truth for the phased implementation plan.

---

## 1. Executive summary

The repo is the **QuizCast Frontend** (package `quizcast-website`): a working, but demo-grade, single-page host-vs-participant live quiz app. It builds cleanly (`npm run build` passes) and has no tests, no lint, no TypeScript, no CI.

Its architecture orients on an **external FastAPI backend** (`NEXT_PUBLIC_BACKEND_URL`) that owns auth, quiz persistence, join and scoring — the frontend only calls Supabase for **realtime broadcast** (game start signal), **postgres_changes** (leaderboard) and **storage** (avatars).

The linked Supabase project (reachable via the `supabase` MCP tools) already contains a **purpose-built schema** for this product — `competitions`, `participants`, `questions`, `choices`, `answers`, `admin_keys` — with Quran fields (`surah_number`, `ayah_number`, `juz_number`, …) baked into `questions`. But the schema is a **locked shell**:

- RLS enabled on every table with **zero policies** (no client can read or write anything)
- **No realtime publications** (no postgres_changes subscription can work)
- **No storage bucket**, no edge functions, no tracked migrations
- **0 Supabase Auth users**; the frontend never uses Supabase Auth

So the path is: keep the working product flow, re-architect it onto **Supabase-only** (Auth + DB + Realtime + Storage), supply the missing migrations/policies/publications, and rebuild the UI to a professional multi-route application.

---

## 2. Current architecture (as found)

### 2.1 Stack

| Layer | Choice | Version | Notes |
|---|---|---|---|
| Framework | Next.js (App Router) | 15.0.3 | effectively a SPA; only `layout.js` + `page.js` |
| React | react | ^18.2.0 | `use` import in NavBar is a React 19 API — dead import |
| Language | Plain JS/JSX | — | no TS, no tsconfig |
| State | Redux Toolkit + redux-persist | ^2.5.0 / ^6.0.0 | persisted to localStorage, `serializableCheck: false` |
| Styling | Tailwind CSS 3 + Flowbite (`flowbite-react`) | ^3.4.1 / ^0.10.2 | plugin + content globs configured |
| Supabase client | @supabase/supabase-js | ^2.47.3 | anon key, client-side only |
| Icons | `react-icons` (`react-icons/fa`) | — | **not a direct dependency**; resolves transitively via flowbite-react |
| Backend | External REST API (FastAPI-style) | — | not in this repo; cannot be deployed here |

### 2.2 Repository structure

```
src/
├── app/
│   ├── layout.js              # "use client"; Redux Provider + PersistGate; fonts
│   ├── page.js                # THE single page: two-pane layout + string-switch "router"
│   ├── hooks/
│   │   └── useSupabase.jsx    # creates a new supabase client on every call
│   └── components/
│       ├── API/index.jsx      # backend endpoint paths (typos kept: joinQiuz, getQuizHistory)
│       ├── LeftPane/          # Welcome, LeaderBoard
│       ├── RightPane/         # Join, Login, SignUp, RoomKey, ReceiveMsg, BroadCast,
│       │                      #   AvailableQuiz, NavBar, UserSession, Profile, AboutUs
│       │   ├── Questions/     # Qsettings, EnteredQuiz (question builder)
│       │   └── Session/       # Qdisplay (student answer screen)
│       └── Notification/      # ErrorNotify, SuccessNotify (10 s auto-dismiss toasts)
├── store/
│   ├── index.js               # persistReducer → localStorage
│   └── Slices/                # user, room_key, participant, leaderBoard
└── styles/global.css          # Tailwind + custom .border-2/bg-glass/circles animations
```

### 2.3 Current flow (host)

1. `Join` → choose role → `Login` (POST `${BACKEND}/authentication/login`) → user object (incl. `access_token`) saved to Redux → persisted.
2. `Qsettings`: choose question count (1–10) and seconds/question (5–60). Local state only.
3. `EnteredQuiz`: hand-built question form (4 options + one "correct" radio, per-question inline validation). Submit → POST `/quiz/addQuestions` → backend returns `room_key` → Redux `room_key`.
4. `BroadCast`: shows join code + Copy; **Start Quiz** sends a Supabase **broadcast** `{event:"cursor-pos", payload:{message:"Start"}}` on channel named `room_key`; **Delete Room** → DELETE `/quiz/deleteRoom`.
5. Left pane `LeaderBoard` subscribes `postgres_changes` on `NEXT_PUBLIC_DB_TABLE` (INSERT/UPDATE), filters `payload.new.room_key !== parseInt(room_key)` client-side.

### 2.4 Current flow (participant)

1. `Join` → `RoomKey`: enter name + code → POST `/quiz/join` → returns `{id, room_key, questions}` → Redux `participant` + `Questions` (wrapped in `[payload]`).
2. `ReceiveMsg`: subscribes broadcast on channel `room_key`; on `"Start"` → `Qdisplay`.
3. `Qdisplay`: client-side `setInterval` countdown from `question.time`; on submit/auto-timeout → PUT `/quiz/updateScore` with full `{id, room_key, name, score:newScore}`; score = `isCorrect ? round(100*(1-timeTaken/totalTime)) : 0`. Shows per-question correct/incorrect colors, then a final score screen. No leaderboard ranking for the student; host sees DB-triggered leaderboard.

### 2.5 Realtime implementation (current)

- **Broadcast** (host→students, one-way, unacknowledged): channel name = room key string, event `"cursor-pos"`.
- **Postgres Changes** (leaderboard): table from `NEXT_PUBLIC_DB_TABLE`, all events, client-side filter.
- **No Presence**, no reconnect handling, no resubscribe/backoff, no duplicate-event dedup, no channel cleanup on logout (only on unmount).

### 2.6 Authentication (current)

- Email/password against the **external backend**; response stored verbatim in Redux (incl. `access_token`) → **localStorage** via redux-persist.
- Logout = clear slice. **No session validation on reload, no expiry, no refresh, no protected routes, no roles.** Stale localStorage revives dead sessions.
- Supabase Auth exists in the project (auth schema present) but is unused (0 users).

### 2.7 Environment variables (required today)

All `NEXT_PUBLIC_*` (browser-visible), read directly in client components:

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase publishable anon key |
| `NEXT_PUBLIC_SUPABASE_BUCKET` | storage bucket for avatars |
| `NEXT_PUBLIC_BACKEND_URL` | external REST backend (to be retired) |
| `NEXT_PUBLIC_DB_TABLE` | table for leaderboard postgres_changes (to be retired) |

---

## 3. Actual Supabase schema (audited via MCP)

All tables `public`, all RLS enabled, **no policies**, no publication, no bucket, no migrations file. Row counts: `competitions` 2, `participants` 8 (dev data — do not delete).

### competitions — game + quiz lifecycle
`id uuid PK`, `code text UNIQUE`, `name`, `description?`, `status` (`draft|scheduled|waiting|running|paused|finished|cancelled`), `scheduled_at?`, `started_at?`, `finished_at?`, `paused_seconds float8`, `default_points int (=10)`, `default_negative_points int (=-2)`, `speed_bonus_enabled bool`, `created_at`, `updated_at`.
FKs: participants, questions, answers → `competition_id`.

> **Missing for the product:** no `owner_id` (host), no quiz-library separation from live games, no visibility/archive, no cover image, no language/category/difficulty.

### participants
`id uuid PK`, `competition_id fk`, `display_name` (len 2–50 enforced), `first_name?`, `last_name?`, `participant_code UNIQUE`, `access_token UNIQUE`, `connected bool`, `joined_at`, `last_seen_at?`, `status` (default `joined`).

> Anonymous joiners get a server-issued token — no Supabase Auth needed to play. Good design; reused.

### questions
`id uuid PK`, `competition_id fk`, `position ≥ 1`, `text`, `type` (`mcq|true_false|text|number|audio`), `duration_seconds` (1–600, default 15), `points?`, `negative_points?` (≤ 0), `explanation?`, `correct_answer_text?`, `audio_url?`, `started_at?`, `ends_at?`, `created_at`.
**Quran fields:** `surah_number` (1–114), `ayah_number`, `page_number`, `juz_number` (1–30), `hizb_number` (1–60) — all nullable.

### choices
`id uuid PK`, `question_id fk`, `text`, `position ≥ 1`, `is_correct bool` (default false).

### answers
`id uuid PK`, `competition_id fk`, `question_id fk`, `participant_id fk`, `choice_id?`, `answer_text?`, `submitted_at`, `response_time_ms int`, `is_correct bool`, `points float8 (=0)`, `bonus_points float8 (=0)`.

### admin_keys
`id uuid PK`, `key_hash UNIQUE`, `label?`, `created_at` — **admin is authenticated by hashed API keys, not by a role column.** The frontend must never know the raw key (no `admin_keys` access from client; admin screens call a server/edge function or use a key the operator pastes into a server-side-only env var).

---

## 4. Proposed architecture

### 4.1 High-level decisions

1. **Retire the external backend.** `NEXT_PUBLIC_BACKEND_URL` endpoints (login/signup/addQuestions/join/updateScore) have no deployable code in this repo. Replace with Supabase Auth + DB + Realtime + Storage. Feature-parity is achievable with the existing schema + the migrations in §6.
2. **Keep the stack.** Next.js 15 App Router + React 18 + Tailwind + Flowbite + Redux (for persisted UI/session state). No new heavy deps. `flowbite-react` is already a dependency; use it as the primary component source, and pin `react-icons` as a direct dependency (currently transitive).
3. **Introduce TypeScript incrementally** (rule 48 allows staged change; user requires strict TS). New code typed; files migrated directory-by-directory (`lib/`, `services/`, `types/` first), `tsconfig` strict, build verified after each batch. Keep runtime versions unchanged.
4. **Routing: real routes** under App Router replacing the string-switch router, per §7. Keep old component logic by porting, not re-writing from scratch.
5. **Realtime model**
   - **Game/state sync:** single source of truth = `competitions.status` + `questions.started_at/ends_at` (authoritative, server timestamps). Host `UPDATE`s status; everyone subscribes `postgres_changes` filtered `WHERE competition_id = '<uuid>'` (needs table-level publication).
   - **Lobby presence:** Realtime **Presence** on channel `game:{code}` + `participants.connected`/`last_seen_at` writes.
   - **Answers/scoring:** client only inserts a raw selection (`answers.choice_id`/`answer_text`, `response_time_ms` computed on client); `is_correct`, `points`, `bonus_points` are computed **server-side** (RLS + `security definer` function) — students can never write their own score.
   - Robustness requirements: reconnect/backoff (supabase-js v2 reconnects transport; we still handle stale channel state, refetch-on-subscribe, dedup by `answer_id`, cleanup on unmount, single shared client via `lib/supabase/client.ts` instead of a client-per-call hook).

### 4.2 Target structure

```
src/
├── app/
│   ├── (public)/                 # /, /about, /join/[...code]
│   ├── (auth)/login, (auth)/register
│   ├── (host)/dashboard, quizzes/[id]/edit, games/[id], analytics, students
│   ├── (student)/dashboard, history, profile
│   └── game/[code]/lobby|question|result|leaderboard   # live game (both roles)
├── components/ui/                # Button, Input, Dialog, Toast, Skeleton, EmptyState, Badge…
├── components/game/              # Timer, GameLobby, QuestionStage, Leaderboard, Podium
├── components/quiz/              # QuizEditor, QuestionEditor, QuestionCard, QuizCard
├── features/…/hooks/             # useGameRealtime, usePresence, useAuthSession, useCompetition
├── lib/supabase/{client,server,types}.ts
├── services/                     # quizzes, games, participants, answers, analytics
├── store/Slices/                 # keep: user(session), participant; drop room_key/leaderBoard → derived from game hooks
├── types/                        # Competition, Question, Choice, Participant, Answer, GameState
├── styles/                       # tokens.css (design system), global.css slimmed
└── i18n/                         # en/ar/fr dictionaries, RTL helper
supabase/migrations/              # all DDL as versioned SQL (see §6)
docs/{ARCHITECTURE,SECURITY}.md
.env.example
```

### 4.3 Auth flow (proposed)

- **Hosts/registered students:** Supabase Auth (email/password). `auth.users` → public `profiles` table (`id → auth.uid()`, `name`, `role` check `host|student`, `avatar_url`). RLS: users manage own profile.
- **Players in a game:** anonymous via `participants` (server-issued `access_token` returned by a `create participant` RPC/policy) — no signup required to play.
- **Admin:** `admin_keys` (hashed). Admin surface is thin (moderation/audit); client uses a **server-only** route/edge function so the raw key never reaches the browser. If an edge function isn't deployed, the admin screens are gated behind an env-var-checked server action.
- **Route protection:** `middleware.ts` (or server layout checks) redirect unauthenticated users; role checks per segment (`(host)` requires `profiles.role = host`).

### 4.4 Game state machine (proposed, matches schema)

`waiting` (lobby) → `running` (loop: question `started_at`/`ends_at` per question) → `finished` → host may `cancel` anytime → `cancelled`; long-lived quizzes can be `draft`/`scheduled`. Host is authoritative: only `competitions` owner can mutate `status` (RLS `owner_id = auth.uid()` policy).

### 4.5 Scoring (proposed, server-side)

Per `questions.points`/`negative_points`/`speed_bonus_enabled` + `answers.response_time_ms`, computed by an RLS-guarded `security definer` function at insert time. Client sends only `choice_id/answer_text` + `submitted_at`. Leaderboard = `SELECT` over `answers` (no separate leaderboard table needed; the current frontend's `NEXT_PUBLIC_DB_TABLE` contract goes away).

---

## 5. Repository conventions (preserve)

- `@/*` alias → `./src/*` (jsconfig.json; tsconfig must mirror it).
- Tailwind content globs include `node_modules/flowbite/**/*.js`; custom `custom: 1036px` breakpoint exists.
- Redux persist + `serializableCheck: false` — keep for session/participant state; don't persist transient game state.
- Flowbite React 0.10 (older API surface; `Flowbite` component wrappers vs new primitives differ — verify against installed version).
- `npm run build` currently passes; it is the only reliable quality gate until tooling is added.

---

## 6. Required Supabase migrations (to implement, in order)

All new DDL will be added versioned under `supabase/migrations/` **before** frontend features that depend on them. Identified, not yet executed:

1. `profiles` table + trigger on `auth.users` insert (name, role `host|student` check, avatar_url) + RLS (self + admin).
2. `competitions` additions: `owner_id uuid` FK → `profiles(id)` (or `auth.users`), `visibility`, `cover_url`, `language`, `category`, `difficulty`, `archived_at?` — RLS: owner CRUD; join via `participants` policy.
3. Publications for realtime: `supabase_realtime` on `competitions`, `participants`, `answers` (private per-table filters).
4. RLS policies across all six tables (anon can create/update only their own `participant`/`answer` rows; nobody writes `answers.is_correct/points`; owner-only game-state writes).
5. Storage bucket (avatars/quiz covers) + policies (`auth.uid()` owns uploads; public read).
6. Indexes: `answers(competition_id)`, `answers(participant_id)`, `questions(competition_id, position)`, `participants(competition_id)`.
7. (Optional) Edge functions: `admin` endpoints (uses `admin_keys`), QR/join resolver if needed.
8. Seed/none — no destructive ops; existing 2 competitions / 8 participants dev rows stay untouched.

> No migration is applied during this audit. Each will be presented with its SQL, reviewed by owner, then applied via MCP + committed to `supabase/migrations/`.

---

## 7. Target routes (see product spec §6)

Public `/`, `/about`, `/join` (+`/join/[code]`), `/(auth)/login`, `/(auth)/register`
Host `/(host)/dashboard`, `/quizzes` (+`/new`, `/[id]/edit`, `preview`), `/games/[id]` (lobby+control), `/analytics`, `/students`
Student `/(student)/dashboard`, `/history`, `/profile`
Game (both) `/game/[code]/lobby`, `/question`, `/result`, `/leaderboard`
Admin `/admin/*` (users/quizzes/games/analytics/settings — thin, key-gated)

Mapping from current SPA: Join→`/join`, Login→`/login`, SignUp→`/register`, RoomKey→`/join`, ReceiveMsg→`/game/[code]/lobby`, Qdisplay→`/game/[code]/question`, BroadCast/AvailableQuiz→`/(host)/games` + `quizzes`, LeaderBoard→`/game/[code]/leaderboard`.

---

## 8. Known issues / bugs (current code)

| # | Where | Issue |
|---|---|---|
| 1 | `Profile.jsx:63` | avatar filename built with `user.id`; backend user uses `user_id` → `undefined_avatar_…` paths |
| 2 | `NavBar.jsx:1` | `import { use } from "react"` — React 19 API, undefined on 18.2 (dead import) |
| 3 | `SuccessNotify.jsx` | renders `errorMsg` (undefined prop) + stray `{errorMsg}` span before `successMsg` |
| 4 | `page.js` | `renderLeftComponent` default returns `null` → blank left pane possible; no error boundary |
| 5 | `LeaderBoard.jsx` | no initial fetch of participants — empty until first event; `parseInt(room_key)` breaks if code non-numeric |
| 6 | `RoomKey.jsx` | duplicate submits, `catch` swallows errors (console only); join failures leave stale Redux state |
| 7 | `Qdisplay.jsx` | client-side timer manipulable; reads `questions[0][…]` (fragile `[payload]` wrap in participant slice); name-shadowing `questions` selector; `handleSubmitAnswer` referenced in effect body before declaration (works only because effect runs post-render — TDZ footgun) |
| 8 | `BroadCast.jsx` | `channel.send` fired inside subscribe callback; no ack; Delete Room button is a `type="submit"` inside the same form as Start |
| 9 | `store` | `access_token` + full user object persisted to localStorage: XSS-exposed credential; no expiry/refresh; schema changes strand stale states |
| 10 | a11y | multiple `<a>`/`<li>` used as buttons without `href`/`role`/keyboard support; many unlabeled controls; error messages rely on color |
| 11 | `useSupabase.jsx` | new client per call (perf/leak surface); no single shared instance |
| 12 | Realtime | broadcast never reconnects silently (ReceiveMsg has no resubscribe); host side never unsubscribes its publish channel; event dedup missing |

## 9. Technical debt

- String-literal "router" prevents deep-linking/refresh/sharing — replaced by real routes.
- Duplicated Tailwind class soup for forms/buttons across Login/SignUp/RoomKey/EnteredQuiz (`border-2` shadow, purple glow) — replaced by the design system.
- Hand-rolled toast with countdown in two components — replaced by one Toast provider.
- Question builder fixed to 4 options, no types — replaced by typed QuestionEditor (mcq/true_false + optional Quran reference fields).
- No error/empty/loading states anywhere except Login spinner — audit & add throughout (rule: every async view).

## 10. Feature roadmap (phased)

0. ✅ Audit + ARCHITECTURE.md + AGENTS.md (this document)
1. Design system: tokens (light/dark), core UI kit (Button/Input/Dialog/Toast/Skeleton/EmptyState/Badge/Table), RTL-ready primitives
2. Routing + app shell + navigation (host/student/public segment groups), error boundary, metadata
3. TypeScript baseline: tsconfig strict, `types/`, `lib/supabase`, migrate `services` first
4. Supabase foundations: migrations §6 (profiles, ownership, RLS, publication, bucket, indexes) + `.env.example`
5. Auth: Supabase Auth login/register/guard, session restore (replaces backend login), roles host/student
6. Quiz management: quizzes list (search/filter/sort/pagination, archive/publish/duplicate/delete), QuizEditor, QuestionEditor (mcq/true_false, points, duration, explanation, Quran reference fields), preview
7. Live game host: create game from quiz (`competitions.code` 6-char), lobby (QR + copy code), start/next/reveal/finish controls, host question view
8. Live game student: join [code] (validate, nickname, token), presence lobby, question stage (authoritative timer, submit), per-question feedback
9. Leaderboard + results: podium, ranked list, per-question breakdown, host results, student own results (privacy)
10. Dashboards + analytics: host stats (avg score/accuracy, most-missed, response times), quiz analytics, student history/progress — computed from `answers` via queries/service layer
11. Classes/students (extensible: host-managed profiles/groups, minimal)
12. i18n: en/ar (RTL)/fr dictionaries + `dir` switching + locale-aware routing; Quran-typography-safe styling
13. Tests: unit (validation, scoring calc, game-state transitions), component, and E2E (host create→play; student join→answer→result) — Playwright; plus `lint` setup (eslint flat config + eslint-config-next) and a `typecheck` script (`tsc --noEmit`)
14. Performance: route-level code splitting, image optimization, subscription hygiene, query limits
15. Light PWA (manifest + icons) if warranted; QR join via existing lib
16. Security audit → `docs/SECURITY.md` (RLS review, token handling, admin key handling)
17. Render deployment: build/start scripts verified, README (setup, env, migrations, Realtime enablement, Render blueprint), final UI audit (loading/empty/error/success, dark, RTL, 360–1440px)

---

## 11. Risks & mitigations

- **Auth migration** removes the external backend: existing hosted users of the old app cannot be migrated (no access to that DB). Mitigation: fresh Supabase Auth accounts; document in README.
- **Old `updateScore` contract disappears** — the student score screen depends on it. Mitigation: server-side scoring replaces it; no feature loss.
- **Schema renames** (`room_key` → `competitions.code/competitions.id`): full refactor of room/leaderboard slices. Mitigated by service layer isolation; drop `NEXT_PUBLIC_DB_TABLE`.
- **Realtime on RLS tables**: publication + policies must ship together (migration #3/4) or realtime silently delivers nothing.
- **Scope**: everything above is staged; each phase ends with build (and later lint/typecheck/tests) green before the next begins.

---

## 12. Quality gates (per phase)

`npm install` → `npm run lint` (once eslint is added) → `npm run typecheck` (once tsconfig exists) → `npm run test` (once tests exist) → `npm run build`. Until tooling exists, `npm run build` is the mandatory gate. No invented commands; scripts are added to package.json as their toolchains land.

---

## 13. Phase progress log

### Phase 1 — Design system ✅ (2026-08-10)
- Added `src/styles/tokens.css`: light/dark CSS variables (media + `.dark` class), radii, shadows, motion tokens; `color-scheme`, `:focus-visible` base, `prefers-reduced-motion` handling, dialog/toast keyframes.
- `tailwind.config.js`: colors/fonts/radius/shadows bound to tokens (Geist fonts now actually applied via `fontFamily.sans`); removed dead `background`/`foreground` placeholders.
- Kit in `src/components/ui/`: `Button` (5 variants/3 sizes/loading/href→Link), `Input`, `Select`, `Textarea` (label+error+hint+aria), `Badge`, `Card`, `Skeleton`, `Spinner`, `EmptyState`, `Dialog` (focus trap/Escape/focus restore/scroll lock), `Toast` (provider + `useToast`, 4 variants, auto-dismiss), `ErrorBoundary` (retry), `src/lib/cn.js`.
- QA route `/design-system` renders and exercises the whole kit (serves as the visual audit surface).
- Root layout now server component (metadata, viewport) → client `Providers` (`providers.jsx`): Redux + persist + ErrorBoundary + Toast.

### Phase 2 — Routing + app shell ✅ (2026-08-10)
- Real App Router routes replacing the SPA string-router; deleted legacy `page.js` and the superseded panes (Login/SignUp/Join/RoomKey/ReceiveMsg/BroadCast/AvailableQuiz/NavBar/UserSession/AboutUs/Profile/Qsettings/EnteredQuiz/Qdisplay/Welcome + Notification toasts). Legacy kept: `API/index.jsx`, `LeftPane/LeaderBoard.jsx`, `hooks/useSupabase.jsx`.
- `(public)`: `/` landing (hero + role cards + how-it-works), `/about`, `/join` + `/join/[code]` (shared `JoinGameForm` → legacy join → `/game/[roomKey]`).
- `(auth)`: `/login`, `/register` (same legacy endpoints; new kit UI; success → `/host/games`).
- `host/` (real dir so URLs carry the prefix): `/host` → redirect `/host/games`; `/host/games` list (loading/empty/error states); `/host/quizzes/new` settings→editor flow; `/host/games/[roomKey]` control screen (copy code, Start broadcast, Delete w/ confirm dialog, legacy LeaderBoard panel) with `RequireUser` guard in layout.
- `game/`: `/game/[code]` lobby (broadcast listener, session-expired guard, mobile-first) and `/game/[code]/question` (ported timer/submit/feedback/result, better state handling, kit UI).
- `components/layout/AppHeader.jsx` (public/host variants, mobile menu, active states).
- Verified: build green (12 routes), all routes return 200, `/host` redirect payload confirmed.

### Phase 3 — TypeScript baseline ✅ (2026-08-10)
- Installed `typescript@5.9.3` (+ `@types/react@18`, `@types/react-dom@18`); added `npm run typecheck` → `tsc --noEmit` (strict tsconfig, includes `.next/types`).
- `tsconfig.json`: strict, bundler resolution, `@/*` → `./src/*` alias mirroring jsconfig, `incremental`.
- `src/types/database.ts`: typed mirror of the audited schema (Competition/Question incl. Quran fields/Choice/Participant/Answer/AdminKey/Profile and GamePhase).
- `src/lib/supabase/client.ts`: single lazily-created shared client + `isSupabaseConfigured()` guard (replaces per-call clients).
- `src/lib/cn.ts` migrated (first TS module; `cn.js` removed).
- Fixed invalid Next 15 page signatures (`game/[code]` and `game/[code]/question` destructured `code` instead of `params`) — caught by the new typecheck over generated `.next/types`.
- Gates green: `npm run typecheck` + `npm run build`.

### Phase 4 — Supabase foundations ✅ (2026-08-10)
- Migrations (all versioned in `supabase/migrations/`, applied via MCP, verified end-to-end via PostgREST smoke test):
  1. `20260810120000_profiles.sql` — `profiles` (role check `host|student`), auto-create trigger from `auth.users` `app_metadata` (never `raw_user_meta_data`), self-only RLS, role immutable.
  2. `20260810120100_competitions_extensions.sql` — `owner_id → profiles(id)`, `visibility`, `cover_url`, `language` (`en|ar|fr`), `category`, `difficulty`, `archived_at`, `updated_at` trigger.
  3. `20260810120200_rls_security.sql` — 19 RLS policies; identity via `X-Participant-Token` header (`participant_from_header`); server-side scoring trigger `grade_answer` (mcq/true_false/text/number, speed bonus, negative points, late-submission → 0); RPC surface `join_competition` / `submit_answer` (upsert, one answer per participant per question) / `get_question_reveal` (owner|participant only) / `game_leaderboard` (aggregates only); spoiler columns (`questions.correct_answer_text`, `choices.is_correct`) revoked from REST; direct INSERT/UPDATE on `answers`, INSERT on `participants` revoked; `admin_keys` fully client-locked.
  4. `20260810120300_realtime_publications.sql` — `supabase_realtime` on `competitions`, `questions`, `participants`, `answers` (NOT `choices`; realtime ignores column privileges).
  5. `20260810120400_storage_media_bucket.sql` — public bucket `media`; auth-write under `avatars/{uid}/`, `covers/{uid}/`; public read; own-file update/delete.
  6. `20260810120500_indexes.sql` (+ advisor cleanup `20260810120800_…`): dropped duplicates of pre-existing `idx_*`/unique constraints; added `answers(choice_id)`; kept `answers_participant_id_question_id_key` (pre-existing unique → ON CONFLICT target). Fixed `round(double precision, integer)` bug (42883) found by the smoke test (`20260810120700_…`).
  7. Advisor pass: `auth.uid()` → initplan subselects in policies; `set_updated_at` search_path pinned; unused `can_read_competition` helper dropped; `join_competition` returns friendly duplicate-name error (`23505`).
- `.env.example` added (gitignore negation); shared client `src/lib/supabase/client.ts` stored to `src/types` alignment.
- **Verified via anonymous PostgREST smoke test**: join → self-select → questions/choices visible only when `running` → submit (fast correct 10pt + 9.2 bonus; wrong −2; late 0; empty rejected) → direct answer write 401 → spoiler columns 401/400 → reveal locked to participant/owner → leaderboard aggregates → cleanup, fixtures (2 comps/8 participants) intact.
- Known/accepted advisor items: `multiple_permissive_policies` on questions/choices SELECT (owner ∪ participant — intentional) and unused-index INFO on new indexes (will be used once live).

### Phase 5 — Supabase Auth ✅ (2026-08-10)
- `src/lib/auth/server.ts`: service-role client (env-only, server-only) + `createUserAccount` (validates input, sets `app_metadata.role` — never client-asserted).
- `src/app/api/auth/register/route.ts`: POST signup route (role `host|student`, email/password validation, friendly errors, no secrets client-side).
- `src/lib/auth/client.ts`: `getProfile` (profiles lookup), `signInWithEmail`, `signOut`.
- `src/store/Slices/userSlice.js`: `user` + `status` (`checking|authenticated|anonymous`); only the public profile is persisted (Supabase owns the session).
- `AuthProvider` (session restore + `onAuthStateChange`, graceful when env unset), `RequireUser` with `role` prop (host layout guards `role="host"`), login → `signInWithPassword` + role-based redirect (invalid creds → friendly error), register → server route + auto sign-in.
- Verified: `/login` 200, `/api/auth/register` 400 on invalid input; full E2E signup blocked by missing local `SUPABASE_SERVICE_ROLE_KEY` (documented).

### Phase 6 — Quiz management ✅ (2026-08-10)
- DB (migrations `20260810120900_…`, `20260810121000_…`, `20260810121100_…`):
  - FK cascades: `questions`, `choices`, `participants`, `answers` (×4) → delete/duplicate quizzes via one call; `answers.choice_id → set null`.
  - Auto room code: `generate_competition_code()` + BEFORE INSERT trigger (8-char unambiguous alphabet, collision loop).
  - Owner-scoped library RPCs (single round trip): `list_my_quizzes` (with `question_count`/`participant_count`), `archive_quiz`, `duplicate_quiz` (snapshots questions+choices), plus editor RPCs `save_question` (atomic question+choices replace; rejects non-owners `42501`, empty text `22023`) and `get_question_full` (owner-only read of spoiler-hidden columns).
- Services: `src/services/quizzes.ts` (typed: list/create/get/update/delete/archive/duplicate, questions list, question save/fetch/delete, live games list, status transitions).
- UI (`src/components/quiz/`): `QuizLibrary` (search, duplicate, archive, delete w/ Dialog), `QuizCard`, `NewQuizForm` (create → editor redirect), `QuizEditor` (meta settings, question list w/ move/add/delete, `QuestionForm` for all 5 types incl. Quran reference fields, `QuestionPreview` student mock, one "Save changes" → sequential RPC persist with 23505 renumber retry, unsaved-changes guard).
- Routes: `/host/quizzes` (library; `/host` and NAV now point here), `/host/quizzes/new`, `/host/quizzes/[id]/edit`; `/host/games` rewritten to Supabase live-games list (`MyGames`); legacy `QuizBuilder.jsx` deleted.
- Verified: RPC E2E via role impersonation (owner saves/fetches; non-owner `42501`; validation `22023`; duplicate+archive+list counts correct; test data cleaned, fixtures intact); typecheck + build green; `/host/quizzes`, `/host/quizzes/new`, `/host/games` → 200.
- Advisory notes: definer-RPC WARNs are by design (each carries an internal `auth.uid()` owner guard).

### Phase 7 — Live game host ✅ (2026-08-10)
- DB (migration `20260810121200_game_lifecycle_rpcs.sql`): `save_question` now locked to `status='draft'` (launched games are immutable — snapshot safety); new owner-scoped RPCs `begin_question` (server timestamps: `started_at=now()`, `ends_at=now()+duration_seconds`; rejects not-active games `28000`, double-start `22023`) and `end_question` (early close, no-op once expired).
- `src/services/games.ts`: `getGameByCode` (owner/visible select by room code), `listGameQuestions` (safe columns + timing), `listParticipants`, `getHostQuestionFull` (definer RPC incl. correct answer for reveal panels), `beginQuestion`/`endQuestion`, `remainingMs`.
- `LiveGameControl.jsx` rewritten from the legacy broadcast backend to Supabase: loads game by code, realtime on `competitions` (status), `questions` (start/end → reveal auto-refresh), `participants` and `answers` (answered count); controls per phase (lobby start → active next/end-now/pause → resume → finish; cancel + delete dialogs); host question card with countdown, correct-answer reveal panel, question deck, players list with online dots.
- Quiz editor: "Launch live game" (draft only, needs ≥1 question, confirm dialog → `waiting` → control room); launched quizzes show a "Launched" badge and lock the Save button.
- Verified: `begin_question` E2E via role impersonation (draft→`28000`, running→timestamps `now`+7s, double-start→`22023`, end after expiry→no-op); delete-quiz cascade proven on live data; fixtures intact; typecheck + build green; `/host/games/[roomKey]` → 200.

### Phase 8 — Live game student ✅ (2026-08-10)
- DB (migration `20260810121300_student_game_support.sql`):
  - **Hardening fixes**: `get_question_reveal` now refuses participants while the window is open (`42501 'Question is still open'` — previously the correct answer leaked mid-question); `submit_answer` now **locks the first answer** per participant per question (ON CONFLICT DO NOTHING → returns the stored row) and rejects submissions before `started_at` (`28000 'Question is not open yet'`) — closes the re-submit-with-0ms speed-bonus exploit and pre-window answering.
  - New header-token RPCs: `my_participant` (session restore), `update_presence` (connected + `last_seen_at` heartbeat), `game_participant_count` (lobby count; aggregates only — participants never see each other's names, aggregates match the existing RLS model).
- `src/lib/supabase/participantClient.ts`: cached per-token client injecting `x-participant-token` via `global.headers` (supabase-js 2.47 has no per-request headers on queries).
- Services (`src/services/games.ts`): `joinGame` (RPC), `getMyParticipant`, `updatePresence`, `gameParticipantCount`, `listStudentQuestions`/`listChoices` (token-scoped REST — RLS keyed off the header), `submitAnswer`, `getMyAnswers`, `getReveal`, `getLeaderboard`.
- Join: `JoinGameForm` → `join_competition`; 8-char alnum codes, friendly `28000`/`22023` errors; participant slice reduced to the real identity (`id/competitionId/displayName/accessToken/code`), legacy `Questions`/`room` usage dropped.
- Lobby `/game/[code]`: session restore via `my_participant`, realtime `competitions` status (running → question, finished → result), 5s poll fallback (catches cancelled games RLS hides from anon), player-count badge, presence heartbeat.
- Question stage `/game/[code]/question`: server-authoritative timing only — active = `started_at ≤ now < ends_at` (250ms client tick, 8s poll + realtime `questions` updates); per-question feedback after the window closes (reveal RPC + own graded answer); text/number/mcq/true_false input; answer locked after first submit; paused/waiting overlays; auto-advance on next `begin_question`.
- Result `/game/[code]/result` (new): gates on `finished`, personal summary (score/correct/rank) + full ranked leaderboard with own row highlighted.
- Verified end-to-end via header-impersonated SQL (waiting→running→finished): pre-start submit `28000` (saved by the pre-start guard), questions hidden while waiting / visible while running, reveal-while-open `42501` / reveal-after-end OK, in-window text answer graded 10pts, late mcq graded 0, **resubmit returned the identical locked row**, presence/count/leaderboard correct, cascade cleanup done, fixtures (2 comps / 8 participants) intact. Typecheck + build green; `/join`, `/game/[code]`, `/game/[code]/question`, `/game/[code]/result` → 200.
- Known residual: timer uses client clock vs server timestamps (skew affects display only; grading is server-authoritative); `game_participant_count` polling in the lobby because anon RLS hides other players' rows from realtime.

### Phase 9 — Leaderboard + results ✅ (2026-08-10)
- DB (migration `20260810121400_game_question_stats.sql`): `game_question_stats(p_competition_id)` — owner-gated (`42501` for anyone else, anon denied at grant level) per-question `answered_count / correct_count / accuracy` for host results; students never see other players' per-question data.
- Host control room (`LiveGameControl.jsx`): live **Leaderboard** card in the side rail during lobby/active/paused phases (realtime-refreshed on every `answers` INSERT); on finish/cancel the main column swaps the question deck for a **Results** card — top-3 podium (gold/silver/bronze), full standings, and a per-question breakdown list with accuracy bars.
- Student result (`/game/[code]/result`): podium for the top 3 + full ranked list + new "Your answers" per-question breakdown (status/points/own answer text; skips shown) — privacy preserved (own rows only).
- Services: `getLeaderboard` typed as `LeaderboardRow[]`, added `getQuestionStats` + `QuestionStatRow`.
- Verified via role-impersonated SQL: owner stats return correct aggregates (1/1/100% and 0/0/0), authenticated non-owner `42501`, anon `42501` grant-level; fixtures intact; typecheck + build green; `/host/games/[roomKey]`, `/game/[code]/result` → 200 (podium on <3 players renders standings only).
- Unrelated auth advisory noticed: "Leaked password protection disabled" — optional Supabase Auth project toggle, not a code issue.

### Phase 10 — Analytics + dashboards ✅ (2026-08-10)
- DB (migration `20260810121500_analytics_history.sql`): `participants.profile_id` (FK + index) links a signed-in student to their anonymous game row; `join_competition(text, text, uuid default null)` — optional profile link validated against `auth.uid()` (`42501` on mismatch), now granted to `authenticated` too (fixes the signed-in student join bug where execution as `authenticated` hit revoked EXECUTE); `game_analytics(p_competition_id)` owner-`42501`-gated JSONB (avg score/accuracy, avg response time, top-5 most-missed questions) — no spoiler columns; `my_history()` — the signed-in user's own linked games (score/correct/answered/accuracy).
- Host `/host/analytics` (new): game picker chips over `listMyLiveGames`, per-game stat cards + most-missed list with accuracy badges; loading/empty/error/retry states.
- Student `/student/dashboard` + `/student/history` (new `student` segment + layout with `AppHeader variant="student"` + `RequireUser role="student"`): dashboard = games played/avg score/avg accuracy/best + recent 5; history = full table. JoinGameForm passes `profile_id` when a session exists so anonymous play gets attributed to the account.
- Verified via role-impersonated SQL: seeded a finished test game (2 questions, 4 choices, 3 players, 5 answers) — owner analytics math correct (60% accuracy, 3s avg response, most-missed = Hard q 2 wrong/33.3%/4s); non-owner `42501`; anon `my_history` grant-level denied; anon join links `null`; signed-in join links the uid; mismatched link `42501`; wrong `v_comp` type in the first applied migration caught by the join test and hot-fixed (`fix_join_competition_vcomp_type`); all test data cleaned up, fixtures intact (2 comps / 8 participants / 0 questions / 0 answers).
- Note: remote migration names on this project are `analytics_history_fix` + `fix_join_competition_vcomp_type`; the single local file is the consolidated intended migration.
- Typecheck + build green after `npm install` repair (installed `next` package was corrupted/invalid); `/host/analytics`, `/student/dashboard`, `/student/history` → 200 (static prerender).
- Known residual: anon players (no sign-in) can't build history — progress tracking needs an account; overview cards for "players/questions/answers" reflect the selected game only (no cross-game aggregation yet).

### Phase 11 — Classes ✅ (2026-08-10)
- DB (migration `20260810121600_classes.sql`): `classes` (owner FK, unique 8-char auto code identical alphabet/trigger pattern as competitions, archived_at) + `class_members` (composite PK → idempotent joins) + `competitions.class_id` (set null on class delete); RLS on both; `competitions_update_owner` extended so a quiz can only be attached to a class the owner owns.
- RPCs (definer, owner/member-guarded): `create_class`, `list_my_classes` (member + game counts), `archive_class`, `join_class` (idempotent, rejects archived with `28000`), `leave_class`, `remove_class_member`, `my_classes` (student view), `list_class_members`.
- Policy recursion fix: `classes_select_owner_or_member` references `class_members` and `class_members` policies reference `classes` → `42P17` infinite recursion. Broken via `is_class_member(uuid, uuid)` security-definer helper (needs `EXECUTE` granted to authenticated — policy expressions run as the query role).
- Frontend: `/host/classes` (create/archive/remove member dialogs, copy-code chip, member + game counts); `/student/classes` (join-by-code form with `28000` friendly error, leave); quiz editor Settings gains a Class select (loaded via `listMyClasses`, saved into `updateQuizMeta.class_id`); nav updated for both roles.
- Verified via role-impersonated SQL: host creates class (code `SBJ2S9YY`); student joins → `my_classes` 1/member_count 1; idempotent rejoin keeps 1; host attaches competition via RLS-policy-compliant update → `list_my_classes.game_count` 1; owner `list_class_members` shows the student; remove → 0; rejoin + leave → 0; archive → student join `28000`; anon denied `42501`; recursion/advisory fixed; test data cleaned, fixtures intact (2 comps / 8 participants / 0 questions / 0 answers / 0 profiles).
- Typecheck + build green; `/host/classes`, `/student/classes`, quiz editor route → 200. Advisors: only known by-design definer WARNs (+ pre-existing `admin_keys` INFO and leaked-password suggestion).

### Next phases
12. i18n → 13. Tests/lint → 14. Perf → 15. PWA → 16. Security audit → 17. Render deploy (see §10 roadmap).