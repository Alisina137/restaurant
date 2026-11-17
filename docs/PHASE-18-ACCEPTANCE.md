# Phase 18 — Authentication, onboarding and account UX

## Implemented code (November 17, 2026)
- **Server-backed password recovery:** Better Auth's one-time password reset flow, token lifetime of 60 minutes, automatic invalidation of existing sessions after a reset, real email delivery via the configured Resend provider (or explicit local-only console email mode). There is no frontend-generated token and no unverified-password bypass. Token-bearing links are not logged by the phase's backend.
- **New routes:** `/forgot-password` with generic account-safe success wording and `/reset-password` with expired/invalid-token handling, password length/confirmation checks, no token echo or storage, token removal from the browser address bar, and explicit sign-in after success.
- **Login:** Visible recovery link, show/hide password, actionable email-not-verified recovery, expired-session alert, single-flight submit, safe allowlisted invitation-only `next` redirects. Authentication remains server-enforced.
- **Owner registration:** Full-name and email constraints, password strength/confirmation, password visibility, clear verified-email-first success and resend guidance (no misleading early tenant-creation action).
- **Staff invitation:** Server-validated invite metadata, expiry information, role and invited email, safe verified-identity acceptance, guidance and identity-switch action for the wrong logged-in email, verification resend and refresh, signup with matching passwords, and single-flight writes. Tenant membership is still only established by server acceptance.
- **Restaurant setup wizard:** Localized progress steps, better international-language slug suggestion with manual edit, stable server draft saving, detailed localized validation and review, email verification resend cooldown and collision-safe single-flight creation. Backend continues enforcing verified owner and signed-off terms.
- **Account workspace:** Profile name editing using Better Auth and authoritative context refresh, role/restaurant display, persisted language and restaurant switch, current-password change that revokes other sessions, active session/device listing and revocation, sign-out, errors/feedback, and responsive profile/workspace/security tabs.
- **Waiter Expo mobile:** Sign-in password visibility and unverified-email recovery, a native forgot-password screen using Better Auth and a public web reset callback, editable profile name, separate password/session security page, and direct access from the More tab. Mobile web callbacks require a browser-reachable trusted `EXPO_PUBLIC_WEB_URL` (or a same-LAN public web origin derived from the API URL).
- **UI:** Shared auth language hook, password reveal field, progress tracker, web responsive styling, keyboard labels and status feedback across Dari, Pashto and English.
- **No schema changes and no new packages.** Existing auth cookies, ownership, role access, and staff invitation token hashing remain unchanged.

## Required environment
- In `apps/api/.env`, configure `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `TRUSTED_ORIGINS` and `PUBLIC_WEB_URL` to accurate trusted hosts.
- For real verification and password-reset email, use `RESEND_API_KEY` and `MAIL_FROM` with a verified sender. In local development, `DEV_EMAIL_DELIVERY=console` prints **sensitive** verification/reset links in the API terminal; do **not** enable it in production and do not share those links.
- Existing web `NEXT_PUBLIC_API_URL` must point at the API origin. The configured `PUBLIC_WEB_URL` must match the public callback origin.
- To request password recovery on a real waiter phone, set `EXPO_PUBLIC_WEB_URL` in `apps/mobile/.env` to a **phone-accessible, trusted HTTPS web origin** and restart Expo. Local LAN testing can derive port 3000 from an accessible port-4000 API address. Do not use localhost as a callback for an external Android phone. No migration needed.

## Automated verification
1. `pnpm auth:verify` — password recovery, permission gates, redirect allowlist, user-profile operations, session security, 3-language copy and route/style checks.
2. `pnpm ui:verify`, `pnpm nav:verify`, `pnpm interaction:verify` — earlier foundations.
3. `pnpm typecheck`, `pnpm test`, `pnpm build:web` — schema/API/client typing, unit tests and Next.js build.
4. GitHub CI migrations, development seed and the complete existing Phase 1–14 Postgres integration matrix must remain green.

## Manual acceptance still needed
1. Register a new owner and verify their email through a real email provider. Attempt login before verification and confirm denial; after verification, complete onboarding and confirm role/workspace.
2. Trigger reset for a valid and unknown email; confirm the UI does not reveal whether an account exists. Verify token expiry and one-time use, password length and confirmation, and that old sessions are invalidated.
3. Invite a new waiter and existing verified staff member, including incorrect signed-in identity, unverified email, expired/revoked invite, resend, and accepted membership. Confirm privilege/tenant boundaries.
4. Update profile, change password with another active device, revoke one device and all others, change language, switch between assigned restaurants and sign out. Verify sessions can no longer act after revocation.
5. Interrupt onboarding during each step, reload and verify the saved draft; try Dari/Pashto restaurant names and manual ASCII slug edits; validate duplicate name/slug conflicts and required terms.
6. Review at 320/375/768/1024/1280 pixels, keyboard/tab/screen reader, Dari/Pashto RTL and English LTR, low network bandwidth, offline/reconnect, and reduced-motion.
7. Real Android/Expo, receipt printing, cash reconciliation and a supervised restaurant pilot are **not performed by this phase**.

## Production release decision
**Implementation/automated verification is not production acceptance.** The real operator, hardware, restore and three-language visual gates from Phase 14 remain blockers until recorded evidence and independent countersignatures exist. Phase 19 will improve the operational restaurant dashboard.
