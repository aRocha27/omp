# Paperfold (OMP) — Orders Management Platform

Paperfold is the public/demo build of OMP, a React/Vite frontend with a Node/Express + Microsoft SQL Server backend for order management, clients, invoicing, recognition, reports and administration.

The Docker image uses the **Paperfold Stationery Platform** brand for the public demo. The backend code is fully functional and can be wired to any SQL Server instance; the seed/fixture data is illustrative.

## Project Layout

- `app/`: React 19 frontend and Vite configuration.
- `server/`: Express API, SQL Server repositories, validation and SQL scripts.
- `docker/`: Docker Compose, deployment instructions and export scripts.
- `docs/`: architecture, current status, and development/security documentation.

## Local Development

Install dependencies independently in each project:

```text
cd app && pnpm install --frozen-lockfile
cd ../server && pnpm install --frozen-lockfile
```

Start the frontend and backend from their respective directories:

```text
cd app && pnpm dev
cd server && pnpm dev
```

The frontend runs on port `5173`. The API runs on port `4000` and uses SQL Server configured in `server/.env`. The frontend supports a mock data mode for offline UI work — set `VITE_DATA_MODE=mock` in `app/.env`.

## Docker

Copy the env template and edit the placeholders, then bring the stack up from the repository root:

```text
cp docker/deploy/server.env.example server/.env
docker compose -f docker/docker-compose.yml up -d --build
```

`http://localhost:5173/` serves the SPA. `http://localhost:5173/api/healthz` returns `{"ok":true}`. SQL Server remains external to Docker.

To create an image export without credentials:

```text
bash docker/scripts/export-docker.sh
```

The generated archive is placed under `docker/exports/`, which is intentionally ignored by Git.

## Verification

```text
cd app && pnpm typecheck && pnpm build
cd ../server && pnpm typecheck && pnpm build
```

Read `docs/CURRENT_STATUS.md` for known test gaps and migration limitations.

## Security

Never commit `.env` files, database credentials, production data or Docker image archives. Use `docker/deploy/server.env.example` as the deployment template.
