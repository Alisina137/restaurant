# Phase roadmap

Each phase owns its internal tasks, parts and steps. The user sees a phase objective, concise progress updates and one integrated delivery. Security, failure handling and relevant tests accompany each feature.

| Phase | Deliverable | Acceptance and dependencies |
|---|---|---|
| 1 — Product and Design | This planning package and screen board | Confirmed scope distinguished from defaults; customer/owner journeys, data model, payment separation, research limits and phase gates documented |
| 2 — Foundation, Accounts and Restaurant Pages | Initial full source project; responsive shell; authentication; owner onboarding; admin approval; public approved profiles; staff ownership checks; locale foundations | Valid accounts and recovery flow with configured provider; unauthorized access denied; drafts private; approved profiles viewable; migrations/build/typecheck and relevant tests; depends on Neon/auth/media configuration for live verification |
| 3 — Feed and Discovery | Posts/media management, linked meal-ready contracts, Discover/Following, follows/likes/saves, reporting, search/filter foundation | Published eligible posts paginated; duplicate social actions prevented; tenant-safe edits; stale/unavailable links handled; requires Phase 2. Meal results/links become fully active with catalog in Phase 4 |
| 4 — Menus and Ordering | Categories/meals/variants/extras, meal search and post links, cart, delivery settings, server quotes, order management and status timeline | Server totals; correct option ownership; one restaurant per order; service-area validation; immutable snapshots; legal state transitions. No live paid checkout claim before Phase 5; test-only payment fixtures never enabled in production |
| 5 — Payments and Subscriptions | HesabPay sandbox and approved live configuration, verified callbacks, renewal, entitlements, refunds and settlement/reconciliation | Amount/reference checks; replay safety; explicit delayed/mismatched payment handling; expired subscription restrictions; confirmed merchant arrangement and price required for live launch |
| 6 — Launch Preparation | Completed-order reviews, notifications/analytics, support/admin completion, localization review, end-to-end hardening, deployment/runbook | Critical journeys on mobile/desktop; owner/staff support process; recovery and backups tested; merchant integration verified; launch service area/fees/policies resolved; deploy only under authorization |

## Phase 2 scope details

Start in a new repository/project, carrying `docs` from Phase 1. Resolve and pin stack versions, configure migrations and environment validation, create reusable responsive primitives, implement real account sessions and membership rules, build draft onboarding and approval workflow, and public restaurant profiles. Basic admin approval is here, not deferred until launch. Owner billing remains clearly unavailable until Phase 5; any development pilot entitlement is explicitly test-only.

Phase 2 excludes live payments, full feed, full menu and orders; it must not display fake success for those future features. Use navigation only for working routes or explicitly unavailable future features. Demo data, if offered, is isolated from production and clearly labeled.

## Practical external dependencies

Before database-backed Phase 2 verification: an accessible development Neon connection configured securely in the environment, authentication/recovery service choice and credentials if external, accessible image storage. Never ask the user to paste production secrets into chat. Build independent code and report unverified external checks honestly if access is missing.

Before live Phase 5: merchant account, sandbox access, API key, webhook settings; subscription price/term; approved restaurant payout model, fees and refund policy. Before launch: real pilot city/areas and participating restaurants, domain/hosting, localized content review, support contact and operating procedures.

## Future mobile phase

After validating web demand: define Android/iOS scope, implement mobile-specific auth and secure token storage, native navigation/notifications, and API compatibility tests. Reuse domain logic, accounts, catalog and order history. Mobile UI is additional work, not an automatic website conversion.
