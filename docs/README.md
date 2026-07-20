# Documentation Index

This folder contains the target product, requirements, architecture, UX, delivery, and engineering documentation for the Ahmed Ramah Coaching Platform.

The documentation describes the final intended system, not only the currently implemented frontend. The existing Next.js frontend is treated as the visual and experiential baseline: the complete platform must preserve the current premium motion-led personal-brand quality while adding booking, CMS, admin, backend, payment, and integration capabilities through a clean frontend/backend contract.

## Folder Structure

| Folder | Purpose | Main Files |
| --- | --- | --- |
| `01-product/` | Product definition, business scope, audience, goals, and operating model. | `PRD.md`, `BRS.md` |
| `02-requirements/` | Functional and non-functional requirements for implementation and acceptance. | `FRS.md`, `NFR.md` |
| `03-architecture/` | System, frontend, backend, API, data, booking, payment, integrations, security, testing, deployment, monitoring, backup, and incident documentation. | `System-Architecture.md`, `API-Design.md`, `ERD.md`, `Data-Dictionary.md` |
| `04-ux-and-flows/` | Public website, booking, admin, wireframe, and use-case flow documentation. | `Public-Site-Flows.md`, `Booking-Flow.md`, `Admin-Dashboard-Flows.md`, `Wireframes.md`, `Use-Case-Diagrams.md` |
| `05-project-plan/` | Delivery plan, phases, milestones, detailed implementation roadmap, production-readiness execution, progress log, dependencies, acceptance, and launch readiness. | `project_plan.md`, `Detailed-Implementation-Plan.md`, `Production-Readiness-Execution-Plan.md`, `Progress-Log.md` |
| `06-engineering/` | Engineering workflow, frontend/backend contract rules, branching, review, onboarding, and production runbooks. | `Frontend-Backend-Contract.md`, `Team-Workflow.md`, `Git-Branching-Strategy.md`, `Code-Review-Checklist.md`, `Onboarding-Guide.md`, `Production-Runbook.md` |
| `superpowers/` | Approved focused designs and executable task-by-task plans that expand the main production roadmap. | `specs/2026-07-20-bilingual-arabic-customer-journey-design.md`, `plans/2026-07-20-bilingual-arabic-customer-journey.md` |

## Source Inputs

The structured documentation is derived from:

- `PRD_ahmed rammah.md`
- `BRS - ahmed rammah dev.md`
- `Ahmed Ramah -  FRS.md`
- `NFR.md`
- `Ahmed_Ramah_Proposal.pdf`
- Existing frontend implementation in `../rammah-next/`

The original source files are retained as historical inputs.

## Key Product Decisions

| Area | Decision |
| --- | --- |
| Frontend | Independent Next.js app with premium motion-led public experience. |
| Backend | Independent Express API. |
| ORM | Drizzle ORM. |
| Database | PostgreSQL. |
| Admin UI | Protected `/admin` area in the frontend app. |
| Public users | Guest-only. No public accounts in MVP. |
| Admin users | Multiple admin users are supported. |
| Booking | Shared booking engine for consultations, sessions, workshops, webinars, courses, and corporate requests. |
| Online sessions | Google Meet link generation through Google Calendar/Meet integration. |
| Offline sessions | Admin-managed locations. |
| Payments | Kashier is the launch provider behind a provider-agnostic adapter; live approval/credentials remain a release input, and provider truth never comes from browser locale/query data. |
| Pricing | Country-based pricing, explicit country override, and early bird pricing are launch scope; coupons/tax ship only if DR-01 supplies approved rules, otherwise their fake contract is removed. |
| CMS | Full admin-managed CMS for pages, services, blog, settings, media, legal pages, and booking content. |
| Language | Production public launch is bilingual: existing unprefixed English routes plus a complete Arabic customer journey under `/ar`; admin chrome remains English and authors both locales. |
| Hosting | Hostinger VPS is the deployment target, with architecture kept VPS-portable. |

## Recommended Reading Order

1. `01-product/PRD.md`
2. `01-product/BRS.md`
3. `02-requirements/FRS.md`
4. `02-requirements/NFR.md`
5. `03-architecture/System-Architecture.md`
6. `03-architecture/Frontend-Architecture.md`
7. `03-architecture/Backend-Architecture.md`
8. `03-architecture/ERD.md`
9. `03-architecture/Data-Dictionary.md`
10. `03-architecture/API-Design.md`
11. `03-architecture/Booking-Architecture.md`
12. `03-architecture/Payment-Architecture.md`
13. `03-architecture/Google-Calendar-Integration.md`
14. `03-architecture/Email-Notification-Architecture.md`
15. `03-architecture/Auth-Security.md`
16. `03-architecture/Webhook-Strategy.md`
17. `03-architecture/Error-Handling-Strategy.md`
18. `04-ux-and-flows/Booking-Flow.md`
19. `04-ux-and-flows/Admin-Dashboard-Flows.md`
20. `05-project-plan/Production-Readiness-Execution-Plan.md` — source of truth for all remaining production work.
21. `superpowers/specs/2026-07-20-bilingual-arabic-customer-journey-design.md` — approved bilingual product/architecture baseline.
22. `superpowers/plans/2026-07-20-bilingual-arabic-customer-journey.md` — file-by-file bilingual implementation sequence.
23. `05-project-plan/project_plan.md` — earlier high-level roadmap.
24. `05-project-plan/Detailed-Implementation-Plan.md` — legacy baseline retained for history.
25. `05-project-plan/Progress-Log.md`
26. `06-engineering/Frontend-Backend-Contract.md`
27. `06-engineering/Onboarding-Guide.md`
28. `06-engineering/Production-Runbook.md`

## Documentation Ownership Rules

- `PRD.md` owns product intent and MVP scope.
- `FRS.md` owns testable functional behavior.
- `NFR.md` owns measurable quality requirements.
- `System-Architecture.md` owns the high-level architecture direction.
- `ERD.md` owns the canonical data model.
- `Data-Dictionary.md` owns field-level definitions.
- `API-Design.md` owns the frontend/backend API contract.
- `Frontend-Backend-Contract.md` owns collaboration boundaries between frontend and backend work.
- Integration-specific documents own provider behavior, failure handling, and adapter requirements.

## Out of Scope

The Ahmed Ramah platform does not include a shop or digital product delivery in MVP. The following domains from the Coach Hossam reference platform are intentionally excluded:

- Shop page.
- Digital products.
- Product orders.
- Download links.
- Digital file delivery.
- Product fulfillment workflows.

Payments remain in scope only as part of paid bookings, paid events, paid workshops, courses, and other paid offerings.
