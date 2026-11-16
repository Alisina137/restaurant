# Phase 12 — SaaS subscriptions and platform administration

## Delivery and operation

- Restaurant owner/manager **Subscription** page: plan, trial/period dates, immutable invoicing, manual payment evidence. Manager is read-only. Owner may request plan changes by support ticket.
- Restaurant **Support**: scoped tenant tickets and messages; owner-only temporary billing/configuration metadata grants (1–60 minutes), immediate revoke. No blanket platform access to operational orders.
- Platform overview and restaurant listing/detail: filters, owner contact/location metadata, plan assignment, approval/rejection of genuinely pending tenants, audited suspend/grace/restore with a reason. Existing open visits can still be closed, but new visits are blocked under suspension, expired trial, or expired paid term/grace.
- Plans are **versioned**. New plan edits produce a new row; issued invoice plan snapshots and prices never change. Single-location MVP remains enforced; staff and tables are capped at server write time with tenant-row locking. Pending staff invitations reserve seats.
- Manual billing: platform issues invoices, owner submits a reference/method and exact amount, platform verifies/rejects proof with a reason; only verification marks invoice paid and activates a subscription. Duplicate verified references and multiple verified proofs per invoice are blocked. There is **no online payment gateway**.
- Printable invoice view supports standard browser **Print → Save as PDF**; no imaginary server-generated PDF or automatic collection.
- Platform support: ticket queue, staff notes, scoped metadata access only for active owner grants; platform audit, trial/grace defaults, incident banner and support email.
- React/Next pages use the stable app shell and feature-specific mobile responsive panels; localized high-visibility flows in Dari, Pashto and English.

## Automated acceptance (src/phase12-ci.ts)

1. Platform-only metrics and settings; owners cannot access cross-tenant billing/admin metadata.
2. Trial onboarding, plan and invoice creation, fixed invoice snapshot.
3. Pending proof keeps invoice issued, platform verification settles once and activates subscription.
4. Duplicate external reference rejected at verification (no double payment).
5. Staff and table quotas reject excess creation (409) even with a valid restaurant role.
6. Suspension blocks a *new* visit; an existing unpaid test visit can finish safely; paid period permits restore.
7. Tickets scoped to tenant; limited support metadata is accessible only while grant valid, and revocation immediately returns 403.
8. Platform audit and policy changes require explicit confirmation and record actor.

## Manual acceptance remaining

- Verify two distinct real restaurant logins and invoice-print legibility/RTL on narrow Android and desktop browsers.
- Simulate overdue terms and expired grace with time control, confirm no new seating while cashiers can settle existing checks.
- Verify actual bank/cash payment references **outside the app** before clicking Verify; no provider integration.
- Confirm support metadata expires after 60 minutes, platform cannot read restaurant orders, rate limiting and physical receipt handling.
- Real device, PDF print and production migration rehearsal remain for P13/P14.

## Current scope boundaries

This phase deliberately has no gateway settlement, allocation of partial payments, multiple branches, in-app email receipt, internal staff payment provider, or direct support impersonation. Restrict data access to preapproved metadata paths and preserve financial/audit logs.
