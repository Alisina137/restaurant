import type {Request} from "express";
import {and,asc,desc,eq,inArray,sql} from "drizzle-orm";
import {randomUUID} from "node:crypto";
import {db} from "./db";
import {scopeFor,fail} from "./menu-helpers";
import {auditEvent,cashierShift,checkActivity,checkPayment,checkReceipt,checkShare,
 checkShareLine,diningCheck,diningTable,diningVisit,financeSetting,guestSubmission,kitchenTicket,
 orderLine,orderRound,restaurantSetting,tenant} from "./schema";
export type Tx=Parameters<Parameters<typeof db.transaction>[0]>[0];
export type FinanceScope={tenantId:string;locationId:string;actorId:string;role:string};
export async function financeScope(req:Request,manage=false):Promise<FinanceScope>{
 const scope=await scopeFor(req);
 if(!["owner","manager","cashier"].includes(scope.role))fail(403,"ACCESS_DENIED","Cashier access required.");
 if(manage&&!["owner","manager"].includes(scope.role))
   fail(403,"ACCESS_DENIED","Restaurant management role required.");
 return scope;
}
export const amountMax=2_000_000_000;
export const roundBps=(base:number,bps:number,denom=10000)=>Math.floor((base*bps+denom/2)/denom);
export type Policy={taxRateBps:number;taxInclusive:boolean;serviceRateBps:number;serviceFixedMinor:number;receiptFooter:string};
export function calculate(subtotal:number,policy:Policy){
 if(!Number.isSafeInteger(subtotal)||subtotal<0||subtotal>amountMax)fail(409,"AMOUNT_INVALID","Invalid accepted order subtotal.");
 const tax=policy.taxInclusive?roundBps(subtotal,policy.taxRateBps,10000+policy.taxRateBps):
   roundBps(subtotal,policy.taxRateBps);
 const service=roundBps(subtotal,policy.serviceRateBps)+(subtotal?policy.serviceFixedMinor:0);
 const total=subtotal+(policy.taxInclusive?0:tax)+service;
 if(total>amountMax)fail(409,"AMOUNT_TOO_LARGE","Check total exceeds financial limit.");
 return {subtotalMinor:subtotal,taxMinor:tax,serviceMinor:service,totalMinor:total};
}
export async function currentPolicy(tx:Tx,scope:FinanceScope){
 await tx.insert(financeSetting).values({tenantId:scope.tenantId}).onConflictDoNothing();
 const [row]=await tx.select().from(financeSetting)
   .where(eq(financeSetting.tenantId,scope.tenantId)).limit(1);
 if(!row)fail(503,"SETTING_UNAVAILABLE","Billing policy unavailable.");
 return {taxRateBps:row.taxRateBps,taxInclusive:row.taxInclusive,
  serviceRateBps:row.serviceRateBps,serviceFixedMinor:row.serviceFixedMinor,
  receiptFooter:row.receiptFooter};
}
export async function writeAudit(tx:Tx,scope:FinanceScope,checkId:string,action:string,details:Record<string,unknown>){
 const id=randomUUID();
 await tx.insert(checkActivity).values({id,tenantId:scope.tenantId,locationId:scope.locationId,
   checkId,actorId:scope.actorId,action,details});
 await tx.insert(auditEvent).values({id:randomUUID(),tenantId:scope.tenantId,userId:scope.actorId,
   action:"finance."+action,details:{checkId,...details}});
}
export async function lockTable(tx:Tx,scope:FinanceScope,tableId:string){
 await tx.execute(sql`SELECT id FROM dining_tables WHERE id=${tableId}
   AND tenant_id=${scope.tenantId} AND location_id=${scope.locationId} FOR UPDATE`);
}
export async function currentOrders(tx:Tx,scope:FinanceScope,visitId:string){
 return tx.select().from(orderRound).where(and(eq(orderRound.visitId,visitId),
   eq(orderRound.tenantId,scope.tenantId),eq(orderRound.locationId,scope.locationId)))
   .orderBy(asc(orderRound.roundNumber));
}
export async function ensureCheck(tx:Tx,scope:FinanceScope,visit:typeof diningVisit.$inferSelect){
 const [found]=await tx.select().from(diningCheck).where(and(eq(diningCheck.visitId,visit.id),
  eq(diningCheck.tenantId,scope.tenantId),eq(diningCheck.locationId,scope.locationId))).limit(1);
 if(found)return found;
 const rounds=await currentOrders(tx,scope,visit.id);
 const subtotal=rounds.reduce((s,x)=>s+x.totalMinor,0);
 const chargePolicy=await currentPolicy(tx,scope);
 const prices=calculate(subtotal,chargePolicy);
 const [created]=await tx.insert(diningCheck).values({id:randomUUID(),tenantId:scope.tenantId,
   locationId:scope.locationId,visitId:visit.id,tableId:visit.tableId,
   number:sql`nextval('dining_check_number_seq')`,chargePolicy,...prices,paidMinor:0}).returning();
 if(!created)fail(503,"CHECK_UNAVAILABLE","Cannot create check.");
 await tx.insert(checkShare).values({id:randomUUID(),checkId:created.id,
   tenantId:scope.tenantId,shareIndex:1,amountMinor:prices.totalMinor,paidMinor:0});
 await writeAudit(tx,scope,created.id,"check.opened",{visitId:visit.id,subtotalMinor:subtotal,
   policy:chargePolicy});
 return created;
}
/** Reconcile late accepted rounds before any payment/split lock; order amount snapshots are authoritative. */
export async function syncCheck(tx:Tx,scope:FinanceScope,check:typeof diningCheck.$inferSelect){
 if(check.status==="settled"||check.lockedAt)return check;
 const rounds=await currentOrders(tx,scope,check.visitId);
 const amounts=calculate(rounds.reduce((s,r)=>s+r.totalMinor,0),check.chargePolicy);
 if(check.subtotalMinor===amounts.subtotalMinor&&check.totalMinor===amounts.totalMinor)return check;
 if(check.paidMinor!==0||check.splitMode!=="single")fail(409,"CHECK_LOCKED","Cannot change locked check.");
 const [updated]=await tx.update(diningCheck).set({...amounts,version:check.version+1,updatedAt:new Date()})
   .where(eq(diningCheck.id,check.id)).returning();
 await tx.update(checkShare).set({amountMinor:amounts.totalMinor})
   .where(and(eq(checkShare.checkId,check.id),eq(checkShare.shareIndex,1)));
 await writeAudit(tx,scope,check.id,"check.synced",{totalMinor:amounts.totalMinor,
   roundCount:rounds.length});
 return updated!;
}
export async function lockedCheck(tx:Tx,scope:FinanceScope,id:string){
 const [target]=await tx.select({tableId:diningCheck.tableId}).from(diningCheck).where(and(
   eq(diningCheck.id,id),eq(diningCheck.tenantId,scope.tenantId),
   eq(diningCheck.locationId,scope.locationId))).limit(1);
 if(!target)fail(404,"NOT_FOUND","Check unavailable.");
 await lockTable(tx,scope,target.tableId);
 await tx.execute(sql`SELECT id FROM dining_checks WHERE id=${id} AND tenant_id=${scope.tenantId} FOR UPDATE`);
 const [check]=await tx.select().from(diningCheck).where(and(eq(diningCheck.id,id),
   eq(diningCheck.tenantId,scope.tenantId),eq(diningCheck.locationId,scope.locationId))).limit(1);
 if(!check)fail(404,"NOT_FOUND","Check unavailable.");
 return syncCheck(tx,scope,check);
}
export async function getCheckForVisit(scope:FinanceScope,visitId:string){
 return db.transaction(async tx=>{
   const [visit]=await tx.select().from(diningVisit).where(and(eq(diningVisit.id,visitId),
     eq(diningVisit.tenantId,scope.tenantId),eq(diningVisit.locationId,scope.locationId))).limit(1);
   if(!visit)fail(404,"NOT_FOUND","Visit unavailable.");
   await lockTable(tx,scope,visit.tableId);
   const [existing]=await tx.select().from(diningCheck).where(eq(diningCheck.visitId,visitId)).limit(1);
   if(visit.status!=="open"&&!existing)fail(409,"VISIT_CLOSED","Visit has already closed.");
   const check=existing??await ensureCheck(tx,scope,visit);
   await tx.execute(sql`SELECT id FROM dining_checks WHERE id=${check.id} FOR UPDATE`);
   return syncCheck(tx,scope,check);
 });
}
export async function fullCheck(scope:FinanceScope,id:string){
 const [check]=await db.select().from(diningCheck).where(and(eq(diningCheck.id,id),
   eq(diningCheck.tenantId,scope.tenantId),eq(diningCheck.locationId,scope.locationId))).limit(1);
 if(!check)fail(404,"NOT_FOUND","Check unavailable.");
 const [visit]=await db.select().from(diningVisit).where(eq(diningVisit.id,check.visitId)).limit(1);
 const [table]=await db.select({label:diningTable.label}).from(diningTable)
   .where(eq(diningTable.id,check.tableId)).limit(1);
 const rounds=await db.select().from(orderRound).where(and(eq(orderRound.visitId,check.visitId),
   eq(orderRound.tenantId,scope.tenantId))).orderBy(asc(orderRound.roundNumber));
 const ids=rounds.map(r=>r.id);
 const [lines,shares,payments,activities,receipt,restaurantSettingRow]=await Promise.all([
   ids.length?db.select().from(orderLine).where(and(eq(orderLine.tenantId,scope.tenantId),
     inArray(orderLine.roundId,ids))).orderBy(asc(orderLine.createdAt),asc(orderLine.lineIndex)):Promise.resolve([]),
   db.select().from(checkShare).where(eq(checkShare.checkId,id)).orderBy(asc(checkShare.shareIndex)),
   db.select().from(checkPayment).where(eq(checkPayment.checkId,id)).orderBy(asc(checkPayment.createdAt)),
   db.select().from(checkActivity).where(eq(checkActivity.checkId,id)).orderBy(desc(checkActivity.createdAt)).limit(100),
   db.select().from(checkReceipt).where(eq(checkReceipt.checkId,id)).limit(1),
   db.select().from(restaurantSetting).where(eq(restaurantSetting.tenantId,scope.tenantId)).limit(1)
 ]);
 const allocations=check.splitMode==="items"?await db.select().from(checkShareLine)
   .where(eq(checkShareLine.checkId,id)):[];
 return {check,visit,tableLabel:table?.label??"",rounds,lines,shares,payments,activities,
   allocations,receipt:receipt[0]??null,timezone:restaurantSettingRow[0]?.timezone??"Asia/Kabul",
   dueMinor:check.totalMinor-check.paidMinor,currency:"AFN" as const};
}
export async function orderGuard(tx:Tx,scope:{tenantId:string;locationId:string},visitId:string){
 const [check]=await tx.select({status:diningCheck.status,lockedAt:diningCheck.lockedAt})
   .from(diningCheck).where(and(eq(diningCheck.visitId,visitId),
    eq(diningCheck.tenantId,scope.tenantId),eq(diningCheck.locationId,scope.locationId))).limit(1);
 if(check&&(check.status!=="open"||check.lockedAt))
   fail(409,"CHECK_LOCKED","Check is locked for payment. Ask your cashier before adding another order.");
}
export async function pendingGuard(tx:Tx,scope:FinanceScope,visitId:string){
 const [pending]=await tx.select({id:guestSubmission.id}).from(guestSubmission).where(and(
    eq(guestSubmission.visitId,visitId),eq(guestSubmission.tenantId,scope.tenantId),
    eq(guestSubmission.status,"pending"))).limit(1);
 if(pending)fail(409,"PENDING_GUEST_ORDER","Resolve pending guest orders before settling.");
 const rounds=await currentOrders(tx,scope,visitId);
 if(!rounds.length)fail(409,"EMPTY_CHECK","Cannot settle a visit without ordered items.");
 const [unfinished]=await tx.select({id:kitchenTicket.id}).from(kitchenTicket)
   .where(and(eq(kitchenTicket.visitId,visitId),eq(kitchenTicket.tenantId,scope.tenantId),
     sql`${kitchenTicket.status} <> 'served'`)).limit(1);
 if(unfinished)fail(409,"UNSERVED_FOOD","All kitchen tickets must be served before closing this visit.");
}
export function splitValues(total:number,count:number){
 if(!Number.isInteger(count)||count<1||count>10)fail(400,"INVALID_SPLIT","Split requires 1 to 10 shares.");
 const base=Math.floor(total/count),values=Array.from({length:count},()=>base);
 values[count-1]+=total-base*count;return values;
}
