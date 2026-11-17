# Phase 17 — Global interaction components and consistent feedback

## Delivered implementation
- A root-level, route-persistent interaction provider powers localized UI notifications and Promise-based confirmation dialogs. It supports success/error/info tones, timed dismissal, a bounded toast stack, Escape/backdrop cancellation, focus trapping/restoration, and cleanup when unmounted. Confirmations never execute the business action until explicitly accepted.
- Reusable accessible controls: controlled search with clear action, filter select, pagination with previous/next boundaries, inline error/status with Retry, and an existing-dialog focus/Escape hook.
- Every shared feedback control uses the established Phase 15 palette, respects Dari/Pashto RTL and English LTR, supports small screens, reduced motion and receipt print exclusion.
- Menu management: accessible archive confirmation, notifications for successful saves/archives/duplication/availability changes, consistent search/filter/skeleton/pagination states and a synchronous lock against overlapping mutations. Catalog editor and preview dialogs gain keyboard focus handling.
- Floor operations: confirmation for archive/cleaned-table transitions, mutation single-flight protection, success toasts, inline retry feedback and a focus-safe form dialog. Floor sections/tables use shared empty/loading/pagination controls.
- Kitchen: confirmed ticket transitions and waiter reminders, single-flight action guard, ticket/history loading and empty states, consistent retry alerts, localized stale-ticket feedback, focus-safe ticket detail modal and shared history pagination.
- Staff: invitation revocation confirmation, error versus success notifications (including undelivered invites), duplicate-action protection, inline edit errors, a focus-safe edit form, shared loading/pagination controls.
- Cashier checks: a debounced search field with clear control, stale-response protection so older requests cannot replace newer query results, loading indicator, shared retry/page controls and a single-flight check open action.
- Cashier check detail: accessible settlement confirmation without weakening server version validation, single-flight guard for financial mutations, clear success notifications and consistent loading/error feedback. Idempotency-key replay behavior remains unchanged.
- Cashier/manager adjustments: explicit approval/rejection/refund confirmations, single-flight state changes and success notifications. Existing independent authorization and financial audit requirements remain intact.
- No changes to authorization, financial calculations, order states, database migrations or external dependencies.

## Verification commands
1. `pnpm interaction:verify`: ensures the root provider, accessibility features, RTL/localized labels, control exports and adoption on representative role screens. CI runs it after `ui:verify` and `nav:verify`.
2. `pnpm typecheck`, `pnpm test`, `pnpm build:web`: standard TypeScript/unit/build checks.
3. GitHub CI PostgreSQL migrations, seed, and Phase 1–14 integration suite: required unchanged-business-logic regression gate.

## Manual acceptance — not asserted by CI
- In Dari, Pashto and English, test every affected screen at 320/375/768/1024/1280px. Verify toast positioning, long copy, button size, message dismissal, and that the layout is stable during background refresh.
- With keyboard alone, open and cancel an archive/revoke/refund/settle confirmation via Escape, Tab and backdrop; verify focus is restored and no API write occurred on cancellation. Test staff edit, floor edit and menu editor focus handling.
- Rapidly double-click save, open check, and cashier settlement/refund buttons; confirm only one server-accepted effect and correct audit/receipt results. Verify retry after network loss.
- Run list filters/search, pagination, archiving the last record on a page, and stale response/race scenarios.
- Test guest/kitchen/platform routes to make sure shared global layout has no regressions; run actual Android/receipt/QR print checks as in the Phase 14 pilot runbook.

## Scope notes
This is the shared system plus adoption on the most consequential administration and cashier workflows; it does **not** certify that all historical one-off forms and dialogs across the entire app have been migrated. Owner dashboards and role-specific workflow redesigns remain Phase 18–39 scope. No UI test is a substitute for real cash settlement, operational pilot, device and accessibility sign-off. Commercial release stays blocked until those gates are fulfilled.
