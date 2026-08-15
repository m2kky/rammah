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

## CMS media and Cloudflare R2

Set `R2_UPLOADS_ENABLED=true` and provide `R2_ENDPOINT`, `R2_BUCKET`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, and the public HTTPS `R2_PUBLIC_BASE_URL`. Also set a dedicated random `CMS_PREVIEW_SECRET` of at least 32 characters; it must differ from `ADMIN_SESSION_SECRET`.

The bucket CORS policy must allow browser `PUT` requests from every admin web origin. Public delivery must support `GET`, `HEAD`, and byte-range requests so videos can seek. A representative policy is:

```json
[
  {
    "AllowedOrigins": ["https://www.example.com"],
    "AllowedMethods": ["PUT", "GET", "HEAD"],
    "AllowedHeaders": ["Content-Type", "Content-Length"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3600
  }
]
```

Replace the origin with the real production admin origin; never use `*` for an authenticated admin deployment. Add an R2 lifecycle rule that deletes objects under the configured `R2_TEMP_PREFIX` after `R2_TEMP_RETENTION_DAYS` (normally one day). Do not apply that rule to the permanent media prefix.

Deployment order is `migrate` → `api` and `worker` → `db:seed`. Keep one worker service running continuously: it processes animation ZIPs, temporary-object cleanup, and scheduled CMS publication. After deploy, run `npm run preflight:prod --workspace=rammah-api` inside the API container and verify one image, one video, and one animation upload from `/admin/cms`.

Database backups contain media metadata and assignments, not the R2 objects. Back up/version the bucket separately and test restoring both to the same point in time. CMS archive is reversible at the database level; **Delete permanently** removes an unused archived R2 object and has no application-level undo. Recovery then depends entirely on bucket retention/versioning or an external backup.
