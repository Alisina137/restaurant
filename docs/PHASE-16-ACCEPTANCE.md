# Phase 16 — Grouped workspace navigation and stable header

## Delivered scope
- Replaced the flat web sidebar with a single typed, localized role-based navigation registry for owner/manager, kitchen, cashier and platform admin.
- Grouped operational routes with expandable sections. Restaurant sections cover Overview, Operations, Menu, Finance, Staff, Insights, Business and Readiness; kitchen, cashier and platform have smaller purpose-built groups.
- The desktop sidebar supports an icon-only collapsed rail, native hover tooltips and accessible item labels. Collapsed preference and open group states are stored per workspace area without triggering reloads.
- Redesigned header with current page and group breadcrumbs, tenant context, account shortcut and a network-only connectivity indicator (not a fabricated backend health signal).
- Mobile drawer replaces the horizontal bottom-scrolling sidebar. It supports backdrop close, Escape, focus trapping, focus return, body scroll lock, correct RTL positioning, and appropriate visibility when closed.
- Active state matches nested detail routes, including check and receipt detail pages. Subtab routes have their own entries; any group containing the selected page opens on navigation.
- Parent sidebar remains mounted under the `[area]` layout while main content changes. The workspace authorization and server-side role checks remain untouched. The menu does not introduce unimplemented destinations.
- No schema or API changes, new dependencies, monetary policy changes or subscription policy changes.

## Automated gates
- `pnpm nav:verify` checks that all navigation targets resolve to source routes, there are no duplicate destinations, primary roles are present, and accessibility/drawer/layout safeguards are declared.
- `pnpm ui:verify`, `pnpm typecheck`, `pnpm test`, `pnpm build:web` and the existing PostgreSQL phase regression suite must pass in GitHub Actions.

## Manual device/browser acceptance (still required)
1. Navigate among all primary and nested routes as restaurant owner/manager, kitchen, cashier and platform. Sidebar and header remain visible while content loads and when API errors occur.
2. Desktop: expand/collapse rail, reload and verify saved state; hover/focus icon buttons; open/close navigation groups; verify active state on deep links; scroll long restaurant group lists.
3. Tablet/phone 320, 375, 768, 769, 1024 and 1280 px: open drawer, scroll internal list, tap links, close via backdrop and Escape; check focus return, keyboard Tab trap and background scroll lock.
4. Dari/Pashto RTL and English LTR: drawer enters from the correct inline-start edge; breadcrumbs, chevrons and all labels remain legible.
5. Check sign-out, session expiration, forbidden role routes, offline indicator accuracy, account page, QR and receipt print views.
6. Confirm that a user cannot navigate to an unauthorized server operation even with a copied link (the server remains the source of authorization).

## Status boundary
Code and automated regression checks can be verified by CI; physical-device visual QA, accessibility inspection and the real restaurant pilot remain separate unresolved release gates. Phase 17 owns system-wide toasts, confirmation dialogs and generalized interaction-state improvements.
