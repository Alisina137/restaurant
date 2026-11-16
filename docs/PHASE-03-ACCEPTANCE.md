# Phase 03 — Acceptance and demo script
**Done criteria:** Owner creates two categories, five meals with modifiers and prices, publishes them, marks a meal sold out, and staff see the changed catalog. Four tabs must remain stable across state changes.

1. Log in as an **owner**. Choose Menu → Categories, create a localized category as draft, publish it. Optional Pashto and English labels can be added. A duplicate active Dari category name must be rejected.
2. In Modifier Groups, create a 'Size' group with a required single choice (small +0 AFN / large +25 AFN). A group whose maximum exceeds its active option count must be rejected.
3. In Items, add meals to published category. Check names, price stored in integer minor units, SKU unique, image (JPEG/PNG/WebP converted to WebP, max original 5MB), allergen tags, modifier association. Publish. Search, filter, edit, duplicate, archive with confirmation.
4. In Preview, only published items within published categories appear. Drafts, archived records and archived groups remain hidden; sold-out is explicitly marked. No cart or checkout button.
5. In Availability, mark one product sold out and available, including bulk page selection. Staff catalog queries reflect the change; revision endpoint and SSE provide refetch signals.
6. Open the same item for editing in two browser sessions. Save first, then attempt stale edit from second: VERSION_CONFLICT, no silent overwrite. Duplicate SKU returns 409. Attempt to archive a populated category: denied. Archive items first; categories and groups archive without physical deletion.
7. Sign in as waiter/kitchen: published catalog permitted but mutation forbidden. Use another tenant: cross-tenant IDs must not expose categories, photos, groups or items. Platform admin must not implicitly read private tenant catalog.
8. Test browser widths 320px, 768px, 1280px with Dari, Pashto and English, sidebar stable during fetch, form errors and keyboard navigation.

**Automated verification:** `pnpm typecheck`, `pnpm test`, `pnpm build:web`, `pnpm db:migrate`, `pnpm seed:dev`, prior API integrations and `pnpm --filter @dineflow/api exec tsx src/phase3-ci.ts`. CI must pass before main merge.

**Deferrals:** table visits P04, waiter ordering/kitchen P05, guest QR P07, live order price snapshots P05, transaction and billing P09. No fake completed-order or revenue UI.
