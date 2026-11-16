
# Phase 12 — SaaS Subscriptions and Platform Administration

## Delivered capabilities

- Platform Overview: aggregate tenant lifecycle, overdue invoices, payment proof queue and support counts without private restaurant order or guest data.
- Platform Restaurants (All / Pending / Suspended / Details): search, plan assignment, owner contact, filtered status, reasoned suspend and eligible restore.
- Platform Subscriptions: immutable versioned plans (AFN minor units), invoice draft/issue/paid/void lifecycle, independent verification or rejection of manual payment evidence. Proof submission alone never marks an invoice paid.
- Restaurant Subscription: plan limits, paid-until and trial state, invoices, Print / Save as PDF via browser, owner-only upgrade requests and payment evidence.
- Support Tickets: tenant-scoped message threads, platform status operations and separate audit events; no raw customer orders shared.
- Access Grants: platform requests limited metadata access; tenant owner may approve for one hour, reject or revoke; metadata reads are audited and grant expiry checked.
- Platform Settings: reason-required trial/grace/contact/incident edits. Filterable platform audit.
- Entitlements: transactions serialize staff/invitation/table additions and plan changes; suspended/expired tenants may finish existing checks but cannot open new visits.

## Automated acceptance

The phase12-ci.ts test script runs after P01–P11 in GitHub Actions, against disposable PostgreSQL. It covers role/tenant isolation, versioned plans, exact verified invoice settlement, rejection of repeat verification, staff/table cap, suspended-tenant existing-visit availability and new-visit guard, restoration, ticket privacy and time-bounded support grants.

## Manual pilot checks remaining

Review phone/tablet and desktop layouts in Dari/Pashto RTL and English LTR. Perform a supervised bank-confirmation test using actual payment evidence, test concurrent management actions and expired grant rejection, reconcile plan invoice amounts, and exercise suspension and restoration while a cashier settles a pre-existing check.

**Deliberate limitations:** No external automatic payment gateway, uploaded payment proof files, server-rendered PDF attachment, automatic overdue reminders, inventory profit analytics or multi-location booking. Invoice Print / Save as PDF uses the browser print dialog. Platform pending approval queue applies to tenants explicitly set pending; ordinary self-onboarding remains automatic.

## Local update

Run git pull --ff-only origin main, then pnpm db:migrate from C:\projects\restaurant. Run pnpm dev:api, pnpm dev:web and pnpm dev:mobile in separate terminals.
