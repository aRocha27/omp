# OMP Agent Guide

## Repository shape

- This repository has two independent pnpm projects: `app/` (React 19 + Vite) and `server/` (Node 20+ + Express + TypeScript + `mssql`). Install and run commands from the relevant directory; there is no root package script.
- Frontend entrypoint: `app/src/main.tsx`; backend entrypoint: `server/src/index.ts`; API listens on port `4000` by default and Vite proxies `/api` to it on port `5173`.
- Frontend data access goes through repository contracts in `app/src/services/`; do not couple UI code directly to fixtures or database/API details. Backend routes and SQL access live under `server/src/routes/` and `server/src/repositories/`.

## Source of truth

- Read `docs/CURRENT_STATUS.md` before making claims about what is implemented or verified.
- The existing database remains the system of record. Do not create or redesign a database, rename database objects, or add migrations unless explicitly requested. The existing `server/sql/001_order_audit_trail.sql` is an approved exception.
- For migrated behavior, inspect the relevant raw Access `.cls` files and `report.md`; treat the HTML prototype and diagrams as UI/derived references, not production data or proof of rules. Preserve unresolved legacy ambiguities instead of guessing.
- If SQL/view definitions, complete Access forms, database metadata, or business rules are missing, do not guess. Record the unknown or request the primary source.

## Development commands

Run these in `app/`:

```text
pnpm install --frozen-lockfile
pnpm dev
pnpm lint
pnpm typecheck
pnpm test                    # Vitest unit/component tests
pnpm test -- src/path.test.tsx  # focused Vitest test
pnpm build
pnpm build && pnpm test:e2e  # Playwright against vite preview
pnpm format:check
```

Run these in `server/`:

```text
pnpm install --frozen-lockfile
pnpm dev                     # tsx watch, loads .env if present
pnpm typecheck
pnpm test                    # Vitest + Supertest tests
pnpm test -- src/path.test.ts # focused Vitest test
pnpm build
pnpm format:check
```

- A practical verification order is `lint`, `typecheck`, focused/full `test`, then `build`; run app E2E after `build`.
- The current status documents known full-suite failures. Do not report the suite as green until those are fixed and rerun.

## Data and environment

- Copy/use `app/.env.example` and `server/.env.example`; never commit `.env` files, credentials, or production data.
- Outside Vitest, `VITE_DATA_MODE` defaults to `api`; set `VITE_DATA_MODE=mock` only for offline UI work. Vitest forces mock mode for deterministic tests.
- Clients use the HTTP repository in both data modes, so the Clients view needs the server even when other features use mock fixtures.
- Server tokenless authentication is development-only on loopback. A non-loopback `HOST` requires `ADMIN_API_TOKEN`; database profiles and ad-hoc connections are configured server-side.

## Implementation constraints

- Preserve confirmed Access behavior before modernizing UX. Translate workflows into domain operations; do not port VBA event-by-event or invent SQL/report formulas.
- Keep authorization and validation on the server for every mutation. Frontend role checks only control UX and are not security.
- Keep database credentials out of frontend code and use parameterized SQL; never concatenate untrusted input into queries.
- Preserve existing identifiers and business terminology while mapping database rows to explicit application types/DTOs. Keep mock fixtures deterministic and synthetic.
- Put business calculations in framework-independent domain code and add regression tests for meaningful fixes and confirmed rules. Update architecture/legacy documentation when a known ambiguity is resolved.
