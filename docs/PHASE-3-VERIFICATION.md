# Phase 3 verification

Revision: P03-R1

Status: implementation complete and locally verified. Live-service and physical-device verification are pending.

## Passed locally

- Drizzle migration generation and repeat-safe application to isolated PostgreSQL-compatible databases.
- Strict TypeScript check and ESLint with no errors or warnings.
- Next.js production build with the Phase 3 pages and versioned API routes.
- 17 integration/security tests across four suites, including five Phase 3 scenarios.
- Unapproved restaurants can prepare drafts but cannot publish; drafts and posts belonging to non-approved restaurants remain outside public feeds.
- Owner/staff post access is membership-scoped and guessed cross-tenant edits are rejected.
- Published posts use deterministic timestamp-and-ID cursor pagination.
- Unknown future meal references are never exposed as working links before the catalog exists.
- Follows, likes and saves are unique, reversible and idempotent.
- Following and saved feeds require an authenticated actor and return only eligible published posts.
- Restaurant discovery searches approved records and supports city, area, cuisine, open-now, delivery and pickup filters.
- One user cannot submit duplicate reports for a post; an administrator can dismiss a report or remove the post exactly once.
- Removed, archived and unpublished posts disappear from public feed and public media access.
- Post images use the existing private-storage pipeline: bounded request size, decode/re-encode, metadata removal and authorization-aware reads.
- Production dependency review reports no high or critical advisory. Four moderate advisories remain in the development-only Drizzle CLI dependency chain; the suggested forced downgrade is breaking and was not applied.

## Visual and responsive implementation

- Reworked the application shell with a clearer desktop rail and mobile bottom navigation.
- Added a food-first Discover/Following feed, responsive post media grids and restaurant suggestions.
- Added a mobile-friendly Explore surface with a compact filter panel and responsive restaurant cards.
- Rebuilt the restaurant profile around its cover, identity, service availability, updates and information rail.
- Added dedicated owner post composition/management, saved-post account collection and admin moderation cards.
- Preserved visible keyboard focus, minimum touch targets, reduced-motion behavior, empty/error states and RTL-compatible logical spacing.

## Not performed

- Live Neon migration and data verification: no development Neon credential was available in this environment.
- Live SMTP delivery: no email provider credential was available in this environment.
- Live S3-compatible post upload/read/delete: no storage credential was available in this environment.
- Browser screenshots and physical-device testing: the remote browser could not access the local preview. Responsive source rules cover phone, tablet and desktop breakpoints, but rendered-device verification is not claimed.
- Production deployment: not requested and no hosting/domain configuration was supplied.
- Dari/Pashto translation review: RTL foundations remain, but full professional translation is a launch task.

## Safe local acceptance check

After pulling this phase, run `npm ci`, `npm run db:migrate`, and `npm run dev`. On a phone-sized browser width:

1. Sign in as a verified owner, open an approved restaurant and publish one text post.
2. Confirm the post appears on Discover and on Following after a separate customer follows the restaurant.
3. Like and save it, then confirm it appears under the customer account.
4. Search the restaurant on Explore and exercise the service filters.
5. Report the post from the customer account, then dismiss or remove it from a separate administrator account.

Use development accounts and data for this check, not production records.
