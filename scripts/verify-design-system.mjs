import {strict as assert} from "node:assert";
import {readFileSync} from "node:fs";

const root=new URL("../",import.meta.url);
const css=readFileSync(new URL("apps/web/src/app/design-system.css",root),"utf8");
const mobile=readFileSync(new URL("apps/mobile/src/theme.ts",root),"utf8");
const ui=readFileSync(new URL("apps/web/src/components/ui/design-system.tsx",root),"utf8");
const layout=readFileSync(new URL("apps/web/src/app/layout.tsx",root),"utf8");
const colors={
 brand:"--df-brand-700",brandDark:"--df-brand-800",brandSoft:"--df-brand-050",
 ink:"--df-ink",muted:"--df-muted",border:"--df-border",
 surface:"--df-surface",danger:"--df-danger"
};
for(const [key,cssKey] of Object.entries(colors)){
 const value=mobile.match(new RegExp("\\b"+key+":\\s*\"(#[0-9A-Fa-f]{6})\""))?.[1];
 const token=css.match(new RegExp(cssKey+":\\s*(#[0-9A-Fa-f]{6})\\s*;"))?.[1];
 assert.ok(value&&token,"Missing design token "+key);
 assert.equal(value.toLowerCase(),token.toLowerCase(),"Web/mobile mismatch for "+key);
}
const defs=new Set([...css.matchAll(/(--df-[a-z0-9-]+)\s*:/gi)].map(x=>x[1]));
for(const [,name] of css.matchAll(/var\((--df-[a-z0-9-]+)/gi))
 assert.ok(defs.has(name),"Undefined token "+name);
for(const name of ["Surface","SurfaceHeading","StatusBadge","LoadingSkeleton","EmptyState","ActionButton","FormField"])
 assert.ok(ui.includes("export function "+name+"("),"Missing shared component "+name);
assert.match(css,/:focus-visible/);
assert.match(css,/prefers-reduced-motion/);
assert.match(css,/aria-invalid/);
assert.ok(layout.indexOf("globals.css")<layout.indexOf("design-system.css"),"Design overrides must load after legacy CSS");
console.log("Phase 15 web/mobile tokens, components and accessible state contract verified.");
