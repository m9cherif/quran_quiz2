# AGENTS.md

Quran Quiz Platform — rebuilt from the **QuizCast frontend** (package name `quizcast-website`; repo dir/remote still say `quran-quiz*`). A live multiplayer quiz app: host creates a game → students join by code → real-time question/answer rounds → leaderboard. Target: production-ready, Supabase-only, deployable on Render, Arabic/English/French.

## Commands

- `npm run dev` — dev server on http://localhost:3000
- `npm run build` — build gate; **must stay green after every change**.
- `npm run typecheck` — `tsc --noEmit` (strict tsconfig, incremental TS migration; runs on `.next/types` too).
- `npm start` — production server (Render start command).
- No tests or lint yet — eslint is not installed. `npm run lint` (`next lint`) is broken; do NOT invent other commands. Phase 13 adds eslint + tests.
- Deployed via Vercel badge in README; no CI workflows in the repo.

## Environment (required to run meaningfully)

`.env*` is gitignored; no `.env.local` ships. Config is read at runtime via `process.env.NEXT_PUBLIC_*` in client components:

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
NEXT_PUBLIC_SUPABASE_BUCKET      # storage bucket "media" for avatars + quiz covers (exists)
NEXT_PUBLIC_BACKEND_URL          # legacy external REST backend — being retired
NEXT_PUBLIC_DB_TABLE             # legacy leaderboard table — being retired
```

## Supabase project state (Phase 4 done, 2026-08-10)

- Schema: `profiles` (auth users, role `host|student`, auto-created by trigger from `app_metadata`) + `competitions` (now with `owner_id`, `visibility`, `cover_url`, `language`, `category`, `difficulty`, `archived_at`), `participants`, `questions`, `choices`, `answers`, `admin_keys`.
- **RLS active everywhere with 19 policies** (owner CRUD on own competitions/questions/choices; anonymous players identified via `participants.access_token` sent in the `X-Participant-Token` header; `answers.is_correct/points/bonus_points` are trigger-scored and client-unwritable; spoiler columns `questions.correct_answer_text` / `choices.is_correct` revoked from the REST API).
- Client-facing DB surface is RPC-only where it matters: `join_competition`, `submit_answer`, `get_question_reveal`, `game_leaderboard`. Direct inserts into `participants`/`answers` are revoked.
- Realtime publication `supabase_realtime` on `competitions`, `questions`, `participants`, `answers` (NOT `choices` — is_correct leak). Storage bucket `media` is public-read, auth-write under `avatars/{uid}/` and `covers/{uid}/`.
- Dev data intact (2 competitions, 8 participants) — never delete it; treat as fixtures.
- Every DB change goes through a versioned migration first (`supabase/migrations/YYYYMMDDHHMMSS_name.sql`), reviewed, applied via MCP, then committed. Never silently alter schema. Run `get_advisors` (security + performance) after DDL.

## Architecture (current → target)

- Next.js 15 App Router + React 18. Routing now real (Phase 2 done): `/` landing, `/about`, `/join` (+`/join/[code]`), `/login`, `/register`, `/host`, `/host/games` (+`/[roomKey]` live control), `/host/quizzes/new`, `/game/[code]` (lobby) + `/game/[code]/question`, plus `/design-system` (QA gallery).
- `src/components/ui/` = design-system kit (Button/Input/Select/Textarea/Badge/Card/Dialog/Toast/Skeleton/Spinner/EmptyState/ErrorBoundary), token-driven via `src/styles/tokens.css` (light/dark CSS vars; Tailwind colors bound in `tailwind.config.js`). Use these for ALL new UI; legacy `global.css` classes (`.border-2`, `bg-glass-1`, circles) are earmarked for removal.
- Legacy kept: `src/app/components/API/index.jsx` (backend paths), `src/app/components/LeftPane/LeaderBoard.jsx` (realtime leaderboard), `src/app/hooks/useSupabase.jsx` (fresh client per call). Providers live in `src/app/providers.jsx` (Redux + persist + Toast + ErrorBoundary).
- Redux Toolkit + redux-persist (localStorage, `serializableCheck: false`). Slices: `user`, `room_key`, `participant`, `leaderBoard`. Persisted session/participant state only — never transient game state. Stale localStorage causes weird states after schema changes.
- Legacy REST backend (FastAPI-style, not in this repo) owns auth/join/scoring → **being replaced by Supabase Auth + DB + RLS-scored answers + Realtime**. Endpoint paths live in `src/app/components/API/index.jsx` (typos preserved: `joinQiuz`, `getQuizHistory`).
- Realtime today: broadcast on channel named by room key (event `cursor-pos`) + `postgres_changes` on `NEXT_PUBLIC_DB_TABLE` filtered client-side via `parseInt`. Target: `competitions.status` + `questions.started_at/ends_at` (server timestamps) via filtered postgres_changes; Presence for lobby; answers scored server-side (RLS) — clients must never write `is_correct`/`points`.
- `useSupabase.jsx` builds a fresh client per call — replace with a single shared client (`lib/supabase/client.ts`).
- Import alias `@/*` → `./src/*` (jsconfig.json; tsconfig must mirror). Tailwind + Flowbite configured; `react-icons` is transitive via `flowbite-react` (pin it as a direct dep if you add icon usage).

## Conventions & standards

- Preserve working flow when porting (join → lobby → question → result); replace weak implementation rather than deleting features.
- Port to TypeScript incrementally (strict; no `any` without a documented reason). Verify `npm run build` after each batch.
- Every async view needs loading, empty, error, success states; error boundaries at route level; confirmation dialogs for destructive actions.
- UI: professional and consistent — design-system tokens + reusable components (Button/Input/Dialog/Toast/Skeleton/EmptyState), mobile-first (student screens prioritize 360–414px), light + dark mode, RTL-ready (Arabic primary), no giant glowing cards or purple gradients (legacy `global.css` animations are earmarked for removal).
- Auth: hosts/students via Supabase Auth (roles `host`/`student` via `profiles` table, RLS `auth.uid()`); players join games anonymously via `participants.access_token`; admin via `admin_keys` (hashed) — raw keys server-only, never in browser code. Never trust client-claimed roles.
- Security: no service-role keys in client code; no bypassing RLS from the frontend; users may not change scores, mark own answers correct, mutate game state, or touch others' rows.
- See `docs/ARCHITECTURE.md` for the full audit, known bugs, and the 17-phase plan. Follow its phase order; end each phase with a green build.