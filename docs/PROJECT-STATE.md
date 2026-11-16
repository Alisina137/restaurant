# DineFlow — Current Project State
**Product specification:** v1.0. **Development workflow:** V5. Repository: `Alisina137/restaurant`.

## Implementation
- **P01**: identity, role-aware workspaces, API/DB, localization. Earlier CI passed; physical-device QA outstanding.
- **P02**: verified owner onboarding, invitations, staff roles, restaurant settings, platform bootstrap. Earlier CI passed; live browser and production email deliverability QA outstanding.
- **P03**: menu catalog implementation in `phase-03-menu-catalog`; require passing GitHub CI and merge into main. Physical browser/device QA pending.

### P03 scope (F03, PG-30, AT-003)
- Owner/manager menu navigation has four functional tabs: **Items, Categories, Modifier Groups, Availability**. Uses stable app shell, responsive RTL/LTR layout, loading/empty/error/retry and server-backed pagination.
- Categories: localizable names, publishing, sorting, versioned edits, safe non-destructive archive; active meals block archive, published meals block unpublish.
- Items: localized fields, optional SKU (case-insensitive unique per location), integer-minor-unit AFN pricing, allergens, prep estimate, photo, modifier attachments, publish/draft, safe duplication and archive.
- Modifier groups: single/multi choice, required min/max constraints, priced localized options and archived dependencies; version-aware mutations.
- Availability: per-item and page-batch sold-out status with reason, optimistic versions and transaction rollback. Authenticated staff-readable catalog plus authenticated catalog version stream and polling fallback.
- Media: image type/size/pixel verification, automatic resize and WebP optimization with private per-tenant access. Persistent `MEDIA_LOCAL_DIR` is required in production. Current storage is local filesystem (suitable for a single instance or shared mounted volume); S3/CDN is not claimed.
- UI menu preview is read-only; **no fake order submission** until P05 and no guest QR until P07.
- All edits derive restaurant and branch IDs from active authenticated membership, enforce DB constraints, are audited, and advance catalog revision.

### Automated verification
- CI runs TypeScript checks, unit tests, Next production build, PostgreSQL migrations, seed and P01/P02/P03 integration.
- P03 scenario validates category/option validation, SKU collision, optimistic version failure, tenant isolation, image decode, publish/sold-out propagation, duplication as unpublished draft, archives and catalog data.
- Live responsive/browser/Expo Go QA still required. Historical price snapshots will be introduced alongside accepted orders in P05; P03 does not yet record orders.
- The **initial 14-day trial is a pilot configuration** rather than implemented billing; subscriptions come in P12.

## Phase 04
New sections, table board, collision-safe visits, waiter assignment, cleaning cycle and Expo Tables UI are implemented on branch `phase-04-sections-tables-visits`. CI includes P04 integration and regressions. Live Windows/Android UI tests remain pending. See `docs/PHASE-04-ACCEPTANCE.md`.

## Next
P05 — waiter ordering and minimal kitchen ticket receiver.

## Local commands
```powershell
cd C:\projects\restaurant
git pull --ff-only origin main
pnpm install
pnpm db:migrate
pnpm dev:api
pnpm dev:web
```
