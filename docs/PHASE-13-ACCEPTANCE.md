# Phase 13 — Production hardening and nonfunctional gates

## Delivered code (not a certification)
- API request IDs, safe route-category structured timing logs (no URL tokens or request bodies), security/cache headers, explicit reverse-proxy trust setting.
- Production startup refuses missing database, auth, email, persistent media and HTTPS origin configuration. Development remains permissive for Expo tunnels and localhost.
- Two layers of guest protection: bounded per-instance admission throttles plus existing PostgreSQL-backed PIN abuse lockouts; Better Auth retains its separate login throttle. Deploy edge/WAF limits for multiple replicas.
- Durable order-outbox recovery worker claims pending events with PostgreSQL \`FOR UPDATE SKIP LOCKED\`, advances tenant/location in-app revision cursor and acknowledges the reconciled batch atomically. The \`delivered_at\` field indicates revision publication, **not** phone push delivery.
- Platform-only \`GET /api/health/operations\` exposes count and age of pending outbox entries without private order or customer data. \`/api/health/ready\` remains DB readiness.
- Graceful SIGINT/SIGTERM listener drainage with bounded shutdown.
- Web role shell retains its navigation, offers an accessible Skip to content link and localized offline warning; no invented connectivity claims.
- Automated unit tests for rate-limit window/memory cap and production configuration; P13 integration smoke test for headers, CORS, operational scope and queued-event replay.
- Safe \`pnpm --filter @dineflow/api backup:rehearsal\` command runs PostgreSQL custom-format dump, restores to a **separate pre-existing rehearsal database**, compares critical table counts and removes the temporary archive. It requires explicit confirmation and naming; does not run automatically on production.

## Production environment checklist (operator action)
1. Use TLS/HTTPS for web, API, Better Auth base URL and every trusted web origin. Set long random BETTER_AUTH_SECRET, DATABASE_URL, RESEND_API_KEY, MAIL_FROM, durable MEDIA_LOCAL_DIR and backup the media volume separately.
2. Only enable TRUST_PROXY_HOPS when a trusted reverse proxy has stripped and reissued forwarding headers. Use hosted edge/WAF protections for multi-instance public QR and auth traffic. Do not log credentials or guest PINs.
3. Provision PostgreSQL scheduled encrypted backups and media backups; set a tested retention period, least-privilege restore access, and database monitoring/alerts. Confirm provider PITR/RPO/RTO before launch. These **cannot be asserted from CI**.
4. Monitor /api/health/ready and, under a platform-operator session, /api/health/operations. Alert if DB ready is 503, pendingOutbox rises, or the oldest unacknowledged event exceeds 60 seconds. Outbox recovery runs every three seconds when API is alive.
5. For a restore rehearsal: create a completely isolated empty PostgreSQL database with **rehearsal** in its name (and target host explicitly nonproduction for production invocation). Set REHEARSAL_DATABASE_URL. Set REHEARSAL_CONFIRM=RESTORE_NONPRODUCTION_ONLY. Run the rehearsal command with PostgreSQL \`pg_dump\` and \`pg_restore\` client tools installed. The target's data **will be replaced**, never point it at a live database. Store no dump in Git or web directories.
6. For deployment rollback, revert the application to the previously verified image/commit while keeping additive database changes. Never reverse a live financial migration or delete ledgers without a reviewed plan. Test checkout settlement and QR entry after rollback.

## Automated CI gate
- TypeScript: shared, API, web, Expo mobile; unit tests; Next.js production build; all database migrations; seed.
- P01–P12 PostgreSQL integration journeys followed by P13 security/recovery smoke test.
- Browser accessibility, screenshot comparison and device testing **are not performed by this workflow**.
- Real PostgreSQL dump/restore rehearsal requires external client tools and a disposable target, therefore remains **manual** until an isolated environment is available.

## Mandatory manual acceptance (not yet certified)
| Area | Gate |
| --- | --- |
| Restaurant roles | Owner, manager, waiter, kitchen, cashier, guest, platform operator; exercise every role's primary journey and permission-denied states; check cross-tenant links and revoked sessions. |
| Guest QR/PIN | Wrong, expired and rotated QR/PIN, rapid retries, idle session expiration; confirm accepted orders persist exactly once across reconnects. |
| Financials | Actual split payments, cash change, refunds and supervisor authorizations; receipts reconcile against reporting CSV and shift totals. |
| Device QA | Low-end Android Expo Go, 320–1280px browsers, keyboard/screen-reader pass, focus and contrast, offline/retry with slow and disconnected connections. |
| Languages | Dari RTL, Pashto RTL and English LTR; dates, numerals, AFN, all menus, fields, tables, modals and receipt printing. |
| Reliability | Peak-hour load test with two tenants and kitchen SSE reconnect; no lost committed tickets, request timeouts or unbounded lag. |
| Disaster recovery | Run isolated restore rehearsal, media restoration, migration dry-run, previous-image rollback and measured RPO/RTO. |
| Release | No P0/P1 blockers, monitoring and on-call contacts verified, all findings recorded, release candidate tagged only AFTER gates pass. |

**Phase status:** code delivered, automated verification subject to GitHub Actions; real-device, financial cash and disaster recovery certification pending. Phase 14 pilot must not be called ready until these gates pass.
