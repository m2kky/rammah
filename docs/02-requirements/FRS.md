# Functional Requirements Specification

## 1. Document Overview

This document defines the functional behavior of the Ahmed Ramah Coaching Platform. Requirements are grouped by domain and written as implementation and QA references.

## 2. Global Functional Rules

### FR-001 Separated Frontend and Backend

The system shall use an independent Next.js frontend and an independent Express backend API.

### FR-002 API-Only Data Access

The frontend shall read and write business data only through backend API endpoints.

### FR-003 Backend Authority

The backend shall be the final authority for pricing, availability, payment verification, booking state, admin authorization, and persisted content.

### FR-004 Guest-Only Public Users

The system shall allow public users to submit bookings, inquiries, quote requests, and subscriptions without creating accounts.

### FR-005 Multi-Admin Support

The system shall support multiple admin users with authenticated access to the dashboard.

### FR-006 Bilingual Public Launch

The production public website shall support English and Arabic. Existing unprefixed URLs shall remain English and Arabic counterparts shall use `/ar`. The system shall not automatically redirect users based on IP address or browser language.

### FR-007 Complete Arabic Customer Journey

Arabic shall cover navigation, public content, offerings, blog, legal pages, contact, quote, newsletter, free and paid booking, payment return and recovery, booking status, thank-you states, validation, errors, and customer transactional emails.

### FR-008 Shared Business State

English and Arabic shall resolve to the same offering, price, availability, hold, booking, payment, calendar, and provider records. Locale shall change presentation only and shall be stored as a trusted customer communication preference on submissions.

### FR-009 English Admin with Bilingual Authoring

The first bilingual release shall keep the admin interface in English while allowing authorized admins to edit, preview, publish, unpublish, and audit English and Arabic content independently.

## 3. Public Website

### FR-010 Home Page

The system shall provide a premium home page that introduces Ahmed Ramah, shows brand positioning, presents key service categories, and routes users to booking, services, contact, blog, and newsletter actions.

### FR-011 Visual Baseline

The public website shall preserve the current frontend quality: strong typography, motion-led sections, responsive behavior, and brand-aligned interaction.

### FR-012 About Page

The system shall provide an About page with editable biography, method, credentials, credibility sections, media, and CTA blocks.

### FR-013 Services Page

The system shall provide a Services page listing active offerings and service categories from the CMS/backend.

### FR-014 Offering Detail

The system shall provide offering detail views for services that require more explanation before booking or quote submission.

### FR-015 Booking Entry Points

The system shall allow users to enter the booking flow from the home page, services page, offering detail page, and direct booking page.

### FR-016 Contact Page

The system shall provide a contact form that stores inquiries and notifies admins.

### FR-017 Blog

The system shall provide a blog index and blog detail pages for published posts.

### FR-018 Legal Pages

The system shall provide Privacy Policy and Terms and Conditions pages managed by the CMS.

### FR-019 Thank You States

The system shall provide clear thank-you or outcome states after submission, booking, payment return, subscription, and contact flows.

## 4. CMS

### FR-030 Full CMS

The admin dashboard shall provide full CMS management for public pages, services, blog posts, legal pages, media, SEO metadata, navigation, footer, and site settings.

### FR-031 Page Sections

The admin shall be able to create, edit, reorder, publish, unpublish, and archive CMS page sections.

### FR-032 Media Assets

The admin shall be able to upload, view, replace, and archive media assets.

### FR-033 SEO Fields

The admin shall be able to configure title, description, canonical URL, image, and indexability fields for relevant pages.

### FR-034 Content Status

Content shall support at least draft, published, archived, and scheduled states where relevant.

### FR-035 Rich Text

Blog posts and long-form content shall support rich text editing.

### FR-036 Slugs

The system shall enforce unique slugs per content type and locale. Fixed public route identities shall remain stable even when a translated content slug differs.

## 5. Offerings

### FR-050 Offering Management

The admin shall be able to create, edit, publish, unpublish, archive, and delete offerings according to retention rules.

### FR-051 Offering Types

The system shall support coaching, therapy-style sessions, workshops, webinars, courses, corporate training, and custom quote-based offerings.

### FR-052 Online and Offline Modes

Offerings shall support online, offline, or hybrid attendance modes.

### FR-053 Offering Metadata

Offerings shall support title, slug, short description, long description, category, media, duration, capacity, pricing, booking behavior, location, calendar behavior, and status.

### FR-054 Quote-Only Offerings

The admin shall be able to configure an offering as quote-only.

### FR-055 Booking Eligibility

The admin shall be able to enable or disable booking per offering.

## 6. Booking

### FR-070 Shared Booking Engine

The system shall use one shared booking engine for all eligible offering types.

### FR-071 Booking Flow Stages

The booking flow shall support offering selection, attendance mode selection where needed, date/slot selection, form completion, price review where needed, payment initiation where needed, and outcome display.

### FR-072 Slot Availability

The system shall show available slots based on backend availability rules, capacity, existing bookings, holds, overrides, and calendar busy blocks.

### FR-073 Backend Final Validation

The backend shall validate availability and capacity again when a booking is submitted.

### FR-074 Free Booking Confirmation

The backend may confirm a free booking immediately after successful validation and persistence.

### FR-075 Paid Booking Pending State

The backend shall create paid bookings in a pending payment state until payment is verified.

### FR-076 Paid Booking Confirmation

The backend shall confirm paid bookings only after successful webhook or trusted payment status verification.

### FR-077 Booking Statuses

Bookings shall support statuses including draft, pending_payment, payment_failed, confirmed, cancelled, rescheduled, completed, no_show, expired, and rejected.

### FR-078 Slot Holds

The system shall support temporary slot holds for paid bookings to reduce double booking during payment.

### FR-079 Hold Expiration

Slot holds shall expire automatically after a configurable time if payment is not completed.

### FR-080 Dynamic Booking Forms

The admin shall be able to configure booking form fields per offering, offering type, or booking type.

### FR-081 Required Fields

The backend shall validate all required fields before accepting the booking.

### FR-082 Extended Birth Fields

The booking form shall support country, full name, email, phone, original date of birth, and original place of birth.

### FR-083 Booking Answers

The system shall store submitted answers with stable question/field references and labels at time of submission.

### FR-084 Capacity

The system shall prevent booking once capacity is reached.

### FR-085 Rescheduling

The admin shall be able to manually reschedule bookings when operationally needed.

### FR-086 Cancellation

The admin shall be able to cancel bookings and record a reason.

## 7. Availability and Calendar

### FR-100 Availability Rules

The admin shall be able to configure recurring availability rules.

### FR-101 Availability Overrides

The admin shall be able to configure one-off availability overrides, blocked dates, and special slots.

### FR-102 Buffers

The system shall support buffer time before or after sessions where configured.

### FR-103 Google Calendar Sync

The backend shall integrate with Google Calendar to create events, retrieve busy blocks, and prevent conflicts according to configuration.

### FR-104 Google Meet

The backend shall generate or attach Google Meet links for online bookings where configured.

### FR-105 Offline Locations

The admin shall be able to manage offline locations and assign them to offerings.

## 8. Pricing

### FR-120 Country Pricing

The system shall support country-based pricing.

### FR-121 Country Detection

The backend shall support automatic country detection using a trusted IP or geo source where available.

### FR-122 Country Override

The system may allow a user-selected country subject to backend validation and fraud rules.

### FR-123 Final Price Resolution

The backend shall calculate and persist final price details before payment initiation.

### FR-124 Early Bird

The admin shall be able to configure early bird pricing per offering.

### FR-125 Coupons

The admin shall be able to create and manage coupons with restrictions and usage limits.

### FR-126 Taxes

The admin shall be able to configure tax rules applicable to country and offering combinations.

## 9. Payments

### FR-140 Payment Provider Adapter

The backend shall expose payment behavior through a provider-agnostic adapter.

### FR-141 Payment Session

The backend shall create a payment session or payment intent for paid bookings through the selected provider.

### FR-142 Webhook Verification

The backend shall verify payment webhooks using provider-specific signature rules.

### FR-143 Payment Events

The system shall persist payment events and webhook payload metadata for traceability.

### FR-144 Payment Status Lookup

The backend shall support status reconciliation with the selected payment provider when needed.

### FR-145 Failed Payment

If payment fails, the booking shall remain unconfirmed and visible to admins.

## 10. Quote Requests

### FR-160 Quote Request Submission

The system shall allow users to submit quote requests for corporate or custom offerings.

### FR-161 Quote Request Data

Quote requests shall support contact details, company details, target audience, expected number of participants, preferred dates, location preference, message, and source offering.

### FR-162 Admin Review

Admins shall be able to review, update status, add internal notes, and follow up on quote requests.

## 11. Contact and Newsletter

### FR-180 Contact Inquiries

The system shall store contact inquiries and notify admins.

### FR-181 Newsletter Subscription

The system shall capture email, optional name/country, source, requested locale, and immutable consent evidence; keep a new subscription pending; send a locale-correct double-opt-in message with a signed, expiring, single-use confirmation token; activate only after valid confirmation; and provide a signed unsubscribe flow that records the outcome.

### FR-182 Duplicate Subscriptions

Subscribe, confirm, and unsubscribe operations shall be idempotent. A duplicate or resubscribe attempt shall not erase prior consent/unsubscribe evidence, bypass suppression, mint unbounded valid tokens, or create duplicate active subscriber rows; the approved resubscribe policy controls any locale update.

## 12. Email Notifications

### FR-200 Transactional Email Provider

The backend shall send transactional emails through Resend or another configured provider.

### FR-201 Customer Emails

The system shall send customer confirmations for bookings, paid confirmations, quote submissions, contact submissions, and subscriptions where enabled.

### FR-202 Admin Emails

The system shall send admin notifications for new operational events.

### FR-203 Email Templates

Authorized admins shall manage English and Arabic customer email templates with independent draft/scheduled/published state, exact placeholder validation, immutable published revisions, protected preview, audit history, and no silent fallback for a required Arabic template. Admin-only operational templates may remain English for this release.

### FR-204 Delivery Logging

The backend shall store email delivery attempts and outcomes.

## 13. Admin Dashboard

### FR-220 Admin Authentication

Admins shall authenticate before accessing `/admin`.

### FR-221 Admin Authorization

The backend shall authorize admin API requests.

### FR-222 Dashboard Modules

The admin dashboard shall include modules for content, offerings, bookings, availability, locations, pricing, payments, quote requests, inquiries, newsletter, blog, media, email templates, settings, users, notifications, and audit logs.

### FR-223 Audit Logs

The system shall record meaningful admin actions.

### FR-224 Dashboard Search and Filters

Operational lists shall support search, filters, sorting, and pagination.

## 14. Error Handling

### FR-240 User-Friendly Errors

The frontend shall show user-friendly errors without exposing internal details.

### FR-241 Structured API Errors

The backend shall return structured errors.

### FR-242 Submission Preservation

The frontend should preserve user input where practical after validation or transient errors.

## 15. Acceptance Criteria

Functional completion requires:

- Public pages and CMS content are connected to backend data.
- Booking flows handle free, paid, online, offline, event, workshop, course, and quote scenarios.
- Admin users can manage operational data.
- Payment state is backend verified.
- Calendar/Meet integration works for configured online offerings.
- Emails are sent and logged.
- Existing English URLs remain stable and every public customer journey has an approved and tested Arabic `/ar` equivalent.
- English and Arabic produce identical machine state for pricing, capacity, booking, payment, Calendar/Meet, and provider operations.
- Required Arabic public content and customer emails never silently fall back to English.
- Admin users can manage and audit both locales from the English admin interface.
- No shop or digital product delivery functionality exists in MVP.
