# Platform bootstrap (P02)
For a **new production** environment with no platform administrators:
1. Configure the API database and normal email verification delivery (RESEND_API_KEY, MAIL_FROM and PUBLIC_WEB_URL).
2. Create a standard account with /register and complete email verification. Do not create a restaurant with that account.
3. In a secure temporary shell on the API machine set ALLOW_PLATFORM_BOOTSTRAP=true and PLATFORM_ADMIN_BOOTSTRAP_EMAIL=<exact verified email>. Run: pnpm --filter @dineflow/api platform:grant <same email>.
4. Unset both bootstrap environment variables immediately and ensure they are not in committed env files or long-lived process config.
5. Sign in at /login and confirm /platform/overview and /platform/restaurants. Platform admins have no implicit tenant order/menu/staff access.
A development-only platform demo user can instead be provisioned by the guarded seed:dev script. Never run seed:dev in production.
