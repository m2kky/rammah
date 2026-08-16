# Production Runbook

## Release order

1. Back up PostgreSQL and the R2 media bucket.
2. Deploy the one-shot migration service and require a zero exit code. CMS migrations `0011` and `0012` add publication diagnostics and trusted seeded-local media support; migration `0013` adds multi-country price-group memberships and immutable paid-booking price references.
3. Start the API and the worker. The worker is mandatory for animation processing, scheduled publishing, and media cleanup.
4. Run `npm run db:seed --workspace=rammah-api`. The seed is idempotent and registers the currently shipped images, videos, and services frame animation before the frontend starts consuming named CMS slots.
5. Start the web service.
6. Run `npm run preflight:prod --workspace=rammah-api`, then `npm run smoke --workspace=rammah-api`.

Do not publish new application containers against an older schema. If migration or seed fails, keep the previous API/web release active and investigate before retrying.

## Country pricing and proxy trust

Configure `PAYMENT_SUPPORTED_CURRENCIES` with the exact comma-separated currencies enabled on the merchant account. The dashboard uses this server-owned list, and `npm run db:pricing-groups:preflight --workspace=rammah-api` fails if published data contains unsupported currencies, missing memberships, duplicate active country assignments, or invalid price groups.

Paid pricing never accepts a country from the customer. Detection uses GeoIP or one explicitly configured provider header:

- keep `COUNTRY_HEADER_PROVIDER=none` while the application domain is not proxied through Cloudflare or Vercel;
- after the domain is orange-cloud proxied through Cloudflare, set `COUNTRY_HEADER_PROVIDER=cloudflare`;
- set `TRUSTED_PROXY_CIDRS` to the immediate reverse-proxy IP/CIDR visible to the API, not a numeric hop count;
- restrict direct access to the API origin and make the trusted reverse proxy strip any inbound `CF-IPCountry` before adding Cloudflare's value.

R2 configuration alone does not make `CF-IPCountry` trustworthy. If no valid country can be detected, or the detected country has no published group, paid checkout stops before payment with “Pricing is not available in your country.” Free bookings and quote requests remain available.

Before enabling traffic:

1. Run migrations, then `npm run db:pricing-groups:preflight --workspace=rammah-api`.
2. In each paid Offering, publish non-overlapping country groups and verify every intended market has exactly one active membership.
3. From a supported country, verify the previewed currency/amount is copied unchanged into the paid booking and payment.
4. From an unsupported country, verify no payment or booking is created.
5. Edit a price after the review screen opens and verify the customer sees the new amount and explicitly reconfirms it without reserving a second slot.

## Required CMS configuration

Production requires direct R2 uploads and these runtime variables:

- `R2_UPLOADS_ENABLED=true`
- `R2_ENDPOINT`: Cloudflare account S3 endpoint over HTTPS
- `R2_BUCKET`: exact bucket name
- `R2_ACCESS_KEY_ID` and `R2_SECRET_ACCESS_KEY`: scoped object read/write credentials
- `R2_PUBLIC_BASE_URL`: public HTTPS delivery URL or custom media domain
- `CMS_PREVIEW_SECRET`: dedicated random value, at least 32 characters and different from `ADMIN_SESSION_SECRET`
- media byte/frame limits and positive worker polling, concurrency, lease, timeout, and drain settings

The production preflight fails closed if these are missing or inconsistent. R2 credentials remain runtime-only and must never be exposed as Next.js build variables.

## R2 browser and delivery policy

Configure bucket CORS for `PUT`, `GET`, and `HEAD` from the exact production admin origin. Allow `Content-Type` and `Content-Length`; expose `ETag`. Verify with browser developer tools that the presigned `PUT` returns 2xx and does not send application cookies.

The public media host must:

- serve `GET` and `HEAD` over HTTPS;
- preserve correct image/video MIME types;
- support `Range` requests and return `206` for video seeking;
- cache immutable permanent object paths;
- avoid indexing/listing the bucket.

Create a lifecycle rule only for the temporary prefix (default `tmp`) and remove objects after the configured retention period. Permanent media lives under the permanent prefix (default `media`) and must not inherit temporary cleanup.

## CMS release smoke test

1. Open `/admin/cms` and confirm Pages, Media, Global media, Legal, Navigation, and Settings load without console errors.
2. Upload an image and video from the browser. Confirm progress reaches finalizing/ready and the API never returns an R2 object key.
3. Upload a small valid frame ZIP. Confirm the worker marks it ready and its manifest loads on the public site.
4. Create an external HTTPS image and video; the picker must require a successful browser preview.
5. Assign media to a draft section, add alternative text for meaningful images, save, and open the expiring preview link.
6. Publish the page and confirm the public URL, metadata, and named media. Schedule another page a few minutes ahead and confirm the worker publishes it once.
7. Check Media usages. An in-use asset must reject archive/delete. Archive an unused asset, then exercise permanent delete only with a disposable test object.
8. Replace one global media group through a draft version and publish it atomically. Confirm the previous public version remains visible until publication completes.

## Backup and recovery

PostgreSQL stores page content, media records, versions, assignments, audit logs, and scheduled state. R2 stores the binary originals, videos, generated animation frames, and manifests. A database-only restore leaves broken URLs; an R2-only restore loses ownership and usage relationships. Back up both and document the timestamp pair.

For recovery:

1. Restore PostgreSQL and the R2 snapshot/version to the same recovery point.
2. Run migrations only if the restored schema is behind the deployed application.
3. Run preflight, then inspect global assignment versions and a representative page before reopening traffic.
4. Restart the worker and check failed/pending animation jobs and scheduled publications.

Archive only changes CMS state and can be reversed through a controlled database repair until permanent deletion. Permanent deletion removes the R2 object and generated animation children; the application has no trash or undo. Restore from bucket versioning/retention or backup, then repair the corresponding database record if recovery is required.

## Rollback

Application rollback is safe only while the older release understands the migrated schema. Do not roll back migrations destructively. Keep additive columns/tables, deploy the previous containers, and leave the worker stopped only if its job payloads are incompatible. Existing published global-media versions and seeded fallbacks keep the public site rendering while CMS writes are paused.
