# Phase 15 — Premium design system foundation

## Scope delivered
- A shared CSS design-token foundation for color, type scale, spacing, radii, surfaces, shadows, controls, feedback and status semantics. It loads **after** legacy feature styles and retains existing class names.
- React components: Surface / SurfaceHeading, StatusBadge, LoadingSkeleton, EmptyState, ActionButton and FormField. Restaurant overview, cashier checks and login use these primitives; future phases can adopt them without disrupting functional business logic.
- Reduced-motion-safe skeletons, keyboard focus, invalid-input styling, normalized forms, buttons, tables, cards and status indicators, and responsive adjustments for the existing web workspaces.
- Expo mobile theme tokens aligned with the web palette and spacing while preserving existing mobile theme keys.
- A dependency-free design-contract check verifies web/mobile token alignment, tokens used, primitive exports and accessibility selectors, required on CI.
- No changes to backend APIs, migrations, subscription behavior, order state machines or financial calculations.

## Automated acceptance
1. `pnpm ui:verify`: shared design-token contract passes.
2. `pnpm typecheck`, `pnpm test`, `pnpm build:web`: existing type, unit and Next.js build checks.
3. Full PostgreSQL regression suite remains green.

## Manual acceptance still required
- View sign-in, restaurant overview, cashier checks, kitchen, guest menu, platform and receipt surfaces at 320, 375, 768, 1024 and 1280px.
- Inspect on a real Android Expo device; check no new layout clipping and readable labels.
- Verify focus rings, keyboard order, 200% zoom, disabled and loading states, and reduced-motion setting.
- Review Dari and Pashto RTL plus English LTR, mixed-language strings and AFN figures.
- Print QR and financial receipts to confirm unchanged print layouts.
- Fix real device/browser regressions before pilot sign-off. CI alone does **not** certify visual quality.

## Phase boundary
Phase 16 owns sidebar and header navigation redesign. Phases 19–39 own role-specific visual/interaction improvements and Phase 41 owns comprehensive responsive, localization and accessibility validation. Phase 15 provides immediate shared styles and reusable components, not a claim of complete cross-device visual certification.
