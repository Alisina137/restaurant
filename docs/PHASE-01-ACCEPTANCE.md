# P01 Acceptance / demo
## Security
1. Request /api/context unauthenticated => 401, not a demo context.
2. POST /api/auth/sign-up/email => 403, even if a visitor bypasses UI.
3. Seed at least owner, waiter and platform roles in a **development database only**.
4. Valid account sign-in => role-specific landing (owner /app/overview, waiter /mobile-access on web and Home on native, platform /platform/overview).
5. Fetch foreign /api/tenants/other-id/access => 404. Platform admin has no blanket tenant read privilege.
6. Revoked membership => /api/context 403 on next request.
7. Sign out, then request /api/context => 401.
8. Wrong password produces visible safe error; network disconnection preserves input and retry.

## Product / UX
1. Web shell never disappears during internal home/account navigation; content region alone shows busy/error.
2. At 320, 768 and 1200px widths, navigation is usable and no enabled item points to an unimplemented feature.
3. Keyboard Tab moves through sign-in inputs, language selection and submit; focus visible.
4. RTL for Dari/Pashto and LTR for English, including email isolation, persist language after reload/sign-out.
5. Expo Go on Android: secure session, Home and More only, profile and sign-out work. Non-waiter is not given waiter data.
6. Health/ready endpoints respond honestly; no raw errors or fake order counts.

## Verification status
Code and automated unit tests have been authored. Full DB integration, browser screenshots and Expo device checks need the project's real database URL, public API tunnel and local install before this phase can be marked complete.
