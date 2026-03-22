# AGENTS

## Purpose
Working agreement for contributors and AI agents in this repository. Keep changes focused, minimal, and production-safe.

## Project essentials
- Stack: Vite + React + TypeScript + Tailwind.
- Main app code lives in `src/`.
- Supabase SQL migrations live in `supabase/migrations/`.

## Implementation rules
- Prefer small, targeted changes over broad refactors.
- Keep TypeScript types aligned with runtime behavior.
- Update docs only when behavior or workflow changes.

## Database change policy (required)
- Any database change **must** include a corresponding migration file in `supabase/migrations/`.
- This includes schema changes, constraints, indexes, RLS/policies, functions, triggers, and required data backfills.
- Do not merge DB-affecting code without the migration, to prevent drift between live database state and migration history.

## Verification before handoff
- Run `npm run lint`.
- Run `npm run build`.
