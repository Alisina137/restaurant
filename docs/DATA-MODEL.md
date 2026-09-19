# Logical data model and lifecycle rules

Design specification, not an applied schema. IDs use opaque UUIDs. Store UTC timestamps; display restaurant operating times in Asia/Kabul. Money is integer minor units plus currency `AFN`; the payment adapter converts to the provider's verified unit convention. Never use binary floating point for totals.

| Entity | Important fields and relationships | Constraints/indexes |
|---|---|---|
| User | ID, normalized email, display name, phone, locale, status | Unique normalized email; no provider secrets in profile |
| Session / auth records | User, expiry, revocation, verification/recovery tokens | Expiring, single-use hashed recovery tokens; library-owned schema |
| Restaurant | ID, owner, slug, city, name, description, media, approval status, timezone | Unique slug; indexed city/status; soft archive |
| Membership | User, restaurant, role | Unique user/restaurant; tenant authorization |
| City / Area | Names, area belongs to city | Stable IDs; localized labels |
| RestaurantHours | Restaurant, day, open/close intervals; closure overrides | Validate overnight intervals and timezone |
| DeliveryZone | Restaurant, area, fee, minimum subtotal, ETA range, enabled | Unique restaurant/area; nonnegative money |
| Post / PostMedia | Restaurant, caption, status, publishedAt; ordered media | Restaurant/time index; upload ownership |
| PostMeal | Post and meal | Same-restaurant association enforced |
| Follow / Like / SavedItem | User and target | Unique user/target; save target type constrained |
| Category | Restaurant, name, sort order | Restaurant/sort index |
| Meal | Restaurant, category, name, description, base amount, available, image | Category tenant must match; nonnegative amount |
| MealVariant | Meal, name, amount, available | Unique name per meal; belongs to correct meal |
| ExtraGroup / ExtraOption | Meal, min/max choices; option amount, availability | Bounds valid; selections checked server-side |
| CustomerAddress | User, area, address/landmark, phone, optional coordinates | User-only access; coordinates validated |
| Quote | User, restaurant, priced selections, fees, expiry, version | Short-lived; signed/DB-backed identity; server recomputation |
| Order | User, restaurant, fulfillment type/state, price/address snapshots, version | User/idempotency-key uniqueness; restaurant/state/time index |
| OrderItem | Order, optional meal reference, quantity, immutable name/options/price | Positive bounded quantity; snapshot not changed by meal edits |
| OrderEvent | Order, actor, previous/new state, timestamp, reason | Append-only audit; chronological index |
| PaymentAttempt | Order OR subscription invoice, provider session, amount/currency, state | Exactly one purpose; unique provider session; idempotency key |
| PaymentEvent | Provider event/reference, signature verification result, processedAt | Unique event key; controlled replay; redacted payload policy |
| Refund | Payment, amount, reason, provider reference, state | Aggregate refunds cannot exceed paid amount |
| Settlement | Restaurant, payment, due amount, provider transfer, status | Unique transfer request; reconciliation; not a pretend wallet |
| Plan / Subscription | Versioned price and term; restaurant, activeUntil, status | Price snapshot on invoice; active entitlement logic |
| SubscriptionInvoice | Restaurant, plan snapshot, amount, term, state | Unique paid-event application; one renewal per invoice |
| Review | Order, author, restaurant, stars, text, moderation | One per delivered/collected order; 1–5 stars; author owns order |
| Report / AuditEvent | Target, reason, actor, resolution | Restricted support access; actor and time preserved |
| Notification / Job | Recipient or job purpose, state, attempts, nextAttemptAt | Durable deduplication key and retry bounds |

Every restaurant-owned child has an enforceable relationship to its tenant. Use composite foreign keys where suitable and service-level checks inside transactions. Do not trust a valid-looking restaurantId supplied by the browser. Retain financial/order snapshots when catalog items are archived. Account deletion uses a documented retention/anonymization policy before launch, not cascading removal of payment history.

## Independent state machines

Payment: created → pending → succeeded OR failed/expired. Refund records separately track requested → pending → succeeded/failed. Payment aggregates may then be partially_refunded/refunded. A delayed verified success can supersede an expired local attempt through reconciliation; never lose evidence that money arrived.

Fulfillment: awaiting_payment → awaiting_acceptance → accepted → preparing → out_for_delivery → delivered. Pickup branches from preparing to ready_for_pickup → collected. Awaiting acceptance may become rejected/cancelled. Later cancellation is handled by permitted restaurant/support action and policy, not an arbitrary client state update.

Settlement: not_due → pending → transferred OR failed; reversal/refund impacts must be reconciled. A transferred settlement does not prove delivery; a delivered order does not prove settlement.

Restaurant approval: draft → pending_review → approved OR changes_requested; admin may suspend. Subscription entitlement: inactive/active/expired/suspended. Open hours and delivery availability are separate properties.

## Critical transaction rules

1. Checkout validates restaurant eligibility, meal/options/quantity, delivery zone, quote freshness and currency; calculates totals; writes immutable order/item snapshots atomically. Replay of the same idempotency key returns the existing order; a different payload with that key fails.
2. Payment callback validates the actual documented signature, event identity, order/invoice reference, amount and currency. Mismatch becomes support/reconciliation, never automatic fulfillment.
3. Exactly one successful payment funds the order. Duplicate event deliveries do not create duplicate orders, renewals, notifications or transfers. Unexpected extra paid attempts enter refund reconciliation.
4. Accept/reject and cancellation race via conditional version updates; only an allowed transition succeeds. A payment arriving after cancellation creates a refund/support action, not a silently reopened order.
5. Availability is a sold-out flag initially, not a promise of counted stock. Restaurant may reject after payment; refund handling is required. If stock counts are introduced, add atomic reservation/expiry before claiming inventory guarantees.
6. Reviews require completed fulfillment and an eligible customer. Ratings exclude removed reviews and never come from seeded production numbers.
7. Expiry prevents new transactions but does not remove access required to fulfill/refund old orders.

## Planned verification examples

Restaurant A cannot update B's meal with a guessed ID; a customer cannot read another address; changing a price after purchase preserves the receipt; 2 × 250 AFN + 50 AFN = 550 AFN; retrying payment events extends a term only once; cancellation racing with acceptance yields one valid final transition; refund timeout leaves refund pending; pickup never adds delivery fee.
