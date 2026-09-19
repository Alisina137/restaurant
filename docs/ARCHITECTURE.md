# Architecture decisions — planning baseline

## ADR-001: One application with reusable APIs

Proposed stack: TypeScript, Next.js App Router, Tailwind CSS, accessible component primitives, Neon PostgreSQL, Drizzle ORM with SQL migrations, npm. Use a modular monolith. Next.js Route Handlers expose versioned JSON APIs; domain services perform business logic independently of page rendering. Native mobile clients can later call these services through the APIs.

Why: one project and deployment are easier to operate initially; SQL suits relationships, ownership and money records. Alternative: separate React/Express applications, adding deployment and integration work before mobile exists. Exact framework/library versions and deployment adapter compatibility must be resolved and locked in Phase 2; this document does not claim packages are installed.

Next.js documents Route Handlers as request handlers in its app routing system: [official documentation](https://nextjs.org/docs/app/getting-started/route-handlers).

Organize by feature: identity, restaurants, posts, catalog, ordering, billing, administration. Each feature has validation, service, data access and relevant tests; routes remain thin. Avoid calling the app's HTTP endpoints from server components when they can safely invoke the same authorized service directly.

## ADR-002: Neon and server-side isolation

Neon is required by the user's workflow. Database access remains server-side; use an HTTP-compatible driver if the eventual runtime requires it. Driver transactions and hosting compatibility must be tested before committing to a runtime. Do not silently replace Neon with another database.

Development, test and production use separate databases/branches and credentials. No production mutation from tests. Generate and review migrations, test on a disposable database, preserve existing data, back up before destructive releases. Use constraints, indexes and conditional updates rather than relying on UI checks.

## ADR-003: Identity and authorization

Use an established authentication library compatible with the selected runtime; final selection is a Phase 2 compatibility decision. Initial UX is email/password with secure recovery. Store password hashes using the library's supported secure hashing mechanism, never custom encryption. Sessions are revocable and held in secure HttpOnly cookies for the website. Add CSRF/origin checks and rate limits. Mobile token storage/refresh is a separate future implementation, not copying web cookies into an app.

Restaurant membership authorizes every owner/staff operation. Derive actor identity from the session. Never accept actor role or restaurant ownership from request input. Admin access is explicitly granted and audited. Public queries exclude pending pages, private customer information and payment records. Orders are visible only to their customer, assigned restaurant staff or authorized support.

## ADR-004: Payments and subscriptions

Keep payment provider code behind a server-only adapter: create checkout, verify notification, query/reconcile status where supported, request/record refund according to the actual API. Read current official API contracts during Phase 5. Never invent endpoints or webhook signatures. Customer redirects are UI navigation, not evidence of payment.

Persist the order before requesting a payment session. Use idempotency keys, unique provider events and amount/currency/reference checks. Persist durable event receipt before responding; retry processing safely. Handle delayed/out-of-order events and a provider success after local timeout. Record unexpected paid attempts for refund reconciliation; do not fulfill twice.

Subscription charges belong to the platform; meal payments belong to a separately identified restaurant settlement arrangement. HesabPay documents optional vendor distribution, but merchant approval, recipient onboarding, fees, payout timing and refunds must be established before live checkout. Do not assume funds can be held as escrow. If the approved account cannot support the intended arrangement, choose a supported direct-merchant model before enabling live orders.

No automatic subscription renewal is assumed. Manual renewal starts at max(current expiry, verified payment time) and adds the invoiced term once.

## ADR-005: Media, notifications and jobs

Use object storage for uploaded restaurant photos, with provider selection in Phase 2 based on access and cost. No image blobs in PostgreSQL. Enforce file size/type/count, decode and re-encode images, strip metadata, create optimized sizes, and authorize upload ownership. Public images use a separate public URL policy from any private assets. Do not persist production media on a temporary server filesystem.

In-app notifications are baseline; owner order screens poll with a visible last-updated time and stale/offline warning. Persistent notifications survive reloads. Email recovery and optional operational email require an accessible email service. SMS and push are not silently assumed. Durable scheduled processing handles unpaid expiry, acceptance timeout, notification retries and reconciliation; do not rely on browser timers or an in-memory queue for money-related operations.

## API boundaries

| API group | Responsibility |
|---|---|
| `/api/v1/restaurants`, `/meals` | Public eligible catalog, filtering and detail |
| `/api/v1/feed`, `/follows`, `/likes`, `/saves` | Paginated feed and authenticated social actions |
| `/api/v1/quotes`, `/orders` | Server-priced quote and idempotent order creation; own-order reads |
| `/api/v1/owner/...` | Membership-scoped publishing, catalog, fulfillment and settings |
| `/api/v1/billing/...` | Authorized subscriptions and provider session requests |
| `/api/webhooks/hesabpay` | Verified, idempotent provider event ingestion |
| `/api/v1/admin/...` | Explicitly authorized moderation and reconciliation |

Define consistent error codes, field errors, request IDs and cursor pagination. Use transactional quote/order snapshots; enforce optimistic concurrency on order transitions. Never return raw database errors or secrets.

## Deployment and operations

Target: HTTPS web runtime compatible with Next.js, Neon, media uploads and scheduled jobs. Hosting vendor/domain remain unselected; no deployment authorized within this planning phase. If using Sites in later phases, inspect its runtime and build compatibility before setup; preserve Neon and the phase-delivery contract. Return source packages even when previews are available.

Use structured logs without secrets, full addresses or payment credentials. Record critical state transitions and provider references. Add error reporting, health checks, job failure alerts, migration/release instructions and rollback procedure before launch. Separate source rollback from data/payment recovery.

Initial performance goals to measure: paginated feed; optimized images with fixed dimensions; no autoplay videos; database indexes for main queries; target p75 LCP under 2.5 seconds on representative pilot traffic, adjusted after real network measurements. No measured performance claims exist yet.
