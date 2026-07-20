# Data Dictionary

## 1. Purpose

This document defines the business meaning, ownership, sensitivity, and implementation notes for the platform data model.

## 2. Sensitivity Levels

| Level | Meaning | Examples |
| --- | --- | --- |
| Public | Safe to expose publicly when published. | Page title, service description, blog post. |
| Internal | Admin-only operational data. | Booking status, notes, audit logs. |
| Personal | Customer/admin personal data. | Name, email, phone, birth details. |
| Secret | Credentials or sensitive provider data. | Password hashes, tokens, API keys. |
| Financial | Payment-related data. | Payment IDs, amounts, provider events. |

## 3. Core Tables

### ADMIN_USERS

| Field | Meaning | Sensitivity | Notes |
| --- | --- | --- | --- |
| `id` | Admin identifier. | Internal | Primary key. |
| `name` | Admin display name. | Internal | Required. |
| `email` | Login email. | Personal | Unique. |
| `password_hash` | Hashed password. | Secret | Never expose. |
| `role` | Permission role. | Internal | Use enum. |
| `status` | Account state. | Internal | active/invited/suspended. |
| `last_login_at` | Last successful login. | Internal | Audit support. |

### PAGES

| Field | Meaning | Sensitivity | Notes |
| --- | --- | --- | --- |
| `slug` | Public URL key. | Public | Unique. |
| `title` | Page title. | Public | Published only. |
| `status` | Publishing state. | Internal | Controls exposure. |
| `template` | Rendering hint. | Internal | Frontend maps to layout. |

### PAGE_SECTIONS

| Field | Meaning | Sensitivity | Notes |
| --- | --- | --- | --- |
| `section_type` | Type of content block. | Internal | Hero, CTA, bio, etc. |
| `title` | Section heading. | Public | Published only. |
| `body` | Section copy. | Public | May be rich text. |
| `config` | Flexible JSON config. | Internal/Public | Validate allowed shapes. |
| `sort_order` | Section order. | Internal | Integer. |

### MEDIA_ASSETS

| Field | Meaning | Sensitivity | Notes |
| --- | --- | --- | --- |
| `storage_key` | Internal storage reference. | Internal | Not necessarily public URL. |
| `public_url` | Public asset URL. | Public | Only for published assets. |
| `alt_text` | Accessibility text. | Public | Required for public images. |
| `mime_type` | File content type. | Internal | Validate uploads. |

### OFFERINGS

| Field | Meaning | Sensitivity | Notes |
| --- | --- | --- | --- |
| `title` | Offering name. | Public | Published only. |
| `slug` | Public URL key. | Public | Unique. |
| `offering_type` | Service classification. | Public/Internal | Drives UI and admin filters. |
| `attendance_mode` | online/offline/hybrid. | Public | Used in booking flow. |
| `booking_mode` | free/paid/quote. | Public/Internal | Backend authority. |
| `duration_minutes` | Session duration. | Public | Used for slots. |
| `capacity` | Seat/session capacity. | Public/Internal | Backend enforcement. |
| `requires_payment` | Payment required. | Internal | Derived or explicit. |
| `status` | Publishing state. | Internal | Controls visibility. |

### OFFERING_PRICES

| Field | Meaning | Sensitivity | Notes |
| --- | --- | --- | --- |
| `country_code` | ISO country code. | Public/Internal | Supports global pricing. |
| `currency` | ISO currency code. | Public | Must match payment provider support. |
| `base_amount_minor` | Price in minor units. | Public/Internal | Backend authority. |
| `early_bird_amount_minor` | Early discount price. | Public/Internal | Optional. |
| `early_bird_ends_at` | Early bird deadline. | Public/Internal | UTC. |

### BOOKINGS

| Field | Meaning | Sensitivity | Notes |
| --- | --- | --- | --- |
| `public_token` | Public-safe lookup token. | Internal | Used for status page links. |
| `offering_id` | Booked offering. | Internal | Foreign key. |
| `status` | Booking state. | Internal | Controls operations. |
| `customer_full_name` | Guest full name. | Personal | Required. |
| `customer_email` | Guest email. | Personal | Required. |
| `customer_phone` | Guest phone. | Personal | Required where configured. |
| `country_code` | Customer/pricing country. | Personal/Internal | Pricing input. |
| `slot_start_at` | Booking start. | Internal/Public to customer | UTC. |
| `slot_end_at` | Booking end. | Internal/Public to customer | UTC. |
| `price_currency` | Booking currency. | Financial | Snapshot. |
| `base_amount_minor` | Base amount. | Financial | Snapshot. |
| `discount_amount_minor` | Discount amount. | Financial | Snapshot. |
| `tax_amount_minor` | Tax amount. | Financial | Snapshot. |
| `total_amount_minor` | Final total. | Financial | Snapshot. |
| `confirmed_at` | Confirmation time. | Internal | Set by backend only. |

### BOOKING_FORM_FIELDS

| Field | Meaning | Sensitivity | Notes |
| --- | --- | --- | --- |
| `field_key` | Stable field identifier. | Internal | E.g. originalDateOfBirth. |
| `label` | Legacy/base user-facing label. | Public | Backfilled to English translation; public reads use `booking_form_field_translations` for the requested locale. |
| `field_type` | Input type. | Internal | text/date/select/etc. |
| `required` | Required flag. | Public/Internal | Backend enforced. |
| `validation_rules` | Field validation config. | Internal | JSON with allowed rules. |

### BOOKING_ANSWERS

| Field | Meaning | Sensitivity | Notes |
| --- | --- | --- | --- |
| `field_key_snapshot` | Field key at submission. | Internal | Protects history. |
| `label_snapshot` | Server-resolved localized label at submission. | Internal | Protects admin readability; client-supplied labels are ignored/rejected. |
| `value` | Submitted value. | Personal | May include birth details. |

### PAYMENTS

| Field | Meaning | Sensitivity | Notes |
| --- | --- | --- | --- |
| `provider` | Payment gateway key. | Financial/Internal | Not finalized. |
| `provider_payment_id` | Gateway identifier. | Financial | Store for reconciliation. |
| `status` | Payment state. | Financial/Internal | Drives booking confirmation. |
| `amount_minor` | Amount paid/expected. | Financial | Must match booking total. |
| `checkout_url` | Provider checkout URL. | Financial/Internal | Can expire. |
| `idempotency_key` | Retry safety key. | Internal | Unique where needed. |

### PAYMENT_WEBHOOK_EVENTS

| Field | Meaning | Sensitivity | Notes |
| --- | --- | --- | --- |
| `provider_event_id` | Gateway event ID. | Financial/Internal | Idempotency key. |
| `signature_valid` | Verification result. | Internal | Must be true before processing. |
| `payload` | Raw event body. | Financial/Internal | Redact if displayed. |
| `processing_status` | processed/failed/ignored. | Internal | Operational review. |

### QUOTE_REQUESTS

| Field | Meaning | Sensitivity | Notes |
| --- | --- | --- | --- |
| `company_name` | Corporate buyer company. | Personal/Internal | Admin-only. |
| `participants_count` | Expected audience size. | Internal | For follow-up. |
| `message` | Submitted requirement. | Personal/Internal | Admin-only. |
| `admin_notes` | Internal notes. | Internal | Never public. |

### NEWSLETTER_SUBSCRIBERS

| Field | Meaning | Sensitivity | Notes |
| --- | --- | --- | --- |
| `email` | Subscriber email. | Personal | Unique. |
| `name` | Optional name. | Personal | Optional. |
| `source` | Capture source. | Internal | Analytics. |
| `unsubscribe_token` | Future unsubscribe token. | Secret/Internal | Do not expose except unsubscribe links. |

### EMAIL_DELIVERIES

| Field | Meaning | Sensitivity | Notes |
| --- | --- | --- | --- |
| `recipient_email` | Recipient. | Personal | Admin-only. |
| `provider_message_id` | Email provider ID. | Internal | Reconciliation. |
| `status` | Delivery status. | Internal | sent/failed/etc. |
| `last_error` | Failure detail. | Internal | Avoid secret leakage. |

## 4. Data Ownership

| Domain | Owner |
| --- | --- |
| Public content | CMS/admin module. |
| Offerings | Offerings module. |
| Pricing | Pricing module. |
| Booking records | Booking module. |
| Payment records | Payment module. |
| Calendar records | Google Calendar integration module. |
| Email records | Email module. |
| Admin users | Auth/admin module. |
| Audit logs | Audit module. |

## 5. Retention Guidance

- Bookings: retain for business and audit requirements.
- Payment events: retain for reconciliation and dispute review.
- Contact inquiries: retain until no longer operationally needed.
- Newsletter subscribers: retain while subscribed; retain minimal unsubscribe history if needed.
- Audit logs: retain for a defined operational period.
- Media: archive before deletion where public content may reference it.

## 6. Privacy Notes

- Original date/place of birth are personal and should be protected.
- Public APIs must not expose personal booking data.
- Admin exports, if added later, must be permissioned and logged.
- Raw webhook payloads should be redacted in admin views.
