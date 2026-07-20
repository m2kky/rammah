# Detailed Implementation Plan

> **Legacy baseline:** this file records the earlier build roadmap and is retained for historical context. For all remaining production work, sequencing, estimates, and release acceptance, use `Production-Readiness-Execution-Plan.md` as the source of truth. For the approved bilingual public journey's file-by-file implementation steps, use `docs/superpowers/plans/2026-07-20-bilingual-arabic-customer-journey.md`.

Status date: 2026-06-21

## 1. Purpose

This document is the detailed delivery roadmap for completing the Ahmed Ramah Coaching Platform from the current frontend baseline and the newly scaffolded backend.

It complements `project_plan.md`, which is the high-level phase plan. This file is the day-to-day implementation reference.

## 2. Current Baseline

### Already Available

- Existing premium public frontend in `../rammah-next`.
- Independent backend in `../rammah-api`.
- Express, TypeScript, Drizzle ORM, PostgreSQL.
- Docker PostgreSQL local environment.
- Database schema, migrations, and seed data.
- Public offerings API.
- Frontend services section wired to public offerings API with local fallback.
- Admin password/session authentication API.
- Protected admin offerings API.
- Admin login screen.
- Protected admin layout and overview screen.
- Admin offerings list screen connected to the backend.
- Admin offering categories read API.
- Admin offering create/edit screens.
- Admin offering prices API and editor UI.
- Audit logging for admin offering and price mutations.
- Development admin seed user.

### Not Yet Built

- API contract documentation for implemented admin endpoints.
- Full CMS APIs and UI. Started with settings, navigation, and legal pages admin UI.
- Booking availability engine.
- Public booking flow.
- Booking admin workflow.
- Pricing management UI.
- Payment provider adapter and webhooks.
- Google Calendar/Meet integration.
- Email notification provider integration. Done for backend MVP with mock/Resend providers.
- Production deployment pipeline.
- End-to-end QA suite.

## 3. Delivery Principles

- Keep frontend and backend independently deployable.
- Preserve the current frontend quality and motion-led visual language.
- Build API contracts before complex UI wiring.
- Treat booking, payment, calendar, and email flows as correctness-critical.
- Keep admin UX practical and operational, not decorative.
- No shop, product orders, digital downloads, or product fulfillment.
- Public users remain guest-only in MVP.
- Multiple admin users are supported.
- **Superseded 2026-07-20:** production public launch is English and Arabic; see the current production and bilingual plans linked above.

## 4. Critical Path

The critical path is:

1. Backend foundation.
2. Admin authentication.
3. Admin shell.
4. Offerings and CMS management.
5. Availability and booking engine.
6. Pricing and payment engine.
7. Calendar and email integrations.
8. Public booking wiring.
9. Deployment and launch hardening.

Booking cannot be finished safely before offerings, pricing, availability, and admin workflows are stable.

## 5. Detailed Phases

## Phase 0: Documentation and Scope Lock

Status: Done

### Objectives

- Convert source proposal and reference docs into a structured project documentation pack.
- Define MVP boundaries.
- Confirm that the project has no shop.
- Confirm backend stack and hosting direction.

### Deliverables

- PRD.
- BRS.
- FRS.
- NFR.
- Architecture pack.
- UX flow docs.
- Project plan.
- Engineering workflow docs.

### Acceptance Criteria

- MVP scope is clear.
- Backend stack is confirmed as Express, Drizzle, PostgreSQL.
- Deployment target is Hostinger VPS with Docker-friendly architecture.
- Coach Hossam reference behavior is captured where relevant.

## Phase 1: Backend Foundation

Status: Mostly done

### Objectives

- Create a standalone API service.
- Establish database foundation.
- Create the core schema that supports the full MVP.
- Provide health, error, validation, and auth primitives.

### Completed

- `rammah-api` scaffolded.
- Express app created.
- Drizzle configured.
- PostgreSQL Docker service created.
- Migrations generated and applied.
- Seed data added.
- Health routes added.
- Environment validation added.
- Error response conventions added.
- Request ID middleware added.
- Admin session auth added.
- Public offerings API added.
- Admin offerings API added.
- Audit logging service added.

### Remaining Tasks

- Add role/permission middleware beyond basic admin authentication.
- Expand audit log coverage as each admin module is implemented.
- Add rate limiting for auth and public submission endpoints. Done with a first-pass in-process limiter.
- Add production-safe logging transport.
- Add API documentation generation or executable OpenAPI file. Done with `/api/v1/openapi.json`.

### Acceptance Criteria

- API boots independently.
- Database can be migrated and seeded from scratch.
- Authenticated admin requests work through HTTP-only cookies.
- Public frontend can consume public offerings.
- Protected admin endpoints reject unauthenticated requests.

## Phase 2: Admin Frontend Shell

Status: Done for first usable slice

### Objectives

- Create the protected admin area in the existing Next.js frontend.
- Connect it to backend session auth.
- Establish reusable admin layout and API client patterns.

### Tasks

Completed:

- Created `/admin/login`.
- Created `/admin` protected layout.
- Added session check using `/api/v1/admin/auth/me`.
- Added login form using `/api/v1/admin/auth/login`.
- Added logout action using `/api/v1/admin/auth/logout`.
- Added admin navigation.
- Added loading, unauthenticated, and error states.
- Added a typed backend API client for admin requests.
- Kept admin UI dense, clear, and operational.

Remaining:

- Add responsive/mobile pass after the first edit forms exist.
- Add deeper admin empty states as each module is implemented.

### Acceptance Criteria

- Admin can log in with seeded credentials.
- Auth cookie is stored by browser, not localStorage.
- Refreshing protected admin pages preserves session.
- Logout clears session.
- Unauthenticated users are redirected to login.

## Phase 3: Offerings Management

Status: Audit logging slice completed

### Objectives

- Let admins manage the services and programs displayed on the public site.
- Keep offerings as the source of truth for booking.

### Backend Tasks

- Keep current admin offerings CRUD. Done.
- Add admin offering categories API. Done for read/select use.
- Add offering price API. Done for list/create/update/archive.
- Add optional media linkage for offering hero/thumbnail assets.
- Add audit logs for create/update/archive. Done for offerings and offering prices.
- Add published/draft filtering rules.

### Frontend Admin Tasks

- Create offerings list screen. Done.
- Add search and status filters. Done.
- Add create/edit offering form. Done.
- Add category selector. Done.
- Add display color controls. Done.
- Add publish/draft/archive controls. Partially done through status field and archive action.
- Add pricing section per offering. Done.
- Add preview state for public card output.

### Public Frontend Tasks

- Continue using public offerings API.
- Add offering detail page if required by final UX.
- Make CTAs route to booking, quote, or details depending on offering mode.

### Acceptance Criteria

- Admin can create and publish an offering.
- Public site only shows published offerings.
- Public services section updates without code changes.
- Offerings support free, paid, and quote-only booking modes.

## Phase 4: CMS Core

Status: Backend API implemented; first admin UI slice implemented

### Objectives

- Give admins control over content required for the public website and legal pages.
- Keep content changes independent from deployments.

### Backend Tasks

- Site settings API. Done.
- Navigation API. Done.
- Pages API. Done.
- Page sections API. Done.
- Legal pages API. Done.
- SEO metadata API. Done.
- Blog categories API. Done.
- Blog posts API. Done.
- Media assets metadata API. Done.

### Frontend Admin Tasks

- Settings screen. Done for site name, locale, contact, timezone, and social links JSON.
- Navigation manager. Done for list/search/status filter/create/edit/archive.
- Page editor.
- Section editor.
- Legal page editor. Done for list/search/status filter/create/edit/archive.
- Blog manager.
- SEO editor.
- Media library browser.

### Public Frontend Tasks

- Wire settings where useful.
- Wire navigation if the current frontend should become CMS-driven.
- Add blog/public content pages if included in MVP launch.
- Add legal page rendering.

### Acceptance Criteria

- Admin can update launch-critical settings, navigation, and legal content without code changes.
- Public content APIs expose only published content.
- Draft content remains hidden from public users.
- SEO metadata can be managed per CMS resource.

## Phase 5: Booking Core

Status: Started - availability, offline locations, fixed-date sessions, slot preview, holds, free recurring/session booking, quote request submission, admin booking list/detail/status actions, and calculated calendar overview completed

### Objectives

- Build the booking system shared by coaching, therapy sessions, workshops, webinars, courses, and corporate requests.
- Support free bookings before adding payment complexity.

### Backend Tasks

- Availability rules CRUD. Done for admin list/create/detail/update/archive API.
- Availability overrides CRUD. Done for admin list/create/detail/update/delete API.
- Offline locations CRUD. Done for admin list/create/detail/update/archive API and admin UI.
- Offering sessions CRUD for fixed-date events. Done for admin list/create/detail/update/archive API and admin UI.
- Dynamic booking form fields CRUD. Done for admin list/create/detail/update/archive API, public config/read, and answer validation.
- Slot calculation service. Done for admin preview using rules, overrides, bookings, and active holds.
- Fixed-date public session listing. Done for published future sessions with remaining capacity.
- Slot hold service. Done for public create/release hold endpoints, including session-aware holds.
- Free booking submission endpoint. Done for active slot hold conversion.
- Booking confirmation logic. Done for free recurring slots and fixed-date sessions.
- Quote request submission endpoint. Done for public quote-only offerings.
- Admin quote request list/detail/status endpoints. Done for quote-only submissions.
- Admin booking list/detail endpoints. Done for read-only list/detail with status and search filters.
- Booking status transitions. Done for controlled admin status update endpoint.

### Frontend Admin Tasks

- Availability rule editor. Done for weekly rules list/create/edit/archive.
- Availability override editor. Done for date-level list/create/edit/delete.
- Calendar-style availability overview. Done as calculated slot preview.
- Offline location manager. Done for admin search/filter/create/edit/archive UI.
- Session/event manager. Done for admin fixed-date sessions.
- Booking form builder. Done for admin list/create/edit/archive UI.
- Bookings inbox. Done for read-only admin inbox.
- Booking detail screen. Done as a side panel inside the inbox.
- Manual confirm/cancel/complete/no-show controls. Done as status actions in the booking inbox.
- Reschedule controls. Done with minimal start/end datetime controls on the booking detail panel.
- Quote requests inbox. Done for list/search/status filters, detail, status update, and admin notes.

### Public Frontend Tasks

- Booking entry from offering CTA. Done with `/booking` and `/booking/[slug]`.
- Slot/date selector. Done for available free-booking slots.
- Fixed-date session selector. Done for public booking flow when published sessions exist.
- Dynamic form rendering. Done for published booking fields on public free booking flow.
- Booking review step. Done before final hold conversion and booking submission.
- Free booking confirmation screen. Done.
- Quote-only request form. Done for `/booking/[slug]` quote offerings.
- Public booking status page. Done with `/booking/status` lookup and `/booking/status/[publicToken]` direct URLs.
- Error and expired-slot states. Done for unavailable slot and API failure messages.

### Acceptance Criteria

- Admin can define availability.
- Admin can manage offline locations.
- Guest can select an available slot.
- Guest can select an available fixed-date session.
- Guest can submit a free booking.
- Guest can submit a quote request for quote-only offerings.
- Double booking is prevented.
- Admin can view and manage submitted bookings.

## Phase 6: Pricing, Country Detection, and Paid Booking

Status: Mostly done - Kashier test-mode paid booking and reconciliation implemented

### Objectives

- Add country-aware pricing and paid booking checkout.
- Keep payment provider replaceable.

### Backend Tasks

- Offering prices CRUD. Done in the admin offerings pricing slice.
- Country detection service. Started for public price preview using trusted request headers.
- Manual country override support. Done for public price preview.
- Country-aware price preview endpoint. Done for paid offerings with fallback and early bird resolution.
- Coupon validation. Pending; preview contract accepts `couponCode` and returns `not_applied`.
- Tax calculation hooks. Pending; preview currently returns `taxAmountMinor = 0`.
- Payment provider adapter boundary. Done for Kashier iFrame test mode.
- Checkout session creation. Done for Kashier iFrame.
- Payment webhook/callback receiver. Done for Kashier GET callback.
- Public payment reconciliation. Done through Kashier order status lookup.
- Idempotency for repeated paid booking submission and provider events. Done for current flow.
- Booking confirmation after successful payment. Done when callback/reconciliation returns trusted paid state.
- Payment failure and expiry handling. Started; callback status mapping exists, full retry UX remains pending.

### Frontend Admin Tasks

- Price management per country/currency.
- Early bird price fields.
- Coupon manager.
- Tax rules manager if required for MVP.
- Payment status visibility on bookings.

### Public Frontend Tasks

- Auto-detect country where possible. Started through backend price preview headers.
- Let guest change country manually. Done on paid `/booking/[slug]` price preview.
- Show correct price before checkout. Done for backend-resolved public price preview.
- Start checkout for paid bookings. Done through Kashier embedded iFrame.
- Show payment return state. Done with backend reconciliation on return.
- Show failed, cancelled, and expired retry states. Pending UI refinement.

### Acceptance Criteria

- Paid booking cannot be confirmed before successful payment.
- Webhooks are idempotent.
- Price shown to user matches payment amount.
- Country pricing has a safe fallback.
- Provider-specific code is isolated behind an adapter.
- Kashier dashboard paid state can be reconciled into local booking/payment state.

### Production Readiness Remaining

- Replace local callback/return URLs with production HTTPS URLs.
- Move from test to live Kashier credentials after account approval.
- Run one low-value live paid booking test and verify Kashier dashboard, local payment state, booking confirmation, and payment event records.
- Add admin payment detail and manual reconcile action if operators need self-service recovery.

## Phase 7: Google Calendar and Meet

Status: MVP implemented for confirmed-booking event creation and Meet links

### Objectives

- Generate online meeting links and keep calendar state aligned with bookings.
- Avoid slot conflicts with external busy events where required.

### Backend Tasks

- Google OAuth or service account strategy finalization. Done with Admin OAuth.
- Calendar event creation. Done for confirmed bookings.
- Google Meet link generation. Done for confirmed bookings.
- Calendar event cancel. Done for admin booking cancellation.
- Calendar event update/reschedule. Done with Google event patch on admin booking reschedule and create fallback.
- External busy block sync. Pending.
- Retry and failure logging. Done for failed event creation and manual retry.

### Admin Tasks

- Calendar integration status screen. Done.
- Manual retry for failed calendar events. Done.
- Visibility of Meet link on booking detail. Done.

### Public Tasks

- Show meeting details only after confirmation where appropriate. Done on booking status.

### Acceptance Criteria

- Confirmed online booking creates a calendar event.
- Online booking receives a Meet link.
- Cancelled booking cancels the calendar event.
- Calendar failures are visible to admin and retryable.

## Phase 8: Email Notifications

Status: Backend MVP implemented

### Objectives

- Send operational emails for booking and admin workflows.
- Keep templates manageable.

### Backend Tasks

- Email provider adapter. Done for `mock` and Resend REST.
- Email template API. Done under `/api/v1/admin/emails/templates`.
- Email delivery records. Done using `email_deliveries`.
- Booking confirmation email. Done for free, paid, and admin-confirmed bookings.
- Payment confirmation email. Covered by paid booking confirmation email after trusted payment confirmation.
- Admin new booking notification. Done for confirmed bookings.
- Admin quote request notification. Done for public quote submissions.
- Cancellation/reschedule emails. Done for admin cancellation and reschedule flows.
- Failure logging and retry approach. Done for delivery status, stored errors, and admin retry.

### Admin Tasks

- Email template editor. Done for subject/body/status on `/admin/emails`.
- Delivery status visibility. Done for list/search/status filters/retry on `/admin/emails`.

### Acceptance Criteria

- User receives correct email after booking confirmation.
- Admin receives notification for new submissions.
- Failed email deliveries are recorded.

## Phase 9: Public Frontend Completion

Status: Sitemap pages implemented; deeper content polish remains iterative

### Objectives

- Keep the existing public frontend visually strong while making it data-driven.
- Add complete booking paths without weakening the current landing experience.

### Tasks

- Keep current hero and premium sections.
- Wire services/offering content from API. Done for services and offering detail pages with fallback data.
- Add offering detail route if needed. Done under `/services/[slug]`.
- Add booking route. Done.
- Add quote request route for quote-only offerings. Done through `/booking/[slug]`.
- Add payment return pages.
- Add contact route. Done with general inquiry storage through quote request backend.
- Add blog index/detail routes. Done through public CMS blog endpoints.
- Add thank-you route. Done.
- Add legal pages. Done for `/privacy`, `/terms`, with long URL aliases.
- Add error/loading states that match the brand quality.
- Verify responsive behavior with browser tests.

### Acceptance Criteria

- Public experience remains visually consistent with current frontend.
- Booking paths are clear from all relevant CTAs.
- Content can be updated from admin without breaking layout.
- Mobile layout remains polished.

## Phase 10: QA and Hardening

Status: Pending

### Objectives

- Reduce launch risk across booking, payment, auth, and admin workflows.

### Backend Tasks

- Unit tests for pricing, slot calculation, payment webhook processing.
- Integration tests for auth, offerings, booking, payment.
- Validation tests for critical endpoints.
- Security review for cookies, CORS, headers, and admin mutations.
- Rate limiting on auth and submission endpoints. Done for first-pass single-instance deployment.
- Repeatable backend smoke runner. Done with `npm run smoke`.
- Repeatable business-flow smoke for paid booking/payment callback idempotency. Done with `npm run business-smoke`.

### Frontend Tasks

- Browser smoke tests for public homepage.
- Browser tests for login/admin offerings.
- Browser tests for booking happy path.
- Browser tests for payment return states once provider is selected.

### Acceptance Criteria

- Critical workflows pass automated tests.
- No known high-risk auth, payment, or booking bugs remain.
- Error states are user-safe and admin-debuggable.

## Phase 11: Deployment and Operations

Status: Started - production runbook and backend preflight implemented

### Objectives

- Deploy frontend, API, database, and supporting services to production-like infrastructure.
- Make operations repeatable.

### Tasks

- Finalize Hostinger VPS layout.
- Create production Docker Compose or deployment scripts.
- Configure reverse proxy.
- Configure HTTPS.
- Configure environment variables.
- Backend production env preflight. Done with `npm run preflight:prod`.
- Configure database backups.
- Configure logs.
- Configure monitoring and uptime checks.
- Run migration and seed strategy for production.
- Document rollback steps. Done in `docs/06-engineering/Production-Runbook.md`.

### Acceptance Criteria

- Production deployment is reproducible.
- Health checks pass.
- Database backup exists and restore path is documented.
- Secrets are not committed.
- Rollback path is documented.

## Phase 12: Launch Readiness

Status: Pending

### Objectives

- Prepare the platform for public launch.

### Tasks

- Final content pass.
- Admin user setup.
- Payment provider live keys.
- Google Calendar production connection.
- Email sender/domain verification.
- Privacy policy and legal pages.
- SEO metadata.
- Performance check.
- Mobile QA.
- Backup verification.
- Launch checklist sign-off.

### Acceptance Criteria

- Public site can receive real users.
- Admin can operate the system without developer involvement for normal tasks.
- Booking/payment/calendar/email workflows work in production mode.

## 6. Immediate Next Sprint

The next practical sprint should be:

1. Update API contract docs with implemented admin endpoints.
2. Add admin category management CRUD when needed.
3. Wire offering CTA behavior on public frontend. Done for free booking entry.
4. Add browser smoke tests for admin login and offerings.
5. Start booking availability API design from the existing schema. Done for rules, overrides, and slot preview.
6. Build availability rules API and admin UI. Done for weekly rules, date overrides, and calculated preview.
7. Build slot hold and free booking submission next. Done for free bookings, admin inbox, admin status actions, and public free booking UI.

This sprint is the fastest route to a visible admin product while preparing the booking engine.

## 7. Open Decisions

The following decisions are still needed:

- Payment provider for MVP.
- Production domain.
- Email provider and sender domain.
- Google Calendar account/ownership model.
- Final list of supported countries and currencies.
- Whether blog is required for first launch or can follow booking launch.
- **Closed 2026-07-20:** Arabic is launch scope, and the English admin must author/preview/publish both locales.

## 8. Local Development Runbook

Backend:

```bash
cd rammah-api
npm install
npm run db:up
npm run db:migrate
npm run db:seed
npm run dev
```

Frontend:

```bash
cd rammah-next
npm install
npm run dev
```

Default local URLs:

- API: `http://localhost:4000`
- Frontend: `http://localhost:3000` or the next available port
- Public offerings: `http://localhost:4000/api/v1/public/offerings`
- Admin login API: `http://localhost:4000/api/v1/admin/auth/login`

Development admin seed:

- Email: `admin@rammah.local`
- Password: `ChangeMe123!`

These credentials are for local development only and must not be used in production.

## 9. Definition of MVP Done

MVP is done when:

- Public site is live and visually consistent with the current frontend.
- Admin can log in.
- Admin can manage key CMS content.
- Admin can manage offerings.
- Admin can manage availability.
- Guest can submit free and paid bookings.
- Payment success confirms paid bookings.
- Google Meet links are generated for online confirmed bookings.
- Admin can review and manage bookings.
- Required emails are sent.
- Deployment, backups, monitoring, and rollback are documented.
