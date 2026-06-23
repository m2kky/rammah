# Ahmed Ramah API

Independent Express backend API for the Ahmed Ramah Coaching Platform.

## Stack

- Node.js
- Express
- TypeScript
- Drizzle ORM
- PostgreSQL
- Zod

## Getting Started

```bash
npm install
cp .env.example .env
npm run db:up
npm run db:migrate
npm run db:seed
npm run dev
```

The default API runs at:

```text
http://localhost:4000/api/v1
```

## Scripts

| Script | Purpose |
| --- | --- |
| `npm run dev` | Run API in watch mode. |
| `npm run build` | Compile TypeScript. |
| `npm run start` | Run compiled API. |
| `npm run typecheck` | Typecheck without emitting files. |
| `npm run smoke` | Run read-only backend smoke checks against a running API. |
| `npm run business-smoke` | Run critical paid booking/payment idempotency smoke checks against a running API. |
| `npm run preflight:prod` | Check production environment readiness and database connectivity. |
| `npm run db:up` | Start local PostgreSQL through Docker Compose. |
| `npm run db:down` | Stop local PostgreSQL. |
| `npm run db:reset` | Stop local PostgreSQL and remove its volume. |
| `npm run db:generate` | Generate Drizzle migrations. |
| `npm run db:migrate` | Apply Drizzle migrations. |
| `npm run db:studio` | Open Drizzle Studio. |
| `npm run db:seed` | Seed baseline settings, categories, and offerings. |

## Current Scope

This scaffold includes:

- Express app setup.
- Environment config.
- Request ID middleware.
- Structured error middleware.
- Health routes.
- Drizzle PostgreSQL client.
- Initial schema foundation for admin, CMS, offerings, booking, payment, leads, blog, and audit domains.
