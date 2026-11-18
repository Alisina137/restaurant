import type {Request} from "express";
import {and,eq,sql} from "drizzle-orm";
import {randomUUID,createHash} from "node:crypto";
import {db} from "./db";
import {scopeFor,fail,field,int,isRecord,version,type MenuScope} from "./menu-helpers";
import {orderRound,orderLine,kitchenTicket,orderActivity,orderOutbox,orderRevision,diningVisit,menuItem,menuCategory,
 menuItemGroup,menuModifierGroup,menuModifierOption} from "./schema";

export type OrderScope=MenuScope;
export async function orderScope(req:Request,allowKitchen=true):Promise<OrderScope>{
 const scope=await scopeFor(req,false);
 if(!["owner","manager","waiter",...(allowKitchen?["kitchen"]:[])].includes(scope.role))
   fail(403,"ACCESS_DENIED","You cannot access restaurant orders.");
 return scope;
}
export function writeScope(scope:OrderScope){
 if(!["owner","manager","waiter"].includes(scope.role))
   fail(403,"ACCESS_DENIED","Only waiters and managers may submit orders.");
}
export function kitchenScope(scope:OrderScope){
 if(!["owner","manager","kitchen"].includes(scope.role))
   fail(403,"ACCESS_DENIED","Kitchen access required.");
}
export function orderId(req:Request){return field(req.params.id,100,"ID",1);}
export type CartOption={groupId:string;version:number;optionIds:string[]};
export type CartLine={itemId:string;itemVersion:number;quantity:number;note:string;selections:CartOption[]};
export type ParsedOrder={idempotencyKey:string;note:string;lines:CartLine[];hash:string};
export function parseOrder(input:Record<string,unknown>):ParsedOrder{
 const idempotencyKey=field(input.idempotencyKey,100,"Idempotency key",12);
 if(!/^[A-Za-z0-9_-]{12,100}$/.test(idempotencyKey))fail(400,"INVALID_KEY","Invalid submission key.");
 const note=field(input.note??"",500,"Order note");
 if(!Array.isArray(input.lines)||!input.lines.length||input.lines.length>40)
   fail(400,"INVALID_CART","An order requires 1–40 lines.");
 const lines:CartLine[]=input.lines.map(raw=>{
   if(!isRecord(raw))fail(400,"INVALID_CART","Invalid order line.");
   const itemId=field(raw.itemId,100,"Meal ID",1),itemVersion=version(raw.itemVersion);
   const quantity=int(raw.quantity,"Quantity",1,99),lineNote=field(raw.note??"",250,"Item note");
   if(!Array.isArray(raw.selections)||raw.selections.length>12)fail(400,"INVALID_MODIFIERS","Invalid modifier selections.");
   const selections:CartOption[]=raw.selections.map(s=>{
     if(!isRecord(s)||!Array.isArray(s.optionIds)||s.optionIds.length>10)
       fail(400,"INVALID_MODIFIERS","Modifier selection must be an option list.");
     const optionIds=s.optionIds.map(v=>field(v,100,"Option ID",1));
     if(new Set(optionIds).size!==optionIds.length)fail(400,"INVALID_MODIFIERS","Repeated option.");
     return {groupId:field(s.groupId,100,"Group ID",1),version:version(s.version),optionIds};
   });
   if(new Set(selections.map(s=>s.groupId)).size!==selections.length)fail(400,"INVALID_MODIFIERS","Duplicate group.");
   return {itemId,itemVersion,quantity,note:lineNote,selections};
 });
 // The hash also detects a changed payload on idempotency-key reuse after a network timeout.
 const hash=createHash("sha256").update(JSON.stringify({note,lines})).digest("hex");
 return {idempotencyKey,note,lines,hash};
}
type Transaction=Parameters<Parameters<typeof db.transaction>[0]>[0];
type LineSnapshot={
 itemId:string;itemVersion:number;quantity:number;note:string;
 itemNameFa:string;itemNamePs:string;itemNameEn:string;allergens:string[];
 basePriceMinor:number;addonsMinor:number;unitPriceMinor:number;lineTotalMinor:number;
 modifierSnapshot:Array<{groupId:string;nameFa:string;namePs:string;nameEn:string;
  options:Array<{id:string;nameFa:string;namePs:string;nameEn:string;deltaMinor:number}>}>;
};
export async function priceLines(tx:Transaction,scope:Pick<OrderScope,"tenantId"|"locationId">,lines:CartLine[]){
 const result:LineSnapshot[]=[];
 let subtotal=0;
 for(const line of lines){
   // PostgreSQL row locks serialize price/stock updates with submission. Different visits
   // can accept concurrently while all commit against authoritative menu data.
   await tx.execute(sql`SELECT id FROM menu_items WHERE id=${line.itemId} AND tenant_id=${scope.tenantId} FOR SHARE`);
   const [item]=await tx.select().from(menuItem).where(and(eq(menuItem.id,line.itemId),
     eq(menuItem.tenantId,scope.tenantId),eq(menuItem.locationId,scope.locationId))).limit(1);
   if(!item||!item.published||item.archivedAt||item.soldOut)
     fail(409,"ITEM_UNAVAILABLE","An item is unpublished, archived or sold out. Update your cart.");
   if(item.version!==line.itemVersion)
     fail(409,"PRICE_CHANGED","Meal details or price changed. Review the latest menu.");
   const [category]=await tx.select().from(menuCategory).where(and(eq(menuCategory.id,item.categoryId),
     eq(menuCategory.tenantId,scope.tenantId),eq(menuCategory.locationId,scope.locationId))).limit(1);
   if(!category||!category.published||category.archivedAt)
     fail(409,"ITEM_UNAVAILABLE","Meal category is unavailable.");
   const attached=await tx.select().from(menuItemGroup).where(eq(menuItemGroup.itemId,item.id));
   if(attached.length!==line.selections.length||
     attached.some(g=>!line.selections.some(s=>s.groupId===g.groupId)))
       fail(409,"MODIFIER_CHANGED","Modifier choices changed. Review the menu.");
   let addons=0;
   const modifierSnapshot:LineSnapshot["modifierSnapshot"]=[];
   for(const selection of line.selections){
     // Locks serialize simultaneous modifier reconfiguration with checkout.
     await tx.execute(sql`SELECT id FROM menu_modifier_groups WHERE id=${selection.groupId} FOR SHARE`);
     const [group]=await tx.select().from(menuModifierGroup).where(and(eq(menuModifierGroup.id,selection.groupId),
       eq(menuModifierGroup.tenantId,scope.tenantId),eq(menuModifierGroup.locationId,scope.locationId))).limit(1);
     if(!group||group.archivedAt||group.version!==selection.version)
       fail(409,"MODIFIER_CHANGED","Modifier group changed. Review the menu.");
     const selected=await tx.select().from(menuModifierOption)
       .where(eq(menuModifierOption.groupId,group.id));
     const choices=selection.optionIds.map(id=>selected.find(o=>o.id===id));
     if(selection.optionIds.length<group.minSelections||selection.optionIds.length>group.maxSelections||
       (group.selectionMode==="single"&&selection.optionIds.length>1)||
       choices.some(o=>!o||!o.active))
       fail(409,"INVALID_MODIFIERS","Choose valid available options for each required group.");
     const snapshots=choices.map(o=>({id:o!.id,nameFa:o!.nameFa,namePs:o!.namePs,
       nameEn:o!.nameEn,deltaMinor:o!.deltaMinor}));
     addons+=snapshots.reduce((sum,o)=>sum+o.deltaMinor,0);
     modifierSnapshot.push({groupId:group.id,nameFa:group.nameFa,namePs:group.namePs,nameEn:group.nameEn,options:snapshots});
   }
   const unit=item.priceMinor+addons,lineTotal=unit*line.quantity;
   if(unit>2_000_000_000||lineTotal>2_000_000_000||subtotal+lineTotal>2_000_000_000)
     fail(400,"AMOUNT_TOO_LARGE","Order amount exceeds the supported limit.");
   subtotal+=lineTotal;
   result.push({itemId:item.id,itemVersion:item.version,quantity:line.quantity,note:line.note,
     itemNameFa:item.nameFa,itemNamePs:item.namePs,itemNameEn:item.nameEn,
     allergens:item.allergens,basePriceMinor:item.priceMinor,
     addonsMinor:addons,unitPriceMinor:unit,lineTotalMinor:lineTotal,modifierSnapshot});
 }
 return {lines:result,subtotal};
}
export async function orderChanged(tx:Transaction,scope:Pick<OrderScope,"tenantId"|"locationId"> & {actorId:string|null},roundId:string,
 eventType:string,payload:Record<string,unknown>){
 // Serialize committed outbox sequences per location BEFORE assigning a sequence.
 // Otherwise two transactions can allocate seq A<B but commit B before A, which
 // would make an 'after=B' replay cursor permanently skip A under heavy load.
 await tx.insert(orderRevision).values({locationId:scope.locationId,tenantId:scope.tenantId})
   .onConflictDoUpdate({target:orderRevision.locationId,
     set:{version:sql`${orderRevision.version} + 1`,changedAt:new Date()}});
 await tx.insert(orderActivity).values({id:randomUUID(),tenantId:scope.tenantId,locationId:scope.locationId,
   roundId,actorId:scope.actorId,action:eventType,details:payload});
 await tx.insert(orderOutbox).values({id:randomUUID(),tenantId:scope.tenantId,locationId:scope.locationId,
   roundId,eventType,payload});
}
export async function readOrder(scope:OrderScope,roundId:string){
 const [round]=await db.select().from(orderRound).where(and(eq(orderRound.id,roundId),
   eq(orderRound.tenantId,scope.tenantId),eq(orderRound.locationId,scope.locationId))).limit(1);
 if(!round)fail(404,"NOT_FOUND","Order not found.");
 if(scope.role==="waiter"){
   const [visit]=await db.select({waiterId:diningVisit.waiterId}).from(diningVisit)
     .where(and(eq(diningVisit.id,round.visitId),eq(diningVisit.tenantId,scope.tenantId))).limit(1);
   if(!visit||visit.waiterId!==scope.actorId)fail(403,"NOT_ASSIGNED","This order belongs to another waiter.");
 }
 const [lines,tickets,activity]=await Promise.all([
   db.select().from(orderLine).where(and(eq(orderLine.roundId,roundId),eq(orderLine.tenantId,scope.tenantId)))
     .orderBy(orderLine.lineIndex),
   db.select().from(kitchenTicket).where(and(eq(kitchenTicket.roundId,roundId),eq(kitchenTicket.tenantId,scope.tenantId))).limit(1),
   db.select().from(orderActivity).where(and(eq(orderActivity.roundId,roundId),eq(orderActivity.tenantId,scope.tenantId)))
     .orderBy(orderActivity.createdAt).limit(40)
 ]);
 return {round,lines,ticket:tickets[0]??null,activity};
}
