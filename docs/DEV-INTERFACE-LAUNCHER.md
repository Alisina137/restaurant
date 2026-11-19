# DineFlow — Development Interface Launcher

This is a **developer convenience screen** to explore **six real interfaces** while the project is running locally. It does not invent demonstration order data, bypass authentication, sign in on behalf of a user, circumvent the customer QR/PIN gate, or certify the app as ready for a physical pilot.

## Start on Windows
From `C:\projects\restaurant`, ensure your existing `apps/api/.env`, `apps/web/.env.local`, and `apps/mobile/.env` contain valid local development settings, including a valid PostgreSQL `DATABASE_URL`. Run any outstanding migrations once (`pnpm db:migrate`), then in **separate PowerShell terminals**:

```powershell
cd C:\projects\restaurant
pnpm dev:api
```

```powershell
cd C:\projects\restaurant
pnpm dev:web
```

```powershell
cd C:\projects\restaurant
pnpm dev:mobile
```

Open **http://localhost:3000/dev/interfaces** in the local browser **while `pnpm dev:web` is running**.

### Six tiles and their actual destinations
| Card | Destination | Requirement |
| --- | --- | --- |
| Restaurant Management | `/app/overview` | Restaurant **owner** or **manager** web session |
| Waiter | Expo mobile app; `pnpm dev:mobile` displays QR | Verified restaurant **waiter** mobile session |
| Kitchen | `/kitchen/live` | Staff **kitchen** web session |
| Cashier | `/cashier/checks` | Staff **cashier** web session |
| Customer | Table-specific guest QR link, pasted into the launcher | Existing issued table QR + open assigned table visit + **six-digit PIN** from waiter |
| App Admin | `/platform/overview` | **platform_admin** web session |

All web role buttons open in a new browser tab. **Tabs in the same browser profile share cookies**; test multiple staff roles with separate browser profiles or incognito contexts, and sign in under each assigned account.

### Customer preview (real state, not fake data)
1. Sign in as a restaurant owner/manager and go to **Tables → Manage**. Create a table, assign an active waiter, and publish menu items.
2. Open **Tables → QR**, issue a QR for that table and **Copy** its generated guest URL.
3. Using the waiter Expo app, **seat guests** at the assigned table to create an open visit. The waiter can reveal the six-digit PIN in the table details.
4. Return to **/dev/interfaces**, paste the copied guest URL into **Launch a real guest session**, then select **Open customer entry**.
5. The real customer verification page opens; submit the current PIN to browse the restaurant menu/cart/orders/help/bill.

The entry field accepts a properly shaped `/g/:restaurant/t/:opaque-qr` URL and navigates to a **local relative path only**. It never sends the browser to a pasted third-party origin. All guest sessions and order permissions remain controlled by the existing backend. Do not log, paste or expose customer PINs in issue reports.

### Waiter Expo / physical Android
The launcher **does not embed a mobile app** or spoof an Expo Go screen. Run `pnpm dev:mobile` and scan its Metro QR code in the Expo Go version matching the app's Expo SDK. On a real phone `localhost:4000` refers to the phone, **not your Windows computer**. Set a phone-accessible HTTPS API URL in `apps/mobile/.env` (`EXPO_PUBLIC_API_URL`), start the API tunnel (for example `ngrok http 4000`), configure the required auth origins, and restart Expo. If you use a phone to open the **customer web UI**, also make the **web** site reachable at a phone-accessible address; don't use `localhost:3000` from the phone.

### Service status
- Web **Online** only means you are currently viewing a rendered local web page.
- API + database are checked by a **non-authenticated, read-only** browser GET to `NEXT_PUBLIC_API_URL + /api/health/ready`. A failed probe may mean a stopped API, an unavailable database, a blocked CORS origin, or a wrong URL. No UI state asserts that all endpoints work.
- Expo/Metro is **manual**: the launcher cannot verify if a separate packager or Android device is running.
- The API probe refreshes every 30 seconds and when the page returns to the foreground; a manual recheck is provided. No secrets, passwords, auth cookies or internal backend operations are read by this probe.

### Demo staff
For optional disposable local accounts, configure `DEMO_PASSWORD` (12+ chars) and `DEMO_*_EMAIL` keys in **apps/api/.env**, then run `pnpm seed:dev` once. Never seed production. Credentials are intentionally **not** shown or hardcoded in the launcher. Web and mobile logins use the project's existing role and session enforcement.

## Security: unavailable in production
The exact Next.js route `/dev/interfaces` is server-side guarded with `process.env.NODE_ENV !== "development"` → `notFound()`, marked `force-dynamic`, and includes `noindex, nofollow, noarchive` metadata. It has **no** new API endpoints, writes, privilege grants, logins or database migrations.

GitHub CI runs `pnpm dev:interfaces:verify` for locale, routes, and safe QR parsing tests. After the production web build, CI boots Next.js in **production mode** and requires an actual **HTTP 404** from `/dev/interfaces`. This is not a safe production admin dashboard.

## Remaining hands-on checks
Confirm the responsive launcher's cards at narrow phone/desktop widths, English/Dari/Pashto RTL/LTR, copy-to-clipboard browser permission errors, API unavailable/ready transition, QR input validation, separate staff role logins, Expo Go launch and real guest PIN handoff. Physical devices and complete restaurant pilot still require separate human acceptance.
