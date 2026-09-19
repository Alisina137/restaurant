# Screen plan and visual specification

## Direction

Food-first social feed, clear restaurant identities, white cards on a light neutral background, charcoal text, deep orange primary action (#B43B13), forest-green availability (#176345). Photos will provide visual richness; do not fabricate photos of actual restaurants. Use commissioned, licensed or owner-uploaded images. Static board uses explicit image placeholders.

Use 16px body text, 14px labels, 24–32px screen headings; generous line spacing for Arabic scripts. Card radius 16px, control radius 12px, 8px spacing scale, primary touch targets at least 44px. Errors have text and icons in addition to color. Respect reduced motion. Focus remains visible; dialogs trap and restore focus. Bottom bars include safe-area spacing.

Phone: single column, fixed Home/Explore/Orders/Account navigation with cart summary above it when needed. Desktop: left navigation, central feed, contextual restaurant/cart panel; restaurant owner workspace uses a sidebar and responsive order cards. No marketing hero in front of the feed.

## Routes and screen acceptance

| Screen / planned route | Primary content/action | Required states |
|---|---|---|
| Home `/` | City selector, Discover/Following tabs, post cards, meal links | Loading, no city, no posts, no followed restaurants, retry |
| Explore `/explore` | Search input, restaurant/meal results, filters | No matches, cleared filters, failed search, pagination |
| Restaurant `/restaurants/[slug]` | Cover, identity, status, tabs, follow, menu | Unapproved private, suspended/unavailable, closed, empty menu |
| Meal `/restaurants/[slug]/meals/[id]` | Photo, options, quantity, current total, add | Missing required option, sold out, changed price |
| Cart `/cart` | Items/options, quantities, subtotal | Empty, restaurant switch confirmation, removed items |
| Checkout `/checkout` | Address/area, delivery or pickup, full price, pay | Outside area, closed, stale quote, payment retry, submitting |
| Payment result `/checkout/result` | Verified pending/success/failure status | Delayed webhook, cancelled attempt, do not fabricate success |
| Orders `/orders` and `/orders/[id]` | Current/history, status timeline, receipt, support | Awaiting payment/acceptance, declined, refund pending, delivered |
| Account `/account` | Profile, saved restaurants/meals, addresses, language | Signed out, invalid input, unsaved changes |
| Authentication `/sign-in`, `/sign-up`, `/reset-password` | Session entry and recovery | Generic errors, rate limit, expired recovery token |
| Owner onboarding `/owner/onboarding` | Profile draft, required fields, submit | Draft, pending, revision requested, approved awaiting subscription |
| Owner workspace `/owner/[restaurantId]` | Orders requiring action, business open switch | Empty day, connection lost, stale order version |
| Owner menu/posts/settings | Meal categories/options; publishing; delivery/hours | Draft/published, upload failed, sold out, no permission |
| Owner billing | Current term, renewal, history | No configured price, unpaid, active, expired, renewal pending |
| Admin `/admin` | Approvals, reports, subscriptions, reconciliation | No role, empty queues, audited confirmation for sensitive changes |

Links identify real entities and preserve back-navigation/filter state. A meal-linked post opens the correct restaurant's item. Out-of-stock meals remain readable but cannot be ordered. The checkout button states the total and payment method; pickup uses no delivery fee. Example board: two 250 AFN items plus 50 AFN delivery = 550 AFN.

## Main journeys

Customer: select city → browse post → open restaurant or meal → choose options → cart → sign in if necessary → address/fulfillment → verify total → hosted payment → payment confirmation → restaurant acceptance → preparation → delivery → eligible review.

Restaurant: sign up → draft page → approval → subscription payment → add menu → publish linked post → accept paid order → prepare → hand to own delivery staff → mark delivered.

Recovery: price change returns to a refreshed cart; payment interruption retains the order and offers status/retry; new payment attempts cannot double-charge intentionally; stale restaurant updates refresh rather than overwrite a newer state. A paid but rejected order displays refund/support status separately from fulfillment.

## Localization and accessibility verification plan

Use translation keys and CSS logical properties from foundation. Set page language and direction. Isolate phone numbers, order IDs and currency text where mixed direction is ambiguous. Keep user-created menu text in its original language; translated UI does not automatically translate food descriptions.

In implementation phases, test 360px, 390px, 768px and 1440px; 200% text zoom; keyboard checkout; focus after variant selection; screen-reader labels; color contrast; one RTL journey. These are planned tests, not tests executed on the wireframe.
