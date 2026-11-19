import assert from "node:assert/strict";
import {readFileSync,existsSync} from "node:fs";
const root=new URL("../",import.meta.url);
const paths={
 page:"apps/web/src/app/dev/interfaces/page.tsx",
 launcher:"apps/web/src/components/developer-interface-launcher.tsx",
 routes:"apps/web/src/lib/dev-interface-launcher.ts",
 copy:"apps/web/src/lib/dev-interface-launcher-copy.ts",
 tests:"apps/web/src/lib/dev-interface-launcher-ci.ts",
 css:"apps/web/src/app/dev-launcher.css",
 layout:"apps/web/src/app/layout.tsx",
 ci:".github/workflows/verify.yml",
 scripts:"package.json",
 doc:"docs/DEV-INTERFACE-LAUNCHER.md"
};
const texts={};
for(const [key,path] of Object.entries(paths)){
 assert.ok(existsSync(new URL(path,root)),path+" missing");
 texts[key]=readFileSync(new URL(path,root),"utf8");
}
const check=(key,items)=>{for(const item of items)
 assert.ok(texts[key].includes(item),paths[key]+" missing: "+item);};
check("page",['process.env.NODE_ENV!=="development"','notFound()',
 'force-dynamic','index:false','DeveloperInterfaceLauncher']);
check("launcher",["interfaceCards.map","/api/health/ready","credentials:\"omit\"",
 "parseGuestEntryRoute","dl-guest","dl-setup","pnpm dev:mobile",
 'role="status"',"guestRoute?","rel=\"noopener noreferrer\"",
 "window.setTimeout","/app/tables/qr","/login"]);
check("routes",["/app/overview","/kitchen/live","/cashier/checks",
 "/platform/overview","kind:\"expo\"","kind:\"guest\"",
 "return match?","url.protocol"]);
check("copy",['"fa-AF"','"ps-AF"','const en=','const ps:',"guestStep3"]);
check("css",[".dl-grid",".dl-hero",".dl-services","@media(max-width:640px)",
 ":focus-visible","prefers-reduced-motion"]);
check("layout",['import "./dev-launcher.css";']);
check("ci",["pnpm dev:interfaces:verify","Assert development interface launcher is absent in production"]);
check("scripts",['"dev:interfaces:verify"']);
console.info("PASS dev launcher source contracts: development-only 404, real role routes, Expo QR instructions and safe guest navigation.");
