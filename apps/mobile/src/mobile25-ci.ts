import assert from "node:assert/strict";
import {addCartLine,issueForLine,MAX_LINES,removeLine,reviewCart,setLineQuantity,setOrderNote,
 toggleOption,validOptions,validateStoredDraft} from "./mobile25-cart";
import {m25} from "./mobile25-copy";
import type {CartLine,MenuData,MenuItem,MenuGroup,OrderDraft} from "./order-types";

const group:MenuGroup={id:"size",version:1,nameFa:"اندازه",nameEn:"Size",namePs:"اندازه",
 selectionMode:"single",minSelections:1,maxSelections:1,options:[
 {id:"small",nameFa:"کوچک",namePs:"کوچنی",nameEn:"Small",deltaMinor:0},
 {id:"large",nameFa:"بزرگ",namePs:"لوی",nameEn:"Large",deltaMinor:2500}]};
const extra:MenuGroup={id:"extras",version:3,nameFa:"افزودنی",namePs:"اضافي",nameEn:"Extras",
 selectionMode:"multiple",minSelections:0,maxSelections:2,options:[
 {id:"sauce",nameFa:"سس",namePs:"ساس",nameEn:"Sauce",deltaMinor:450},
 {id:"cheese",nameFa:"پنیر",namePs:"پنير",nameEn:"Cheese",deltaMinor:800},
 {id:"salad",nameFa:"سالاد",namePs:"سلاد",nameEn:"Salad",deltaMinor:1000}]};
const item:MenuItem={id:"meal",categoryId:"food",nameFa:"غذا",namePs:"خواړه",nameEn:"Meal",
 description:"Meal",allergens:["wheat"],priceMinor:22000,imageId:null,soldOut:false,
 soldOutReason:"",version:1,preparationMinutes:15,groupIds:["size","extras"]};
const menu:MenuData={version:1,currency:"AFN",categories:[{id:"food",nameFa:"غذا",namePs:"خواړه",
 nameEn:"Food",sortOrder:0}],groups:[group,extra],items:[item]};
const selection=[{groupId:"size",version:1,optionIds:["large"]},
 {groupId:"extras",version:3,optionIds:["cheese"]}];
const line:CartLine={itemId:"meal",itemVersion:1,quantity:2,note:"No onions",selections:selection};
const draft:OrderDraft={lines:[line],note:"Table allergic to nuts",
 idempotencyKey:"p25submit_123456789"};
const ok=reviewCart(draft,menu);
assert.equal(ok.valid,true);assert.equal(ok.subtotalMinor,(22000+2500+800)*2);
assert.equal(ok.count,2);assert.deepEqual(ok.issues,[]);
assert.equal(reviewCart({...draft,lines:[]},menu).issues[0]?.code,"empty");
assert.equal(reviewCart({...draft,lines:[{...line,quantity:0}]},menu).valid,false);
assert.equal(reviewCart({...draft,lines:[{...line,quantity:100}]},menu).valid,false);
assert.equal(reviewCart({...draft,note:"x".repeat(501)},menu).issues[0]?.code,"order_note");
assert.equal(reviewCart({...draft,lines:[{...line,note:"x".repeat(251)}]},menu).valid,false);
assert.equal(reviewCart({...draft,idempotencyKey:"short"},menu).valid,false);
assert.equal(reviewCart(draft,{...menu,items:[]}).issues[0]?.code,"item_missing");
assert.equal(reviewCart(draft,{...menu,items:[{...item,version:2}]}).issues[0]?.code,"item_changed");
assert.equal(reviewCart(draft,{...menu,items:[{...item,soldOut:true}]}).issues[0]?.code,"sold_out");
assert.equal(reviewCart(draft,{...menu,groups:[{...group,version:2},extra]}).issues[0]?.code,"modifier_changed");
assert.equal(reviewCart({...draft,lines:[{...line,selections:selection.slice(0,1)}]},menu)
 .issues[0]?.code,"groups_changed","Optional groups still require explicit empty selection");
assert.equal(reviewCart({...draft,lines:[{...line,selections:[
 {...selection[0]!,optionIds:[]},selection[1]!]}]},menu).issues[0]?.code,"options_invalid");
assert.equal(reviewCart({...draft,lines:[{...line,selections:[
 {...selection[0]!,optionIds:["large","large"]},selection[1]!]}]},menu).valid,false);
assert.equal(reviewCart({...draft,lines:[{...line,selections:[
 selection[0]!,{...selection[1]!,optionIds:["salad","sauce","cheese"]}]}]},menu).valid,false);
assert.equal(reviewCart({...draft,lines:[{...line,selections:[
 selection[0]!,{...selection[1]!,optionIds:["deleted"]}]}]},menu).valid,false);
assert.equal(validOptions(group,["large"]),true);assert.equal(validOptions(group,[]),false);
assert.equal(validOptions(extra,[]),true);assert.equal(validOptions(extra,["sauce","cheese"]),true);
assert.equal(validOptions(extra,["sauce","cheese","salad"]),false);
assert.deepEqual(toggleOption(group,["small"],"large"),["large"]);
assert.deepEqual(toggleOption(extra,["sauce","cheese"],"salad"),["sauce","cheese"],
 "Stop exceeding max before submit");
assert.deepEqual(toggleOption(extra,["sauce","cheese"],"cheese"),["sauce"]);
assert.deepEqual(toggleOption(extra,[],"unknown"),[]);
assert.equal(issueForLine(reviewCart(draft,{...menu,items:[]}),0),"item_missing");

const added=addCartLine(draft,line);
assert.equal(added.lines.length,1);assert.equal(added.lines[0]!.quantity,4);
assert.notEqual(added.idempotencyKey,draft.idempotencyKey);
const distinct=addCartLine(draft,{...line,note:"Extra chilli"});
assert.equal(distinct.lines.length,2);
const overQty=addCartLine(draft,{...line,quantity:98});
assert.equal(overQty.lines.length,2,"Never merge past 99");
const tooMany={...draft,lines:Array.from({length:MAX_LINES},(_,i)=>({...line,note:"item"+i}))};
assert.equal(addCartLine(tooMany,{...line,note:"new"}),tooMany,"41st line must be rejected");
assert.equal(addCartLine(draft,{...line,quantity:0}),draft);
const modified=setLineQuantity(draft,0,3);
assert.equal(modified.lines[0]!.quantity,3);
assert.notEqual(modified.idempotencyKey,draft.idempotencyKey);
assert.equal(setLineQuantity(draft,0,2),draft,"No-op preserves submission key");
assert.equal(setLineQuantity(draft,0,100),draft);
assert.equal(removeLine(draft,100),draft);
assert.equal(removeLine(draft,0).lines.length,0);
assert.equal(setOrderNote(draft,draft.note),draft);
assert.equal(setOrderNote(draft,"New instruction").note,"New instruction");
assert.equal(setOrderNote(draft,"x".repeat(501)),draft);
assert.equal(validateStoredDraft(draft),true);
assert.equal(validateStoredDraft({...draft,idempotencyKey:"bad"}),false);
assert.equal(validateStoredDraft({...draft,lines:Array.from({length:41},()=>line)}),false);
assert.equal(validateStoredDraft({...draft,lines:[{...line,quantity:-1}]}),false);
for(const locale of ["en","fa-AF","ps-AF"] as const){
 for(const k of ["title","cart","saveSuccess","restored","refreshError","invalidLines",
  "validationFailed","confirmBody","uncertain","retrySame","markerFailed","tableUnavailable",
  "modifierChanged","sendFailed","draftStorage","menuWarning","safety"] as const){
  assert.ok(m25(locale,k)?.trim().length>3,locale+" "+k);
 }
}
console.info("PASS P25: strict actual-cart preflight, modifier boundaries, immutable idempotency edits, journal payload validation, and localized recovery/cancellation.");
