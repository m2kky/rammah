# Ahmed Ramah Frontend

## Getting started

From the repository root, install dependencies once, copy `rammah-next/.env.example` to `rammah-next/.env.local`, then start the frontend:

```bash
npm ci --no-audit --no-fund
npm run dev --workspace=rammah-next
```

Open [http://localhost:3000](http://localhost:3000) with your browser. Do not install this workspace independently.

## Scripts

| Script | Purpose |
| --- | --- |
| `npm run dev --workspace=rammah-next` | Run the Next.js development server. |
| `npm run build --workspace=rammah-next` | Create a production build. |
| `npm run start --workspace=rammah-next` | Serve the production build. |
| `npm run lint --workspace=rammah-next` | Run ESLint. |
| `npm run typecheck --workspace=rammah-next` | Typecheck without emitting files. |
| `npm run clean --workspace=rammah-next` | Remove generated build and test output. |

The root command table documents shared lint, typecheck, build, smoke, preflight, Docker, and future test commands. Unit, integration, coverage, and E2E suites do not exist yet.
