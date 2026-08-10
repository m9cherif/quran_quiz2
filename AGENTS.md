# AGENTS.md

QuizCast frontend: a live multiplayer quiz app (host creates quiz → participants join by room key → real-time leaderboard). Repo name says "quran-quiz2" but the package is `quizcast-website`; README covers QuizCast. It is a fork whose git remote still points to the placeholder `YOUR_USERNAME/quran-quiz-platform.git`.

## Commands

- `npm run dev` — dev server on http://localhost:3000
- `npm run build` / `npm start` — production
- **No tests and no typechecking exist** (plain JS, no TS config). Do not invent either.
- `npm run lint` (`next lint`) is broken: eslint is not installed and there is no eslint config. Don't rely on it.
- Deployed via Vercel (badge in README); no CI workflows in the repo.

## Environment (required to run meaningfully)

`.env*` is gitignored and no `.env.local` ships. The app reads all config at runtime via `process.env.NEXT_PUBLIC_*` directly in client components:

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
NEXT_PUBLIC_SUPABASE_BUCKET      # storage bucket for profile images
NEXT_PUBLIC_BACKEND_URL          # separate REST backend (not in this repo)
NEXT_PUBLIC_DB_TABLE             # Supabase table whose changes feed the leaderboard
```

Without these, `npm run dev` starts but auth, quizzes, and leaderboard fail at runtime.

## Architecture

- Next.js 15 **App Router**, but it's effectively a single-page client app: `src/app/page.js` is a two-pane layout that switches components via string state (`leftComponent`/`rightComponent`) — no routed pages beyond `layout.js`/`page.js`.
- Every component/hook is a `"use client"` file.
- Backend REST endpoints are centralized in `src/app/components/API/index.jsx` and called with `NEXT_PUBLIC_BACKEND_URL` as prefix. Note legacy typos in the keys, e.g. `joinQiuz`, `getQuizHistory` (trailing `/` is appended by callers).
- Redux Toolkit + redux-persist (localStorage, `serializableCheck: false`) in `src/store/index.js`; slices under `src/store/Slices/`: `user`, `room_key`, `participant`, `leaderBoard`. UI reads persisted state via `useSelector` — stale localStorage can cause weird states after schema changes.
- Real-time: `src/app/hooks/useSupabase.jsx` builds a fresh supabase client per call; `LeaderBoard.jsx` subscribes to `postgres_changes` on `NEXT_PUBLIC_DB_TABLE` filtered by `room_key` (compared with `parseInt`, and room keys are expected to be numeric).
- Import alias: `@/*` → `./src/*` (jsconfig.json).

## Gotchas

- `react-icons` (`react-icons/fa`) is imported but is **not** a direct dependency; it resolves transitively via `flowbite-react`. Don't "clean up" the import, and pin it as a direct dep if you add more icon usage.
- Tailwind + Flowbite are preconfigured (`tailwind.config.js` — flowbite plugin, custom `custom: 1036px` breakpoint). Flowbite JS is loaded from `node_modules` via content globs.
- Host quiz flow: `Qsettings` → `EnteredQuiz` posts `/quiz/addQuestions`; participants join via `RoomKey`; quiz JSON lives in the user slice under `Questions`.
- `next lint` aside, the repo is a single git commit ("Original QuizCast frontend") — there's no established branch/commit convention to follow.