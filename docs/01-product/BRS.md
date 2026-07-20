# Business Requirements Specification

## 1. Document Purpose

This Business Requirements Specification defines the business operating requirements for the Ahmed Ramah Coaching Platform. It explains what the business needs the system to achieve, which users it serves, what operational controls are required, and how success will be evaluated.

## 2. Business Context

Ahmed Ramah's digital presence must operate as both a premium brand experience and a functional booking and content management platform. The existing frontend establishes a strong visual identity and positioning around engineering, systemizing, training, coaching, and psychological decoding. The complete product must turn that brand experience into measurable business outcomes.

## 3. Business Objectives

- Build trust and authority for Ahmed Ramah.
- Convert qualified visitors into bookings and quote requests.
- Support multiple service types without rebuilding the system each time.
- Make admin operations manageable by non-developers.
- Reduce manual back-and-forth around times, locations, pricing, and confirmations.
- Support local and international customers.
- Serve English and Arabic customers through one shared booking, pricing, payment, content, and operational process.
- Keep payment gateway choice flexible until final provider selection.

## 4. Stakeholders

| Stakeholder | Interest |
| --- | --- |
| Ahmed Ramah | Brand representation, service conversion, operational control. |
| Admin users | Manage content, bookings, availability, pricing, leads, subscribers, and notifications. |
| Individual clients | Understand services and book sessions easily. |
| Workshop/course participants | Register for events and receive clear confirmation. |
| Corporate buyers | Request custom training and receive follow-up. |
| Developers | Implement frontend/backend features against a stable contract. |
| Operations | Deploy, monitor, back up, and troubleshoot the platform. |

## 5. Business Capabilities

The platform must provide the following capabilities:

- Premium website publishing.
- Service and offering management.
- Guest booking management.
- Paid booking management.
- Event and capacity management.
- Corporate quote handling.
- Content management.
- Blog publishing.
- Newsletter capture.
- Contact inquiry capture.
- Email notifications.
- Google Calendar/Meet coordination.
- Payment gateway integration.
- Pricing and discount configuration.
- Admin user management.
- Operational visibility.

## 6. Business Rules

### 6.1 Guest-Only Public Access

Public users must not be required to create accounts. The business wants low-friction submission for bookings, registrations, quote requests, contact inquiries, and newsletter subscriptions.

### 6.2 Admin-Only Operations

Operational control belongs to authorized admins. Public users cannot edit bookings, content, pricing, locations, schedules, or account data.

### 6.3 Shared Booking Engine

The business must not maintain separate booking systems for different offering types. Consultations, workshops, webinars, courses, paid events, free events, and corporate requests must be supported by one configurable domain model.

### 6.4 Payment Verification

Paid bookings are not confirmed until the backend verifies payment through the selected payment gateway. A return URL alone is not enough to confirm a booking.

### 6.5 Provider Flexibility

The payment provider is not finalized. The business requires a provider-agnostic payment architecture so Kashier, Paymob, or another provider can be selected without redesigning booking logic.

### 6.6 Google Calendar and Meet

Online sessions should generate or attach Google Meet details when configured. Calendar events should help prevent scheduling conflicts and support admin operations.

### 6.7 Country Pricing

The business must support different pricing by country or market. Auto country detection is required to reduce friction, but final pricing is controlled by backend rules.

### 6.8 CMS Ownership

The business must be able to update public content without developer deployments. This includes pages, services, legal pages, blog posts, media, SEO fields, and booking copy.

## 7. Business Scope

### 7.1 Included

- Premium public website.
- Admin dashboard.
- Full CMS.
- Booking and registration.
- Online/offline sessions.
- Dynamic forms.
- Country pricing.
- Early bird, coupons, taxes.
- Google Calendar/Meet.
- Payment gateway adapter.
- Email notifications.
- Contact, newsletter, quote requests.
- Blog.
- Multi-admin support.
- Audit logs.
- Hostinger VPS deployment.

### 7.2 Excluded

- Shop.
- Digital products.
- Download fulfillment.
- Public accounts.
- Mobile apps.
- Complex marketing automation.
- Built-in accounting system.

## 8. Success Metrics

| Metric | Business Meaning |
| --- | --- |
| Booking conversion rate | Website visitors become bookings. |
| Quote request count | Corporate demand captured. |
| Paid booking completion rate | Payment and booking flow works. |
| Booking abandonment rate | Flow friction is visible. |
| Admin task completion time | Dashboard is operationally useful. |
| Email delivery success rate | Communication is reliable. |
| Content publishing lead time | CMS reduces developer dependency. |
| Error rate | Platform reliability. |

## 9. Operational Requirements

- Admins must be able to review all submitted records.
- Admins must be able to identify whether a booking is free, pending payment, paid, failed, cancelled, or completed.
- Admins must be able to identify country, price, coupon, tax, and final amount for each paid booking.
- Admins must be able to manually follow up on quote requests and failed payment cases.
- Admins must be able to publish and unpublish content.
- Admins must be able to configure availability and locations.
- Admins must be able to manage multiple admin accounts.

## 10. Business Risks

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Payment provider not finalized | Integration delay | Use adapter architecture and provider-neutral docs. |
| Calendar sync errors | Double booking or wrong meeting details | Backend final validation, retries, logs, dashboard visibility. |
| CMS scope too broad | Implementation delay | Prioritize required page/content types first. |
| Country detection inaccurate | Wrong pricing | Allow controlled user correction and backend validation. |
| Admin dashboard weak UX | Operations remain manual | Treat admin as product surface, not only CRUD. |
| VPS misconfiguration | Downtime/security risk | Deployment checklist, backups, monitoring, reverse proxy rules. |

## 11. MVP Acceptance

MVP is accepted when the business can operate the platform without developer involvement for normal daily tasks:

- Update content.
- Manage services.
- Manage availability.
- Receive bookings.
- Receive paid bookings after provider selection.
- Review quote requests.
- Publish blog posts.
- See subscribers and inquiries.
- Send customer/admin emails.
- Deploy and restore from documented operations.
