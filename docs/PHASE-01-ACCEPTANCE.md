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
GitHub Actions run 43722995802 passed: TypeScript, shared/API unit tests, Next.js production build, PostgreSQL migrations and demo seed, plus live API integration testing (5 roles, isolation, account status, sign-out, language). Browser screenshots, keyboard/responsive walkthrough and Android Expo Go checks have not yet run; Phase 1 remains IMPLEMENTED — VERIFICATION PENDING for device/visual gates.
