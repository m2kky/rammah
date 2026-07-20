# Non-Functional Requirements

## 1. Document Purpose

This document defines measurable quality requirements for the Ahmed Ramah Coaching Platform.

## 2. System Context

The platform consists of:

- Next.js frontend.
- Express backend API.
- PostgreSQL database accessed through Drizzle ORM.
- Admin dashboard under protected frontend routes.
- Google Calendar/Meet integration.
- Transactional email integration.
- Provider-agnostic payment gateway integration.
- Hostinger VPS deployment target.

## 3. Quality Objectives

- Preserve premium public experience quality.
- Keep the booking flow fast, trustworthy, and low-friction.
- Keep admin operations reliable and understandable.
- Protect customer and admin data.
- Prevent booking, capacity, and payment state corruption.
- Make deployment, backup, and recovery practical on VPS infrastructure.

## 4. Performance

### NFR-001 Public Page Load

Public pages should load quickly on mobile and desktop under normal network conditions. Hero and motion-heavy sections must be optimized so they do not block the initial usable experience.

### NFR-002 Motion Performance

Motion, GSAP timelines, canvas sequences, and scroll interactions should target smooth performance on modern mobile and desktop devices.

### NFR-003 Booking API Responsiveness

Booking availability, pricing, validation, and submission API responses should complete within acceptable user-facing time under normal traffic.

### NFR-004 Admin Dashboard Responsiveness

Admin list views and editing workflows should respond fast enough for daily operations, with pagination and filters used where record volume can grow.

### NFR-005 Media Optimization

Images, frame sequences, and media assets should be compressed, sized, cached, and lazy-loaded where appropriate.

## 5. Usability

### NFR-010 Premium Experience

The public interface must maintain a polished premium feel consistent with the current frontend baseline.

### NFR-011 Low-Friction Booking

The booking flow must be linear, understandable, and usable on mobile.

### NFR-012 Clear State

Users must always understand whether a booking is free, paid, pending payment, failed, or confirmed.

### NFR-013 Admin Clarity

Admin screens must be organized around real operations, not raw database tables only.

### NFR-014 Error Clarity

Validation and integration failures must be explained in plain user-facing language.

## 6. Reliability

### NFR-020 Booking Integrity

The system must prevent overbooking and capacity violations through backend final validation and database constraints where possible.

### NFR-021 Payment Integrity

Paid bookings must not become confirmed without trusted payment verification.

### NFR-022 Calendar Reliability

Calendar event creation failures must be visible and retryable without losing the core booking record.

### NFR-023 Email Reliability

Email delivery failures must be logged and visible to admins or operators.

### NFR-024 Graceful Degradation

If non-critical integrations fail after a core booking is valid, the booking record must remain intact and the failure must be recoverable.

## 7. Security

### NFR-030 Admin Protection

Admin routes and admin APIs must be accessible only to authenticated admins.

### NFR-031 Secrets

Database URLs, email credentials, Google credentials, and payment gateway secrets must never be exposed to frontend code.

### NFR-032 Input Validation

All public and admin inputs must be validated on the backend.

### NFR-033 Anti-Spam

Public forms must include essential anti-spam controls such as rate limits, honeypot, throttling, or challenge-based controls where needed.

### NFR-034 Webhook Security

Payment webhooks must verify signatures or provider-specific authenticity checks.

### NFR-035 Data Minimization

The system must collect only data required for booking, follow-up, payment, and operations.

## 8. Availability

### NFR-040 Public Availability

Public pages and booking entry points should remain available under normal VPS operating conditions.

### NFR-041 Admin Availability

Admin dashboard should be available whenever operational users need to manage bookings and content.

### NFR-042 Maintenance

Planned maintenance should avoid peak booking periods and must not corrupt pending bookings or payment states.

## 9. Scalability

### NFR-050 Content Growth

The system must support growth in pages, blog posts, media, services, and offerings.

### NFR-051 Booking Growth

The system must support growth in bookings, form answers, payment events, email logs, and audit logs.

### NFR-052 Feature Expansion

The architecture must support additional locales beyond the production English/Arabic pair, WhatsApp integration, richer analytics, and provider replacement without a full rewrite.

## 10. Maintainability

### NFR-060 Separation of Concerns

Frontend, backend, database, and integrations must remain separated by clear contracts.

### NFR-061 Drizzle Migrations

Database schema changes must be managed through versioned Drizzle migrations.

### NFR-062 API Consistency

API responses, errors, pagination, filtering, and status values must be consistent across resources.

### NFR-063 Configuration

Provider credentials, URLs, timeouts, country pricing behavior, and operational thresholds must be environment-configurable.

## 11. Accessibility

### NFR-070 Semantic HTML

Public and admin pages should use semantic HTML where possible.

### NFR-071 Keyboard Support

Forms, dialogs, menus, booking controls, and admin actions should be usable by keyboard.

### NFR-072 Contrast

Text and interactive controls should maintain readable contrast.

### NFR-073 Responsive Layout

Public pages, booking flow, and admin dashboard must work across mobile, tablet, and desktop.

## 12. Localization and RTL Quality

### NFR-080 Bilingual Route Stability

Existing English URLs shall remain stable. Arabic public URLs shall use `/ar`; neither IP address nor browser language shall trigger an automatic redirect. A language switch shall use an explicit published counterpart or a deterministic section landing page.

### NFR-081 Arabic RTL Quality

Arabic pages shall render server-side with `lang="ar"` and `dir="rtl"`, preserve logical keyboard and screen-reader order, avoid horizontal overflow, and pass the same accessibility and performance gates as English.

### NFR-082 Timezone and Locale Display

Booking times shall use the trusted business timezone and default to `Africa/Cairo`. Human-facing Arabic dates, times, numbers, and currencies shall use `ar-EG`; English presentation shall use the approved English locale. Machine values, identifiers, money minor units, and provider payloads shall remain locale-independent.

### NFR-083 Locale Parity and Direction Isolation

Both locales shall produce identical price, capacity, booking, payment, and provider state. Identifiers, email addresses, phone numbers, monetary references, and provider references shall be directionally isolated in Arabic UI. A missing required Arabic translation shall fail closed with an operator-visible error rather than silently render English.

## 13. Observability

### NFR-090 Logs

The backend must log errors, webhook processing, payment transitions, email attempts, and integration failures.

### NFR-091 Metrics

The system should expose or record operational metrics for bookings, payments, email delivery, API errors, and integration failures.

### NFR-092 Tracing

Important workflows should share correlation IDs across API requests, payment events, and logs.

## 14. Backup and Recovery

### NFR-100 Database Backup

PostgreSQL data must be backed up on a defined schedule.

### NFR-101 Restore Testing

Restore procedures must be documented and periodically tested.

### NFR-102 Media Backup

Uploaded media assets must be backed up or stored in a recoverable location.

## 15. Compliance and Privacy

### NFR-110 Privacy Notice

The system must publish a privacy policy explaining what data is collected and why.

### NFR-111 Customer Data Handling

Customer data must be accessible only to authorized admins and operators.

### NFR-112 Sensitive Leakage

Errors, logs, and frontend responses must avoid exposing secrets or sensitive personal data.

## 16. Quality Acceptance Criteria

The system meets NFR acceptance when:

- Public pages remain fast and polished.
- Booking workflows are reliable and traceable.
- Admin operations are secure and usable.
- Payment verification cannot be bypassed.
- Backups and restore procedures exist.
- Deployment and monitoring are documented.
- The frontend/backend boundary is enforced.
- English URLs remain stable and the complete Arabic `/ar` journey passes RTL, accessibility, performance, SEO, and provider parity gates.
- Locale changes presentation and communication only; it never changes trusted business or payment state.
