# DineFlow — Restaurant Ordering & Management SaaS
## Product Specification v1.0 | Decision-ready implementation blueprint

**Document date:** 15 November 2026  
**Status:** Proposed specification; product assumptions pending client validation  
**Project working name:** **DineFlow** (placeholder, not an approved brand)  
**Primary market assumption:** Afghanistan, with Dari, Pashto, and English support  
**Document authority:** Product behavior, features, UX, pages, permissions, and acceptance outcomes. A separate Software Development Workflow governs source code, testing commands, Git, deployment, and migrations.

> **Important status notice.** This is a design specification, **not implemented software**. It incorporates the user's confirmed selections and explicitly marks decisions the user has not made. Do not interpret suggested providers, metrics, payment rails, or subscription prices as approved facts.

---

# 1. Executive summary, supplied inputs, constraints, and decisions

## 1.1 Filled inputs from the Master Product Documentation Prompt

| Input | Filled project value | Confidence |
|---|---|---|
| Application name and idea | **DineFlow** (working name): a multi-restaurant SaaS platform for waiter-entered and customer QR-based dine-in food ordering, kitchen fulfillment, table service, billing, and restaurant administration. | Idea confirmed; name proposed |
| Problem | Paper menus, verbal handoffs, scattered tickets, and separate bills can cause lost items, slow kitchen communication, inconsistent table status, and reconciliation difficulty. | Reasoned problem hypothesis; validate in pilot |
| Audience | Independent restaurants; initially small and medium table-service establishments; restaurant owners/managers, waiters, kitchen staff, cashiers, and dine-in customers. | Confirmed direction; segments proposed |
| Primary goal | Complete the dine-in loop reliably: **seat → select → submit → prepare → serve → bill → pay → reset table**, across both ordering channels. | Confirmed |
| Platform | **Multiplatform**: Expo React Native mobile app for waiters; responsive Next.js web dashboards for kitchen, cashier, restaurant administration, and SaaS administration; no-install responsive customer QR menu. | Confirmed |
| Business model | **Subscription SaaS** for multiple independent restaurant tenants; billing per restaurant/location is a proposed default, not final pricing. | SaaS confirmed; structure proposed |
| Geography and language | First-market assumption Afghanistan; **Dari (default RTL), Pashto (RTL), English (LTR)**; display AFN as default configurable currency; store UTC timestamps and render restaurant-local time. | Languages agreed in conversation; locale/defaults proposed |
| Preferred stack | pnpm monorepo, TypeScript, Expo/React Native, Next.js, Node.js backend, PostgreSQL, Drizzle ORM, Better Auth, object storage, WebSockets or SSE with polling fallback. | Proposed based on earlier technical direction |
| Existing code/database | **No existing repository or schema supplied for this new product.** Do not assume the separately discussed restaurant/social-delivery project is this project. | Explicit boundary |
| Hosting/deadline/budget | Not supplied. Favor low operating cost; provider/hosting selection requires review. | Open |
| References | User's waiter + customer QR workflow and choices; public feature references from Toast, Square, Lightspeed, and GloriaFood (Section 2). No screenshots or proprietary product references supplied for this product. | Confirmed and researched |
| Must-haves | Tenant isolation; waiter and guest ordering into one kitchen stream; menu & modifiers; table sessions; guest verification; kitchen tracking; cashier payments; receipt; role-specific app shells; multilingual UX; auditability; subscriptions. | Spec-defined MVP necessities |
| Explicitly excluded from MVP | Delivery marketplace, courier dispatch, table reservations, customer accounts, loyalty, payroll, AI recommendations, inventory recipes, multi-location operations, hardware-terminal payment processing, offline-finalized payments. | Product prioritization, not previously requested |

## 1.2 One-sentence value proposition

**A restaurant can run its dine-in service from menu to paid bill with a shared order ledger, whether the waiter or the guest places the order, using inexpensive phones and browsers.**

## 1.3 Strategic operating model

- **Tenant:** one independent restaurant business account. **Location:** the physical branch; MVP supports one active location per tenant, with location-safe data modeling from the start. Multiple locations are a next-release feature.
- **Guest:** no login or app installation. Scans QR, verifies the current seating session with a short table PIN, browses menu, orders, tracks progress, and requests assistance.
- **Waiter:** uses Android/iOS mobile app to open or join table sessions, enter orders, serve food, and request the bill.
- **Kitchen:** web/tablet display consumes a unified ticket queue from both ordering channels; staff can accept/prepare/mark ready.
- **Cashier:** web interface issues/splits bills, records cash or verified manual tender, applies authorized adjustments, and closes checks.
- **Restaurant manager/owner:** web dashboard sets up menu, staff, tables, approval policy, reports, and subscription.
- **Platform admin:** global web interface manages tenants, plans, billing records, support, and platform audit without casual access to private restaurant content.

## 1.4 Product principles

1. **One truth per table visit.** Orders, kitchen tickets, bills, and payments link to a single visit/session, regardless of who entered them.
2. **Staff remain in control.** High-impact edits, cancellations, refunds, and customer-initiated orders use explicit permissions and approval rules.
3. **Fast under real restaurant conditions.** Large tap targets, few actions, low-bandwidth images, stable navigation, clear retry states, readable kitchen display.
4. **Local-language native, not translated later.** RTL/LTR, fonts, numerals, mixed English item names, dates, and currency in all workflows from Phase 1.
5. **No silent financial changes.** Server-calculated totals, immutable snapshots, adjustment records, payments ledger, audit trail, idempotent operations.
6. **Ship working vertical slices.** A new page ships with its route, core actions, permission checks, data, errors, and responsive behavior.

## 1.5 Outcome measures (pilot targets, not validated forecasts)

| Goal ID | Observable pilot measure | Initial target / interpretation |
|---|---|---|
| GOAL-01 | End-to-end dine-in completion | At least 95% of test visits from seating to closing succeed without operator intervention. |
| GOAL-02 | Order transmission reliability | 99.5% of accepted submissions persist exactly once; no duplicate kitchen tickets on retry. |
| GOAL-03 | Fast kitchen visibility | Online order-to-kitchen display p95 at or below 3 seconds in a healthy network; alert on degradation. |
| GOAL-04 | Cash reconciliation | Every closed check has zero unexplained balance and a complete tender/adjustment history. |
| GOAL-05 | First setup completion | Pilot restaurant can create menu, tables, staff, and first demo order in under 45 minutes with onboarding help. |

## 1.6 Scope decisions still needed

**DEC-01 Brand:** final app and domain name.  
**DEC-02 Market:** confirm Afghanistan-only launch versus international multi-currency.  
**DEC-03 Restaurant billing:** pricing/plans, free trial length, manual invoice process, tax treatment.  
**DEC-04 Tender methods:** cash only at initial pilot versus optional local-bank/HesabPay/provider integration after verification.  
**DEC-05 Customer order policy:** recommend **waiter approval by default**, with optional direct-to-kitchen only for verified active table sessions.  
**DEC-06 Hardware:** target Android minimum OS, receipt printer model, kitchen tablets/monitors and connectivity baseline.  
**DEC-07 Language/localization:** which numeral glyph style, calendar presentation (Gregorian vs optional Solar Hijri), and restaurant tax configuration.  
**DEC-08 Pilots:** first restaurant's table count, menu complexity, peak concurrent tickets, staff count.

None of the above should block the architecture; where relevant the MVP defaults are specified below and reversible through configuration.

---

# 2. Focused market/reference evidence

**Evidence classification:** **VERIFIED FACT** refers to official vendor documentation accessed for this specification; **REASONED INFERENCE** denotes design implications, not claims about competitors or local market demand; **OPEN ASSUMPTION** denotes a product hypothesis requiring restaurant validation. This is a feature benchmark, not independent hands-on usability research.

| Reference | Verified feature observation | Evidence source | Product implication |
|---|---|---|---|
| Toast POS | Toast describes handheld tableside ordering, menu modifiers, split checks, kitchen display, and live stock updates. | https://pos.toasttab.com/restaurant-pos | **Baseline:** modifiers, seating, reliable kitchen handoff, split-check readiness. |
| Square | Square documents QR codes associated with tables, guest ordering, notes, POS/kitchen routing, and payment flows. | https://squareup.com/us/en/online-ordering/qr-code-ordering | **Baseline:** no-install QR ordering with correct table identity and single backend queue. |
| Lightspeed Restaurant | Lightspeed documents configurable floor plans, table position and seat count, and seat-linked checks. | https://k-series-support.lightspeedhq.com/hc/en-us/articles/1260804656709-Creating-and-managing-floor-plans-and-tables | **Baseline:** table board, sections, seating sessions, status and optional seat assignment. |
| GloriaFood | GloriaFood documents individual table QR codes and on-premise ordering; its public product page describes QR browsing/ordering. | https://www.gloriafood.com/ | **Baseline:** self-service ordering and an easy restaurant setup pathway. |
| Square Restaurant plans | Square documents split/reopen checks, KDS device sync, ticket routing, and real-time updates. | https://squareup.com/us/en/point-of-sale/restaurants/pricing | **Baseline:** correction/reopen rules, timer visibility and role-specific kitchen screens. |

**Research limitation:** Vendor pages establish advertised capabilities, not that features work equally well in Afghanistan, nor actual pricing/provider coverage locally. No claim is made that the above vendors lack Dari/Pashto or support a specific Afghan payment method.

## 2.1 Baseline expectations versus differentiators

| Capability | Evidence/rationale | Priority | Target role | DineFlow behavior |
|---|---|---|---|---|
| Table-linked orders | Toast/Lightspeed | MVP / REQUIRED | Waiter, cashier | Active table session contains all order rounds and bill lines. |
| Item options/modifiers | Toast/GloriaFood | MVP / REQUIRED | Guest, waiter | Required selection groups, priced extras, notes, availability checks. |
| Kitchen tickets | Toast/Square | MVP / REQUIRED | Kitchen | Reliable real-time queue with source, timestamp, table, priority and status. |
| Guest QR ordering | Square/GloriaFood | MVP / REQUIRED | Guest | No account; PIN-verified table session; optional approval policy. |
| Split billing | Toast/Square | MVP / REQUIRED | Cashier | Split by items/equal amounts, no double charging; item-level seat split next release. |
| Local-first language system | OPEN ASSUMPTION of underserved operational need, not a verified competitor gap | MVP / REQUIRED | All | Dari/Pashto RTL and English LTR across receipts, statuses, filters, input. |
| Weak-network honesty | REASONED INFERENCE from mobile/tablet environments | MVP / REQUIRED | Waiter, kitchen | Local draft allowed; final submission requires server acknowledgment; polling fallback. |
| Unified waiter/guest ledger | REASONED INFERENCE from dual ordering flow | MVP / REQUIRED | All | Same visit, ordered item identities, reconciliation and kitchen routing. |
| Advanced inventory and recipes | Useful but high setup burden | NEXT RELEASE | Owner | Stock deduction, recipes, waste, supplier purchasing after ordering MVP validates. |
| Delivery, loyalty, AI | Not required for first dine-in outcome | EXCLUDED / FUTURE | Various | No nav entries or fake screens in MVP. |

---

# 3. Product scope, priority, and deployment model

## 3.1 MVP / REQUIRED

- Tenant creation, trial/active/suspended entitlements, organization-scoped authentication, invitations and roles.
- One location per tenant, menu categories/items/options/prices/photos and stock availability toggle.
- Floor/section and table setup, active visit management, secure QR links and rotating visit PINs.
- Waiter mobile app: home, tables, order creation, rounds/additions, status, service tasks, account.
- Guest responsive web: PIN join, menu, item customization, cart, submit, status, call waiter, request bill.
- Unified order and kitchen ticket service, approval path, statuses, kitchen web board, waiter ready alerts.
- Cashier: single bill and split by item/equal shares, configurable tax/service charge, cash/manual payment, printed/browser receipt.
- Financial adjustments with reasons and manager approval, basic refunds/voids, payment reconciliation and immutable audit.
- Restaurant dashboard: operational overview, live/history orders, menu, tables, staff, receipts, summaries, subscription, settings.
- Platform admin: tenant status, manual subscription billing, access controls and support workflows.
- Responsive, Dari/Pashto/English, accessible, safe retry/empty/error states, backup and monitoring.

## 3.2 NEXT RELEASE

- Multiple locations per tenant; advanced floor-plan drag-and-drop; kitchen stations/routing and coursing; seat-specific split and item transfers; ingredient-level inventory and suppliers; receipt printer integrations; automated payment gateway where locally feasible; staff shifts; enhanced reports/export scheduling.

## 3.3 FUTURE / REQUIRES VALIDATION

- Delivery/takeout, reservation/waitlist, customer loyalty/account, promotion rules, integrations with accounting, multi-restaurant chain analytics, digital payment at table, SMS alerts, offline first-class synchronization, advanced kitchen forecasting.

## 3.4 EXCLUDED from MVP

- Public restaurant discovery marketplace, courier network, AI-powered suggestions, warehouse management, payroll, franchise revenue settlement, stored customer card details, cryptocurrency integration, biometric attendance, per-guest customer profiling.

## 3.5 Operational tenant boundaries

- A restaurant's users, floor plans, menu, stock flags, visits, orders, receipts, and analytics are fully tenant-scoped.
- A tenant can have **one MVP location**; `location_id` nonetheless exists on operational records to make later branch expansion safe.
- Subscription controls the tenant's eligible feature set and seat/device/table limits; user permissions independently govern allowed actions.
- Platform support access is time-bound, reason-logged, and explicitly enabled by restaurant owners when needed; direct database browse is not a product feature.

---

# 4. Personas, permissions, access and cross-role handoffs

## 4.1 Role model and first-use

| Role | First-use / daily goal | Landing destination | Data/ownership scope |
|---|---|---|---|
| Guest (no account) | Scan table QR, verify PIN, choose and order food; follow status, call waiter | Guest Menu | Active verified visit only, no private staff data |
| Waiter | Log in, see assigned tables, enter/serve orders, respond to calls | Mobile Home | Assigned location/tables, with manager override |
| Kitchen Staff | See live tickets, prepare and mark ready; no money actions | Kitchen Live | Location tickets; internal item/prep notes only |
| Cashier | Collect/reconcile payments and close checks | Cashier Open Checks | Location checks/transactions; no menu admin by default |
| Manager | Run service, approve modifications/voids, manage table/staff operations | Restaurant Overview | Restaurant location, controlled financial approvals |
| Restaurant Owner | Configure restaurant, manage staff, review finances, subscription | Restaurant Overview | Entire tenant (excluding platform-only operations) |
| Platform Admin | Review organizations, subscription records, support and abuse | Platform Overview | Platform metadata and authorized limited tenant-support actions |

**Account acquisition:** Owner establishes verified tenant identity; staff joins using time-limited single-use invitation tied to role and location. One human may have memberships in more than one tenant; explicit active-tenant selector appears **only** when applicable. Membership disable immediately revokes new actions and active realtime subscriptions. Guests receive a visit-scoped browser session, not an account.

## 4.2 Permission matrix

Legend: **Y** allowed; **A** requires assigned table; **P** manager/owner approval; **S** self/own guest session; **—** not allowed. All staff actions also require active location membership and eligible tenant status.

| Permission / action | Guest | Waiter | Kitchen | Cashier | Manager | Owner | Platform Admin |
|---|---|---|---|---|---|---|---|
| View published menu | S | Y | Y | Y | Y | Y | — |
| Create dine-in order | S verified | A | — | — | Y | Y | — |
| Submit for kitchen | S policy-gated | A | — | — | Y | Y | — |
| Accept/prepare/ready ticket | — | — | Y | — | Y | Y | — |
| Mark items served | — | A | — | — | Y | Y | — |
| Call waiter / request bill | S | — | — | — | Y | Y | — |
| Open/close table visit | — | A open only | — | Y close after settlement | Y | Y | — |
| Edit unsubmitted cart | S | A | — | — | Y | Y | — |
| Cancel/void transmitted item | — | P | — | P | Y | Y | — |
| Record tender / issue receipt | — | — | — | Y | Y | Y | — |
| Approve refund/discount | — | — | — | P request | Y | Y | — |
| Manage menu / availability | — | View | Availability view | View | Y | Y | — |
| Manage floors/QR/restaurant settings | — | View | — | View | Y | Y | — |
| Invite/manage staff | — | — | — | — | Y limited (non-owner) | Y | — |
| View exportable finance reports | — | — | — | Limited shift | Y | Y | — |
| Manage tenant subscription | — | — | — | — | View | Y | Platform finance only |
| Manage platform plans/tenants | — | — | — | — | — | — | Y |

**Role entitlement distinction:** a cashier may be allowed to issue receipts by role but prevented from recording new tender if the tenant is fully suspended; a manager may request refunds but never bypass a plan or tenant boundary. Platform Admin is **not** a default super-user inside restaurant order screens.

## 4.3 Required handoff contracts

1. **Guest/Waiter → Order service:** successful submitted order is committed once, assigned server ID and receipt-level line snapshots; origin `GUEST_QR` or `WAITER` recorded.
2. **Approval policy → Kitchen:** waiter-assisted orders route immediately; guest orders route via `AWAITING_APPROVAL` by default and generate a waiter review alert. Only accepted orders create kitchen tickets.
3. **Kitchen → Waiter:** ticket preparation transitions broadcast with order/visit IDs; `READY` alerts waiter even after navigating away; no duplicate alert on reconnect.
4. **Waiter → Cashier:** served/unserved item statuses and open check update; cashier sees all valid accepted items including late rounds.
5. **Cashier → Waiter/Guest:** successful settlement closes/checks out visit when all balances are zero; guest tracking becomes read-only; waiter table changes to cleaning/available through explicit action.
6. **Owner → Staff:** revoke/deactivate removes server access immediately; personal data is limited to required operational details.

---

# 5. Information architecture, role navigation, and route registry

## 5.1 Universal application shell rules

- The shell (header, sidebar, tab bar, account control) **never disappears during tab/page loading**. Only route content uses skeletons or a focused panel spinner. Preserve current route, scroll/filter state where reasonable.
- Mobile navigation has **five root tabs maximum**. Subnavigation uses header/contextual tabs, not nested bottom bars.
- Desktop restaurant admin uses a persistent left sidebar (mirrored to right in RTL), grouped headings, icon + label, responsive collapse to icons and accessible tooltip; active route emphasized with tinted background and leading rail.
- Every app has authenticated logout, profile/language, expired-session recovery; public guest has language selector and close-session message rather than logout.
- Hide unreleased or unauthorized routes from navigation; direct navigation returns branded 403/upgrade/404 with a valid back destination, not blank pages.
- Modal closes to originating route; deep links open the correct parent context, and require login/PIN when the session expired.

## 5.2 Exact navigation trees

**GUEST responsive web** — landing `/g/:restaurantSlug/t/:qrCode` → PIN verification → `/g/:visitToken/menu` (default). Header logo, table badge, language dropdown, status chip. Sticky footer tabs **Menu** (book-open), **My Order** (receipt), **Assistance** (bell); Cart action is a persistent quantity/total pill above bottom tabs, not a fourth equal tab. Item detail is a sheet on phone and modal on tablet/desktop; Order History and Bill are within My Order subnavigation.

**WAITER mobile** — `Home` (house, default) · `Tables` (grid) · `Orders` (receipt) · `Menu` (utensils) · `More` (ellipsis). Home includes Today, My Active Tables, Ready to Serve, Customer Requests; Tables includes **All / Mine / Needs Attention** subtabs; Orders includes **Active / Ready / Completed**; Menu includes category chips. More: **Notifications**, **Profile**, **Language**, **Help**, **Sign Out**. Details and add-order flow are pushed on a stack, not a sixth root tab.

**KITCHEN web/tablet** — persistent top navigation `Live` (default) · `Preparing` · `Ready` · `History`; header includes location, audible alerts, display mode and station filter (the last is disabled until multi-station release). Live includes `New / Awaiting Acceptance`; Preparing includes `By Elapsed Time` sort; Ready includes `Awaiting Pickup`. All views share stable shell; order card actions are contextual, not admin settings.

**CASHIER web** — left sidebar `Open Checks` (default) · `Transactions` · `Shift Summary` · `Receipts` · `Account`. Open Checks has **All / Payment Requested / Partially Paid**; check detail opens `Items / Split / Payments / Activity` subviews, with amount due always visible.

**OWNER/MANAGER responsive web** — sidebar groups: `Overview` (default); **Operations**: `Orders` (Live / History), `Tables` (Board / Sections & Tables / QR Codes), `Menu` (Items / Categories / Modifier Groups / Availability); **People**: `Staff` (Directory / Invitations / Permissions); **Finance**: `Billing` (Transactions / Refunds / Receipts), `Reports` (Sales / Items / Service); **Account**: `Subscription` (Plan / Invoices), `Settings` (Restaurant / Ordering Rules / Charges & Receipts / Localization / Security), `Help`, profile/logout. Manager sees subscription read-only and cannot modify subscription. Features yet to ship are hidden in earlier phases.

**PLATFORM ADMIN web** — `Overview` (default) · `Restaurants` (All / Pending / Suspended) · `Subscriptions` (Plans / Invoices / Payments) · `Support` (Tickets / Access Grants) · `Audit` · `Platform Settings` · profile/logout. Global summary never joins raw restaurant private order details by default.

## 5.3 Navigation matrix

| Role | Platform | Level | Exact label | Route/screen | Default? | Visibility / owner | Phase |
|---|---|---|---|---|---|---|---|
| Guest | Responsive web | Entry | Verify Table | `/g/:slug/t/:qr` | Entry | Valid QR, guest / order service | P07 |
| Guest | Responsive web | Bottom | Menu | `/g/:visit/menu` | Yes | Verified guest / menu | P07 |
| Guest | Responsive web | Detail | Meal Details | `/g/:visit/item/:itemId` | No | Published item / menu | P07 |
| Guest | Responsive web | Floating | Cart | `/g/:visit/cart` | No | Guest active cart / orders | P07 |
| Guest | Responsive web | Bottom | My Order | `/g/:visit/orders` | No | Verified guest / orders | P07 |
| Guest | Responsive web | Sub | Bill | `/g/:visit/bill` | No | Active or settled visit / billing | P09 |
| Guest | Responsive web | Bottom | Assistance | `/g/:visit/help` | No | Active visit / service | P08 |
| Waiter | Mobile | Bottom | Home | `/w/home` | Yes | Waiter / operations | P05 |
| Waiter | Mobile | Bottom | Tables | `/w/tables` | No | Waiter / tables | P04–05 |
| Waiter | Mobile | Detail | Table Details | `/w/tables/:tableId` | No | Assigned or authorized / tables | P05 |
| Waiter | Mobile | Detail | New Order | `/w/visits/:visitId/order/new` | No | Active assigned visit / orders | P05 |
| Waiter | Mobile | Bottom | Orders | `/w/orders` | No | Waiter / orders | P05 |
| Waiter | Mobile | Detail | Order Details | `/w/orders/:orderId` | No | Authorized / orders | P05 |
| Waiter | Mobile | Bottom | Menu | `/w/menu` | No | Waiter / menu | P03–05 |
| Waiter | Mobile | Bottom | More | `/w/more` | No | Signed in / account | P01 |
| Waiter | Mobile | More | Notifications | `/w/notifications` | No | Signed in / notifications | P06 |
| Waiter | Mobile | More | Profile | `/w/profile` | No | Signed in / profile | P01 |
| Kitchen | Web/tablet | Top | Live | `/kitchen/live` | Yes | Kitchen role / tickets | P05–06 |
| Kitchen | Web/tablet | Top | Preparing | `/kitchen/preparing` | No | Kitchen role / tickets | P06 |
| Kitchen | Web/tablet | Top | Ready | `/kitchen/ready` | No | Kitchen role / tickets | P06 |
| Kitchen | Web/tablet | Top | History | `/kitchen/history` | No | Kitchen role / tickets | P06 |
| Cashier | Web | Sidebar | Open Checks | `/cashier/checks` | Yes | Cashier role / billing | P09 |
| Cashier | Web | Detail | Check Details | `/cashier/checks/:checkId` | No | Authorized / billing | P09 |
| Cashier | Web | Sidebar | Transactions | `/cashier/transactions` | No | Cashier / billing | P09 |
| Cashier | Web | Sidebar | Shift Summary | `/cashier/shift` | No | Cashier / shift ledger | P09 |
| Cashier | Web | Sidebar | Receipts | `/cashier/receipts` | No | Cashier / billing | P09 |
| Owner/Manager | Web | Sidebar | Overview | `/app/overview` | Yes | Tenant membership / operations | P02 |
| Owner/Manager | Web | Sidebar | Orders | `/app/orders/live` | No | Tenant / operations | P05 |
| Owner/Manager | Web | Sub | Order History | `/app/orders/history` | No | Tenant / operations | P05 |
| Owner/Manager | Web | Sidebar | Tables | `/app/tables/board` | No | Tenant / tables | P04 |
| Owner/Manager | Web | Sub | Sections & Tables | `/app/tables/manage` | No | Manage tables / tables | P04 |
| Owner/Manager | Web | Sub | QR Codes | `/app/tables/qr` | No | Manage tables / QR | P07 |
| Owner/Manager | Web | Sidebar | Menu | `/app/menu/items` | No | Manage menu / menu | P03 |
| Owner/Manager | Web | Sub | Categories | `/app/menu/categories` | No | Manage menu / menu | P03 |
| Owner/Manager | Web | Sub | Modifier Groups | `/app/menu/modifiers` | No | Manage menu / menu | P03 |
| Owner/Manager | Web | Sub | Availability | `/app/menu/availability` | No | Manage menu / menu | P03 |
| Owner/Manager | Web | Sidebar | Staff | `/app/staff/directory` | No | Staff management / identity | P02 |
| Owner/Manager | Web | Sub | Invitations | `/app/staff/invitations` | No | Staff management / identity | P02 |
| Owner/Manager | Web | Sub | Permissions | `/app/staff/permissions` | No | Owner full, manager restricted / identity | P02 |
| Owner/Manager | Web | Sidebar | Billing | `/app/billing/transactions` | No | Manager/owner / finance | P09 |
| Owner/Manager | Web | Sub | Refunds | `/app/billing/refunds` | No | Manager/owner / finance | P10 |
| Owner/Manager | Web | Sub | Receipts | `/app/billing/receipts` | No | Manager/owner / finance | P09 |
| Owner/Manager | Web | Sidebar | Reports | `/app/reports/sales` | No | Manager/owner / reports | P11 |
| Owner/Manager | Web | Sub | Items | `/app/reports/items` | No | Manager/owner / reports | P11 |
| Owner/Manager | Web | Sub | Service | `/app/reports/service` | No | Manager/owner / reports | P11 |
| Owner/Manager | Web | Sidebar | Subscription | `/app/subscription/plan` | No | Owner manage; manager read-only | P12 |
| Owner/Manager | Web | Sub | Invoices | `/app/subscription/invoices` | No | Owner/manager view; billing | P12 |
| Owner/Manager | Web | Sidebar | Settings | `/app/settings/restaurant` | No | Tenant admin / settings | P02 |
| Owner/Manager | Web | Sub | Ordering Rules | `/app/settings/ordering` | No | Manager/owner / order policy | P07 |
| Owner/Manager | Web | Sub | Charges & Receipts | `/app/settings/charges` | No | Owner/manager / finance policy | P09 |
| Owner/Manager | Web | Sub | Localization | `/app/settings/localization` | No | Manager/owner / localization | P02 |
| Owner/Manager | Web | Sub | Security | `/app/settings/security` | No | Owner / identity | P02 |
| Platform Admin | Web | Sidebar | Overview | `/platform/overview` | Yes | Platform admin | P02 |
| Platform Admin | Web | Sidebar | Restaurants | `/platform/restaurants` | No | Platform admin | P02/P12 |
| Platform Admin | Web | Sub | Pending | `/platform/restaurants/pending` | No | Platform admin | P12 |
| Platform Admin | Web | Sub | Suspended | `/platform/restaurants/suspended` | No | Platform admin | P12 |
| Platform Admin | Web | Sidebar | Subscriptions | `/platform/subscriptions/plans` | No | Platform admin | P12 |
| Platform Admin | Web | Sub | Invoices | `/platform/subscriptions/invoices` | No | Platform admin | P12 |
| Platform Admin | Web | Sub | Payments | `/platform/subscriptions/payments` | No | Platform admin | P12 |
| Platform Admin | Web | Sidebar | Support | `/platform/support/tickets` | No | Platform admin | P12 |
| Platform Admin | Web | Sub | Access Grants | `/platform/support/grants` | No | Platform admin | P12 |
| Platform Admin | Web | Sidebar | Audit | `/platform/audit` | No | Platform admin | P12 |
| Platform Admin | Web | Sidebar | Platform Settings | `/platform/settings` | No | Platform admin | P12 |

## 5.4 Route / sitemap registry (all destination families, including create/edit/details)

**Registry statuses:** `MVP` means scheduled; `NEXT` means omitted from MVP navigation. The exact route IDs below are stable identifiers for coverage and test writing. Role-scoped route families inherit the parent authorization policy.

| Route ID | Parent | Type | Roles | Feature IDs | Phase | Entry → exit | Status |
|---|---|---|---|---|---|---|---|
| R-001 `/auth/login` | Public | Auth | Staff | F01 | P01 | Invite/direct → role home | MVP |
| R-002 `/auth/invite/:token` | Public | Auth form | Staff | F01,F02 | P02 | Invite → login/home | MVP |
| R-003 `/onboarding/restaurant` | Public | Wizard | Owner | F02 | P02 | Signup → overview | MVP |
| R-004 `/w/home` | Waiter shell | Dashboard | Waiter | F07,F10 | P05 | Login → table/order | MVP |
| R-005 `/w/tables` | Waiter shell | List/tabs | Waiter | F04 | P05 | Home → detail | MVP |
| R-006 `/w/tables/:id` | Tables | Detail | Waiter | F04,F07 | P05 | Table → order/new | MVP |
| R-007 `/w/visits/:id/order/new` | Table detail | Form/cart | Waiter | F07 | P05 | Table → confirmation | MVP |
| R-008 `/w/orders` | Waiter shell | List/tabs | Waiter | F07,F10 | P05 | Bottom tab → detail | MVP |
| R-009 `/w/orders/:id` | Orders | Detail | Waiter | F07,F10 | P05 | Orders → table | MVP |
| R-010 `/w/menu` | Waiter shell | Catalog | Waiter | F03 | P05 | Bottom tab → item | MVP |
| R-011 `/w/more`, `/w/profile`, `/w/notifications` | Waiter shell | Account/alerts | Waiter | F01,F10 | P01/P06 | More → previous | MVP |
| R-012 `/kitchen/live` | Kitchen shell | Board | Kitchen | F08 | P05/P06 | Login → ticket | MVP |
| R-013 `/kitchen/preparing` | Kitchen shell | Board | Kitchen | F08 | P06 | Top tab → ready | MVP |
| R-014 `/kitchen/ready` | Kitchen shell | Board | Kitchen | F08 | P06 | Top tab → history | MVP |
| R-015 `/kitchen/history` | Kitchen shell | Search/list | Kitchen | F08 | P06 | Top tab → ticket | MVP |
| R-016 `/g/:slug/t/:qr` | Public QR | Table gate | Guest | F06 | P07 | Scan → menu | MVP |
| R-017 `/g/:visit/menu`, `/g/:visit/item/:id` | Guest shell | Menu/detail | Guest | F03,F06 | P07 | QR → cart | MVP |
| R-018 `/g/:visit/cart` | Guest shell | Cart | Guest | F06 | P07 | Menu → order | MVP |
| R-019 `/g/:visit/orders` | Guest shell | Tracking | Guest | F06,F08 | P07 | Submit → bill | MVP |
| R-020 `/g/:visit/help` | Guest shell | Request | Guest | F09 | P08 | Bottom tab → request | MVP |
| R-021 `/g/:visit/bill` | Guest shell | Read-only check | Guest | F11 | P09 | My Order → close | MVP |
| R-022 `/cashier/checks`, `/cashier/checks/:id` | Cashier shell | List/detail | Cashier | F11 | P09 | Login → receipt | MVP |
| R-023 `/cashier/transactions`, `/cashier/shift`, `/cashier/receipts` | Cashier shell | Ledger/summary | Cashier | F11 | P09 | Sidebar → detail | MVP |
| R-024 `/app/overview` | Restaurant shell | Dashboard | Manager,Owner | F02,F12 | P02/P11 | Login → management | MVP |
| R-025 `/app/orders/live`, `/app/orders/history`, `/app/orders/:id` | Restaurant shell | Lists/detail | Manager,Owner | F07,F08 | P05 | Sidebar → order | MVP |
| R-026 `/app/tables/board`, `/app/tables/manage`, `/app/tables/qr` | Restaurant shell | Board/settings | Manager,Owner | F04,F05 | P04/P07 | Sidebar → table edit | MVP |
| R-027 `/app/menu/items`, `/app/menu/items/new`, `/app/menu/items/:id/edit` | Restaurant shell | List/form | Manager,Owner | F03 | P03 | Sidebar → list | MVP |
| R-028 `/app/menu/categories`, `/app/menu/modifiers`, `/app/menu/availability` | Restaurant shell | Lists/forms | Manager,Owner | F03 | P03 | Menu subtabs → items | MVP |
| R-029 `/app/staff/directory`, `/app/staff/invitations`, `/app/staff/permissions` | Restaurant shell | Admin | Manager,Owner | F01,F02 | P02 | Sidebar → directory | MVP |
| R-030 `/app/billing/transactions`, `/app/billing/refunds`, `/app/billing/receipts` | Restaurant shell | Ledger/approvals | Manager,Owner | F11,F12 | P09/P10 | Sidebar → check | MVP |
| R-031 `/app/reports/sales`, `/app/reports/items`, `/app/reports/service` | Restaurant shell | Reports | Manager,Owner | F13 | P11 | Sidebar → filter/export | MVP |
| R-032 `/app/subscription/plan`, `/app/subscription/invoices` | Restaurant shell | Plan/invoices | Owner,Manager read-only | F14 | P12 | Sidebar → invoice | MVP |
| R-033 `/app/settings/restaurant`, `/app/settings/ordering`, `/app/settings/charges`, `/app/settings/localization`, `/app/settings/security` | Restaurant shell | Settings/forms | Owner,Manager restricted | F02,F15 | P02/P07/P09 | Sidebar → saved setting | MVP |
| R-034 `/platform/overview`, `/platform/restaurants`, `/platform/restaurants/:id` | Platform shell | Ops | Platform Admin | F16 | P02/P12 | Login → tenant | MVP |
| R-035 `/platform/restaurants/pending`, `/platform/restaurants/suspended` | Platform shell | Lists | Platform Admin | F16 | P12 | Restaurants → detail | MVP |
| R-036 `/platform/subscriptions/plans`, `/platform/subscriptions/invoices`, `/platform/subscriptions/payments` | Platform shell | Finance | Platform Admin | F14,F16 | P12 | Sidebar → plan/ledger | MVP |
| R-037 `/platform/support/tickets`, `/platform/support/grants` | Platform shell | Support | Platform Admin | F16 | P12 | Sidebar → ticket | MVP |
| R-038 `/platform/audit`, `/platform/settings` | Platform shell | Audit/config | Platform Admin | F16 | P12 | Sidebar → filters/settings | MVP |
| R-039 `/app/inventory/*`, `/app/locations/*`, `/app/reports/advanced` | Restaurant shell | Reserved | Owner,Manager | F17 | Post-MVP | Not reachable in MVP | NEXT |
| R-040 `/app/help`, `/app/profile`, `/cashier/account`, `/kitchen/account`, `/platform/profile` | Role shell | Help/account | Owner,Manager,Cashier,Kitchen,Platform Admin | F01,F16 | P01–02/P12 | Account header/sidebar → return | MVP |

**Detailed route-state rule:** `/app/menu/items/new` and `/:id/edit`, staff invite detail, restaurant table/section edits, check split, refund review and platform tenant detail are routed forms or dialogs launched from their parent pages; they must retain referrer context and have a working Cancel/Back target.

---
# 6. Complete page inventory and page/subtab blueprints

## 6.1 Page inventory

Each row represents a separately testable destination or genuinely distinct stateful panel. Shared shell behavior is defined in Section 5; shared data/visual states are in Section 8. A `/new` or `/edit` route inherits its list's authorization and has its own form contract below.

| Page ID | Exact title | Route | Role | Parent / subtabs | Primary job | Features | Phase |
|---|---|---|---|---|---|---|---|
| PG-01 | Sign In / Accept Invitation | `/auth/*` | Staff | Public | Secure identity entry | F01 | P01–02 |
| PG-02 | Set Up Restaurant | `/onboarding/restaurant` | Owner | Onboarding steps | Create usable tenant | F02 | P02 |
| PG-03 | Home | `/w/home` | Waiter | Mobile Home | Prioritize work | F07,F09 | P05/P08 |
| PG-04 | Tables | `/w/tables` | Waiter | All / Mine / Needs Attention | Choose table | F04 | P05 |
| PG-05 | Table Details | `/w/tables/:id` | Waiter | Current Visit / Orders / Requests | Serve one table | F04,F07,F09 | P05/P08 |
| PG-06 | New Order | `/w/visits/:id/order/new` | Waiter | Menu / Cart | Submit round | F07 | P05 |
| PG-07 | Orders | `/w/orders` | Waiter | Active / Ready / Completed | Track and serve | F07,F08 | P05–06 |
| PG-08 | Order Details | `/w/orders/:id` | Waiter | Items / Activity | View or request change | F07,F10 | P05/P08 |
| PG-09 | Menu | `/w/menu` | Waiter | Categories | Look up dishes | F03 | P05 |
| PG-10 | More / Profile / Alerts | `/w/more` etc. | Waiter | Account destinations | Language, account, recovery | F01,F09 | P01/P06 |
| PG-11 | Kitchen Live | `/kitchen/live` | Kitchen | New / Awaiting Acceptance | Receive tickets | F08 | P05–06 |
| PG-12 | Kitchen Preparing | `/kitchen/preparing` | Kitchen | Timer-sorted tickets | Advance preparation | F08 | P06 |
| PG-13 | Kitchen Ready | `/kitchen/ready` | Kitchen | Awaiting Pickup | Signal handoff | F08 | P06 |
| PG-14 | Kitchen History | `/kitchen/history` | Kitchen | Search/filter | Audit service tickets | F08 | P06 |
| PG-15 | Verify Table | `/g/:slug/t/:qr` | Guest | QR entry | Activate visit scope | F06 | P07 |
| PG-16 | Guest Menu | `/g/:visit/menu` | Guest | Category chips | Find meals | F03,F06 | P07 |
| PG-17 | Meal Details | `/g/:visit/item/:id` | Guest | Modifier groups | Customize one meal | F03,F06 | P07 |
| PG-18 | Cart | `/g/:visit/cart` | Guest | Item summary | Confirm and submit | F06 | P07 |
| PG-19 | My Order | `/g/:visit/orders` | Guest | Active / Past Rounds | Check status | F06 | P07 |
| PG-20 | Assistance | `/g/:visit/help` | Guest | Call Waiter / Request Bill | Request help | F09 | P08 |
| PG-21 | Bill | `/g/:visit/bill` | Guest | Check summary | Read amount due | F11 | P09 |
| PG-22 | Open Checks | `/cashier/checks` | Cashier | All / Payment Requested / Partially Paid | Find payable check | F11 | P09 |
| PG-23 | Check Details | `/cashier/checks/:id` | Cashier | Items / Split / Payments / Activity | Settle check | F11 | P09–10 |
| PG-24 | Transactions | `/cashier/transactions` | Cashier | Filters | Trace tender | F11 | P09 |
| PG-25 | Shift Summary | `/cashier/shift` | Cashier | Current / Previous | Reconcile cash | F11 | P09 |
| PG-26 | Receipts | `/cashier/receipts` | Cashier | Search | Reprint receipts | F11 | P09 |
| PG-27 | Overview | `/app/overview` | Owner,Manager | Operational summary | Monitor restaurant | F02,F13 | P02/P11 |
| PG-28 | Orders | `/app/orders/live`, `/history` | Owner,Manager | Live / History | Monitor and fix orders | F07,F10 | P05 |
| PG-29 | Tables | `/app/tables/*` | Owner,Manager | Board / Sections & Tables / QR Codes | Configure seating | F04,F05 | P04/P07 |
| PG-30 | Menu | `/app/menu/*` | Owner,Manager | Items / Categories / Modifier Groups / Availability | Manage catalog | F03 | P03 |
| PG-31 | Staff | `/app/staff/*` | Owner,Manager | Directory / Invitations / Permissions | Manage team | F01,F02 | P02 |
| PG-32 | Billing | `/app/billing/*` | Owner,Manager | Transactions / Refunds / Receipts | Oversee money | F11,F12 | P09–10 |
| PG-33 | Reports | `/app/reports/*` | Owner,Manager | Sales / Items / Service | Track operations | F13 | P11 |
| PG-34 | Subscription | `/app/subscription/*` | Owner,Manager | Plan / Invoices | Maintain entitlement | F14 | P12 |
| PG-35 | Settings | `/app/settings/*` | Owner,Manager | Restaurant / Ordering Rules / Charges & Receipts / Localization / Security | Configure behavior | F02,F15 | P02/P07/P09 |
| PG-36 | Platform Overview | `/platform/overview` | Platform Admin | Platform KPIs | Review global health | F16 | P02/P12 |
| PG-37 | Restaurants | `/platform/restaurants/*` | Platform Admin | All / Pending / Suspended | Approve/support tenants | F16 | P12 |
| PG-38 | Platform Subscriptions | `/platform/subscriptions/*` | Platform Admin | Plans / Invoices / Payments | Control billing | F14,F16 | P12 |
| PG-39 | Support | `/platform/support/*` | Platform Admin | Tickets / Access Grants | Resolve tenant issues | F16 | P12 |
| PG-40 | Audit / Settings | `/platform/audit`, `/platform/settings` | Platform Admin | Dedicated destinations | Safe platform management | F16 | P12 |
| PG-41 | Shared Help / Account | `/app/help`, `/app/profile`, `/cashier/account`, `/kitchen/account`, `/platform/profile` | Authenticated staff | Account menu | Recover access and find operational help | F01,F16 | P01–02/P12 |

## 6.2 Global page contract (applies to each screen)

**Layout:** page-title at consistent typography level, action aligned to logical trailing edge, only meaningful metrics, context tabs below header, body content in sections/cards rather than large undifferentiated forms. **Loading:** preserve shell and tabs; use skeleton cards/rows sized like final content. **Empty:** explain no records and offer role-authorized primary next action. **Filtered empty:** retain filter chips and clear-filters action. **Errors:** contextual error with Retry and non-destructive return; avoid toast-only failures for transaction writes. **Pagination:** staff admin lists default 10 items/page; 5 on phone if card layout, server-side cursor/offset with stable sorting; operational boards are live, segmented and virtualized at high volume rather than paginated mid-service. **Feedback:** disable only the action being processed; success state and idempotent submit prevent accidental duplicate creation. **Accessibility:** keyboard labels, focus return, screen-reader titles and status announcements; reduced-motion respected. **RTL:** logical inline-start/end and mirrored navigation; icons that convey direction mirror when semantic. **Responsiveness:** under 768px stacked cards, top filters collapse; dialogs become bottom sheets on phone; fixed submit/action bars avoid keyboards and safe-area overlays.

## 6.3 Auth, tenant onboarding, and profile

### PG-01 — Sign In / Invite Acceptance

**Outcome:** a staff member enters only a role and tenant they are entitled to use. **Entry:** staff URL, invitation link, expired-session redirect. **Layout:** branded card, language toggle, email/username field, password, sign-in CTA, forgot-password link, safe generic errors; invite acceptance adds restaurant name/role and display name. **Forms:** sign-in identity (required, email or username), password (required, never prefilled); invite acceptance token read-only, display name (2–80 characters), password if new identity (minimum 12 characters plus secure-password guidance), confirm password and TOS checkbox as applicable. **Behavior:** rate-limit sign-in, reset by verified email; if outgoing email unavailable, owner/administrator handles staff setup securely rather than displaying development links. Invite expires after configurable 48 hours and cannot be reused; invalid invitation has request-new-invite route. **States:** invalid credentials generic; pending verification; expired/inactive membership; network retry without revealing whether email exists. **Acceptance:** unauthenticated staff cannot fetch tenant data; role landing is correct; sign-out revokes session.

### PG-02 — Set Up Restaurant

**Outcome:** verified owner reaches an operable restaurant shell. **Entry:** signup → four-step wizard: **(1) Account**, **(2) Restaurant**, **(3) Service Defaults**, **(4) Review**. **Fields:** owner name/email/password; business display name (2–100, required), slug (unique, lowercase letters/numbers/hyphens, autosuggest editable), location name (required), city (required), phone (optional), address (optional), operating timezone (required default Asia/Kabul), locale/language (default Dari), currency (default AFN), opening hours (optional), initial ordering policy (waiter approval recommended), receipt footer (optional). **Actions:** Back, Save Draft, Continue, Create Restaurant; transaction creates owner membership, location, default policies and empty shells, not demo financial data. **Validation:** unique slug, verified identity, timezone and currency consistency, terms acknowledgement; duplicate submission returns existing tenant. **First-run:** Overview banner with action cards `Add Menu`, `Create Tables`, `Invite Staff`, `Test Order`; never present fake KPIs as actual sales. **Acceptance:** interrupted wizard resumes, and owner has only their tenant after creation.

### PG-10 — Waiter More / Profile / Notifications

**More:** list items with icon/chevron: Notifications badge; Profile; Language; Help; Sign Out. **Profile:** name, restaurant/location, assigned role, account email (read-only unless verified change), app version, password change; no unrelated management data. **Notifications:** `All / Unread`, chronological cards with table/ticket context, mark read and deep-link, optional sound/vibration preference; items do not auto-disappear. **Language:** explicit Dari, Pashto, English, preview direction change, persisted per user/device; sign-out confirmation preserves server drafts but removes local guest/staff tokens. **States:** empty notifications, expired session, offline notification cache marked stale. **Acceptance:** a ready ticket deep-link opens the right order and respects assignment.

## 6.4 Waiter mobile app

### PG-03 — Home

**Outcome:** waiter knows which action matters next. **Layout:** compact greeting and shift/location, connection indicator; 2×2 compact KPI cards (`My Active Tables`, `Ready to Serve`, `Pending Requests`, `Orders in Progress`) only when data exists, then **Needs Attention** list, then **My Tables** carousel and a primary **Open Tables** action. **Actions:** tap request → table/request detail; tap ready ticket → order; Start Order only from a valid active table. **Data:** assigned active visits ordered by urgent elapsed time; subscription remains idle when app backgrounded and resyncs on return. **States:** zero tables says 'No assigned tables' and offers All Tables or manager contact; stale data timestamp; partial outage banner. **Phone design:** 16px padding, 2 columns for summary cards, no oversized charts. **Acceptance:** no false '0 orders' while load pending; waiter sees a ready ticket once after status change.

### PG-04 — Tables (All / Mine / Needs Attention)

**Outcome:** choose a table and recognize status. **Layout:** header search by table/section, status filter chips, three sticky subtabs, list/grid with table number large, section, seating count, visit elapsed, status badge and waiter assignment. **All:** authorized location tables; sort active first then label, filter section/status. **Mine:** only assigned tables; empty message suggests ask manager for assignment. **Needs Attention:** only tables with pending guest approvals, ready food, assistance, or payment request; priority by age. **Actions:** available → open visit; occupied → details; cleaning → mark available if authorized; disabled table cannot open. **Data:** live subscriptions and periodic reconciliation; 2-column on wider phones, 1-column accessible compact on narrow. **Acceptance:** two devices cannot open two concurrent visits for one table; one active visit wins, other sees 'Open existing visit'.

### PG-05 — Table Details (Current Visit / Orders / Requests)

**Outcome:** manage one table's service. **Header:** table #, section, people count, assigned waiter, visit duration, status; persistent **Add Order** CTA only on active visit. **Current Visit subtab:** open/close workflow, seat count editor, notes, total estimated check, pending and served item counts, QR PIN visibility restricted to staff, request bill action. **Orders subtab:** rounds grouped by submission time, source and status; view item list, open order details, add new round. **Requests subtab:** assistance/approval/bill requests with received time, acknowledge and resolve actions; keep resolved history within visit. **Forms:** Open Visit: guests (integer 1–30, default 2, may be overridden), waiter assignment (default self; manager-only reassignment), optional table note 0–300. **Guards:** cannot force-close unsettled check; merging tables is excluded from MVP. **States:** table reopened by another waiter gives reload/access message; cancelled visit history still readable to management. **Acceptance:** QR guest addition appears in current visit without navigation reset.

### PG-06 — New Order (Menu / Cart)

**Outcome:** accurately submit selected items in under a few interactions. **Menu:** category chips, item search, 2-column grid on large phone or 1-column compact cards on small; cards show thumbnail, name, short description, price, availability, popular/contains allergen indicators if entered. **Item detail sheet:** quantity 1–99, required modifier groups with min/max, price-delta labels, optional special note (max 250), seat number optional in MVP informational only, Add. **Cart:** lines grouped by item/options, +/- quantity, edit/remove, order note (max 500), exact subtotal/charges **estimate**, prominent server-authoritative submit. **Actions:** Save Draft (device-local, scoped to visit) and **Send to Kitchen**; if visit closes or price/item availability changes, require revalidation and visible adjustment confirmation. **Network:** disable duplicate tap; show `Sending → Accepted #1234` only after server acknowledgment; failed submit returns editable cart and Retry, never assumed submitted. **Accepted order:** immediately viewable in kitchen baseline inbox at P05 and richer kitchen P06. **Acceptance:** 100 simultaneous retry attempts with same idempotency key yield one persisted order/ticket.

### PG-07 — Orders (Active / Ready / Completed)

**Active:** submitted/accepted/preparing orders, status and time, filter by table/assigned waiter. **Ready:** ready items awaiting pickup and `Mark Served` action with confirmation if multiple items. **Completed:** served, cancelled or settled orders from date range, searchable, 10 per page. **Actions:** tap detail; refresh; request change on permitted items; no direct destructive edit button. **Design:** status colors plus text/icon, persistent tabs while fetching; empty tab communicates meaning. **Acceptance:** marking served removes from Ready and updates table detail, but does not automatically record payment.

### PG-08 — Order Details (Items / Activity)

**Items:** order ID, origin, table, submitter, created time, status, item snapshots, modifiers, preparation notes, per-line status, totals. **Activity:** chronological event timeline with actor and reason, truncated to recent first 20 with Load More. **Actions:** Add another round (routes to table/new), mark served, request cancel/change, return to table. **Change request:** choose line, qty/cancel, reason required when transmitted, manager review if preparation started; update produces kitchen delta event, never edits original ticket silently. **Acceptance:** waiter cannot directly delete a preparing item or modify a paid line.

### PG-09 — Waiter Menu

**Outcome:** answer customer menu questions without entering an order. **Layout:** search, category pills, available/unavailable markers, item details (read-only for catalog), allergen/ingredient information entered by admin. **Action:** `Add to Table` asks for an active assigned table and routes to order cart; never creates a floating unattached order. **Acceptance:** unavailable item cannot be submitted even if cached on phone.

## 6.5 Kitchen web/tablet

**Shared kitchen composition:** high-contrast top bar with restaurant, connection and sound status; fixed status tabs; dense adaptive ticket grid with card width minimum ~280px; order cards show **table number large**, ticket ID, submitted time, elapsed timer, waiter/guest origin, item quantity and modification notes, colored status badge, single primary status action. Huge 48px primary buttons; no customer phone/email. Audio notifications optional and user-enabled, throttled per batch. Timers render client-side but status comes from server. If real-time disconnects, use polling fallback with visible `Reconnecting` banner.

### PG-11 — Live (New / Awaiting Acceptance)

**New subtab:** newest accepted unstarted tickets sorted oldest first by default; `Start Preparing`, `Inspect`, and `Reject` (only on permitted exceptional cases with reason and manager escalation); items include notes and course if supplied. **Awaiting Acceptance subtab:** guest orders pending waiter approval are **visible only as a clearly marked context summary** (not actionable by kitchen) so staff know backlog; actual approve/reject controls belong to waiter/manager operational inbox. For restaurants configured direct guest routing, guest orders enter New after verification. **Acceptance:** pending-approval ticket never enters preparation through a kitchen action; committed accepted order appears exactly once.

### PG-12 — Preparing

**Outcome:** progress the actual kitchen work. **Layout:** ticket cards sort by longest elapsed first; optional filter `All / My Items` only if meaningful to kitchen staffing, otherwise omit. **Action:** `Mark Ready` per ticket or per line if multi-line readiness enabled; irreversible status change can be corrected only through manager-authorized exception event. **Concurrency:** optimistic version lock prevents double mark or invalid jump. **Acceptance:** two kitchen tablets updating same ticket converge; duplicate event is rejected/idempotent and clients resync.

### PG-13 — Ready

**Outcome:** kitchen can see food awaiting waiter pickup. **Layout:** ready cards with waiter name/table and elapsed-since-ready timer, `Notify Waiter Again` throttled, `Mark Handed Off` (separate from waiter `Served` if restaurant chooses to track pickup). **Actions:** ready handoff may set `PICKED_UP` but not `SERVED` without waiter action. **Acceptance:** waiter ready notification includes correct table and order; no financial action appears here.

### PG-14 — History

**Outcome:** explain past tickets. **Filters:** date range (default current business day), table, ticket ID, status, source. **Rows:** received/prepared/ready time, delay, operator, result; 20/page. **Detail:** complete timeline, adjustments and reject reasons with permissions. **Export:** CSV only for management roles via restaurant Reports, not kitchen by default. **States:** no tickets today, malformed filters and expired rights handled.

## 6.6 Customer QR web

**Guest header:** compact restaurant logo/name, table number and privacy note, language selector, connection status. **Phone bottom:** Menu / My Order / Assistance; raised Cart CTA appears when cart has items. **Do not ask for account, password, mobile number, marketing consent or location permission.**

### PG-15 — Verify Table

**Outcome:** guest proves they belong to the current seating session. **Sequence:** scan printed QR → server resolves public restaurant/table → shows restaurant branding, table number and notice `Ask your waiter for the current table code` → enter **6-digit visit PIN** (rotated every visit) → obtain short-lived visit-scoped guest token → menu. **Forms:** PIN numeric exactly 6 digits, aria-label, localized number input; 5 attempts / rolling window before cool-down; tokens tied to `tenant_id`, `location_id`, `table_id`, `visit_id`, policy and expiry. **Security:** static QR alone never grants open ordering; stale QR/closed visit shows `Ask waiter to open your table`, retry and restaurant contact. Restaurant can print unique table QR, while PIN changes each seating. **Acceptance:** past guest's token and PIN do not authorize the next visit; another tenant's QR/token is rejected.

### PG-16 — Guest Menu

**Layout:** visual restaurant header, menu search, category horizontal chips, optional featured strip only for curated available dishes, dish cards with name, description up to 2 lines, price in AFN, allergen tags if entered, Add button or Customize. **Data:** only published, visible, currently available items; category selection preserves scroll and filters; lightweight optimized images with fallback. **Footer:** pinned cart amount/quantity, ordering policy badge (`Waiter will confirm` when relevant). **Acceptance:** unpublished item never reachable via deep link; long Dari/Pashto title wraps cleanly.

### PG-17 — Meal Details

**Layout:** responsive sheet/full page with 4:3 photo, title, ingredients description, allergen disclosure where configured, base price, option groups, special requests, quantity and sticky Add button. **Modifier group:** min/max choice counts; single choice radio, multi choice checkboxes; price delta shown; disabled option excluded from new carts; selected items preview final price. **Validation:** required groups complete; limit quantities and note length; server revalidates on submit. **Acceptance:** a meal with required size selection cannot be added incomplete; server rejects forged cheaper modifiers.

### PG-18 — Cart

**Outcome:** submit a valid round to the actual table visit. **Sections:** grouped cart lines, customizations, notes, editable quantity; subtotal and clearly labeled estimated tax/service charge; terms about policy; bottom `Place Order` CTA and spinner. **Actions:** edit line (opens PG-17), remove with Undo toast, clear cart with confirmation, submit. **After submit:** if waiter approval policy, show `Sent for Approval`; else `Accepted by Restaurant` only after server accept; order number and track button. **Failures:** unavailable ingredient, price change, PIN invalidation, concurrent visit closure, timeout with query-by-idempotency-key before retry. **Acceptance:** refresh does not duplicate accepted order; cart persists within active visit and is cleared only on confirmed success.

### PG-19 — My Order (Active / Past Rounds)

**Active subtab:** cards grouped by order round; status `Awaiting Confirmation / Accepted / Preparing / Ready / Served`, each line details, last update time; includes `Order More` and `View Bill` after check starts. **Past Rounds:** prior round list within *same* visit, sorted newest first, not historic customer profiles; cancelled lines marked with reason where guest-safe. **Rules:** no cancel action after submitting unless restaurant policy specifically enables guest request; assistance request used instead. **Read-only:** after table closes display receipt/bill view for a short TTL without access to next customers. **Acceptance:** waiter-created rounds also display in guest's visit status without exposing internal staff notes.

### PG-20 — Assistance (Call Waiter / Request Bill)

**Call Waiter:** selectable reason `Need help`, `Water`, `Cutlery`, `Other` (optional text ≤200), submit once, status `Pending / Acknowledged / Resolved`; prevent repeated requests of same type within 60 seconds while pending. **Request Bill:** one-tap request with optional `Together / Split` preference; moves table attention state but **does not freeze additional ordering** until cashier locks check. **Layout:** two prominent action cards, request history below. **Acceptance:** request raises waiter and manager inbox item; same outstanding request cannot flood staff notification queue.

### PG-21 — Bill

**Outcome:** guests can review charges before payment. **Layout:** restaurant/table, list of accepted chargeable items and snapshots, subtotal, line discounts, tax/service charge, amount paid, due, split indicator, `Request Adjustment` routes to Assistance. **Read-only:** guest cannot edit financial records or mark paid. **Privacy:** no full cashier data, internal notes, prior table visits. **Acceptance:** waiter and guest see the same server-calculated due amount, subject to a refresh while concurrent orders remain open.

## 6.7 Cashier web

### PG-22 — Open Checks (All / Payment Requested / Partially Paid)

**All:** active visits with nonzero due; table number, duration, line count, open amount, payment status, bill request indicator. **Payment Requested:** only guest/waiter bill requests, oldest first. **Partially Paid:** checks with recorded valid tender but remaining balance, show percentage. **Actions:** click check; use filters `Section`, `Waiter`, `Status`; search table/order ID. **Design:** desktop table, mobile cards, sticky due total and no auto-open upon new events. **Acceptance:** check moves between subtabs without duplication as payments post.

### PG-23 — Check Details (Items / Split / Payments / Activity)

**Sticky summary:** table/visit, check number, version, subtotal, discounts, tax/service, paid, due, status, action `Record Payment`. **Items subtab:** line snapshots, quantity and price, serving status, manual adjustment requests; authorized discount/void opens manager-approval dialog. **Split subtab:** `Single Bill` (default), `Split Equally` (2–10 shares, rounding remainder to last share), or `Split by Item` (select items/quantity per guest, all chargeable lines must be allocated exactly once); lock split revision after first payment unless manager adjusts with compensating ledger entry. **Payments subtab:** tender entries (timestamp, method, amount, reference optional, cashier, status), `Record Payment`, `Issue Receipt`, controlled reversal/refund. **Activity subtab:** actor-reason audit for order round, split, adjustment, payment and close. **Payment form:** amount (required, >0, max outstanding unless explicit cash tender with change calculation), tender type `Cash` or `Manual External Transfer`, optional reference (required for manual transfer), received amount and computed change (cash), notes optional; **manual transfer requires staff to verify payment outside the app**, never auto-label as gateway success. **Rules:** amount and rounding in integer minor units, no negative bill, server-side transactions; close only if zero due, no unresolved charge-affecting kitchen order, no pending approval; posted payment immutable, reversal is an audit event. **Acceptance:** no duplicate payment from double-tap/retry; two cashiers cannot overpay a check; receipt total reconciles to ledger.

### PG-24 — Transactions

**Outcome:** locate any tender or reversal. **Filters:** business-date range, method, cashier, status, check number, min/max amount. **Columns:** transaction ID, time, table/check, tender type, gross amount, reversed amount, net amount, actor; 20/page with server-side date filter and stable sort. **Actions:** open check and view receipt; no erase. **Acceptance:** refund/reversal always appears separately and reconciles.

### PG-25 — Shift Summary (Current / Previous)

**Current:** shift start, opening cash float (optional), cash sales, change dispensed, cash reversals/refunds, expected drawer amount and counted cash field; **Close Shift** requires count and supervisor acknowledgment if variance exceeds configured threshold. **Previous:** historical closed shifts with variance and actor (10/page), immutable read-only detail. **Rules:** shift is per cashier and location; unassigned payment belongs to named cashier's session. **Acceptance:** two simultaneous shift closes create one closing record; totals derive from ledger, not editable KPI fields.

### PG-26 — Receipts

**Layout:** receipt search by number/table/date, 20 per page; preview, print browser/standard receipt size, export PDF; branded header and local-language footer. **Actions:** Reprint (records event), Email only if a verified provider is later configured (hidden in MVP); no customer email collection required. **Acceptance:** receipt content matches recorded bill and is marked reprint without changing tender.

## 6.8 Restaurant management web

### PG-27 — Overview

**Outcome:** restaurant manager sees the state of service, not a pile of unrelated forms. **Layout:** header with business date/location and quick links; alert strip for order queue issues; KPI grid `Active Tables`, `Orders Today`, `Unpaid Checks`, `Revenue Today` (after finance release), followed by `Live Queue`, `Attention Needed`, and `Setup Checklist` for new businesses. **No fake charts/placeholder data.** Actions lead to table/order/menu/staff routes. Manager cannot view other tenants. **Acceptance:** card counts agree with underlying filtered lists and show as unavailable, not zero, on API error.

### PG-28 — Orders (Live / History)

**Live:** three columns `Awaiting Guest Approval`, `In Kitchen`, `Ready for Service` at desktop; mobile status tabs, query by table, waiter and source; approve/reject guest order with recorded reason, escalate rejected items, open details. **History:** date range, status, table, origin filters, 20/page, detailed event timeline and adjustment linkage. **Action:** `Review Order` opens a proper detail panel; no direct editing of transmitted lines. **Acceptance:** approval is exactly-once; rejected guest order visibly becomes rejected in guest tracking with a polite explanation.

### PG-29 — Tables: Board / Sections & Tables / QR Codes

**Board:** live location table grid grouped by section, available/occupied/payment requested/cleaning/disabled colors and labels; click to view active visit and waiter; authorized actions Open, Assign, Mark Cleaning/Available; kitchen order status context. **Sections & Tables:** sections listing with Add/Edit/Archive; table list with Add/Edit/Disable, search and section filter, 10/page. **Section form:** name 2–40 required, display order integer, active flag. **Table form:** label unique per location 1–12 characters required, section required, seats 1–30, display order, notes optional, active flag. **Destruction rule:** cannot archive occupied table or a section containing active tables; archived table retains history. **QR Codes:** one table QR per active table, table label, generated URL, print-ready 1/2/4-up template, print/download, regenerate/revoke static QR with confirmation; QR **not** the visit PIN. **Acceptance:** duplicate table label conflicts cleanly and previous QR becomes invalid after regeneration, not after ordinary visit closure.

### PG-30 — Menu: Items / Categories / Modifier Groups / Availability

**Items:** search, category/status filter, table rows/card items with thumbnail, localized name, price, menu status, sold-out flag, action New/Edit/Duplicate/Archive. **Item form:** category required; localized name Dari required (2–100) with optional Pashto/English, SKU optional unique per location, description ≤500, base price integer minor units ≥0, photo optional optimized and validated type/size, allergens optional curated list, available yes/no, published yes/no, preparation estimate optional, modifiers multiselect, sort order optional. **Categories:** ordered categories; form localized name required in default locale, description optional, sort index, published flag; archive forbidden with active published items unless reassigned. **Modifier Groups:** list then editor; label, min selections 0–10, max selections ≥min and ≤option count, single/multi mode, each option localizable name, delta price ≥0 or signed admin-approved, active flag; save validates min/max, optionally allow option substitution; archive prevents new orders but historical item snapshot persists. **Availability:** fast bulk menu item toggles by category with sold-out reason optional and `Available Again` action; changed status broadcasts to waiter/guest views. **Acceptance:** no negative total, unpublished items stay hidden; a currently active order is unaffected by changing menu price; new carts get a price-change warning.

### PG-31 — Staff: Directory / Invitations / Permissions

**Directory:** name, role, status, assigned section/tables optional, last active, actions View/Edit/Disable/Reset Invitation. **Staff form:** name required, verified email/username required, one primary role, optional section assignment, status Active/Disabled; cannot remove last active owner. **Invitations:** invite form email, role, expiry default 48 hours, optional message; list Pending/Accepted/Expired/Revoked with Resend/Revoke; never show raw invite secrets after generation. **Permissions:** read-only role matrix for managers, owner can adjust supported granular manager approvals (void limit, discount limit, staff invitation rights) with recorded change; cannot promote to platform admin. **Acceptance:** invitation of existing account adds membership only after acceptance; disabling member terminates server access within session revocation window.

### PG-32 — Billing: Transactions / Refunds / Receipts

**Transactions:** similar to PG-24, restaurant-wide, restricted export with date range; include net cash and manual tender. **Refunds:** queue `Pending / Approved / Rejected / Completed` showing payment, amount, reason, requesting cashier and approver; form refund amount ≤ refundable balance, mandatory reason, original payment reference; status transitions performed by manager/owner; cash refund is marked completed only when money is physically returned. **Receipts:** search, preview, reprint with audit, export PDF. **Never silently delete money records.** **Acceptance:** cumulative refunds cannot exceed original settled payment; requestor cannot approve own request when configured segregation-of-duties rule is enabled.

### PG-33 — Reports: Sales / Items / Service

**Sales:** business-day/date range, gross sales, discounts, tax/service, refunds, net sales and tender breakdown; clear distinction between order value and actually collected tender. **Items:** top-selling item quantities and net sales, category filter, CSV export; historical names use snapshots. **Service:** ticket count, median and p95 kitchen time, approval delays, ready-to-served latency, cancelled item rate; show `Insufficient data` rather than fabricated score. **State:** defaults today, 7d, 30d presets and custom dates; on phones KPI stack and downloadable data instead of cramped tables. **Acceptance:** example scenario with refund reconciles to reports and ledger.

### PG-34 — Subscription: Plan / Invoices

**Plan:** active plan, entitlement limits, current status, next renewal, trial/grace expiry and upgrade request; **manager read-only**. `Request Upgrade` creates a request/ticket, not a fake automated checkout. **Invoices:** chronological invoice cards with period, amount, currency, due/paid status, payment instructions from platform, downloadable PDF, proof-of-payment submission if platform accepts manual collection. **Acceptance:** pending proof is not counted paid until platform admin verifies; no external payment service invented.

### PG-35 — Settings: Restaurant / Ordering Rules / Charges & Receipts / Localization / Security

**Restaurant:** business name/logo, location contact/address, opening hours/timezone, optional kitchen instruction header; name required, logo size/type validation, Save/Cancel. **Ordering Rules:** guest ordering enabled, **Waiter Approval (default)** vs Direct to Kitchen, guest PIN lifetime per visit, new orders after bill requested allowed by default, kitchen new-ticket alert; direct mode activation requires explicit acknowledgement of guest-session abuse risk. **Charges & Receipts:** tax inclusive/exclusive flag, percentage or fixed service charge (explicit 0 allowed), optional discount approvals, rounding mode, receipt footer and contact; changing charges affects **new checks only**, old check uses policy snapshot. **Localization:** default menu locale, allowed guest locales, date/time formats, currency symbol placement, digit display, week start; `Dari / Pashto / English` preview; persist setting per tenant/user. **Security:** view active sessions, revoke user tokens, owner password/verification status, session duration, support access grants; record any change with actor/reason. **Acceptance:** settings apply consistently across web/mobile, with preview before direction-sensitive changes.

## 6.9 Platform administration

### PG-36 — Platform Overview

**Outcome:** view healthy tenant operations without private restaurant data. **Layout:** tenant counts Active / Trial / Suspended, overdue invoices, pending approval, support queue, recent security incidents, service health; no raw customer order details. **Actions:** drill into filtered tenants, invoices, support. **Acceptance:** platform KPI counts derive from tenants and platform billing ledgers only.

### PG-37 — Restaurants: All / Pending / Suspended (+ detail)

**All:** list tenant, owner contact, plan, status, location count, created date, renewal, 20/page; search and status filter. **Pending:** verification and approval queue; actions Approve/Reject with reason. **Suspended:** list suspended/overdue with reasons, Restore after eligibility check. **Tenant detail:** profile, location metadata, plan status, billing timeline, action history, limited-support control; **no direct order browse**. **Forms:** suspend reason required, effective time, notice field optional; restore requires reason and plan eligibility. **Acceptance:** suspension blocks creation of new visits after grace policy, but never erases existing ledger/receipts or silently leaves active sessions stranded.

### PG-38 — Platform Subscriptions: Plans / Invoices / Payments

**Plans:** plan table with name, pricing, currency, billing period, location/staff/table limits and feature entitlements; Edit produces versioned plan so existing invoices retain original terms. **Invoices:** draft/issued/due/overdue/paid/voided, number, tenant, period, amount, PDF, issue/cancel actions. **Payments:** manual receipt queue with proof, amount, payment method, verifier, duplicate-reference warning, Verify/Reject with reason; automated gateway is not required. **Acceptance:** proof alone never flips invoice to paid; one payment cannot settle two invoices unless explicit allocation ledger exists.

### PG-39 — Support: Tickets / Access Grants

**Tickets:** opened by owner or platform, type `Billing / Technical / Account`, priority, assignment and status `Open / In Progress / Resolved / Closed`, message history and attachments with size/security checks. **Access Grants:** an owner grants scoped temporary support access (max 1 hour default), reason required, actions `Approve / Revoke`; platform staff only see permitted metadata and operation paths. **Acceptance:** expired or revoked access stops immediately; all support data access is audited.

### PG-40 — Audit / Platform Settings

**Audit:** filters actor, tenant, action, date and outcome; event records display target type/ID, actor, timestamp, status, request correlation; pagination 50/page; immutable retention policy. **Platform Settings:** plan enrollment defaults, trial/grace policy, incident banner, support contact, notification provider status; changes require explicit confirmation and recorded actor. **Acceptance:** no platform admin can change tenant billing silently, and direct navigation to a nonpermitted setting returns 403.

---
# 7. Feature catalog, workflows, lifecycle, rules, and acceptance

## 7.1 Feature catalog (stable IDs)

A feature is not done until its initiating surface, server operation, permissions, affected destination, empty/error states and acceptance case all work. Unless a row says otherwise, all items are **MVP / REQUIRED**.

| Feature ID | Feature | Owning role / entry | Preconditions & input → output | Failure/side effect & key acceptance | Owning phase |
|---|---|---|---|---|---|
| F01 | Staff identity/session/roles | Owner/Manager invites; staff signs in | Verified membership; credentials/invite → scoped session | Revoke on disable; cross-tenant denied; AT-001 | P01–02 |
| F02 | Restaurant onboarding/configuration | Owner → wizard/settings | Identity + unique slug + locale → tenant/location | Resume wizard; no orphan tenant; AT-002 | P02 |
| F03 | Menu/catalog & modifiers | Manager/Owner → Menu | Valid categories, item, price, options → published catalog | Reject invalid groups and stale prices; preserve snapshots; AT-003 | P03 |
| F04 | Tables/sections/visits | Manager/Waiter → Tables | Active table, no active visit → seating session | Conflict returns existing visit; archive blocked; AT-004 | P04 |
| F05 | Table QR creation | Manager → QR Codes | Active table → printable public QR identifier | Regeneration invalidates old QR; never grants visit alone; AT-005 | P07 |
| F06 | Guest verification/cart/order | Guest → QR/Menu/Cart | Active visit, valid PIN, available items → guest order | Rate-limit PIN, guest scope, idempotent submit; AT-006 | P07 |
| F07 | Waiter order entry/rounds | Waiter → Table/New Order | Assigned open visit + valid items → order round | Submit requires ACK; retry safe; add rounds; AT-007 | P05 |
| F08 | Kitchen tickets/status | Kitchen → Live/Preparing/Ready | Approved order → ticket, prep → ready | One ticket per accepted round; realtime fallback; AT-008 | P05–06 |
| F09 | Assistance/bill requests/alerts | Guest/Waiter → Assistance/Home | Open visit + request type → waiter queue | Throttling, acknowledge/resolve; AT-009 | P08 |
| F10 | Order approval/changes/voids | Waiter/Manager → Live/Order Detail | Pending guest order or changed transmitted item → decision | Approvals audited; invalid prep changes blocked; AT-010 | P07–08/P10 |
| F11 | Checks/payments/receipts/split | Cashier → Checks | Valid accepted items and charge policy → settled check and receipt | No overpayment/duplicate/refund overrun; AT-011 | P09–10 |
| F12 | Restaurant financial approvals/audit | Owner/Manager → Billing | Proposed discount/void/refund + reason → approved ledger event | No destructive mutation, policy snapshots; AT-012 | P10 |
| F13 | Basic reports | Owner/Manager → Reports | Tenant-authorized date range → reconciled metrics | Empty/partial marked; export permissions; AT-013 | P11 |
| F14 | Subscriptions/entitlements/invoices | Owner/Platform → Subscription | Active plan and payment evidence → plan state | Overdue/grace behavior explicit; no phantom gateway; AT-014 | P12 |
| F15 | Restaurant policy, locale, security | Owner/Manager → Settings | Scoped validated settings → versioned policy | Only new check uses new charges; audit changes; AT-015 | P02/P07/P09 |
| F16 | Platform tenant/support oversight | Platform Admin → Platform | Platform membership, approval, support grant → bounded action | No routine tenant order browse; AT-016 | P02/P12 |
| F17 | Inventory/recipes/multi-branch | Owner → future modules | Post-MVP only | No active nav in MVP; AT-017 is defer check | NEXT RELEASE |

## 7.2 End-to-end journey registry

| Journey ID | Role + goal → entry → action → server operation → destination → other-role visibility → recovery |
|---|---|
| J-01 First restaurant | Owner → Signup → verified credentials, restaurant/location wizard → atomic tenant creation + owner membership → Overview setup checklist → invited staff later → resume if interrupted, no duplicate tenant. |
| J-02 Invite waiter | Manager → Staff/Invitations → role/email → one-time invite and membership acceptance → waiter Home → active table assignments visible → revoked/expired link yields re-invite CTA. |
| J-03 Publish menu | Manager → Menu/Categories and Items → category, food item, modifier constraints → validated publish → Guest/Waiter Menu reflects availability → invalid group form explains field and retains draft. |
| J-04 Seat a table | Waiter → Tables/Available → Enter party size/open visit → one active visit + rotating PIN → Table Details + guest QR gate becomes accessible → concurrent open returns existing visit, never duplicates. |
| J-05 Waiter order | Waiter → Table/New Order → select items/options and submit → idempotent order commit + kitchen ticket → Kitchen Live and Waiter Orders → network timeout queries submission status before retry. |
| J-06 Kitchen fulfill | Kitchen → Live → Start Preparing → Ready → signal waiter → Waiter Ready + table status; waiter serves → Guest/Waiter status Served → reconnect resync preserves correct state. |
| J-07 Guest order approval | Guest → QR+PIN → menu/cart/submit → pending order committed → waiter/manager approval queue, then kitchen upon approval → guest tracking shows outcome → denied approval gives clear message, cart may be rebuilt from published items. |
| J-08 Guest direct mode | Owner enables direct mode → guest PIN verified → submit → server immediately approves and creates kitchen ticket → guest sees Accepted → rate limit and visit closure invalidate token. |
| J-09 Assistance | Guest → Assistance/Call Waiter → service request → waiter Home notification → acknowledge → resolved → guest sees resolved; duplicate calls throttled. |
| J-10 Additional order | Waiter/Guest → existing visit → order more → second immutable order round → kitchen new ticket and check totals extend → cashier sees updated version; if payment has started, cashier policy gates new charged rounds with explicit alert. |
| J-11 Pay and close | Guest requests bill → waiter/cashier sees request → cashier Check → optional split, record payment(s) → zero balance + receipt → visit close, waiter marks table cleaning/available → failed bank/manual verification does not count as tender. |
| J-12 Correct/refund | Cashier → Check/Item adjustment or Refunds → request with reason → manager approval → compensating ledger entry/ticket delta where appropriate → customer due and reports update → rejected request remains visible/audited. |
| J-13 Tenant suspension | Platform Admin → Tenant Detail → suspend with reason → entitlement transition → existing sessions can be settled under grace/safety policy; creation of new visits blocked after grace → platform/owner notified → restore retains all records. |
| J-14 Recovery | Any role → service/network error → stable shell, offline banner, Retry/back, unchanged submitted action state → reconnect via same idempotency key/session → correct screen reflects confirmed server state; never show a fabricated successful payment/order. |

## 7.3 State machines (legal transitions and ownership)

**Restaurant tenant:** `DRAFT → TRIAL → ACTIVE → PAST_DUE → SUSPENDED → ACTIVE` and `ACTIVE/SUSPENDED → CLOSED`. A `PAST_DUE` state has configurable grace; terminal `CLOSED` is an archived business state, not physical destruction. Only platform billing controls paid status; owner can request cancellation. Suspension never deletes financial history.

**Physical table:** `AVAILABLE → OCCUPIED → PAYMENT_REQUESTED → CLEANING → AVAILABLE`; `OCCUPIED ↔ PAYMENT_REQUESTED` is allowed while bill is only requested; `DISABLED` only from `AVAILABLE`, and back through manager enable. Table status is derived partly from visit state; no manual transition that contradicts an active visit.

**Table visit:** `OPEN → BILL_REQUESTED → SETTLING → CLOSED`; `BILL_REQUESTED → OPEN` when service resumes before cashier locks; `OPEN → CANCELLED` only if no approved chargeable items or through manager-managed void flow. One active (not CLOSED/CANCELLED) visit per table. When closed, old tokens become invalid for ordering.

**Order round:** `DRAFT` is local/client-only until submitted. Server orders use `AWAITING_APPROVAL → ACCEPTED → IN_PREPARATION → READY → SERVED`, or `AWAITING_APPROVAL → REJECTED`; waiter-origin order begins `ACCEPTED`. Partial line completion is tracked per item; aggregate order status is computed. Authorized cancellation/void is a separate adjustment state `CANCEL_REQUESTED → APPROVED_VOID / REJECTED_VOID`, not a destructive overwrite.

**Kitchen ticket:** `NEW → PREPARING → READY → PICKED_UP`; ticket status may aggregate line statuses, and `PICKED_UP` ≠ `SERVED`. Exceptional invalidation attaches a void/replacement event, not a hard delete. Kitchen cannot start before approval.

**Service request:** `PENDING → ACKNOWLEDGED → RESOLVED` or `PENDING/ACKNOWLEDGED → CANCELLED`; permission and reason recorded. Request visibility remains within same visit.

**Check:** `OPEN → PAYMENT_REQUESTED → PARTIALLY_PAID → PAID → CLOSED`; `PAYMENT_REQUESTED → OPEN` if request cleared; manual adjustment can require return to OPEN with version increment; no automatic close before all chargeable items finalized. **Payment:** `PENDING_VERIFICATION → POSTED` (manual external transfer) or `REJECTED`; cash transaction posts immediately when cashier confirms receipt; reversal creates `REVERSAL_POSTED` referencing original, never edits it away.

**Refund:** `REQUESTED → APPROVED → COMPLETED` or `REQUESTED → REJECTED`, with optional `APPROVED → FAILED_RETRYABLE`; refund amounts and references remain immutable. **SaaS invoice:** `DRAFT → ISSUED → PAID` or `ISSUED → OVERDUE → PAID`, `DRAFT/ISSUED → VOIDED` with authority and reason. No paid→unpaid silent change.

## 7.4 Business rules (numbered; authoritative)

| Rule | Definition |
|---|---|
| BR-001 | Every tenant-owned operational row carries `tenant_id`; branch records also carry `location_id`. Server resolves scope from membership/token, not an untrusted client input alone. |
| BR-002 | Only one active visit can exist per table. Database partial uniqueness or equivalent transaction locking enforces this under concurrency. |
| BR-003 | Waiter can open a visit only on authorized assigned/current-location tables; manager may reassign with audit. |
| BR-004 | Printed static QR identifies the table but is insufficient for ordering; current visit PIN verification is required. PIN rotates on each new visit and is rate limited. |
| BR-005 | Guest token is scoped to one visit and expires/invalidates when visit closes; it never exposes staff identity/contact or another visit. |
| BR-006 | Guest order policy defaults to `WAITER_APPROVAL`; `DIRECT_TO_KITCHEN` requires owner/manager confirmation and an active verified visit. |
| BR-007 | All line prices, taxes, services and discounts are computed on the server from authoritative item/charge configuration at commit; prices and relevant policy snapshots are then immutable. |
| BR-008 | Item modifier groups enforce configured minimum/maximum; unavailable, unpublished or archived option cannot appear in a new accepted order. |
| BR-009 | A submitted round is immutable as an event; corrections are separate authorized adjustment/void records with references and reasons. |
| BR-010 | Each create order/payment/refund API supports client idempotency keys and returns previously committed result on safe duplicate retry within retention window. |
| BR-011 | Kitchen ticket creation is transactionally linked to approved order; event delivery may repeat but clients deduplicate by event and ticket ID. |
| BR-012 | Kitchen `NEW → PREPARING → READY` transitions use server versioning; illegal jumps fail with conflict and resync action. |
| BR-013 | Guest/waiter additional rounds attach to current visit, not a second bill; if check is payment-locked, allow only after explicit cashier unlock/manager policy. |
| BR-014 | Changing published menu item prices never retroactively changes accepted order snapshots; guest carts must reconfirm new prices. |
| BR-015 | Archived categories/items/tables cannot be physically deleted while referenced by order/financial history. Hide them from creation surfaces but retain readable snapshots. |
| BR-016 | Payment posting and check balance update occur in a serializable transaction or equivalent ledger lock; concurrent cashier operations cannot create negative due. |
| BR-017 | Equal split must sum exactly to check amount; assign rounding residue deterministically and show it. Item split must allocate each chargeable unit exactly once. |
| BR-018 | Discounts, voids, and refunds have owner/manager approval controls and mandatory reason; no override using only client-side UI hiding. |
| BR-019 | Cash tender over due is allowed only as amount received with computed **change**, not as excess revenue. Noncash tender cannot exceed due. |
| BR-020 | Manual external transfer is not considered verified until cashier confirms physical proof; automated gateway success is not implied. |
| BR-021 | A visit cannot close while amount due > 0, charge-affecting approval is pending, or required kitchen items are unresolved, except audited manager emergency settlement workflow. |
| BR-022 | Staff deactivation/revocation prevents new API operations and unsubscribes/restricts real-time streams immediately after token invalidation. |
| BR-023 | Financial reports reconcile posted payment, reversals, discounts and refunds; net collected revenue is not confused with submitted order amount. |
| BR-024 | Tenant subscription suspension uses defined grace; existing open visits must be safely completed even when new visit creation is blocked after grace. |
| BR-025 | Plan entitlements (locations/table/staff limits) are separate from permissions. Overlimit actions fail with upgrade guidance; no cross-tenant leakage. |
| BR-026 | Default timezone is restaurant-configured, with UTC storage and business-day reporting cutoffs; user-specific formatting never changes accounting boundaries. |
| BR-027 | No physical deletion of financial ledger, ticket history, or security audit from user-facing features; retention/purge is exceptional and legally reviewed. |
| BR-028 | Requests and notifications are deduplicated/rate limited; waiter service actions include ACK/resolution and visit ownership checks. |
| BR-029 | All customer and staff-facing errors show an actionable recovery path without exposing implementation stack traces or private business data. |
| BR-030 | No unimplemented feature may have a functioning-looking navigation link, primary action, or paid entitlement promise in a release. |
| BR-031 | Guest notes are not trusted instructions; limit length and sanitize display for web/ticket/receipt, and never execute HTML/Markdown embedded by customers. |
| BR-032 | The latest browser/client locale controls presentation only; access policy, money math, table linking and server timestamps remain authoritative. |
| BR-033 | A restaurant owner cannot disable the last active owner membership without controlled ownership transfer. |
| BR-034 | Restaurant managers cannot edit platform subscription prices, plan entitlements or access grants outside their delegated tenant scope. |
| BR-035 | Every money-affecting mutation records actor, reason when relevant, original/changed amounts, check version, and timestamp; no silent overwrite. |

## 7.5 Edge-case behavior checklist

- **Two guests submit same table simultaneously:** separate order rounds, independent idempotency keys; both reflected in one active visit/check; cashier receives version-changed notice if viewing an old bill.
- **Waiter and guest both order same meal:** two legitimately separate rounds are accepted; *only identical idempotency-key retries* are deduplicated, not same food content.
- **Item becomes unavailable while guest cart is open:** server returns unavailable items/options and offers revise cart; previously accepted order unchanged.
- **Table is closed during pending guest approval:** pending order must be explicitly rejected/voided before closing; old guest token no longer submits.
- **Network drops after Send:** client queries submission-by-idempotency key; shows `Unknown—checking` rather than `Failed` until reconciliation; no duplicate.
- **Kitchen tablet reconnects:** snapshot + event cursor reconciliation, no ticket lost or duplicated, elapsed timer recomputed from committed timestamp.
- **Waiter leaves app mid-draft:** locally encrypted/scoped draft restored on same signed-in device if visit still active; otherwise discard with explanation.
- **Cashier splits after partial payment:** original split remains locked; manager can explicitly reverse/adjust then create a new allocation, preserving ledger.
- **Tax settings change midday:** active/accepted check policy snapshot stable; newly opened check uses new policy version; preview warns manager.
- **Staff loses access mid-task:** API rejects and returns to sign-in or valid tenant selector without revealing stale protected data.
- **Tenant suspended with active tables:** existing visits can be settled under defined grace/closure permission; onboarding/new visits blocked and owner notified.
- **QR screenshot shared remotely:** short-lived visit PIN and frequent rotation reduce risk; optional waiter approval remains the recommended default; rate limits flag suspicious activity.
- **Refund larger than original:** reject server-side; partial refunds sum to no more than refundable posted amount.

---

# 8. Design system, responsive behavior, accessibility and localization

## 8.1 Visual direction

**Brand concept:** calm, modern hospitality operations. Not a generic neon/gradient dashboard. Use a grounded deep-teal identity, warm off-white surfaces, restrained terracotta emphasis for guest/customer menus, and unmistakable semantic colors for kitchen states. Consumer screens are image-led and spacious; kitchen screens prioritize speed and high contrast; finance/report screens favor data density and precision.

**Representative composition A — Waiter Tables:** 56px mobile header with logo/location and sync state; 44px search/filter line; segmented `All/Mine/Needs Attention` with clear underline; 2-column table cards on normal phones showing bold table number, compact status and time; sticky bottom five-tab bar with 24px outlined icons and text label. The selected tab uses teal tinted pill and bold 12px caption. No full-page Loading text replacing the navigation.

**Representative composition B — Restaurant Menu Items:** 260px desktop sidebar left/RTL right; 72px content header with title, breadcrumb and `Add Item`; 44px contextual subtabs; filter/search row; data table with 56px rows, square 44px thumbnails and status chips; slide-in 480px item edit panel or dedicated page for complex modifiers. On phones, sidebar becomes accessible drawer and rows become full-width cards.

## 8.2 Design tokens (initial proposal)

| Token | Value | Use |
|---|---|---|
| `brand.primary` | `#0F766E` | Primary actions, active nav |
| `brand.primaryHover` | `#115E59` | Hover/pressed |
| `brand.accent` | `#C26D4B` | Warm hospitality highlights, not critical state |
| `surface.app` | `#F7F9F8` | Admin page background |
| `surface.card` | `#FFFFFF` | Elevated content surfaces |
| `surface.guest` | `#FFFBF6` | Guest menu canvas |
| `text.primary` | `#18312E` | Titles and body |
| `text.secondary` | `#5A706C` | Descriptions/metadata |
| `border.default` | `#DDE7E3` | Cards, table lines |
| `state.new` | `#2563EB` | New order, informational |
| `state.preparing` | `#A16207` | Preparing/warning |
| `state.ready` | `#15803D` | Ready/success |
| `state.danger` | `#B91C1C` | Void/refund/delete/error |
| `state.disabled` | `#94A3B8` | Disabled controls |
| `radius.card` / `radius.control` | `16px` / `10px` | Consistent edges |
| `shadow.card` | `0 4px 18px rgba(15,35,31,.06)` | Low-key elevation |
| `space` scale | `4, 8, 12, 16, 24, 32, 48, 64px` | Layout rhythm |
| `touch.minimum` | `44×44px` (48 preferred kitchen) | Finger targets |
| `motion.fast` / `normal` | `120ms` / `200ms` | Intentional feedback; zero when reduced-motion |

**Typography:** Use a font family with well-tested Arabic-script shaping (e.g., Noto Sans Arabic for Dari/Pashto) and Inter/system sans for English where licensed/available; preserve Arabic-script legibility and baseline heights. Scale: display `30/38`, page title `24/32`, section `20/28`, card title `16/24`, body `14/22` (16/26 on guest menus), label `13/20`, metadata `12/18` minimum. Money due amount `24/30` tabular numerals; table number `28/34`. Never shrink a body paragraph to fit long text; wrap at two lines or expand card.

**Common controls:** primary/secondary/destructive buttons with loading spinner replacing label inside fixed-size button; 44px input heights; labels above fields and error below; searchable selects; option chips with clear checkmark; active subtabs 3px underline; consistent status badges include icon/text; confirmation dialog identifies object and consequence; toast for recoverable actions, inline banner for failures affecting completion. Skeleton uses final dimensions; empty state has title + next step; charts always label data period and source.

## 8.3 Responsive transformation matrix

| Context | Desktop ≥1200 | Tablet 768–1199 | Phone <768 |
|---|---|---|---|
| Restaurant admin | 260px persistent sidebar + content grid; optional collapse to 72px icons | 72px rail or drawer, wider cards | Header + accessible menu drawer; stacked forms/cards; sticky contextual action |
| Kitchen | 3–5 ticket columns, wide cards | 2–3 ticket columns | 1 card column, fixed status tabs and large touch controls |
| Cashier | Checks table + 2-pane detail | Single-column detail, compact ledger | Check cards; split/pay in full-screen sheet; no horizontal clipped prices |
| Guest menu | 3–4 item columns, detail modal | 2–3 item columns, detail sheet/modal | 1–2 cards depending width; bottom nav/cart pill; soft keyboard safe-area |
| Waiter app | Native mobile prioritized | Native tablet can use 2-column split | 5-tab native bar; stack details; 16px padding |

**Touch/focus:** 44px target minimum, explicit focused border and error text, no hover-only actions, dialogs trap focus on web and restore focus to opener; multiline text with clear labels; bottom sheet usable above on-screen keyboard. **Motion:** 120–200ms tab/slide/success transitions only when communicating state; no ambient 3D motion or decorative effects in busy kitchen; respects reduced motion.

## 8.4 Localization implementation rules

- Every product string, field validation, toast, receipt label, calendar, status, and notification has Dari (`fa-AF`), Pashto (`ps-AF`), English (`en`) keys. A missing translation falls back to English with monitoring, not raw keys.
- Entire layout mirrors direction for Dari/Pashto, including sidebar position, breadcrumbs, arrows and alignment; **table numbers, prices, time separators, email, URLs, QR codes and technical references** use bidi isolation to avoid reversal.
- Allow user-selectable digit glyph presentation; internally store numeric values as structured numbers, not localized strings. Default AFN display is proposal; menu, receipts, reporting use tenant's currency consistently.
- Store all timestamps as UTC and a canonical restaurant timezone. Business-date reports use restaurant business-day boundaries. Render 12/24h and Gregorian calendar initially, with other local calendar displays after verification; do not mix calendar styles on one check.
- Localized search must normalize Persian/Arabic variants (`ی/ي`, `ک/ك`), whitespace and diacritics without changing stored canonical names; sorting follows locale where available.
- Text field lengths count Unicode grapheme clusters where needed; select fonts supporting both Arabic-script languages, avoid forced letter-spacing, and test mixed-language notes.
- Language choice persists per staff profile or guest browser visit; change direction without resetting current cart or form progress.

## 8.5 Accessibility and error-handling targets

- Meet **WCAG 2.2 AA** as a design/QA target for web surfaces where applicable; meaningful color contrast, labels, screen-reader names and status messages, keyboard operation and visible focus.
- Never communicate kitchen urgency through color alone: include badge text, icon and elapsed time. Notifications are not solely audio.
- Authentication error does not reveal account existence. Sensitive confirmations require clear object identifiers.
- Offline: draft and cached read-only menu/table state may remain, marked stale; **no offline final order, payment, refund or check closure in MVP**. Users get Retry/reconnect and the system checks commit status before repeating writes.
- Date/time and financial summaries use localized, high-contrast tabular formatting and preserve exact minor units; large font and 200% zoom must not clip the primary CTA.

---
# 9. Data model, API contracts, integrations, security, quality

## 9.1 Architecture recommendation

Use a **modular monolith** written in TypeScript, organized by domains `identity`, `tenancy`, `catalog`, `table-service`, `ordering`, `kitchen`, `billing`, `reporting`, `subscriptions`, `notifications`, and `audit`. Avoid premature microservices. A single PostgreSQL transactional source of truth backs the waiter Expo app, guest responsive Next.js app, kitchen/cashier/restaurant Next.js dashboards and platform admin. WebSockets or Server-Sent Events carry low-latency updates; fetch-by-version and periodic polling reconcile after disconnect. A transactional **outbox** ensures accepted orders and kitchen/notification events are not lost if a process restarts after a database commit.

**Proposed repo layout (not existing code):** `apps/mobile-waiter`, `apps/web` (route groups guest/kitchen/cashier/restaurant/platform), `apps/api`, `packages/db`, `packages/contracts`, `packages/i18n`, `packages/ui-web`, `packages/config`, `packages/test-fixtures`. Authorization belongs on API endpoints and query scopes, not only front-end route guards.

## 9.2 Conceptual entities, relationships and constraints

| Entity | Important fields / constraints | Ownership, lifecycle, index |
|---|---|---|
| `users` | id, verified email, name, password/auth IDs, status | Global identity; unique verified email; no restaurant data without membership |
| `tenants` | id, slug unique, display name, state, plan, created_at | SaaS tenant; soft close; index slug/state |
| `locations` | id, tenant_id, name, address, timezone, currency, status | One active per MVP tenant; composite FK to tenant |
| `memberships` | user_id, tenant_id, location_id, role, status | Unique active membership per tuple; indexed user/tenant |
| `invitations` | id, tenant_id, role, email, token_hash, expires, accepted_at | Scoped, single-use, rate-limited, no plaintext secret persistence |
| `role_policy_overrides` | tenant_id, role, permission, limit, version | Owner approval changes, audited |
| `sections` | id, tenant_id, location_id, label, sort_index, archived | Unique label per location; referenced by tables |
| `tables` | id, tenant_id, location_id, section_id, label, seats, state | Unique active label per location; index section/state |
| `table_qr` | table_id, public_code_hash/opaque id, version, revoked_at | One active printable code per table; token separate from visit PIN |
| `visits` | id, table_id, tenant/location, opened_by, assigned_waiter, party_size, state, opened/closed times, version | Partial unique active visit by table; index location/state/time |
| `visit_guest_secrets` | visit_id, PIN hash, rotated_at, attempts, token epoch | TTL and rotation; PIN never stored plaintext |
| `guest_sessions` | id/hash, visit_id, expires, epoch, revoked_at | No account; visit-scoped and short lived |
| `menu_categories` | id, location, localized names, sort, published, archived | Unique active sort/name policy; index location/status |
| `menu_items` | id, category_id, localized names, price_minor, image_key, sku, flags, version | Published/available/archived, index category, search and status |
| `modifier_groups` | id, location, label, min/max, select_type, version | Group-option constraints; index location |
| `modifier_options` | id, group, localized label, delta_minor, active | Preserve old snapshots in order lines |
| `item_modifier_links` | item_id, group_id, sort, required | Join; unique item/group |
| `order_rounds` | id, visit_id, source, submitted_by_staff/guest, state, idempotency_key, created, version | Unique `(tenant_id, actor_scope, idempotency_key)` for retention; indexes visit/time/state |
| `order_lines` | id, round_id, item_id, snapshot_title, unit_price_minor, qty, notes, state, tax class | Immutable financial snapshot plus append-only adjustment references |
| `order_line_options` | line_id, option_id, snapshot_title, price_delta_minor, qty | Item customization snapshots |
| `approvals` | id, order_id/adjustment_id, requested_by, decided_by, reason, status, timestamps | Unique current active decision; audit |
| `kitchen_tickets` | id, round_id, location_id, state, received/prepared/ready timestamps, version | Unique accepted round ticket; index location/status/age |
| `kitchen_ticket_lines` | ticket_id, order_line_id, state, timestamps | Line-level reconciliation; unique linkage |
| `service_requests` | id, visit_id, kind, note, state, actor, timestamps | Dedup index pending by visit/kind; time query |
| `checks` | id, visit_id unique, policy_version/snapshot, status, calculated totals, version | One check/visit, money balances derived from ledger; state index |
| `check_allocations` | check_id, split_id, line_id/unit allocation, share_minor | Sum allocations exactly equal check charges |
| `financial_adjustments` | id, check_id, line_id, type, amount_minor, reason, approved_by, created | Append-only correction and approval; never hard delete |
| `payments` | id, check_id, shift_id, amount_minor, method, ref, state, idempotency_key, posted_at | Unique retry key; check ledger indexes; immutable posted rows |
| `payment_reversals` | id, payment_id, amount_minor, reason, approved_by, posted_at | Cumulative ≤ original posted amount; audit required |
| `refund_requests` | id, original payment, amount, reason, requested/approved/completed actors, status | State machine, no negative refundable balance |
| `cashier_shifts` | id, user/location, open_float, counted_cash, expected, status, time | One open shift per cashier/location; immutable close |
| `receipts` | id, check_id, number, snapshot JSON/PDF key, issued_at, copy_count | Unique number per location/series; retained |
| `subscription_plans` | id, version, name, price_minor, currency, limits, active | Versioned plans and entitlements |
| `tenant_subscriptions` | tenant_id, plan_version, period, state, grace_until | Index state/renewal; history preserved |
| `platform_invoices` | tenant_id, period, amount/currency, invoice number, state | Financial platform ledger separate from restaurant sales |
| `platform_payments` | invoice_id, proof, verified_by, posted_at, state | Verified manual receipts, no assumed gateway |
| `notifications` | recipient, tenant, event_type, entity, delivered/read state, created | Dedup on event/recipient; TTL for read storage |
| `outbox_events` | aggregate/entity, event_id, payload, retries, state | Transactional publish/retry; unique event ID |
| `audit_events` | actor, tenant optional, location optional, action, entity, prior/after fingerprint, reason, trace_id, timestamp | Append-only; indexed tenant/time/action; protected retention |
| `support_tickets` / `access_grants` | tenant, creator, scope, status, expiry, reason | Grant may be revoked immediately; audit every access |

**Data integrity details:** composite foreign keys or equivalent invariants require child `tenant_id` and `location_id` match their referenced parent. Database transactions wrap visit creation, order-approval/ticket creation and payment/close operations. Monetary values use integer minor units with documented currency exponent; no floating point for stored prices. Unique slugs/table labels are checked in DB, not only frontend. Index active queue by `(location_id, status, created_at)` and check by `(location_id, state, updated_at)`. Restaurant day and receipt sequence are location/timezone-aware.

**Privacy:** Guests have pseudonymous browser tokens; no guest contact details required. Staff display names in operational audit; other staff PII minimized. Retention is configurable and lawful; payment/financial record retention requires client jurisdiction review before production.

## 9.3 API capability matrix (illustrative endpoints, not locked implementation paths)

Contract-wide: versioned JSON API; authentication (session or scoped token) and authorization per operation; error shape `{ code, messageKey, fieldErrors?, retryable, correlationId }`; success writes return server-generated ID, authoritative version/status and summary. Clients never submit trusted tenant IDs as proof of ownership. Writes are idempotent when money/order relevant. All reads expose scoped resource versions/ETags where useful.

| Domain | Suggested operation | Authorized principal | Input validation / output | Error codes and rule |
|---|---|---|---|---|
| Identity | `POST /auth/session`, `POST /invites/accept` | Staff | Identity/password or invitation; returns role/tenant memberships | `INVALID_AUTH`, `INVITE_EXPIRED`, `MEMBERSHIP_DISABLED`; BR-022 |
| Tenant | `POST /tenants`, `PATCH /tenant/settings` | Verified owner | Name, slug, locale, location; tenant summary/version | `SLUG_TAKEN`, `FORBIDDEN`, `INVALID_TIMEZONE`; BR-001 |
| Menu | `GET /menu`, `POST/PATCH /menu/items` | Staff read; manager write; guest published only | Filter/category, localized payload, modifier validation | `ITEM_UNAVAILABLE`, `INVALID_MODIFIER`, `VERSION_CONFLICT`; BR-007/008 |
| Tables | `GET /tables`, `POST /tables`, `POST /tables/:id/visits` | Manager create, waiter open | Section/seats, party size, waiter; table/visit with version | `ACTIVE_VISIT_EXISTS`, `TABLE_DISABLED`; BR-002/003 |
| QR | `POST /tables/:id/qr/regenerate`, `POST /guest/verify-pin` | Manager QR; anonymous PIN gate | Opaque QR + six digits; visit-scoped token | `QR_REVOKED`, `PIN_RATE_LIMITED`, `VISIT_CLOSED`; BR-004/005 |
| Orders | `POST /visits/:id/orders` | Authorized waiter or verified guest | Lines qty/options/note, idempotency; accepted/pending order snapshot | `PRICE_CHANGED`, `VISIT_LOCKED`, `RETRY_PENDING`; BR-006–010 |
| Approvals | `POST /orders/:id/approve`, `/reject`, `/adjustments` | Waiter/Manager by policy | version/decision/reason; updated order and event | `ALREADY_DECIDED`, `APPROVAL_REQUIRED`; BR-009/018 |
| Kitchen | `GET /kitchen/tickets`, `POST /tickets/:id/transition` | Kitchen or manager | Expected version, next legal state; ticket + event cursor | `STATE_CONFLICT`, `TICKET_VOIDED`; BR-011/012 |
| Service | `POST /visits/:id/requests`, `POST /requests/:id/ack` | Guest submit; waiter/manager ack | type/note; dedup id/status | `DUPLICATE_PENDING`, `VISIT_CLOSED`; BR-028 |
| Checks | `GET /checks/:id`, `POST /checks/:id/split` | Cashier/Manager | expected version, shares/items; precise due | `SPLIT_NOT_BALANCED`, `PAYMENT_LOCKED`; BR-016/017 |
| Tender | `POST /checks/:id/payments`, `POST /payments/:id/reverse` | Cashier payment; manager approve reversal | method, amount, received/change, idempotency, proof ref; ledger event | `AMOUNT_EXCEEDS_DUE`, `DUPLICATE`, `APPROVAL_REQUIRED`; BR-016/019 |
| Refunds | `POST /refunds`, `POST /refunds/:id/decision`, `/complete` | Cashier request; manager decide | amount/reason, original payment; state event | `EXCEEDS_REFUNDABLE`, `NOT_APPROVED`; BR-018/035 |
| Receipt | `POST /checks/:id/close`, `GET /receipts/:id` | Cashier/Manager | expected version; receipt read/print representation | `OUTSTANDING_BALANCE`, `PENDING_ITEM`; BR-021 |
| Reports | `GET /reports/sales`, `/items`, `/service`, `/exports` | Owner/Manager | date range/timezone/filter; totals/counts/explanations | `RANGE_TOO_LARGE`, `EXPORT_NOT_ALLOWED`; BR-023 |
| Subscription | `GET /subscription`, `POST /upgrade-requests`, `POST /platform/payments/verify` | Owner/Platform | plan, proof, verify decision → new entitlement | `ENTITLEMENT_LIMIT`, `PAYMENT_UNVERIFIED`; BR-024/025 |
| Platform | `GET /platform/tenants`, `POST /platform/tenants/:id/suspend` | Platform admin | status/actor/reason → audited transition | `NOT_PLATFORM_ADMIN`, `INVALID_STATE`; BR-024/034 |
| Realtime | `GET /events?cursor=`, `WS /events` or SSE stream | Tenant-scoped staff or guest visitor | subscription topic with event ID/version; reconnect cursor | `CURSOR_EXPIRED` → full snapshot then resume; BR-011 |

## 9.4 Authentication and session security

- Staff authentication via Better Auth (suggested), verified identity, secure password hashing and login rate limits. MFA for platform admin and owner is a **production requirement** subject to feasible authenticator implementation; do not rely solely on email as MFA when email delivery is unreliable.
- Role checks run server-side on every API operation and event subscription. Multiple-tenant memberships require explicit active context, and all queries verify ownership in DB constraints.
- Guest token is opaque, HTTPS-only cookie/header safe from URL leaks where possible; visit tokens and PIN hashes stored securely. Avoid persistent raw PIN or placing guest session secret in QR print.
- Short staff idle timeout (e.g., 12 hours configurable) and shorter high-privilege platform sessions; tokens invalidated on disable, role change, password reset and tenant suspension. Use secure/same-site cookies, CSRF protection for cookie-based writes, CORS origin allowlist, and content security policy for web.
- All images uploaded are validated by content type, size, safe decoding, and object key tenant path; storage access uses signed URLs and least privilege.
- Payments **never** store credit card PAN/CVV. An integration is scoped as a separate effort requiring provider contract, regional availability, PCI assessment, and tested failure reconciliation.

## 9.5 Integration decisions and fallbacks

| Service | MVP decision | External risk | Fallback / UX |
|---|---|---|---|
| PostgreSQL | Required | Connection outages/backup schedule | No final writes if unavailable; show reconnect, leave local draft |
| Object storage | Required for menu images and receipt artifacts | Vendor account/cost/bucket policy | Placeholder image on fetch error; upload retry; never block text-only item creation |
| Outbound email | Needed for staff invite/reset unless secure manual provisioning approved | SMTP deliverability/credentials in Afghanistan | Retry delivery; owner can revoke/resend; never expose live reset links in logs |
| WebSockets/SSE | Needed for low-latency kitchen/waiter | Proxies and mobile sleep | Poll/reconcile with cursor and stale state badge |
| Cash | Supported recorded tender | Human accounting risk | Cashier receipt/reconciliation and approvals |
| Manual external transfer | Optional configured tender; no gateway claim | Fraud/mis-entered reference | Show `Awaiting verification` until manual confirmation |
| Receipt printer | Browser/system print in MVP | Printer drivers/paper width vary | PDF and print preview; thermal integrations NEXT RELEASE |
| SaaS fee payment | Platform manual invoices/verification in MVP | Provider not selected | Pending proof vs paid states, admin verification |
| SMS, map, delivery, AI | Not in MVP | Cost, legal/provider dependencies | No navigation or implied integration |

## 9.6 Quality and nonfunctional acceptance

| Area | Initial requirement / measurable gate |
|---|---|
| Correctness | Exactly-once **business effect** from duplicate order/payment commands; all financial totals ledger-derived, zero negative outstanding balances. |
| Tenant isolation | Automated cross-tenant route/API/query tests including guessing IDs, event subscription topics, exports and asset URLs; zero leaks. |
| Performance | Under target pilot load (10 concurrent staff clients, 20 open tables, 200 active tickets), online order submitted→kitchen visible p95 ≤3 seconds and normal API reads p95 ≤500ms excluding slow public internet; confirm with actual pilot tests. |
| Resilience | Reconnect/reconcile on websocket/SSE failure; order timeout state is uncertain until queried; no invented offline successful writes. |
| Accessibility | WCAG 2.2 AA design target; keyboard/focus review for dashboards and accessible mobile labels. |
| Device support | Responsive modern Chromium/Firefox/Safari; Expo Android/iOS support set by chosen Expo SDK. Exact OS baseline requires DEC-06. |
| Observability | Correlation IDs, structured redacted logs, error monitoring, slow query dashboard, outbox retry alarms, payment/order anomaly alerts. |
| Backup/recovery | Encrypted automated database backups, daily restore testing in staging, RPO target ≤24h/RTO target ≤4h for initial service (confirm hosting/criticality before contractual promise). |
| Security | Threat model covering QR/PIN replay, leaked guest links, cross-tenant access, replayed money writes, XSS notes, uploads, staff role escalation, support grants. |
| Privacy | Minimal guest collection, consent-free service operations by default, retention/export/deletion policy after local legal review. |
| Data quality | Seed **clearly labeled demo data** only in nonproduction; production starts empty; analytics never count test transactions. |
| Localization | All shipped screens, errors, receipt layouts and notifications covered in 3 languages; RTL regression tests and mixed-direction examples. |

---

# 10. Implementation roadmap — vertical slices with full acceptance

**Important:** these are *product delivery phases*, not statements of completed coding. Navigation/screens from a later phase must stay hidden until that phase passes its full acceptance. Dependencies are deliberate: a simple working live-kitchen receiver ships together with first waiter ordering in P05; P06 enhances the whole kitchen experience. A basic platform bootstrap console exists at P02 so onboarding never requires undocumented manual database edits.

## P01 — Foundation, app shells and identity

**User-visible outcome:** stable language-aware shells, authenticated entry, correct role landing, zero broken tabs. **Roles/pages:** Staff and platform sign-in PG-01, profile shell PG-10, shell skeletons for all 5 interfaces, but expose only login/profile and enabled role home. **Features/rules:** F01 core, BR-001, BR-022, BR-029, BR-030. **Data/API:** identity/user, membership model, authorization guard, role/tenant context, i18n package, UI tokens, basic audit and error format. **UI:** responsive sidebar and mobile bottom-bar components, RTL/LTR, focus states, stable shell during navigation. **Acceptance:** AT-001 login valid/invalid, tenant isolation and role redirects; app shell does not vanish while loading; no disabled fake tabs. **Regression/tests:** unit RBAC and locale tests, web/mobile smoke, keyboard and token expiry. **Not yet available:** restaurant creation/menu/order/billing; hidden from active nav. **Definition of done/demo:** three sample roles sign in and see their proper blank, polished shell with valid logout and 403.

## P02 — Tenant registration, onboarding, staff invitation and initial platform controls

**Outcome:** owner creates a real tenant/location and invites staff. **Roles/pages:** Owner PG-02/PG-27 setup mode, Staff PG-31, Settings Restaurant/Localization/Security PG-35, Platform PG-36 and minimal tenant list/detail PG-37. **Features/rules:** F01/F02/F15 bootstrap/F16 bootstrap, BR-001, BR-022, BR-025, BR-033/034. **Data/API:** tenants, locations, staff membership and invite entities, secure email dispatch/manual documented fallback, platform bootstrap access; entitlement temporary trial. **UI:** four-step wizard and setup checklist, directory/invite subtabs fully functional. **Acceptance:** AT-002 wizard resume, unique slug, invitation accept/revoke/expire, last-owner protection, no foreign tenant access; platform can review tenant created. **Regression/tests:** sign-in/logout, multi-role membership, email failure retry, locale reload. **Not yet:** menu/tables/ordering or production recurring billing, so checklist shows actions as inactive guidance **without clickable fake destinations**. **Done/demo:** owner registers, invited waiter accepts, owner disables access, platform sees tenant.

## P03 — Publishable menu and price-safe catalog

**Outcome:** owners can make a complete meal menu before first order. **Roles/pages:** PG-30 full **Items / Categories / Modifier Groups / Availability**, read-only PG-09 data contract. **Features/rules:** F03, BR-007/008/014/015/031/032. **Data/API:** categories, items, images, modifier groups/options, image storage, publish and stock endpoints. **UI:** list/search/status with New/Edit/Archive, polished field validation and localizations, soft responsive item editor. **Acceptance:** AT-003 required modifier validation, version conflict, duplicate SKU, unpublished hidden, archive retains snapshot after test fixtures; stock flag pushes changes to client queries. **Regression/tests:** i18n/RTL, cross-tenant item access, image fallback, empty/long list pagination. **Not yet:** order submit; waiter catalog can be browsed only in internal preview, no faux cart submit. **Done/demo:** owner creates two categories, five items, priced size group, publishes and toggles one unavailable.

## P04 — Sections, tables and collision-safe visits

**Outcome:** waiters/managers can see actual restaurant seating and open exactly one active visit. **Roles/pages:** PG-29 **Board / Sections & Tables** (QR tab hidden), waiter PG-04/PG-05 table aspects. **Features/rules:** F04, BR-002/003/015. **Data/API:** sections/tables/visits, assignment, active-visit uniqueness, table states. **UI:** responsive table cards, status filters, seating form, location badges, no undefined controls. **Acceptance:** AT-004 duplicate table label, active-visit collision, visit assignment, archive guard; active table remains consistent across two devices. **Regression/tests:** staff membership, menu scope, form defaults and empty board. **Not yet:** full order form, guest QR or payment. **Done/demo:** create sections and 10 tables; waiter opens Table 3; second waiter sees same visit rather than duplicate.

## P05 — Waiter ordering + minimum viable kitchen receiver (first closed loop)

**Outcome:** waiter can submit a full valid order, and kitchen can immediately receive it. **Roles/pages:** PG-03 Home, PG-05 Table Details, PG-06 New Order **Menu/Cart**, PG-07 **Active** and PG-08 item details, PG-09 Menu, PG-28 restaurant **Live/History** basics, PG-11 **New** kitchen queue with `Accept/Start Preparing` action. **Features/rules:** F07 and minimum F08, BR-007–012, BR-030/031. **Data/API:** order rounds/lines snapshots, ticket creation transaction/outbox, idempotency, room/location event stream, status update. **UI:** 5-tab waiter nav *all five active with meaningful More, Tables, Orders, Menu, Home content*, stable shells, item sheets, cart validation and explicit ACK. **Acceptance:** AT-007 submit/retry and modifiers; AT-008 first kitchen ticket; no duplicate after timeout; kitchen can start and mark ticket ready via first functional ticket view even before P06 polish. **Regression/tests:** visit uniqueness, item stock stale, tenant RBAC, live fallback, background/foreground. **Not yet:** guest QR, full kitchen sorting/history/ready board, cashier. **Done/demo:** waiter opens table, submits burgers + custom sides, kitchen sees one ticket with correct details and marks ready.

## P06 — Full kitchen workflow and waiter ready handoff

**Outcome:** kitchen works efficiently through New → Preparing → Ready and waiter serves. **Roles/pages:** PG-11 **New / Awaiting Acceptance** context, PG-12 Preparing, PG-13 Ready, PG-14 History; waiter PG-07 **Ready / Completed**, PG-10 alerts, PG-08 activity. **Features/rules:** F08 complete, F09 alert subset, BR-011/012/028. **Data/API:** ticket line state, event cursor/resync, notification inbox, throttled sound/alerts, kitchen elapsed timings. **UI:** high-contrast grid, 48px controls, clear status chips, stable tabs while refetching. **Acceptance:** AT-008 two kitchen devices converge, timer/status correct, ready alert deep-links, served separate from pickup, reconnection sync. **Regression/tests:** first-order creation, scoped event topics, slow network, disabled membership. **Not yet:** guest self-ordering or billing; kitchen status is still fully usable. **Done/demo:** kitchen operates a rush of 10 tickets and waiter serves ready items without duplicate notifications.

## P07 — Secure QR guest ordering and approval

**Outcome:** diners scan, verify PIN, build cart, submit; waiters approve and kitchen receives accepted orders. **Roles/pages:** PG-15–19 full guest journey; PG-29 QR Codes; PG-28 Live approval panel, PG-05 Requests approval context; PG-35 Ordering Rules. **Features/rules:** F05/F06/F10 approval core/F15 policy, BR-004–014, BR-028/031/032. **Data/API:** opaque QR, rotating visit PIN, guest tokens, rate limits, cart/order API, waiter approval, policy toggles. **UI:** premium responsive customer menu with sticky cart, all localized; no login; approval state clearly differentiated from kitchen Accepted. **Acceptance:** AT-005/006/010 guest approval path, direct policy, stale PIN, code guessing, multi-device orders, stock changed, replay attempt, unaccepted tickets not in kitchen. **Regression/tests:** waiter orders still work, kitchen dedup, tenant isolation, guest session TTL. **Not yet:** direct online guest payments; Bill tab withheld until P09. **Done/demo:** guest scans Table 3 QR and PIN, orders drink, waiter approves, kitchen prepares, guest tracks status.

## P08 — Assistance, late rounds, change requests and service recovery

**Outcome:** active tables handle additional drinks, guest requests and responsible order corrections. **Roles/pages:** PG-20 **Call Waiter / Request Bill**, PG-05 **Requests**, PG-03 Needs Attention, PG-08 change request, PG-28 approval/correction details. **Features/rules:** F09/F10 changes, BR-009/013/018/028/035. **Data/API:** service requests, live notification, requested adjustments, review decisions, revised kitchen event/cancel rules. **UI:** visible request status with reason, safe confirmation, no repeated alert spam. **Acceptance:** AT-009 throttles duplicate call, request resolves in guest UI; AT-010 preparing item requires approval and ticket delta; second round appears in same visit. **Regression/tests:** kitchen ordering/guest approval, unexpected closed visit, double processing, 3 languages. **Not yet:** full final payment and refund handling. **Done/demo:** customer asks for water, waiter acknowledges, adds second order round and manager rejects an unsafe change with reason.

## P09 — Check, payment, receipt and safe table closure

**Outcome:** cashier closes a genuine table visit with reconciled money. **Roles/pages:** PG-21 Bill; PG-22 Open Checks **All / Payment Requested / Partially Paid**; PG-23 **Items / Split / Payments / Activity**, PG-24 Transactions, PG-25 **Current / Previous**, PG-26 Receipts; PG-32 Transactions/Receipts; PG-35 Charges & Receipts. **Features/rules:** F11 single bill/equal or item split, F15 charge policy, BR-016/017/019–021/023/026/035. **Data/API:** check ledger, split allocation, tender, shift, receipt rendering, close transaction, immutable charge snapshot. **UI:** dense but readable financial layout; sticky amount due and split math, pay confirmation; browser print/receipt PDF. **Acceptance:** AT-011 double-cashier race, change calculation, partial payment, equal/item split, exact rounding, close guard, receipt matches ledger. **Regression/tests:** add-order policy while check settling, guest bill request, ready items, timezone/business date. **Not yet:** advanced refund approval interface P10; basic void handling controlled by managers. **Done/demo:** Table 3 bill split 2 ways; two cash payments recorded; receipt printed; table cleaned/reset.

## P10 — Full void/discount/refund approval and corrections

**Outcome:** staff correct mistakes without corrupting kitchen or financial history. **Roles/pages:** PG-32 **Refunds**, PG-23 adjustment/reversal dialogs, PG-28 historical detail and PG-08 order change request. **Features/rules:** F10/F12, BR-009/018/021/027/035. **Data/API:** adjustment and refund state machines, approval/segregation policy, reversal ledger, kitchen correction events. **UI:** confirmation with item/amount/reason and clear status, immutable activity timeline. **Acceptance:** AT-012 cumulative refund cap, manager approval, paid item cannot be silently removed, reversal posts separate event, report snapshots unaffected until proper financial entry. **Regression/tests:** split payments, multiple cashier concurrency, aborted refunds, tenant auth. **Not yet:** automated bank/card refund integration. **Done/demo:** cashier requests partial refund, manager approves, cashier records cash returned, ledger/check/receipt history remains consistent.

## P11 — Reporting, export and operational audit

**Outcome:** owner sees trustworthy revenue and service performance. **Roles/pages:** PG-33 **Sales / Items / Service**, PG-27 Overview expanded; PG-24/32 export where authorized. **Features/rules:** F13, BR-023/026/027. **Data/API:** aggregation queries with business-day boundaries, event timings, CSV export with role guard, report reconciliation service. **UI:** filtered compact KPI, accessible tables, empty/insufficient data states; no invented performance comparisons. **Acceptance:** AT-013 sample ledger matches sales totals, refunds reduce net receipts, staff/tenant permissions enforced, report range limited. **Regression/tests:** prior refunds/rounds, cross-tenant export, AFN formatting, mixed locale. **Not yet:** inventory profit/cost, forecasting or chain roll-ups. **Done/demo:** owner checks last 7 days sales and service time, downloads authorized CSV, verifies one receipt transaction.

## P12 — SaaS subscription lifecycle and complete platform admin

**Outcome:** platform can safely operate many independent restaurants and bill them transparently. **Roles/pages:** PG-34 Plan/Invoices, PG-36–40 full platform **Restaurants All/Pending/Suspended**, **Subscriptions Plans/Invoices/Payments**, **Support Tickets/Access Grants**, **Audit**, Platform Settings. **Features/rules:** F14/F16, BR-001/024/025/027/034. **Data/API:** versioned plans, entitlement enforcement, invoices, manual proof/verification, suspend/grace/restore, support grants, audit. **UI:** admin shell feature-complete, no unrelated restaurant private data in platform UI. **Acceptance:** AT-014 invoice not paid until verified, limit enforcement, suspension blocks *new* visits after grace but existing check can settle; AT-016 support grant expires and logs. **Regression/tests:** every role tenant isolation, guest read scope, payments, kitchen operation during grace. **Not yet:** automated provider billing or chain multi-location. **Done/demo:** platform onboards two restaurants, assigns plans, verifies invoice, suspends/restores one, proves no data mixing.

## P13 — Production hardening, localization certification and nonfunctional gates

**Outcome:** first release passes operational reliability gates on real devices. **Roles/pages:** all PG-01–41; no new navigation needed. **Features/rules:** all MVP; especially BR-001/004/010/016/022/029/030/032. **Data/API:** backups/restore rehearsal, monitoring alerts, outbox recovery, rate limiting, asset security, data retention config, production migration validation. **UI:** cross-language visual QA, accessibility keyboard/screen reader, low-end Android testing, skeleton/empty/offline and stable navigation. **Acceptance:** AT-001–016 plus NFR gate: no P0 defects, no tenant leakage, no lost accepted tickets, audited money arithmetic, load and disaster recovery rehearsal. **Regression/tests:** automated E2E full service journey and permission matrix, expired QR/PIN, slow and intermittent network, re-login after role removal. **Not yet:** post-MVP inventory, delivery, reservations. **Done/demo:** complete pilot rehearsal by every role and tested rollback procedure; release candidate tagged by implementation workflow.

## P14 — Pilot launch, controlled feedback and release approval

**Outcome:** one real restaurant uses the product through a supervised full service day, and operations are ready for second tenant. **Roles/pages:** all released MVP destinations. **Features/rules:** all MVP plus operational onboarding and support checklists. **Data/API:** production deployment, environment/secrets checklist, support runbook, backups, incident process, tenant provisioning and billing policy. **UI:** check actual table placement, receipt print quality, kitchen visibility and language on target devices. **Acceptance:** AT-001–016 on production-like pilot with test records isolated, real tender reconciled, failure drill completed, ownership/role review approved. **Regression/tests:** 3-language smoke, multiple tenants, real device, backup restore in staging. **Not yet:** commercial extras remain hidden. **Done/demo:** simulated rush then supervised production shift yields completed visits, payments and reconciled reports; client signs off.

---

# 11. Traceability and executable tests

## 11.1 Requirement-to-phase traceability

| Requirement ID | Feature/required behavior | Role | Route/tab | Rule / data / API | Owning phase | Acceptance ID | Test journey |
|---|---|---|---|---|---|---|---|
| REQ-001 | Verified staff auth & scope | Staff | PG-01/PG-10 | F01,BR-001/022, membership/auth | P01–02 | AT-001 | J-02/J-14 |
| REQ-002 | Tenant wizard and location | Owner | PG-02/PG-27 | F02, tenants/locations | P02 | AT-002 | J-01 |
| REQ-003 | Staff invitations, role controls | Manager/Owner | PG-31 all subtabs | F01,F02,BR-033, invitations | P02 | AT-002 | J-02 |
| REQ-004 | Items/categories/modifiers/availability | Manager/Owner | PG-30 all 4 subtabs | F03,BR-007/008/014 | P03 | AT-003 | J-03 |
| REQ-005 | Section/table board and unique visit | Waiter/Manager | PG-04/05/29 Board+Manage | F04,BR-002/003 | P04 | AT-004 | J-04 |
| REQ-006 | Waiter add/edit cart, order rounds | Waiter | PG-06/07/08/09 | F07,BR-007/010/013 | P05 | AT-007 | J-05/J-10 |
| REQ-007 | Kitchen new/prepare/ready/history | Kitchen | PG-11–14 | F08,BR-011/012 | P05–06 | AT-008 | J-06 |
| REQ-008 | QR print/rotation/revoke | Owner/Manager | PG-29 QR Codes | F05,BR-004 | P07 | AT-005 | J-07 |
| REQ-009 | Guest PIN/menu/detail/cart/status | Guest | PG-15–19 | F06,BR-005/006/008 | P07 | AT-006 | J-07/J-08 |
| REQ-010 | Guest approval policy/denial | Waiter/Manager | PG-28 Live, PG-35 Ordering | F10,F15,BR-006/018 | P07 | AT-010 | J-07 |
| REQ-011 | Assistance and bill request | Guest/Waiter | PG-20/PG-05 Requests | F09,BR-028 | P08 | AT-009 | J-09 |
| REQ-012 | Change requests/late rounds | Waiter/Manager | PG-08/PG-28 | F10,BR-009/013 | P08/P10 | AT-010 | J-10/J-12 |
| REQ-013 | Check math, split, tender, receipt | Cashier | PG-21–26 all subtabs | F11,BR-016/017/019–021 | P09 | AT-011 | J-11 |
| REQ-014 | Restaurant charge/tax policy | Owner/Manager | PG-35 Charges | F15,BR-007/026 | P09 | AT-015 | J-11 |
| REQ-015 | Adjustment/refund lifecycle | Cashier/Manager | PG-23/PG-32 Refunds | F12,BR-018/035 | P10 | AT-012 | J-12 |
| REQ-016 | Sales/items/service reporting | Owner/Manager | PG-33 three subtabs | F13,BR-023/026 | P11 | AT-013 | J-11/J-12 |
| REQ-017 | SaaS plan/invoices | Owner/Platform | PG-34,PG-38 | F14,BR-024/025 | P12 | AT-014 | J-13 |
| REQ-018 | Platform tenant lifecycle | Platform Admin | PG-36/37/40 | F16,BR-001/034 | P02/P12 | AT-016 | J-13 |
| REQ-019 | Platform support/audit | Platform Admin | PG-39/40 | F16,BR-027/035 | P12 | AT-016 | J-13 |
| REQ-020 | Consistent localization/responsive UI | All | All shipped routes | F15,BR-029/032, i18n tokens | P01 each phase; gate P13 | AT-015 | J-01–J-14 |
| REQ-021 | Errors/realtime/idempotency | All | All orders/finance routes | BR-010/011/016/029 | P05 onward, gate P13 | AT-008/011 | J-05/J-14 |
| REQ-022 | Complete SaaS pilot/backup/runbooks | Owner/Platform | All | NFR controls/retention | P13–14 | AT-016 | J-13/J-14 |

## 11.2 Acceptance ID and test-journey matrix (objective pass/fail)

| Acceptance ID | Automated/manual scenario | Passing result | Test layer |
|---|---|---|---|
| AT-001 | Sign in as Waiter, Cashier, Platform Admin; guess foreign tenant ID; sign out/disable | Correct landing/shell, foreign requests 403/404, revoked tokens fail | Auth API, web/mobile E2E |
| AT-002 | Create restaurant, resume wizard, invite waiter, expire invite, attempt last-owner removal | One tenant, no duplicate, clear recovery, owner protected | E2E + DB constraints |
| AT-003 | Publish priced modifier meal; invalid min/max; stale available flag; change price after order | Invalid rejected, stale cart revalidated, accepted order stays original | Menu API + E2E |
| AT-004 | Two waiters open same table simultaneously and try archive active table | Exactly one active visit; archive denied with reason | Transaction/concurrency |
| AT-005 | Generate QR, regenerate, use old QR, try previous visit PIN and remote brute force | Old/revoked code rejected, PIN rotated, throttling works | Security + guest E2E |
| AT-006 | Guest scan PIN, customize, submit twice with same key; close visit and retry | One order, correct approval, old session denied | Guest + API integration |
| AT-007 | Waiter orders 3 customized dishes then connection drops during submit | One committed round, all modifiers/amounts correct, visible reconciliation | Mobile E2E + idempotency |
| AT-008 | Kitchen sees order, two tablets change same ticket, disconnect and reconnect | One ticket, legal state, no lost event, waiter ready notified once | Realtime integration + E2E |
| AT-009 | Guest requests waiter/bill repeatedly then waiter acknowledges/resolves | Pending request dedup, guest sees states; correct attention badge | Guest/staff E2E |
| AT-010 | Guest order pending approval; reject, approve different order; edit preparing item | Rejected not sent to kitchen, approval ticket once, edit approval required | RBAC + E2E |
| AT-011 | Split 101 minor units into 2 equal parts; two cashiers pay concurrently; partial payment and close | Shares sum 101 minor units (51+50); no overpay; zero due/receipt; close blocked otherwise | Ledger unit + concurrency |
| AT-012 | Refund partial payment then attempt over-refund and unauthorized approval | Refund cap enforced, approved reversal separate, full audit | Financial integration |
| AT-013 | Test orders/payments/refunds across business-date boundary and tenants | Gross/net/tender totals reconcile and export tenant-scoped | Reports SQL + E2E |
| AT-014 | Invoice issued/proof uploaded/unverified; verify; suspend tenant with open check | No premature entitlement, suspend restricts new visit, old settlement safe | Subscription integration |
| AT-015 | Switch all screens between Dari/Pashto/English at 320px, 200% zoom; inspect RTL receipt | Correct mirroring, no clipped actions, inputs/amounts legible and stable | Visual QA, a11y |
| AT-016 | Platform admin support grant expiry; 2 tenant operations; restore backup; simulate outage | No cross-tenant leak, expiry enforced, full audit, recovery within tested target | Security, resilience/pilot |

## 11.3 Every-screen release checklist

For each PG page/subtab and phase, review: **route reachable**; active navigation selected; correct role/tenant/location; first-use empty state; realistic data state; loading skeleton with fixed shell; search/filter/sort/page state where applicable; create/edit/confirm/cancel paths; form validation; API errors and retries; offline or stale feedback; translated labels and RTL; screen reader/focus; back/deep-link; mobile layout; no bogus KPI/dead control. Do not mark phase accepted if any of those required for its released page fail.

---

# 12. Risks, exclusions, decisions, and completeness audit

## 12.1 Risk register

| Risk | Impact | Probability (assessment) | Mitigation / decision owner |
|---|---|---|---|
| Unstable Wi-Fi/mobile internet at restaurant | Lost/late tickets or perceived failure | Medium–High, unverified | Idempotency, ACK/polling, visible reconnect and staged low-network pilot; technical lead + pilot owner |
| QR/order abuse from shared code | Unauthorized orders, kitchen disruption | Medium | Active PIN per visit, rate limit, approval default, revoke sessions, anomaly alert; security lead |
| Local payment provider unavailable | Incorrect promise of online payments | High until verified | MVP cash + explicitly verified manual tender; partner integration only after provider review; product owner |
| Staff training/adoption | Confusion during dinner rush | Medium | Four-role guided onboarding, demo mode in staging, large touch targets, role-specific 1-page SOPs; restaurant manager |
| Multi-tenant data leakage | Severe privacy/commercial harm | High impact | Scoped DB queries, tenant FK, automated adversarial tests, support access grants; security lead |
| Pricing/tax complexity | Incorrect charge/refund/receipt | Medium | Versioned policy, integer minor units, check/ledger tests, jurisdiction review; finance lead |
| Unverified Afghan tax/receipt rules | Operational/regulatory risk | Unknown | Confirm local rules with professional adviser before cash operation; owner/client |
| Device/print compatibility | Service interruption | Medium | Browser print/PDF MVP, select pilot hardware early, test thermal next release; pilot owner |
| SaaS billing disputes | Restaurant churn/support costs | Medium | Transparent manual invoice workflow, grace policy, audit every verification; platform operator |
| Scope expansion to delivery/loyalty early | Delayed core product | High | Explicit post-MVP exclusions and release gate; product owner |

## 12.2 Explicit open decisions and defaults used

| Decision ID | Interim default / consequence | Needs approval before |
|---|---|---|
| DEC-01 | Working brand **DineFlow**; can rename safely before release | Domain/logo/public launch |
| DEC-02 | Afghanistan first, AFN, Dari default, Pashto/English | Tax/receipt/legal copy and hosting localization |
| DEC-03 | Manual SaaS invoices and configurable plan limits, no prices invented | Tenant billing live |
| DEC-04 | Cash and staff-verified manual transfer only; no gateway claim | Pilot money handling |
| DEC-05 | Guest orders require waiter approval by default | Restaurant pilot SOP |
| DEC-06 | Expo Android/iOS waiter app + browser kitchen/cashier; pilot device checklist | Device procurement |
| DEC-07 | UTC storage, restaurant Asia/Kabul time, Gregorian UI initially; localized digit settings | Receipt and legal formats |
| DEC-08 | Pilot load test model 20 tables, 10 clients, 200 open/queued tickets | Performance SLA |
| DEC-09 | One physical location per tenant in MVP; multi-location later | SaaS plan marketing |
| DEC-10 | Guest PIN shown to waiter/current tabletop, rotates per visit | Table signage, staff training |
| DEC-11 | Thermal printer integration deferred; browser print or PDF required | Pilot receipt logistics |
| DEC-12 | Product name, color tokens, typefaces are design proposals, not contracted brand assets | Final visual approval |

## 12.3 Product-completeness audit (specification-level, not software test result)

| Audit question | Design result / evidence | Remaining validation |
|---|---|---|
| Every role reaches only authorized pages? | Role navigation tree, matrix, route registry, server-side permission checks | Automated RBAC and role walkthrough P13 |
| Main tasks complete across roles? | J-01–J-14 and phases P02–P14 cover seat→order→kitchen→serve→pay→close | Pilot task observation |
| Forms, editing and cancels defined? | PG-01–PG-40 forms/actions, BR-009/015/018, acceptance IDs | Exact client discounts/taxes limits |
| Lists and states realistic? | Shared page contract plus each subtab's empty/error/loading filters | Performance with actual menu/table volumes |
| UI navigation stable & well-styled? | Shell persistence and design tokens from P01, no orphan active routes | Device and RTL visual QA |
| Money and permissions safe? | Ledger, idempotency, approval rules, audit, matrix | Security and financial penetration-style testing |
| Customer QR secure enough for default use? | Visit PIN+expiry/rate limit+approval recommended | Real restaurant abuse/UX pilot |
| SaaS platform operates real tenants? | P02 bootstrap + P12 full billing/support/admin | Confirm pricing/provider/legal eligibility |
| MVP has no fake pages/controls? | BR-030 and phase-specific hidden exclusions | Final navigation crawl before release |
| Phase dependencies consistent? | P05 includes kitchen receiver; P07 guest order uses P05/P06; P09 pays P05–08 orders | Integration tests each phase |

**Audit result:** The specification contains a coherent proposed MVP and explicit deferred items. This is **not** evidence the implementation exists or passes testing. DEC-01–DEC-12 are decision items, not secretly approved requirements. The largest remaining product unknowns are pilot restaurant workflows, legal/receipt formatting, commercial subscription terms, payment verification, and actual hardware/network conditions.

---

# 13. Implementation handoff — one-page summary

**Project:** DineFlow (working name), configurable single-location-per-tenant restaurant SaaS initially aimed at Afghanistan. **Confirmed product choices:** both waiter-entered ordering and guest no-install QR ordering; waiters use Expo mobile; owner/manager/cashier/kitchen/platform admins use appropriate web dashboards; separate independent restaurants subscribe.

**MVP role destinations:** Guest `Verify → Menu → Item → Cart → My Order → Assistance → Bill`; Waiter `Home / Tables / Orders / Menu / More` plus table/order detail; Kitchen `Live / Preparing / Ready / History`; Cashier `Open Checks / Transactions / Shift Summary / Receipts`; Restaurant `Overview / Orders / Tables / Menu / Staff / Billing / Reports / Subscription / Settings`; Platform `Overview / Restaurants / Subscriptions / Support / Audit / Settings`. Refer to Sections 5–6 for exact routes, subtabs, actions and permission variations.

**Core workflow contract:** Owner sets up tenant, menu and tables → waiter opens visit and gets rotating PIN → waiter or verified guest submits round → guest order approval as configured → kitchen receives exactly one ticket → kitchen marks ready → waiter serves → guest requests bill → cashier optionally splits and records verified tender → receipt issued → visit closed → table cleaned → reports reconcile. No guest account and no separate guest payment gateway in MVP.

**Stack:** pnpm TypeScript monorepo, Expo, Next.js, modular Node backend, PostgreSQL/Drizzle, Better Auth, object storage, WebSockets/SSE + polling, transactional outbox; use design tokens/i18n/RBAC from P01. **Security gates:** strict tenant/location query scope, QR/PIN visit verification and expiry, idempotent order/payment writes, server-side price calculation, append-only adjustment ledger, approval/audit, session revocation, support grant expiration.

**Release phases:** P01 shells/auth → P02 onboarding/staff/platform bootstrap → P03 menu → P04 tables/visits → P05 waiter + initial kitchen receiver → P06 complete kitchen → P07 guest QR/approval → P08 service/change requests → P09 billing/checks/receipts → P10 refunds/voids → P11 reports → P12 subscriptions/platform → P13 production hardening → P14 pilot. Each phase must demonstrate its user outcome and pass relevant AT cases, regressions and localization checks **before** moving forward.

**External prerequisites:** hosting/database/storage provider, email deliverability, kitchen/waiter hardware, local tax/receipt confirmation, actual restaurant SOP and service-charge policy, subscription pricing/invoicing process, domain/branding, backup and support operations, payment-provider feasibility if requested. **Do not fabricate setup credentials, legal guarantees, provider availability, prices, or completed implementations.**

**Acceptance gates:** AT-001–AT-016; all 3 languages, consistent navigation and layout, all role links meaningful, no tenant leaks, no duplicate ticket/payments, valid financial reconciliation, safe network recovery, restore rehearsal, owner/manager/kitchen/cashier/guest pilot walk-through. **Authority:** this document defines proposed product outcomes pending approval; implementation repository defines current code, and the Software Development Workflow governs execution.

---

## Source/reference appendix

1. User's supplied *Master Product Documentation Prompt — V2*, provided 15 November 2026; this document follows its requested 13-section output structure.
2. Toast, “Restaurant POS System”: https://pos.toasttab.com/restaurant-pos (official product description; accessed 15 November 2026).
3. Square, “QR code ordering for restaurants”: https://squareup.com/us/en/online-ordering/qr-code-ordering (official product description; accessed 15 November 2026).
4. Square, “Restaurant POS Pricing & Plans”: https://squareup.com/us/en/point-of-sale/restaurants/pricing (official product description; accessed 15 November 2026).
5. Lightspeed Restaurant, “Creating and managing floor plans and tables”: https://k-series-support.lightspeedhq.com/hc/en-us/articles/1260804656709-Creating-and-managing-floor-plans-and-tables (official help documentation; accessed 15 November 2026).
6. GloriaFood, official online ordering product site: https://www.gloriafood.com/ (accessed 15 November 2026).

**End of Product Specification v1.0.**
