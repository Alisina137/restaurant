# Logical data model and lifecycle rules

IDs use opaque UUIDs. Store UTC timestamps; display restaurant operating times in Asia/Kabul. Money is integer minor units plus currency `AFN`; the payment adapter converts to the provider's verified unit convention. Never use binary floating point for totals.

Implementation status through the Side Phase: users/authentication, restaurants and separately reviewed restaurant revisions, permissioned memberships, public/pending restaurant media, audit events, posts/post media, Fresh Today offers, follows, post likes, saved posts, restaurant favorites, saved meals, private customer addresses, reports, menu categories, meals, variants, extras, delivery zones, kitchen/fulfillment availability, expiring quotes, immutable order snapshots and order events are applied by versioned migrations. Payment provider events, subscriptions, reviews and notifications remain planned for later phases.

| Entity                    | Important fields and relationships                                                           | Constraints/indexes                                               |
| ------------------------- | -------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| User                      | ID, normalized email, display name, phone, locale, status                                    | Unique normalized email; no provider secrets in profile           |
| Session / auth records    | User, expiry, revocation, verification/recovery tokens                                       | Expiring, single-use hashed recovery tokens; library-owned schema |
| Restaurant                | ID, owner, slug, city, profile, approval, kitchen state, prep estimate, fulfillment switches | Unique slug; indexed city/status; valid prep range; soft archive  |
| Membership                | User, restaurant, owner/contributor role, preset and explicit permissions                    | Unique user/restaurant; tenant authorization; owner-only grants   |
| City / Area               | Names, area belongs to city                                                                  | Stable IDs; localized labels                                      |
| RestaurantHours           | Restaurant, day, open/close intervals; closure overrides                                     | Validate overnight intervals and timezone                         |
| DeliveryZone              | Restaurant, area, fee, minimum subtotal, ETA range, enabled                                  | Unique restaurant/area; nonnegative money                         |
| Post / PostMedia          | Restaurant, caption, status, publishedAt; ordered media                                      | Restaurant/time index; upload ownership                           |
| PostMeal                  | Post and meal                                                                                | Same-restaurant association enforced                              |
| FreshOffer                | Post, restaurant, meal, price override, stock total/remaining, time window                   | One per post; tenant match; nonnegative atomic stock              |
| Follow / Like / SavedItem | User and target                                                                              | Unique user/target; save target type constrained                  |
| Favorite / SavedMeal      | User and restaurant or meal                                                                  | Unique user/target; only public eligible data is surfaced         |
| Category                  | Restaurant, name, sort order                                                                 | Restaurant/sort index                                             |
| Meal                      | Restaurant, category, name, description, base amount, available, image                       | Category tenant must match; nonnegative amount                    |
| MealVariant               | Meal, name, amount, available                                                                | Unique name per meal; belongs to correct meal                     |
| ExtraGroup / ExtraOption  | Meal, min/max choices; option amount, availability                                           | Bounds valid; selections checked server-side                      |
| CustomerAddress           | User, label, area, address/landmark, phone, default flag                                     | User-only access; at most one default per user                    |
| Quote                     | User, restaurant, priced selections, optional offer, fees, expiry, version                   | Short-lived; DB-backed identity; server recomputation             |
| Order                     | User, restaurant/zone, fulfillment state, price/address/offer snapshots, version             | User/idempotency-key uniqueness; one-time inventory restoration   |
| OrderItem                 | Order, optional meal reference, quantity, immutable name/options/price                       | Positive bounded quantity; snapshot not changed by meal edits     |
| OrderEvent                | Order, actor, previous/new state, timestamp, reason                                          | Append-only audit; chronological index                            |
| PaymentAttempt            | Order OR subscription invoice, provider session, amount/currency, state                      | Exactly one purpose; unique provider session; idempotency key     |
| PaymentEvent              | Provider event/reference, signature verification result, processedAt                         | Unique event key; controlled replay; redacted payload policy      |
| Refund                    | Payment, amount, reason, provider reference, state                                           | Aggregate refunds cannot exceed paid amount                       |
| Settlement                | Restaurant, payment, due amount, provider transfer, status                                   | Unique transfer request; reconciliation; not a pretend wallet     |
| Plan / Subscription       | Versioned price and term; restaurant, activeUntil, status                                    | Price snapshot on invoice; active entitlement logic               |
| SubscriptionInvoice       | Restaurant, plan snapshot, amount, term, state                                               | Unique paid-event application; one renewal per invoice            |
| Review                    | Order, author, restaurant, stars, text, moderation                                           | One per delivered/collected order; 1–5 stars; author owns order   |
| Report / AuditEvent       | Target, reason, actor, resolution                                                            | Restricted support access; actor and time preserved               |
| Notification / Job        | Recipient or job purpose, state, attempts, nextAttemptAt                                     | Durable deduplication key and retry bounds                        |

Every restaurant-owned child has an enforceable relationship to its tenant. Use composite foreign keys where suitable and service-level checks inside transactions. Do not trust a valid-looking restaurantId supplied by the browser. Retain financial/order snapshots when catalog items are archived. Account deletion uses a documented retention/anonymization policy before launch, not cascading removal of payment history.

## Independent state machines

Payment: created → pending → succeeded OR failed/expired. Refund records separately track requested → pending → succeeded/failed. Payment aggregates may then be partially_refunded/refunded. A delayed verified success can supersede an expired local attempt through reconciliation; never lose evidence that money arrived.

Fulfillment: awaiting_payment → awaiting_acceptance → accepted → preparing → out_for_delivery → delivered. Pickup branches from preparing to ready_for_pickup → collected. Awaiting acceptance may become rejected/cancelled. Later cancellation is handled by permitted restaurant/support action and policy, not an arbitrary client state update.

Settlement: not_due → pending → transferred OR failed; reversal/refund impacts must be reconciled. A transferred settlement does not prove delivery; a delivered order does not prove settlement.

Restaurant approval: draft → pending_review → approved OR changes_requested; admin may suspend. For an approved page, edits live in a separate revision and do not replace public fields until approval. Subscription entitlement: inactive/active/expired/suspended. Kitchen state is open/busy/paused; delivery and pickup operational switches are independent properties.

## Critical transaction rules

1. Checkout validates restaurant eligibility, meal/options/quantity, delivery zone, quote freshness and currency; calculates totals; writes immutable order/item snapshots atomically. Replay of the same idempotency key returns the existing order; a different payload with that key fails.
2. Payment callback validates the actual documented signature, event identity, order/invoice reference, amount and currency. Mismatch becomes support/reconciliation, never automatic fulfillment.
3. Exactly one successful payment funds the order. Duplicate event deliveries do not create duplicate orders, renewals, notifications or transfers. Unexpected extra paid attempts enter refund reconciliation.
4. Accept/reject and cancellation race via conditional version updates; only an allowed transition succeeds. A payment arriving after cancellation creates a refund/support action, not a silently reopened order.
5. Ordinary meal availability is a sold-out flag. Fresh Today offers additionally use an atomic conditional decrement inside order creation. A competing order fails rather than overselling, and cancellation/rejection restores reserved offer units at most once. Quote-time validation is repeated at placement because a quote is not a stock reservation.
6. Reviews require completed fulfillment and an eligible customer. Ratings exclude removed reviews and never come from seeded production numbers.
7. Expiry prevents new transactions but does not remove access required to fulfill/refund old orders.

## Planned verification examples

Restaurant A cannot update B's meal with a guessed ID; a content editor cannot alter price or availability; an admin is not implicitly a restaurant member; a customer cannot read another address; changing a price after purchase preserves the receipt; two customers cannot oversell the last Fresh Today unit; rejection restores it once; reordering creates a new server quote and discloses changed prices; 2 × 250 AFN + 50 AFN = 550 AFN; retrying payment events extends a term only once; cancellation racing with acceptance yields one valid final transition; refund timeout leaves refund pending; pickup never adds delivery fee.
