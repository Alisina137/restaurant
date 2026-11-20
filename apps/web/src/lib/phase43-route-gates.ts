/**
 * Phase 43: reject invalid cross-area URL prefixes *before* App Router starts
 * streaming HTML. Calling notFound() in a shared streaming page can render a
 * Next 404 boundary inside a response whose HTTP status is already 200.
 *
 * These are route-existence checks, NOT authentication/authorization: every
 * real business API still requires the current Better Auth user, tenant and
 * role. Never interpret a 200 page shell as permission to read private data.
 */
export function isWrongRoleRoute(pathname:string):boolean{
 const segments=pathname.split("/").filter(Boolean);
 if(segments.length<2)return false;
 const [area,section]=segments;
 if(!["app","cashier","kitchen","platform"].includes(area!))return false;
 // Shared dynamic segments where only one area has an actual UI screen.
 if(["reports","pilot","billing"].includes(section!))return area!=="app";
 if(["ready","preparing","history"].includes(section!))return area!=="kitchen";
 if(["pilots"].includes(section!))return area!=="platform";
 if(["checks","shifts","transactions"].includes(section!))return area!=="cashier";
 // Other paths are controlled by their own route modules; do not accidentally
 // block app/ platform/settings, accounts, kitchen/live, or guest QR pages.
 return false;
}
