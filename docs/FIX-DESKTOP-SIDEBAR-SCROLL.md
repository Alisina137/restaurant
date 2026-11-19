# DineFlow — Fixed desktop sidebar and independent content scrolling

## Changed behavior
For restaurant owner/manager (`/app`), kitchen (`/kitchen`), cashier (`/cashier`) and platform (`/platform`) on desktop (>768px), the DineFlow shell fills the viewport. The sidebar brand and account/sign-out footer stay in place, the navigation list has its own scrollbar **only when the navigation is taller than the available height**, the header remains in place, and **only the main page content scrolls**.

This is a layout-only fix: no API changes, migrations, login behavior changes or dependency installation. RTL and LTR layouts use the same scroll containment; collapsed rail preferences are unchanged.

## Acceptance checks to perform in a browser
1. Open `/app/menu/items` and a long restaurant report on a desktop browser. Scroll using the mouse wheel over the *main content*: the header, sidebar brand, nav and bottom account/sign-out actions remain visible. The main content scroll position changes.
2. In the sidebar itself, expand enough groups to make the nav list taller than the screen and scroll inside that list: only the **nav list** moves, not the brand, footer or main content.
3. Collapse the desktop sidebar to icons and expand it again. Navigate between main and submenu tabs. The rail width, active route and group state continue to work, and main scroll remains independent.
4. Repeat in Dari and Pashto RTL plus English LTR; confirm side placement, active tab marker and content scroll.
5. At widths 769px, 1024px and 1440px (also with a short viewport), verify there are no clipped actions or unusable scrollbars.
6. At 768px and below, confirm the responsive overlay drawer still opens, traps focus, closes via Escape/scrim and locks the document only while open. Mobile page scrolling must remain normal when the drawer is closed.
7. Print/save a receipt or report as PDF. The entire content must print rather than only its visible viewport section; sidebar and header stay hidden on print.

## Automated guard
Run `pnpm nav:verify`; CI also performs typechecks, component verification and a production web build. CSS contract verification is **not** equivalent to rendered cross-browser visual QA. Perform the above checks after pulling.
