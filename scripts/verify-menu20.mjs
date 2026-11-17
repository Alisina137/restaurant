import {strict as assert} from "node:assert";
import {readFileSync,existsSync} from "node:fs";
const root=new URL("../",import.meta.url);
const read=(p)=>readFileSync(new URL(p,root),"utf8");
const required=[
 "apps/api/src/menu-catalog.ts","apps/api/src/menu-items.ts",
 "apps/web/src/components/menu-console.tsx","apps/web/src/components/menu-health.tsx",
 "apps/web/src/components/menu-editors.tsx","apps/web/src/lib/menu20-copy.ts",
 "apps/web/src/app/menu20.css","apps/api/src/phase20-ci.ts"
];
for(const path of required)assert.ok(existsSync(new URL(path,root)),"Missing phase20 artifact "+path);
const catalog=read(required[0]),items=read(required[1]),consoleUI=read(required[2]),health=read(required[3]);
for(const term of [
 'catalogRouter.get("/summary"','scopeFor(req,true)','eq(menuCategory.tenantId',
 'COUNT(*) FILTER (WHERE published)','archived_at IS NULL','Cache-Control','no-store'
])assert.ok(catalog.includes(term),"Menu readiness source must be real and scoped: "+term);
for(const term of [
 'itemRouter.patch("/:id/publication"','scopeFor(req,true)','version(body.version)',
 'eq(menuItem.tenantId','eq(menuItem.locationId','validateRelations(tx,scope,data)',
 'await changed(tx,scope','VERSION_CONFLICT','archivedAt'
])assert.ok(items.includes(term),"Quick publishing must preserve backend safety: "+term);
for(const term of [
 '/api/menu/summary','<MenuHealth','setItemPublished','setCategoryPublished',
 'itemPublishConfirm','categoryPublishConfirm','/publication','load(true)',
 'requestId.current','setSelected([])','confirm({title:m20','previewError',
 'p20-preview-summary','/api/menu/items/availability/bulk','<PageControls'
])assert.ok(consoleUI.includes(term),"Menu manager feature missing: "+term);
assert.ok(health.includes("summary.items.published")&&health.includes("summary.categories.published"),
 "Readiness must be based on published items AND published category, never mock data.");
const editor=read(required[4]);
for(const term of ["m20(locale","modifierInvalid","selectedCategory?.published","uploading||busy","nameFa"])
 assert.ok(editor.includes(term),"Editor should validate and explain publishing: "+term);
const copy=read(required[5]);
for(const term of ["const en=","const fa:","const ps:","Menu20Key","m20(locale:Locale"])
 assert.ok(copy.includes(term),"Dari/Pashto/English coverage missing: "+term);
const css=read(required[6]);
for(const term of [".p20-health-cards",".p20-publish-button",".p20-readiness",
 ".p20-preview-summary","@media(max-width:470px)","[dir=rtl]","prefers-reduced-motion"])
 assert.ok(css.includes(term),"Missing responsive or RTL behavior: "+term);
assert.ok(read("apps/web/src/app/layout.tsx").includes('import "./menu20.css"'));
const checks=read(required[7]);
for(const term of ["owner-ci@example.test","cashier-ci@example.test","waiter-ci@example.test",
 "new-owner-ci@example.test","VERSION_CONFLICT","/api/menu/catalog","/availability/bulk",
 'version:1','version:2','version:3','scope']){
 assert.ok(checks.includes(term),"Phase20 seeded security test missing: "+term);
}
console.log("Phase 20 menu management contract passed: tenant-scoped readiness, real publication, availability, preview, RTL and verified lifecycle.");
