# DineFlow P08 Acceptance — guest assistance and waiter attention

## Source / target
`docs/PRODUCT-SPECIFICATION-v1.md` P08 / REQ-011 / AT-009 / PG-03, PG-05 and PG-20; intended to integrate with P07 guest table QR/PIN and P09 finance.

## Shipped interfaces
- Guest `/g/:visit/help`: Call waiter, Water, Cutlery, Request Bill (together/split), Other; optional or required 200-character notes; status timeline.
- Waiter `/requests`, home requests card, Tables > Needs Attention requests, table detail requests shortcut.
- Manager `/app/service/requests`: active/resolved inbox with 20-per-page, tenant scope and guarded versioned acknowledge/resolve.
- Cashier `/cashier/checks` Payment Requested: only real active bill requests.

## Security and correctness
- Guest must provide a valid session from active table PIN verification; no raw QR token grants access.
- Request operations serialize on the visit table row to prevent races; one outstanding request per kind/visit. Recently completed duplicate type is suppressed for 60 seconds. Request status version prevents double acknowledgement.
- Assigned waiter sees only the visits assigned to them. Owner/manager can operate across their tenant; cashier cannot manipulate service requests. Other restaurants' requests are invisible.
- Immutable creation/resolution audit, durable database rows, waiter/guest refresh and application focus polling; never claim push alert guarantee.
- Bill requests do not automatically lock ordering or create fake payments. Cashier's request filter includes a valid zero-total bill request.

## Automated acceptance
CI: TypeScript, unit tests, Next.js build, PostgreSQL migrations + seed, earlier phase integrations, and `apps/api/src/phase8-ci.ts`: QR/PIN session, rate/dedup, state transitions, stale versions, role/tenant isolation, bill preference and real cashier queue.
Manual: verify local Expo Go waiter navigation, guest web at narrow screen and large tablet, English/Dari/Pashto RTL, concurrent guest clicks, local disconnect/retry, expired table session, and live service completion.

## Deferred
Refunds/voids/financial adjustments and changes to charged or preparing items require P10 approval/ledger work. Do not claim they are implemented, or show misleading active editing buttons.
