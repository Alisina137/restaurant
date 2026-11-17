import {strict as assert} from "node:assert";
import {readFileSync} from "node:fs";

const root=new URL("../",import.meta.url);
const read=path=>readFileSync(new URL(path,root),"utf8");
const provider=read("apps/web/src/components/ui/interaction-provider.tsx");
const controls=read("apps/web/src/components/ui/interaction-controls.tsx");
const focus=read("apps/web/src/components/ui/use-dialog-focus.ts");
const css=read("apps/web/src/app/interaction-system.css");
const layout=read("apps/web/src/app/layout.tsx");
const translations=read("apps/web/src/lib/interaction-copy.ts");

assert.match(layout,/<InteractionProvider>\{children\}<\/InteractionProvider>/);
assert.ok(layout.indexOf("interaction-system.css")>layout.indexOf("workspace-navigation.css"),"Interaction styles must load last");
for(const name of ["notify","confirm","pending.current","settle(false)","role={dialog.danger","aria-labelledby",
  "aria-describedby","Escape","event.key!==\"Tab\"","document.body.style.overflow","clearTimeout"]){
 assert.ok(provider.includes(name),"Missing dialog/toast lifecycle behavior: "+name);
}
for(const name of ["SearchInput","FilterSelect","PageControls","InlineFeedback"]){
 assert.ok(controls.includes("export function "+name+"("),"Missing shared interaction primitive: "+name);
}
for(const name of ["aria-label","disabled={busy","onPageChange","aria-live","role={tone","aria-busy"]){
 assert.ok(controls.includes(name),"Missing control semantics: "+name);
}
for(const name of ["Escape","focusable","window.addEventListener","document.body.style.overflow"]){
 assert.ok(focus.includes(name),"Missing dialog focus guard: "+name);
}
for(const language of ["en:","\"fa-AF\":","\"ps-AF\":"]){
 assert.ok(translations.includes(language),"Interaction labels missing locale: "+language);
}
for(const selector of [".df-confirm-backdrop",".df-toast-stack",".ds-page-controls",".ds-search-input",
  ".ds-filter-select",".ds-inline-feedback","prefers-reduced-motion","@media print"]){
 assert.ok(css.includes(selector),"Missing responsive/accessibility style: "+selector);
}
const migrated=[
 "apps/web/src/components/menu-console.tsx",
 "apps/web/src/components/floor-console.tsx",
 "apps/web/src/components/kitchen-operations.tsx",
 "apps/web/src/components/staff-console.tsx",
 "apps/web/src/components/finance-check-detail.tsx",
 "apps/web/src/components/finance-adjustments.tsx"
];
for(const path of migrated){
 const c=read(path);
 assert.ok(c.includes("useInteraction"),"Confirmation/notification provider not adopted: "+path);
 assert.ok(!c.includes("window.confirm("),"Native confirmation remains in migrated surface: "+path);
}
for(const path of ["apps/web/src/components/finance-checks.tsx","apps/web/src/components/floor-manage.tsx"]){
 assert.ok(read(path).includes("PageControls"),"Shared pager missing: "+path);
}
assert.match(read("apps/web/src/components/finance-checks.tsx"),/openingCheck.current/);
assert.match(read("apps/web/src/components/finance-check-detail.tsx"),/moneyLock.current/);
assert.match(read("apps/web/src/components/floor-console.tsx"),/mutationLock.current/);
console.log("Phase 17 interaction contract: global provider, 3 languages, reusable controls, five migrated confirmations, single-flight guards.");
