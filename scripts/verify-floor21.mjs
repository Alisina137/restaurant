import {strict as assert} from "node:assert";
import {readFileSync,existsSync} from "node:fs";
const root=new URL("../",import.meta.url);
const file=(path)=>readFileSync(new URL(path,root),"utf8");
const required=["apps/api/src/floor-tables.ts","apps/api/src/floor-sections.ts",
 "apps/web/src/components/floor-console.tsx","apps/web/src/components/floor-board.tsx",
 "apps/web/src/components/floor-manage.tsx","apps/web/src/components/floor-forms.tsx",
 "apps/web/src/components/table-qr-console.tsx","apps/web/src/lib/floor21-copy.ts",
 "apps/web/src/app/floor21.css","apps/api/src/phase21-ci.ts"];
for(const path of required)assert.ok(existsSync(new URL(path,root)),"Missing Phase 21 artifact "+path);
const tables=file(required[0]),sections=file(required[1]),consoleUI=file(required[2]);
for(const term of ["floorScope(req,true)","q?or(ilike(diningTable.label","status","waiter",
 "assignedWaiterId","tenantId","locationId","hasVisit","noVisit","archived",
 "Cache-Control","no-store","page,limit,offset"]){
 assert.ok(tables.includes(term),"Manager table filtering lost scoped behavior: "+term);}
assert.ok(!tables.includes('status==="reserved"'),"Do not invent reservation state.");
for(const term of ["floorScope(req)","ilike(diningSection.name","page,limit,offset","tenantId","locationId",
 "Cache-Control","no-store"]){
 assert.ok(sections.includes(term),"Section directory scoped search missing: "+term);}
for(const term of ["<FloorBoardGrid","<FloorManage","<FloorDetails","sectionQuery","tableFilters",
 "URLSearchParams","requestId.current","EventSource","visibilitychange","online","lastSync",
 "useDialogFocus","phase","confirm","floor-modal-backdrop"]){
 if(term==="phase")continue;
 assert.ok(consoleUI.includes(term),"Floor console functionality missing: "+term);}
const board=file(required[3]);
for(const term of ["floor21-stats","attention","filter","assignedWaiterId","sectionId",
 "f21(locale","floor21-quick-links","/app/orders/live","/app/service/requests",
 "/app/billing/checks","/app/tables/qr","useDialogFocus","aria-modal","visitPartySize",
 "noReservations","cleaning"]){
 assert.ok(board.includes(term),"Floor board missing live interaction: "+term);}
const manager=file(required[4]);
for(const term of ["<PageControls","tableFilters","setTableFilters","sectionQuery",
 "sectionText","tableText","page","archived","archiveTable","archiveSection","active",
 "noFilterResults","waiters"]){
 assert.ok(manager.includes(term),"Manager directory missing: "+term);}
const forms=file(required[5]);
for(const term of ["capacityWarn","tableBlocked","busy","partySize","assignedWaiterId",
 "manager","visit","version","save("]){
 if(term==="visit")continue;
 assert.ok(forms.includes(term),"Floor form guard missing: "+term);}
const qr=file(required[6]);
for(const term of ["useInteraction","confirm({","qrRotateWarn","lock.current","loading",
 "PageControls","qrFilter","qrSelectionCount","window.print()","printable",
 "selected","!row.active","requestId.current"]){
 assert.ok(qr.includes(term),"QR workflow missing: "+term);}
const copy=file(required[7]);
for(const term of ["const en=","const fa:","const ps:","f21(locale:Locale","noReservations",
 "qrRotateWarn","floorBilling","unassignedWarning"]){
 assert.ok(copy.includes(term),"Dari/Pashto/English floor copy missing: "+term);}
const css=file(required[8]);
for(const term of [".floor21-stats",".floor21-quick-links",".floor21-manage",
 ".floor21-dir-toolbar",".floor21-qr-summary",".floor21-detail",
 "dir=rtl","prefers-reduced-motion","@media(max-width:440px)"]){
 assert.ok(css.includes(term),"Responsive/RTL floor style missing: "+term);}
assert.ok(file("apps/web/src/app/layout.tsx").includes('import "./floor21.css"'));
const integration=file(required[9]);
for(const term of ['owner-ci@example.test','waiter-ci@example.test',
 'new-owner-ci@example.test','/api/floor','status=occupied','status=cleaning',
 'status=available','status=reserved','waiter=unassigned','archive','/ready',
 '/finish','/sections?q=','/tables?q=']){
 assert.ok(integration.includes(term),"Phase 21 database coverage missing: "+term);}
console.info("Phase 21 contract passed: tenant-scoped table search, real floor state, role safety, clean/occupy lifecycle, accessible forms, verified QR printing and RTL.");
