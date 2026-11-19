import {strict as assert} from "node:assert";
import {existsSync,readdirSync,readFileSync,statSync} from "node:fs";
import {join,resolve} from "node:path";

const root=resolve(process.cwd(),"apps/web/src");
const nav=readFileSync(join(root,"lib/workspace-navigation.ts"),"utf8");
const shell=readFileSync(join(root,"components/role-shell.tsx"),"utf8");
const css=readFileSync(join(root,"app/workspace-navigation.css"),"utf8");
const layout=readFileSync(join(root,"app/layout.tsx"),"utf8");
const hrefs=[...nav.matchAll(/href:"(\/[^"]+)"/g)].map(match=>match[1]);
assert.ok(hrefs.length>=25,"Navigation must cover each role and admin subtab");
assert.equal(new Set(hrefs).size,hrefs.length,"Duplicate route in navigation");
const areas=new Set(["app","kitchen","cashier","platform"]);
const appRoot=join(root,"app");
function isDirectory(path){return existsSync(path)&&statSync(path).isDirectory();}
function routeExists(href){
 let dirs=[appRoot];
 for(const part of href.slice(1).split("/")){
   dirs=dirs.flatMap(dir=>readdirSync(dir,{withFileTypes:true})
     .filter(entry=>entry.isDirectory()&&(entry.name===part||/^\[[^\]]+\]$/.test(entry.name)))
     .map(entry=>join(dir,entry.name)));
   if(!dirs.length)return false;
 }
 return dirs.some(dir=>existsSync(join(dir,"page.tsx")));
}
for(const href of hrefs){
 assert.ok(areas.has(href.split("/")[1]),"Route outside role scope: "+href);
 assert.ok(routeExists(href),"Broken navigation route: "+href);
}
for(const required of ["/app/overview","/app/menu/items","/app/tables/board",
  "/app/billing/checks","/app/staff/directory","/app/reports","/app/pilot",
  "/cashier/checks","/kitchen/live","/platform/overview"]){
 assert.ok(hrefs.includes(required),"Primary role navigation lost: "+required);
}
for(const code of ["aria-current","aria-expanded","aria-controls","aria-modal",
  "matchMedia","Escape","inert={drawerOpen}","setDrawerOpen(false)","sidebarRef"]){
 assert.ok(shell.includes(code),"Missing accessible/resilient navigation behavior: "+code);
}
assert.ok(css.includes(".workspace-nav-items[hidden]"),"Closed groups must not remain focusable");
assert.ok(css.includes('data-collapsed="true"'),"Desktop rail must support collapsed icons");
assert.ok(css.includes('data-mobile-open="true"'),"Mobile drawer must be stateful");
assert.ok(css.includes('dir="rtl"'),"RTL drawer positioning must be explicit");
assert.ok(css.includes("@media print"),"Navigation must not appear on receipts or printed reports");
assert.ok(layout.indexOf("workspace-navigation.css")>layout.indexOf("design-system.css"),
  "Navigation CSS must override legacy mobile bottom navigation");
// Desktop scroll isolation: independently scroll only workspace content, not the
// sidebar, header, or document. A too-long navigation list remains usable.
const desktop=css.split("@media(min-width:769px){")[1]?.split("@media(max-width:768px){")[0];
assert.ok(desktop,"Desktop navigation layout media rule missing");
assert.match(desktop,/\.workspace-layout\s*\{[^}]*height:100dvh;[^}]*overflow:hidden;/s,
  "Desktop shell must be viewport-bounded and stop document scrolling");
assert.match(desktop,/\.workspace-layout \.sidebar\s*\{[^}]*position:relative;[^}]*height:100%;/s,
  "Desktop sidebar must stay inside the non-scrolling shell");
assert.match(desktop,/\.workspace-layout \.sidebar-nav\.workspace-sidebar-nav\s*\{[^}]*min-height:0;/s,
  "Long navigation must scroll in its own available space");
assert.match(desktop,/\.workspace-layout \.workspace-column\s*\{[^}]*height:100%;[^}]*overflow:hidden;/s,
  "Desktop content column must not scroll the whole page");
assert.match(desktop,/\.workspace-layout \.workspace-main\s*\{[^}]*overflow-y:auto;/s,
  "Main content must be the independent vertical scroll surface");
const mobile=css.split("@media(max-width:768px){")[1]?.split("@media(max-width:390px){")[0];
assert.match(mobile,/position:fixed;/,"Mobile drawer must retain viewport-fixed overlay");
assert.match(css,/\.workspace-layout \.workspace-main\s*\{[^}]*overflow:visible!important;/s,
  "Print styles must unclip full-length receipts and reports");

console.log("Phase 16 navigation contract verified:",hrefs.length,"existing route links and accessibility states.");
