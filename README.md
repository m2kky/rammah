# Ahmed Ramah Platform

The repository uses npm workspaces for the API (`rammah-api`) and frontend (`rammah-next`). Use Node 24.14.0 and npm 11.9.0, as pinned in `.nvmrc` and `package.json`.

## Getting started

Install dependencies once from the repository root; do not install each workspace independently.

```bash
npm ci --no-audit --no-fund
npm run docker:up
npm run db:migrate --workspace=rammah-api
npm run db:seed --workspace=rammah-api
```

Copy each workspace's `.env.example` to its local environment file before starting it.

The API defaults to `http://localhost:4000/api/v1`; the frontend defaults to `http://localhost:3000`.

## Repository commands

| Command | Purpose |
| --- | --- |
| `npm run lint` | Run every available workspace linter. |
| `npm run typecheck` | Typecheck every workspace. |
| `npm run test:unit` | Run available unit suites. No unit suite exists yet. |
| `npm run test:integration` | Run available integration suites. No integration suite exists yet. |
| `npm run test:coverage` | Run available coverage suites. No coverage suite exists yet. |
| `npm run build` | Build every workspace. |
| `npm run test:e2e` | Run available E2E suites. No E2E suite exists yet. |
| `npm run smoke` | Run available smoke checks; today this is the API smoke check against a running API. |
| `npm run preflight` | Run the API production preflight check. |
| `npm run docker:up` | Start the local PostgreSQL Compose service. |
| `npm run docker:down` | Stop the local PostgreSQL Compose service. |
| `npm run docker:reset` | Stop local PostgreSQL and remove its local Compose volume. |
| `npm run clean` | Remove generated build and test output only. |

`docker:*` commands manage only the local PostgreSQL Compose service. Production container images are not available yet.

Workspace-specific commands remain available through `npm run <script> --workspace=<workspace>`; see each workspace README for details.
