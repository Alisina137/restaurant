# Product requirements

## Confirmed direction

- Restaurants create accounts and maintain subscription-based public pages.
- Restaurants publish daily posts and list meals.
- Customers create accounts, browse a shared feed, search/filter, view restaurants and order meals.
- HesabPay is the intended payment provider.
- Restaurants deliver their own orders.
- Launch a mobile-friendly website first; build a mobile app later.
- Deliver one complete phase at a time using Software Development Workflow V3.
- Neon PostgreSQL is the workflow's database default.

## Product thesis

Connect food discovery to ordering: a restaurant's daily post leads directly to an available menu item and an order. Give owners a manageable publishing, menu and order workspace. The value proposition is a hypothesis until restaurant adoption and repeat customer use are measured.

## Working defaults, not confirmed commercial decisions

Temporary name Restaurant Social; Kabul used only as a sample pilot city; one city/area at initial launch; one restaurant per checkout; free customer accounts; one restaurant subscription plan with monthly manual renewal. Subscription amount is unset and must not be fabricated or charged. No platform order commission is assumed. Gateway fees and who absorbs them require agreement. One location per restaurant page initially; data model supports multiple owned pages.

Public browsing does not require login. Login is required for orders, following, likes, saves and reviews. Initial account proposal: email/password using an established authentication library, with verified email for recovery and sensitive actions. Phone number is required for deliveries but is not claimed to be verified without OTP. SMS-based login is a later choice requiring a working regional provider.

Dari and Pashto right-to-left layout support and English message catalogs are design defaults. Production translation review is required. The wireframe uses English for review, not a final decision about the default language.

## Roles

| Role                   | Can do                                                                                                   | Cannot do                                             |
| ---------------------- | -------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| Visitor                | Browse public posts, restaurants and menus                                                               | Order or write social activity                        |
| Customer               | Manage own profile/address/orders; follow, like, save; review delivered orders                           | Read another customer's address or order              |
| Restaurant owner       | Manage owned restaurants, contributors, posts, menu, availability, delivery settings, billing and orders | Modify another restaurant or approve own verification |
| Restaurant contributor | Use only explicitly granted manager, kitchen, content or custom capabilities                             | Change ownership, billing or contributor permissions  |
| Platform admin         | Approve/suspend restaurants; handle reports and audited support actions                                  | Mark payments paid without verified provider evidence |

One user can be both a customer and an owner. Restaurant membership, not a single global role, governs restaurant access.

The application shell adapts to the active context: visitor, personal customer, a selected restaurant membership, or platform admin. A user may belong to multiple restaurant pages and switches workspace without losing the personal customer experience. Navigation improves usability but never replaces server authorization.

## First release requirements

### Feed and discovery

Discover defaults to newest published posts in the selected city; Following shows followed restaurants. Paginate using a stable cursor. No personalized ranking engine initially. Each post has restaurant identity, date, caption, one or more limited-size photos and optional meal links. Customers can like once, save and follow once; actions are reversible. Add reporting and administrative removal. Defer comments, video, stories and direct messages.

Search restaurant and meal names with city, area, cuisine, price and open/delivery filters. Sorting supports newest posts and relevant restaurant results. Empty results offer clearing filters. Do not imply distance sorting without reliable coordinates.

Fresh Today turns a daily post into a limited, orderable offer with a start/end time, special price and real remaining quantity. Stock is enforced atomically at order placement and restored once after pre-fulfillment rejection/cancellation. The offer expires automatically and must never be represented by fabricated scarcity.

### Restaurant page and menu

Cover, logo, description, hours, address, contact, availability, follow action; tabs Posts/Menu/About/Reviews. Show separate open, delivery and pickup availability. Menus have categories and meals with description, image, base price, variants, optional extras and sold-out controls. A meal with variants shows its minimum available price as 'From'. No placeholder ratings; show 'No reviews yet'.

Only approved restaurants with an active entitlement publish new posts or accept new orders. Owners may prepare drafts before activation. Subscription expiry hides posts from discovery and disables new publishing/orders, but preserves the public page with 'Not accepting orders' and keeps existing-order operations and billing access available. Administrative suspension overrides publishing/order permission and routes outstanding orders to support.

An approved restaurant remains available with its current public details while an edited profile revision is drafted, reviewed or rejected. Only approval publishes the new details. Operational controls are separate: open/busy/paused kitchen state, independent delivery and pickup switches, preparation range/note and per-meal sold-out state.

### Delivery and checkout

Restaurants choose service areas from a controlled city/area list, set fees and minimum subtotal per area, operating hours, delivery availability and estimated delivery range. Customer enters area, street/landmark, phone and instructions. A pin is optional, not required to order. Area validation is explicit and does not imply precise geofencing.

Cart contains one restaurant. Adding another restaurant asks whether to replace the cart. Validate selected variants/extras belong to that meal and restaurant. Store integer minor currency units and show AFN consistently. Recompute all totals on the server, including delivery and any explicitly configured charge; never trust browser prices.

Before checkout, recheck hours, entitlement, service area, availability and prices. If anything changes, show the difference and require confirmation. Snapshot the address, item names, options and prices on the order. The receipt remains correct after menu edits.

Initial payment design: customer pays, verified payment queues the order for restaurant acceptance. Declines/timeouts after payment initiate the refund/support workflow, never silently erase the charge. The acceptance timeout is configurable; 10 minutes is a provisional default for operational testing, not a guaranteed service promise. Show customers that payment does not itself mean restaurant acceptance.

Restaurant-owned delivery updates: accepted → preparing → out for delivery → delivered. Pickup uses preparing → ready for pickup → collected. Show timestamps and restaurant contact; no live driver map or platform driver account. Customer cancellation before acceptance cancels an unpaid order or requests refund for a paid order; later cancellation requires restaurant/support handling under the published policy. Never show 'Refunded' before confirmation.

### Subscription and administration

Onboarding: account → draft page → submit for review → approval → subscription checkout → active. One approved plan initially. User initiates renewal; no automatic recurring debit assumed. Duplicate payment notifications cannot extend the subscription twice. Renew from the later of current expiry or payment completion. Record invoiced price and term; later price changes do not rewrite existing receipts.

Plan eligibility is server-enforced; admin may grant a time-limited pilot entitlement with an audit record, distinctly labeled from a paid subscription. Production price and pilot terms must be set before restaurant sales open.

Admin workspace covers pending restaurants, reports, active/expired entitlements, orders needing attention and payment/refund reconciliation. Restaurant owners see basic page views, orders and sales; do not equate gross order value with platform revenue.

## Quality and success measures

Launch checks: no unauthorized cross-restaurant access; no duplicate order from checkout retry; no order marked paid by redirect alone; amount/currency mismatch flagged; no horizontal overflow at 360px; keyboard-operable core journey; explicit failure states; address data absent from public APIs.

Proposed pilot learning targets, not forecasts: onboard 5 willing restaurants, observe 10 customers attempting discovery-to-order, resolve critical usability failures, then collect a first cohort of at least 50 real completed orders before considering expansion. Measure post-to-menu clicks, checkout starts/completions, order acceptance time, cancelled/refunded orders, delivery complaints, 30-day repeat customers and restaurant renewal. Define conversion denominators; use provider-confirmed payments and delivered orders, not button clicks, for sales counts.

Later: mobile clients, richer media, promotions, recommendations, additional cities and multilingual merchant content. Separate roadmap items, not hidden requirements of the first release.
