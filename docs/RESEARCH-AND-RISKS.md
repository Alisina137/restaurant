# Focused research and risk register

Research checked 19 September 2026. This is a narrow feasibility review, not comprehensive Afghan market validation. Public searches for local providers returned insufficient reliable matches; do not infer that competitors are absent or that this idea is unique. No user interviews or competitor account testing occurred.

## Evidence and design implications

| Reference | Verified observation | Our interpretation |
|---|---|---|
| User's six screenshots | Restaurant cover/status, category chips, meal options, AFN prices and cart/checkout layouts visible | Adopt useful ordering patterns, add the requested post feed; screenshots do not establish provider identity, pricing accuracy or backend behavior |
| [DoorDash Self-Delivery](https://merchants.doordash.com/en-us/products/self-delivery) | Its official page describes restaurant-owned drivers, restaurant-set delivery area and fee, and order acceptance | International functional comparator, not verified Afghanistan competitor. A restaurant-owned delivery model still needs acceptance and operational controls |
| [foodpanda](https://www.foodpanda.com/) | Official site describes food/grocery delivery and country-specific services | Broad discovery/ordering comparator. Do not copy grocery scope or claim Afghanistan coverage |
| [HesabPay overview](https://docs.hesab.com/introduction/overview/) | Hosted checkout, server callbacks and optional vendor distribution are documented | Relevant payment feasibility; actual account approval and settlement behavior remain to be validated |
| [HesabPay prerequisites](https://docs.hesab.com/quickstart/before-you-start/) | Merchant account, sandbox access and an active API key are prerequisites | Required before integration can be verified |
| [HesabPay vendor transfers](https://docs.hesab.com/api-reference/multi-vendor-transfer/) | A dedicated transfer API is documented | A documented API is not proof that our merchant setup is approved; inspect full contract during integration |
| [Next.js Route Handlers](https://nextjs.org/docs/app/getting-started/route-handlers) | Framework supports app request handlers | Proposed API layer can serve web and later mobile clients |

Facebook-style restaurant pages and telephone/message orders are conceptual indirect alternatives identified from the user's idea, not a surveyed local usage claim. No competitor fees or subscription prices are used as an Afghanistan pricing benchmark.

## Hypotheses to test

Restaurant owners will post regularly if posts generate orders; customers will revisit a local food feed; owners will pay a monthly fee; owners can maintain menu availability and reliably fulfill orders. None is established. Interview 5 restaurant owners about existing ordering, delivery capacity, willingness to pay and payment access. Observe 10 customer attempts on a prototype/pilot. Research actual local competitors with verified links before broad marketing claims. The pilot can proceed while this learning occurs; do not promise market demand.

## Risks and decisions

| Item | Impact | Mitigation / decision timing |
|---|---|---|
| Brand/city not finalized | Low for foundation | Use temporary name and sample Kabul labels; confirm before launch |
| Restaurant subscription price unset | Blocks charging | Configurable unpublished plan; owner sets price before Phase 5 live use |
| Merchant approval / distribution arrangement | Blocks live meal payments | Confirm settlement recipients, fees, transfer timing and refund handling with provider; never invent escrow |
| Automatic recurring billing unverified | Medium | Manual renewal checkout is the baseline |
| Payment succeeds but restaurant rejects | High | Separate state machines, explicit refund/support queue and customer communication |
| Duplicate or delayed callbacks | High | Verified events, idempotency, reconciliation and alerting |
| Delivery quality controlled by restaurant | High | Clear restaurant identity, promised range, status timestamps, contact and support escalation |
| No reliable local service coverage research | Medium | Pilot in verified service areas; do not claim nationwide delivery |
| SMS/email/media/hosting accessibility | High for production | Validate chosen services from target region; do not assume a free tier/payment card is available |
| No development DB credentials | Blocks live DB verification | Prepare source and tests; label integration unverified until configured |
| Account takeover / cross-tenant access | High | Secure auth, rate limits, membership checks and adversarial integration tests |
| Low bandwidth / RTL usability | Medium | Optimized images, pagination, no video autoplay, real device and language review |
| Spam/photos without rights | Medium | Owner responsibility, upload policy, limits, report and moderation controls |

Before public launch, agree customer support, cancellation/refund responsibilities, data retention and merchant terms appropriate to the operating business. This package specifies product requirements; it does not establish legal compliance or financial permissions.
