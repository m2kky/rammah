# Product Requirements Document

## 1. Document Purpose

This Product Requirements Document defines the target Ahmed Ramah Coaching Platform. It aligns business goals, user needs, scope, product behavior, and release priorities for the full platform.

The document is written for product owners, designers, frontend developers, backend developers, QA, deployment operators, and future maintainers.

## 2. Product Name

Ahmed Ramah Coaching Platform.

## 3. Product Overview

The Ahmed Ramah Coaching Platform is a premium personal-brand website and operating system for coaching, therapy-style sessions, workshops, training, corporate programs, content publishing, newsletter capture, and booking management.

The product must convert visitors into qualified leads, bookings, quote requests, and subscribers while giving the admin team full control over content, offerings, pricing, availability, forms, requests, payments, and follow-up operations.

The public experience must preserve the quality of the existing frontend: high visual confidence, cinematic motion, clear brand positioning, and a direct conversion path. The technical system must then add a separated backend API, database-backed CMS, booking engine, Google Calendar/Meet integration, payment gateway adapter, transactional emails, and protected admin dashboard.

## 4. Product Vision

Create a premium digital platform that presents Ahmed Ramah as an engineer, systematizer, trainer, and coach who helps users decode and change their psychological systems.

The platform should feel distinctive and high-trust, while the operational backend should make bookings, paid registrations, content updates, and follow-ups manageable without developer involvement.

## 5. Business Goals

- Present Ahmed Ramah's personal brand at a premium visual and technical level.
- Convert visitors into leads, free bookings, paid bookings, workshop registrations, course registrations, corporate quote requests, and newsletter subscribers.
- Reduce manual coordination around availability, session type, location, booking data, confirmations, and reminders.
- Centralize operational control in an admin dashboard.
- Support local and international audiences through country-based pricing and country detection.
- Launch the complete public customer journey in English and Arabic without duplicating business state or rebuilding the data model.
- Allow provider changes for payment gateways without changing the core booking workflow.

## 6. Problem Statement

The business needs more than a static personal website. It needs a conversion-focused and operations-ready system that can:

- Explain services clearly.
- Handle multiple offering types.
- Collect rich booking data.
- Manage online and offline session logistics.
- Prevent overbooking.
- Confirm paid bookings only after verified payment.
- Send professional email confirmations and admin notifications.
- Publish content and blog posts without developer involvement.
- Track leads, bookings, quote requests, subscribers, and admin activity.

## 7. Target Audience

### 7.1 Individual Coaching Clients

Visitors looking for one-on-one coaching, therapy-style support, or personal transformation. They need a clear service explanation, trust signals, simple booking, and confidence that the process is professional.

### 7.2 Learning Customers

Visitors interested in workshops, webinars, courses, or group learning experiences. They need event details, seats, price, date/time, location or online access, and a low-friction registration flow.

### 7.3 Corporate Buyers

Organizations looking for corporate training or custom programs. They need a quote/request flow, clear corporate offering pages, and a professional path for follow-up.

### 7.4 Admin Users

Internal operators who manage offerings, availability, locations, forms, content, bookings, payments, subscribers, blog posts, and notifications.

## 8. Product Scope

### 8.1 In Scope

- Premium public website.
- Home, About, Services, Booking, Contact, Blog, Thank You, Privacy Policy, Terms and Conditions.
- Full CMS for public pages, services, blog posts, legal pages, site settings, media, and booking content.
- Guest-only public booking and registration flows.
- Online and offline session support.
- Google Calendar/Meet integration.
- Availability, slot, capacity, buffer, and booking limit management.
- Dynamic forms and questions per offering or booking type.
- Country-based pricing with auto country detection.
- Early bird pricing, coupons, and tax handling.
- Paid booking flow with provider-agnostic payment gateway integration.
- Payment webhook handling.
- Email notifications through Resend or equivalent transactional email provider.
- Newsletter subscription.
- Contact inquiry capture.
- Corporate quote requests.
- Multi-admin dashboard.
- Audit logging for admin actions.
- Deployment on Hostinger VPS.
- Monitoring, backup, and incident response procedures.

### 8.2 Out of Scope

- Public user accounts.
- User login for customers.
- Membership portals.
- Digital shop.
- Digital product checkout.
- Downloadable product delivery.
- Marketplace functionality.
- Mobile apps.
- Complex CRM automation beyond the defined admin review and notification workflows.

## 9. Product Principles

- The frontend is responsible for experience, clarity, motion, layout, and interaction.
- The backend is responsible for final validation, persistence, pricing, availability, payment verification, and integration workflows.
- Guests never need an account to submit a booking, inquiry, quote request, or subscription.
- Admin functionality must be protected and auditable.
- Paid bookings are never confirmed from frontend state alone.
- The payment provider is replaceable through an adapter boundary.
- Content should be manageable without code changes.
- Production public journeys are bilingual: existing unprefixed English routes and complete Arabic counterparts under `/ar`; locale changes presentation and communication, not business state.

## 10. Public Information Architecture

| Page | Purpose | Primary Actions |
| --- | --- | --- |
| Home | Brand entry, positioning, services summary, conversion paths. | Book, explore services, subscribe, contact. |
| About | Bio, credibility, method, story, credentials. | Book consultation, contact. |
| Services | Detailed offering catalog and segmentation. | Open offering, book, request quote. |
| Booking | Shared booking flow for eligible offerings. | Select offering, choose slot, submit, pay if required. |
| Contact | Lead capture and general inquiries. | Submit inquiry. |
| Blog | Articles and insights. | Read, share, subscribe. |
| Thank You | Confirmation after forms, bookings, payments, and subscriptions. | Understand next steps. |
| Privacy Policy | Data usage and privacy notice. | Legal review. |
| Terms and Conditions | Service and booking terms. | Legal review. |

## 11. Offering Types

The platform must support a shared offering model. Each offering can be configured as one or more of the following:

- One-on-one coaching.
- Therapy-style session.
- Online session.
- Offline session.
- Workshop.
- Webinar.
- Course.
- Corporate training.
- Quote-only program.

Each offering may define:

- Title and slug.
- Public description.
- Booking type.
- Online/offline mode.
- Duration.
- Date/time behavior.
- Capacity.
- Country-based price rules.
- Early bird rules.
- Tax rules.
- Coupon eligibility.
- Dynamic form fields.
- Required questions.
- Location rules.
- Google Calendar behavior.
- Confirmation email template.
- Status and visibility.

## 12. Booking Model

### 12.1 General Rules

- All public bookings are guest-only.
- All bookable offerings use the shared booking engine.
- Free and paid bookings share the same data model but differ in confirmation rules.
- Booking status must reflect the real workflow state.
- The backend must perform final availability and capacity validation at submission time.
- Users must see clear progress, slot availability, price, and final outcome.

### 12.2 Free Offerings

- Free offerings may include consultations, webinars, workshops, or events.
- A free booking can be confirmed after successful backend validation.
- The admin receives an internal notification and email.
- The customer receives a confirmation email.
- If the offering is online, a Google Meet link may be generated depending on configuration.

### 12.3 Paid Offerings

- Paid offerings require verified payment before confirmation.
- The backend creates the payment session or intent through the selected payment gateway.
- The booking remains pending payment until webhook verification.
- The frontend may display a pending, failed, or confirmed state based on backend status.
- A paid booking must not become confirmed because the user returned to the website.

### 12.4 Corporate Quote Requests

- Corporate offerings may use request-a-quote instead of direct booking.
- The user submits company, contact, requirement, audience, and schedule preference details.
- The admin reviews the quote request inside the dashboard.
- Quote requests do not require payment during MVP unless explicitly enabled later.

## 13. Pricing Rules

### 13.1 Country-Based Pricing

- The platform must support country-specific pricing.
- The backend owns price resolution.
- The frontend may send country, locale, and IP-derived hints, but must not be the price authority.
- Auto country detection should be supported through IP or trusted geo lookup.
- Users must be allowed to correct country if the detected country is wrong, depending on fraud rules and admin configuration.

### 13.2 Currencies

- The data model must support multiple currencies.
- MVP must support at least local Egypt pricing and international pricing.
- Currency display must be consistent across offering details, booking summary, payment initiation, and confirmation.

### 13.3 Early Bird

- Early bird pricing is in MVP.
- Early bird rules are optional per offering.
- An early bird rule may include price, deadline, capacity, and country applicability.
- The backend must resolve the final price at the moment of payment initiation.

### 13.4 Coupons

- Coupons are in MVP.
- Coupons may be fixed amount or percentage.
- Coupons may have start/end dates, usage limits, country restrictions, and offering restrictions.
- Coupon application must be validated by the backend.

### 13.5 Taxes

- Tax handling is in MVP.
- Tax rules must support a configurable percentage and country applicability.
- Tax must be calculated by the backend and stored in the booking/payment record.

## 14. Admin Dashboard Scope

The admin dashboard must allow authorized admins to:

- Manage public page content.
- Manage services and offerings.
- Manage booking types.
- Manage dynamic form fields and questions.
- Manage availability rules.
- Manage event/session schedules.
- Manage online/offline locations.
- Manage country pricing.
- Manage early bird, coupons, and taxes.
- Review bookings.
- Review payments and payment events.
- Review quote requests.
- Review contact inquiries.
- Manage newsletter subscribers.
- Manage blog posts and categories.
- Manage media assets.
- Manage legal pages.
- Manage email templates.
- Manage site settings.
- Review admin notifications.
- Review audit logs.

## 15. CMS Scope

The CMS is full scope, not limited to blog editing.

The admin must be able to manage:

- Homepage sections.
- About page sections.
- Service/offering pages.
- Booking copy and help text.
- Contact page content.
- Blog posts.
- Blog categories/tags.
- Privacy policy.
- Terms and conditions.
- SEO metadata.
- Media assets.
- Site navigation and footer links.
- Social links and contact data.

## 16. Notifications and Follow-Up

- Customer confirmation emails are required after successful free booking confirmation, paid booking confirmation, quote submission, contact submission, and newsletter subscription where configured.
- Admin notification emails are required for new bookings, paid booking confirmation, payment failure requiring attention, quote requests, contact inquiries, and newsletter events where configured.
- Dashboard notifications must be created for operationally relevant events.
- WhatsApp follow-up is a manual operational step in MVP unless a future integration is approved.

## 17. Blog and Newsletter

Blog and newsletter are MVP scope.

The blog should support:

- Draft, published, and archived states.
- SEO metadata.
- Rich text body.
- Featured image.
- Categories/tags.
- Publish date.
- Slug.

Newsletter should support:

- Email capture.
- Optional name and country.
- Subscription source.
- Pending, confirmed, unsubscribed, and suppressed status.
- Double opt-in confirmation through a signed, expiring, single-use token.
- Signed unsubscribe token and immutable consent/unsubscribe evidence.
- Idempotent duplicate subscribe/confirm/unsubscribe behavior without silently resetting consent history.

## 18. Language Strategy

The production public website launches in English and Arabic:

- Existing unprefixed URLs remain English; Arabic counterparts use `/ar`.
- The complete customer journey is bilingual, including public content, legal, lead capture, newsletter, free/paid booking, payment recovery/status, validation/errors, and transactional customer email.
- Both locales use the same offering, price, availability, hold, booking, payment, calendar, and provider records.
- Admin chrome remains English while authorized admins author, preview, publish, unpublish, and audit both locales independently.
- Arabic renders server-side as RTL and uses `ar-EG` for human-facing formatting; machine identifiers/provider values remain locale-independent and directionally isolated.
- No automatic language redirect and no silent English fallback for required Arabic content or customer emails.

## 19. Hosting and Operations

Hostinger VPS is the deployment target. The architecture should remain portable enough to run on another VPS if needed.

The deployment should support:

- Frontend app.
- Express API.
- PostgreSQL database.
- Reverse proxy.
- TLS.
- Environment variables.
- Logs.
- Backups.
- Monitoring checks.

## 20. Acceptance Criteria

The product is acceptable when:

- Public pages are complete, responsive, performant, and visually aligned with the current frontend quality.
- Guests can submit free bookings.
- Guests can initiate and complete paid booking flows once a payment provider is selected.
- Paid bookings are confirmed only after backend payment verification.
- Admins can manage content, offerings, booking rules, pricing, forms, blog, subscribers, inquiries, and legal pages.
- Google Calendar/Meet integration creates or synchronizes booking events according to configuration.
- Emails are sent for customer and admin workflows.
- Dashboard records remain consistent with database state.
- The system is deployable to Hostinger VPS with documented operations.
- There is no shop, order, or digital download workflow in MVP.

## 21. Release Priorities

### 21.1 Must Have

- Public pages.
- Full CMS.
- Booking engine.
- Admin dashboard.
- Express API.
- PostgreSQL with Drizzle.
- Google Calendar/Meet integration.
- Payment gateway abstraction and webhook flow.
- Country pricing, early bird, coupons, and taxes.
- Blog.
- Newsletter.
- Resend email integration.
- Complete English/Arabic public customer journey with bilingual CMS authoring, RTL, localized customer email, and shared business state.
- Deployment and backup documentation.

### 21.2 Nice to Have

- Advanced CRM automation.
- WhatsApp integration.
- Analytics dashboards beyond operational metrics.
- Arabic or multi-language admin chrome; the English admin still manages both public locales.
- A third public locale beyond English and Arabic.
- Multiple payment gateways active at the same time.
