# Coolify deployment

1. Create a Coolify resource from the Git repository and select **Docker Compose**.
2. Use branch `master`, base directory `/`, and compose file `/deploy/docker-compose.production.yml`.
3. Paste `.env.example` into Coolify's Environment Variables developer view and replace every placeholder.
4. Keep only `NEXT_PUBLIC_API_BASE_URL` enabled as a build variable. Provider keys and database/admin secrets should be runtime-only.
5. Assign `https://www.example.com:3000` to `web` and `https://api.example.com:4000` to `api`. Do not assign domains to `worker` or `migrate`.
6. Deploy. The one-shot `migrate` service must complete before `api` and `worker` start.
7. In the running `api` container, run these once:

   ```sh
   npm run db:seed --workspace=rammah-api
   npm run preflight --workspace=rammah-api
   npm run smoke --workspace=rammah-api
   ```

8. Connect Google Calendar from the admin integrations page, then complete one real booking/payment smoke test.

Coolify provides the reverse proxy and TLS certificate; no host Nginx configuration is required. PostgreSQL is supplied through `DATABASE_URL` and must have its own automated backup policy.
