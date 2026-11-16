import {Router} from "express";
import {and,asc,count,desc,eq,inArray,sql} from "drizzle-orm";
import {randomUUID} from "node:crypto";
import {db} from "./db";
import {auditEvent,checkPayment,checkReceipt,checkShare,diningCheck,diningTable,diningVisit,
 floorRevision,orderLine,orderRound,restaurantSetting,financeSetting,tenant} from "./schema";
import {bodyObject,fail,field,int,route} from "./menu-helpers";
import {calculate,financeScope,lockedCheck,pendingGuard,writeAudit} from "./finance-core";
import {guestAccess,invalidateVisitSessions} from "./guest-security";
import {serviceRequest,orderChangeRequest} from "./schema";
import {bumpService} from "./service-requests";
export const financeHistoryRouter=Router();
export const guestFinanceRouter=Router();
const id=(req:import("express").Request)=>field(req.params.id,100,"ID",1);
const page=(v:unknown)=>typeof v==="string"&&/^\d+$/.test(v)?Math.min(Math.max(1,Number(v)),10000):1;
financeHistoryRouter.post("/checks/:id/settle",route(async(req,res)=>{
 const scope=await financeScope(req),checkId=id(req),version=int(bodyObject(req).version,"Version",1,2e9);
 const done=await db.transaction(async tx=>{
   const check=await lockedCheck(tx,scope,checkId);
   if(check.status==="settled"){
     if(check.receiptId)return {created:false,receiptId:check.receiptId,checkId:check.id};
     fail(409,"SETTLEMENT_IN_PROGRESS","Settlement incomplete.");
   }
   if(check.version!==version)fail(409,"VERSION_CONFLICT","Another cashier updated this check.");
   if(check.totalMinor!==check.paidMinor)fail(409,"AMOUNT_DUE","Outstanding balance remains.");
   const shares=await tx.select().from(checkShare).where(eq(checkShare.checkId,check.id));
   if(shares.reduce((s,x)=>s+x.amountMinor,0)!==check.totalMinor||
       shares.some(x=>x.amountMinor!==x.paidMinor))
      fail(409,"SPLIT_UNPAID","Some split shares remain unpaid.");
   const [visit]=await tx.select().from(diningVisit).where(and(eq(diningVisit.id,check.visitId),
     eq(diningVisit.tenantId,scope.tenantId),eq(diningVisit.locationId,scope.locationId))).limit(1);
   if(!visit||visit.status!=="open")fail(409,"VISIT_CLOSED","Visit has already closed.");
   await pendingGuard(tx,scope,visit.id);
   const [table]=await tx.select().from(diningTable).where(eq(diningTable.id,visit.tableId)).limit(1);
   const [restaurant]=await tx.select({name:tenant.name}).from(tenant).where(eq(tenant.id,scope.tenantId)).limit(1);
   const rounds=await tx.select({id:orderRound.id}).from(orderRound).where(and(
     eq(orderRound.visitId,visit.id),eq(orderRound.tenantId,scope.tenantId)));
   const lines=rounds.length?await tx.select({nameFa:orderLine.itemNameFa,namePs:orderLine.itemNamePs,
      nameEn:orderLine.itemNameEn,quantity:orderLine.quantity,unitPriceMinor:orderLine.unitPriceMinor,
      lineTotalMinor:orderLine.lineTotalMinor})
     .from(orderLine).where(and(eq(orderLine.tenantId,scope.tenantId),
       inArray(orderLine.roundId,rounds.map(x=>x.id)))):[];
   const payments=await tx.select().from(checkPayment).where(and(eq(checkPayment.checkId,check.id),
     eq(checkPayment.tenantId,scope.tenantId))).orderBy(asc(checkPayment.createdAt));
   if(payments.reduce((s,x)=>s+x.amountMinor,0)!==check.paidMinor)
     fail(409,"LEDGER_MISMATCH","Payment totals failed reconciliation.");
   const now=new Date(),receiptId=randomUUID(),receiptNumber="DF-"+String(check.number).padStart(8,"0");
   const snapshot={
     receiptNumber,checkNumber:check.number,restaurant:restaurant?.name??"DineFlow",
     tableLabel:table?.label??"—",issuedAt:now.toISOString(),currency:"AFN",
     subtotalMinor:check.subtotalMinor,taxMinor:check.taxMinor,serviceMinor:check.serviceMinor,
     totalMinor:check.totalMinor,paidMinor:check.paidMinor,footer:check.chargePolicy.receiptFooter,
     lines,payments:payments.map(x=>({method:x.method,amountMinor:x.amountMinor,
       receivedMinor:x.receivedMinor,changeMinor:x.changeMinor,createdAt:x.createdAt.toISOString(),
       externalReference:x.externalReference}))
   };
   await tx.insert(checkReceipt).values({id:receiptId,tenantId:scope.tenantId,
     locationId:scope.locationId,checkId:check.id,number:receiptNumber,snapshot,
     issuedBy:scope.actorId,createdAt:now});
   await tx.update(diningCheck).set({status:"settled",receiptId,settledAt:now,
     settledBy:scope.actorId,lockedAt:check.lockedAt??now,
     version:check.version+1,updatedAt:now}).where(eq(diningCheck.id,check.id));
   await tx.update(diningVisit).set({status:"closed",closedBy:scope.actorId,
     closedAt:now,closedReason:"Settled: "+receiptNumber,updatedAt:now})
     .where(eq(diningVisit.id,visit.id));
   if(table)await tx.update(diningTable).set({cleaning:true,version:table.version+1,
     updatedAt:now}).where(eq(diningTable.id,table.id));
   await tx.update(serviceRequest).set({status:"resolved",resolvedBy:scope.actorId,
     resolvedAt:now,updatedAt:now,resolutionNote:"Visit settled."})
     .where(and(eq(serviceRequest.visitId,visit.id),eq(serviceRequest.tenantId,scope.tenantId),
       inArray(serviceRequest.status,["pending","acknowledged"])));
   await bumpService(tx,scope);
   await invalidateVisitSessions(tx,visit.id,scope,"Check settled; visit closed.");
   await tx.insert(floorRevision).values({locationId:scope.locationId,tenantId:scope.tenantId})
     .onConflictDoUpdate({target:floorRevision.locationId,
       set:{version:sql`${floorRevision.version}+1`,changedAt:now}});
   await writeAudit(tx,scope,check.id,"check.settled",{receiptId,receiptNumber,
      paidMinor:check.paidMinor,visitId:visit.id});
   return {created:true,receiptId,checkId:check.id,receiptNumber,nextTableStatus:"cleaning"};
 });
 res.status(done.created?201:200).json(done);
}));
financeHistoryRouter.get("/transactions",route(async(req,res)=>{
 const scope=await financeScope(req),p=page(req.query.page);
 const method=typeof req.query.method==="string"?req.query.method:"all";
 if(!["all","cash","manual_transfer"].includes(method))fail(400,"INVALID_FILTER","Invalid method.");
 const from=typeof req.query.from==="string"?req.query.from:"",to=typeof req.query.to==="string"?req.query.to:"";
 for(const day of [from,to]){
   if(!day)continue;
   if(!/^\d{4}-\d{2}-\d{2}$/.test(day)||new Date(day+"T00:00:00Z").toISOString().slice(0,10)!==day)
     fail(400,"INVALID_DATE","Invalid date.");
 }
 if(from&&to&&from>to)fail(400,"INVALID_RANGE","End date must not precede start date.");
 const [settings]=await db.select({timezone:restaurantSetting.timezone}).from(restaurantSetting)
   .where(eq(restaurantSetting.tenantId,scope.tenantId)).limit(1);
 const timezone=settings?.timezone??"Asia/Kabul";
 const businessDate=sql`(${checkPayment.createdAt} AT TIME ZONE ${timezone})::date`;
 const where=and(eq(checkPayment.tenantId,scope.tenantId),eq(checkPayment.locationId,scope.locationId),
   method==="all"?undefined:eq(checkPayment.method,method),
   from?sql`${businessDate}>=${from}::date`:undefined,
   to?sql`${businessDate}<=${to}::date`:undefined);
 const [items,totals]=await Promise.all([
   db.select({id:checkPayment.id,checkId:checkPayment.checkId,shareId:checkPayment.shareId,
     method:checkPayment.method,amountMinor:checkPayment.amountMinor,receivedMinor:checkPayment.receivedMinor,
     changeMinor:checkPayment.changeMinor,externalReference:checkPayment.externalReference,
     cashierId:checkPayment.cashierId,createdAt:checkPayment.createdAt,status:checkPayment.status,
     checkNumber:diningCheck.number,tableLabel:diningTable.label})
    .from(checkPayment).innerJoin(diningCheck,eq(diningCheck.id,checkPayment.checkId))
    .innerJoin(diningTable,eq(diningTable.id,diningCheck.tableId))
    .where(where).orderBy(desc(checkPayment.createdAt),desc(checkPayment.id))
    .limit(20).offset((p-1)*20),
   db.select({n:count()}).from(checkPayment).where(where)
 ]);
 res.setHeader("Cache-Control","no-store");
 res.json({items,total:totals[0]?.n??0,page:p,perPage:20,timezone});
}));
financeHistoryRouter.get("/receipts",route(async(req,res)=>{
 const scope=await financeScope(req),p=page(req.query.page);
 const q=typeof req.query.q==="string"?field(req.query.q,100,"Search").toLowerCase():"";
 const from=typeof req.query.from==="string"?req.query.from:"";
 const to=typeof req.query.to==="string"?req.query.to:"";
 for(const day of [from,to]){
   if(!day)continue;
   const d=new Date(day+"T00:00:00Z");
   if(!/^\d{4}-\d{2}-\d{2}$/.test(day)||Number.isNaN(d.getTime())||d.toISOString().slice(0,10)!==day)
     fail(400,"INVALID_DATE","Use YYYY-MM-DD for valid business dates.");
 }
 if(from&&to&&from>to)fail(400,"INVALID_RANGE","Date range is reversed.");
 const [setting]=await db.select({timezone:restaurantSetting.timezone}).from(restaurantSetting)
   .where(eq(restaurantSetting.tenantId,scope.tenantId)).limit(1);
 const timezone=setting?.timezone??"Asia/Kabul";
 const businessDay=sql`(${checkReceipt.createdAt} AT TIME ZONE ${timezone})::date`;
 const where=and(eq(checkReceipt.tenantId,scope.tenantId),
   eq(checkReceipt.locationId,scope.locationId),
   q?sql`(strpos(lower(${checkReceipt.number}),${q})>0
      OR strpos(lower(${diningTable.label}),${q})>0
      OR strpos(${diningCheck.number}::text,${q})>0)`:undefined,
   from?sql`${businessDay}>=${from}::date`:undefined,
   to?sql`${businessDay}<=${to}::date`:undefined);
 const joined=db.select({id:checkReceipt.id,checkId:checkReceipt.checkId,
   number:checkReceipt.number,createdAt:checkReceipt.createdAt,reprintCount:checkReceipt.reprintCount,
   tableLabel:diningTable.label,totalMinor:diningCheck.totalMinor}).from(checkReceipt)
   .innerJoin(diningCheck,eq(diningCheck.id,checkReceipt.checkId))
   .innerJoin(diningTable,eq(diningTable.id,diningCheck.tableId));
 const totals=db.select({n:count()}).from(checkReceipt)
   .innerJoin(diningCheck,eq(diningCheck.id,checkReceipt.checkId))
   .innerJoin(diningTable,eq(diningTable.id,diningCheck.tableId));
 const [items,total]=await Promise.all([
   joined.where(where).orderBy(desc(checkReceipt.createdAt),desc(checkReceipt.id))
     .limit(20).offset((p-1)*20),
   totals.where(where)
 ]);
 res.setHeader("Cache-Control","no-store");
 res.json({items,total:total[0]?.n??0,page:p,perPage:20,timezone});
}));
financeHistoryRouter.get("/receipts/:id",route(async(req,res)=>{
 const scope=await financeScope(req);
 const [receipt]=await db.select().from(checkReceipt).where(and(eq(checkReceipt.id,id(req)),
   eq(checkReceipt.tenantId,scope.tenantId),eq(checkReceipt.locationId,scope.locationId))).limit(1);
 if(!receipt)fail(404,"NOT_FOUND","Receipt unavailable.");
 res.setHeader("Cache-Control","no-store");res.json(receipt);
}));
financeHistoryRouter.post("/receipts/:id/reprint",route(async(req,res)=>{
 const scope=await financeScope(req),receiptId=id(req);
 const result=await db.transaction(async tx=>{
   const [row]=await tx.select().from(checkReceipt).where(and(eq(checkReceipt.id,receiptId),
     eq(checkReceipt.tenantId,scope.tenantId),eq(checkReceipt.locationId,scope.locationId))).limit(1);
   if(!row)fail(404,"NOT_FOUND","Receipt unavailable.");
   const [updated]=await tx.update(checkReceipt).set({reprintCount:sql`${checkReceipt.reprintCount}+1`})
     .where(eq(checkReceipt.id,receiptId)).returning();
   await writeAudit(tx,scope,row.checkId,"receipt.reprinted",{receiptId});
   return updated!;
 });
 res.json({id:result.id,reprintCount:result.reprintCount});
}));
/** Guests see only line snapshots, due and bill split metadata, never tender or staff identities. */
guestFinanceRouter.get("/bill",route(async(req,res)=>{
 const scope=await guestAccess(req);
 const [check,rounds,charges]=await Promise.all([
   db.select().from(diningCheck).where(and(eq(diningCheck.visitId,scope.visitId),
     eq(diningCheck.tenantId,scope.tenantId),eq(diningCheck.locationId,scope.locationId))).limit(1),
   db.select({id:orderRound.id,totalMinor:orderRound.totalMinor})
    .from(orderRound).where(and(eq(orderRound.visitId,scope.visitId),
      eq(orderRound.tenantId,scope.tenantId))),
   db.select().from(financeSetting).where(eq(financeSetting.tenantId,scope.tenantId)).limit(1)
 ]);
 const changes=await db.select({deltaMinor:orderChangeRequest.deltaMinor}).from(orderChangeRequest)
   .where(and(eq(orderChangeRequest.visitId,scope.visitId),
     eq(orderChangeRequest.tenantId,scope.tenantId),eq(orderChangeRequest.status,"approved")));
 const subtotal=rounds.reduce((sum,r)=>sum+r.totalMinor,0)+
   changes.reduce((sum,x)=>sum+x.deltaMinor,0);
 const c=check[0];
 const p=charges[0];
 // Before the cashier locks a check, late accepted rounds must be reflected in
 // the guest view even if the cashier has not yet reopened the check detail.
 // Once tender starts, the persisted charge snapshot is authoritative.
 const values=c?.status==="open"&&!c.lockedAt?calculate(subtotal,c.chargePolicy):
   c??calculate(subtotal,{taxRateBps:p?.taxRateBps??0,taxInclusive:p?.taxInclusive??false,
   serviceRateBps:p?.serviceRateBps??0,serviceFixedMinor:p?.serviceFixedMinor??0,receiptFooter:""});
 const lines=rounds.length?await db.select({nameFa:orderLine.itemNameFa,namePs:orderLine.itemNamePs,
   nameEn:orderLine.itemNameEn,quantity:orderLine.quantity,lineTotalMinor:orderLine.lineTotalMinor})
    .from(orderLine).where(and(eq(orderLine.tenantId,scope.tenantId),
      inArray(orderLine.roundId,rounds.map(x=>x.id)))):[];
 res.setHeader("Cache-Control","no-store");
 res.json({restaurant:scope.tenantName,tableLabel:scope.tableLabel,visitId:scope.visitId,
   checkNumber:c?.number??null,status:c?.status??"not_opened",currency:"AFN",
   subtotalMinor:values.subtotalMinor,taxMinor:values.taxMinor,serviceMinor:values.serviceMinor,
   totalMinor:values.totalMinor,paidMinor:c?.paidMinor??0,dueMinor:values.totalMinor-(c?.paidMinor??0),
   splitMode:c?.splitMode??"single",lines,noPaymentAction:true});
}));
