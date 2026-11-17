# Phase 20 — Menu management, publishing and availability

## Implemented on 17 November 2026

### Backend and access
- `GET /api/menu/summary`: live, tenant-and-location-scoped menu counts for active meals (total/published/draft/sold-out), category totals/published, modifier groups and catalog revision. Uses PostgreSQL counts; archived records excluded; no demo values. Owner/manager authorization is enforced through `scopeFor(req,true)`; response is `no-store`.
- `PATCH /api/menu/items/:id/publication`: a dedicated, version-checked item publishing endpoint that requires a real Boolean and current item version, rejects archived/foreign items, and reuses the **same** category and active modifier-group validation as the edit form. A successful transition increments version and the shared catalog revision with an audit event, so guest and kitchen catalogs update without a separate publish tool. No-op requests do not generate fake change events.
- Existing category full `PATCH` endpoint is used to publish/unpublish categories; its rule forbidding unpublishing a category with published items remains enforced. Existing transactional, versioned bulk availability API and archive guards are reused, not bypassed.
- No schema migrations, dependencies or changes to guest checkouts or historical orders.

### Web interface
- The actual menu workspace—`/app/menu/items`, `/app/menu/categories`, `/app/menu/modifiers`, and `/app/menu/availability`—is upgraded rather than duplicated.
- Live menu readiness panel showing item state counts, published categories and a link to the next actionable setup step. No misleading “ready” state when there is no published category or item.
- One-click publish/unpublish meal and category buttons, with preview of what changes and an explicit confirmation. Server rejects stale edits, invalid modifier rules and attempts to hide categories with still-published meals. Errors guide staff to category and modifier prerequisites.
- Improved item search/status/category filters with a reset action and locally cleared availability selections when any page, query, filter or tab changes. Current-page bulk stock updates are confirmed before transaction commit, and must pass the existing optimistic version checks.
- Refined category and modifier cards, editor hints explaining language/publishing/dependency behavior, localized item/category labels, upload-in-progress protection and category gating in the item editor.
- Staff guest-facing menu preview shows real published meals, visible categories and catalog version; drafts remain hidden. Preview loading/failure has an accessible retry state.
- Modern responsive premium layout with mobile overflow-safe controls, keyboard focus, RTL-aware action arrows and reduced-motion styling. Copy covers English, Dari and Pashto. The sidebar remains mounted; tab changes do not show fake navigation destinations.

### Validation
- `pnpm menu20:verify`: static structure, authorization, page adoption, edit/publish/inventory, preview and three-language styling contracts; wired to GitHub Actions.
- `pnpm --filter @dineflow/api exec tsx src/phase20-ci.ts`: seeded PostgreSQL test for live summary counts, owner/manager publishing, waiter/cashier/foreign-tenant denial, invalid Boolean and stale version, draft-category prevention, guest catalog visibility, category unpublish dependency, bulk stock status and cleanup.
- Existing design/navigation/interaction/auth/dashboard contracts, TypeScript checks, unit suites, Next build and the Phase 1–19 database regressions remain in CI.

### Real-world checks remaining
- Owner and manager should create multilingual categories, modifiers and meals on an actual deployment, upload images via configured media storage, then verify live published guest QR menu, pricing, category ordering, modifier minimums and allergy information. Test empty catalog, all-sold-out and unavailable stock.
- Test multiple browser tabs and multiple employees editing the same meal; confirm the second write is rejected and inventory actions cannot silently overwrite new versions. Confirm guest/kitchen clients react to catalog SSE revision changes.
- Test archiving an in-use category and modifier, wrong-role and cross-restaurant access, poor connectivity, media upload retries, mobile width and keyboard accessibility.
- Real Android/Expo, cash/receipt reconciliation, backup restore, full Dari/Pashto RTL visual QA and a supervised restaurant service pilot from Phase 14 remain **outstanding**. Automated CI success is not production certification.

## Next
Phase 21 — Tables & Floor Management UI.
