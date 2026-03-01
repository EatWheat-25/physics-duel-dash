# AGENTS.md

## Cursor Cloud specific instructions

### Overview
This is **A-Level Arena (BattleNerds)** — a real-time 1v1 competitive quiz game for A-Level students built with Vite + React + TypeScript + Tailwind CSS + shadcn-ui. The backend is entirely hosted on **Supabase** (cloud) — there are no local backend services to run.

### Services
| Service | How to run | Notes |
|---------|-----------|-------|
| Frontend (Vite dev server) | `npm run dev` | Runs on port **8080**. See `vite.config.ts`. |
| Supabase (backend) | N/A — cloud hosted | Credentials are hardcoded as fallbacks in `src/integrations/supabase/client.ts`. No `.env` file is needed for the frontend to function. |
| Edge Functions | Deployed to Supabase cloud | Located in `supabase/functions/`. Run locally via `supabase functions serve` if needed. |

### Key commands
- **Dev server:** `npm run dev` (port 8080)
- **Build:** `npm run build`
- **Lint:** `npm run lint` (ESLint 9 — note: the codebase has many pre-existing `no-explicit-any` errors)
- **Type check:** `npx tsc --noEmit` (passes cleanly)
- **Seed scripts:** `npm run seed:questions`, `npm run seed:real-questions`, etc. (require Supabase access)

### Gotchas
- The `rollup` dependency is overridden to `@rollup/wasm-node` in `package.json` — this is intentional for cross-platform compatibility.
- No automated test suite exists (no `test` script in `package.json`).
- ESLint exits with a non-zero status due to pre-existing lint errors; this is normal for this codebase.
- The Supabase anon key and URL are hardcoded in the client file, so the app works without environment variables.
