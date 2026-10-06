# CLAUDE.md

Read `PROJECT.md` first. It holds scope, architecture, data model, MCP tool spec, security rules, edge cases and the build plan. Do not build anything outside §1 "In scope" without asking.

## How to work in this repo

- Work phase by phase as listed in `PROJECT.md` §13. Finish the acceptance line of a phase before starting the next.
- Before touching `apps/api/src/db/schema.ts`, the token helpers, the MCP transport or the SSE stream, say what you plan to change and why. Those four areas are where mistakes cost the most.
- Run `pnpm typecheck && pnpm test` before reporting a task done. Report what was skipped, not only what was done.
- Keep messages and code plain. No new libraries for things under 50 lines.

## Subagents (`.claude/agents/`)

- `coder` (Sonnet 5.5): all implementation, backend and frontend.
- `debugger` (Opus 5.5): call it after two failed fix attempts, or for any bug in tokens, MCP transport, long-poll or SSE.
- `designer` (Opus 5.5): visual direction and screen specs before the coder builds UI (Phase 3). It writes `docs/design-direction.md`, no code.
- `security-reviewer` (Opus 5.5): read-only review against `PROJECT.md` §10 at the end of Phase 2 and Phase 5.

## Stack reminders

- `apps/web`: Vite + React + TypeScript + Tailwind, deployed on Netlify. Static only; all data via the API.
- `apps/api`: Node 20 + Express + TypeScript, deployed on Railway. Hosts REST, SSE and the MCP endpoint. Must stay a long-running process (long-poll up to 50 s).
- `packages/shared`: zod schemas, types, greeting and connect-prompt templates.
- Database: Postgres on Supabase through Drizzle. No Supabase Auth, no RLS, no client-side Supabase SDK.

## Things that must never happen

- Logging a token or a message body.
- Accepting a `room_id` from the client as proof of access. Resolve the seat from the token, derive the room from the seat.
- Parsing message text for approval decisions. Decisions come only from the approvals endpoint or `/approve` and `/decline` typed by the owner's human seat.
- Letting agent seats execute slash commands.
- Moving the MCP server into a serverless function.
