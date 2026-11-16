import {Router} from "express";
import {and,asc,desc,eq,inArray,sql} from "drizzle-orm";
import {createHash,randomUUID} from "node:crypto";
import {db} from "./db";
import {financeAdjustment,financeRefund,checkPayment,checkShare,diningCheck,
 diningVisit,orderRound,orderLine,kitchenTicket,cashierShift} from "./schema";
import {financeScope,lockedCheck,currentOrders,calculate,writeAudit,
 amountMax,type FinanceScope,type Tx} from "./finance-core";
import {orderChanged} from "./order-core";
import {bodyObject,fail,field,int,route} from "./menu-helpers";
export const adjustmentsRouter=Router();
const ident=(value:unknown)=>field(value,100,"ID",1);
const key=(value:unknown)=>{const k=field(value,100,"Request key",12);
 if(!/^[A-Za-z0-9_-]{12,100}$/.test(k))fail(400,"INVALID_KEY","Invalid request key.");return k;};
function demandEditable(check:typeof diningCheck.$inferSelect){
 if(check.status!=="open"||check.lockedAt||check.paidMinor||check.splitMode!=="single")
  fail(409,"CHECK_LOCKED","Discounts and voids require an unpaid, unsplit, open check.");
}
async function refundAvailable(tx:Tx,scope:FinanceScope,checkId:string){
 const payments=await tx.select().from(checkPayment).where(and(eq(checkPayment.checkId,checkId),
  eq(checkPayment.tenantId,scope.tenantId),eq(checkPayment.locationId,scope.locationId)));
 const refunds=await tx.select().from(financeRefund).where(and(eq(financeRefund.checkId,checkId),
  eq(financeRefund.tenantId,scope.tenantId),eq(financeRefund.locationId,scope.locationId)));
 return {available:payments.reduce((n,p)=>n+p.amountMinor,0)-refunds.reduce((n,r)=>n+r.amountMinor,0),
  byMethod:(method:string)=>payments.filter(p=>p.method===method).reduce((n,p)=>n+p.amountMinor,0)-
    refunds.filter(r=>r.method===method).reduce((n,r)=>n+r.amountMinor,0)};
}
async function validRound(tx:Tx,scope:FinanceScope,check:typeof diningCheck.$inferSelect,roundId:string){
 const [round]=await tx.select().from(orderRound).where(and(eq(orderRound.id,roundId),
  eq(orderRound.visitId,check.visitId),eq(orderRound.tenantId,scope.tenantId),
  eq(orderRound.locationId,scope.locationId))).limit(1);
 if(!round||round.status==="voided")fail(409,"ROUND_UNAVAILABLE","This order round cannot be voided.");
 const [ticket]=await tx.select().from(kitchenTicket).where(and(eq(kitchenTicket.roundId,round.id),
  eq(kitchenTicket.tenantId,scope.tenantId),eq(kitchenTicket.locationId,scope.locationId))).limit(1);
 if(!ticket||ticket.status!=="new")fail(409,"KITCHEN_STARTED","Kitchen preparation has started; request a post-sale refund instead.");
 const lines=await tx.select().from(orderLine).where(and(eq(orderLine.roundId,round.id),
  eq(orderLine.tenantId,scope.tenantId)));
 if(lines.some(line=>line.kitchenStatus!=="new"))fail(409,"KITCHEN_STARTED","Cannot void prepared food.");
 return {round,ticket};
}
/** Manager queue is read-only; all mutations recheck tenant, review status and check state under locks. */
adjustmentsRouter.get("/adjustments",route(async(req,res)=>{
 const scope=await financeScope(req);
 const status=typeof req.query.status==="string"?req.query.status:"all";
 if(!["all","pending","approved","rejected","applied"].includes(status))
  fail(400,"INVALID_FILTER","Unsupported status.");
 const page=typeof req.query.page==="string"&&/^\d+$/.test(req.query.page)?
  Math.min(Math.max(Number(req.query.page),1),10000):1;
 const where=and(eq(financeAdjustment.tenantId,scope.tenantId),
  eq(financeAdjustment.locationId,scope.locationId),
  status==="all"?undefined:eq(financeAdjustment.status,status));
 const items=await db.select().from(financeAdjustment).where(where)
  .orderBy(desc(financeAdjustment.createdAt)).limit(20).offset((page-1)*20);
 res.setHeader("Cache-Control","no-store");res.json({items,page,perPage:20});
}));
adjustmentsRouter.post("/checks/:id/adjustments",route(async(req,res)=>{
 const scope=await financeScope(req),checkId=ident(req.params.id),data=bodyObject(req);
 const kind=data.kind;
 if(kind!=="discount"&&kind!=="void"&&kind!=="refund")
  fail(400,"INVALID_KIND","Select discount, void or refund.");
 const requestKey=key(data.requestKey),version=int(data.version,"Version",1,2_000_000_000);
 const reason=field(data.reason,500,"Reason",8);
 const roundId=kind==="void"?ident(data.roundId):null;
 const requestedAmount=kind==="void"?0:int(data.amountMinor,"Amount",1,amountMax);
 const requestHash=createHash("sha256").update(JSON.stringify({kind,roundId,requestedAmount,reason})).digest("hex");
 const result=await db.transaction(async tx=>{
  const check=await lockedCheck(tx,scope,checkId);
  const [prior]=await tx.select().from(financeAdjustment).where(and(
   eq(financeAdjustment.checkId,checkId),eq(financeAdjustment.requestKey,requestKey))).limit(1);
  if(prior){
   if(prior.requestHash!==requestHash)fail(409,"IDEMPOTENCY_CONFLICT","Request key already used for another correction.");
   return {created:false,adjustment:prior};
  }
  if(check.version!==version)fail(409,"VERSION_CONFLICT","Check changed; reload.");
  let amountMinor=requestedAmount;
  if(kind==="refund"){
   if(check.status!=="settled")fail(409,"NOT_SETTLED","Refund requests require settled checks.");
   const limits=await refundAvailable(tx,scope,checkId);
   if(amountMinor>limits.available)fail(409,"REFUND_CAP","Refund exceeds remaining paid amount.");
  }else{
   demandEditable(check);
   const [visit]=await tx.select({status:diningVisit.status}).from(diningVisit)
    .where(and(eq(diningVisit.id,check.visitId),eq(diningVisit.tenantId,scope.tenantId))).limit(1);
   if(visit?.status!=="open")fail(409,"VISIT_CLOSED","Visit is already closed.");
   if(kind==="discount"){
    if(amountMinor>check.subtotalMinor-check.discountMinor)fail(409,"DISCOUNT_CAP","Discount exceeds remaining subtotal.");
   }else{
    const target=await validRound(tx,scope,check,roundId!);
    amountMinor=target.round.totalMinor;
    if(amountMinor<=0)fail(409,"INVALID_VOID","Order amount must be positive.");
   }
  }
  const [created]=await tx.insert(financeAdjustment).values({id:randomUUID(),
   tenantId:scope.tenantId,locationId:scope.locationId,checkId,kind,targetRoundId:roundId,
   amountMinor,reason,requestKey,requestHash,status:"pending",
   requestedBy:scope.actorId,checkVersion:version}).returning();
  await writeAudit(tx,scope,checkId,"adjustment.requested",{
   adjustmentId:created!.id,kind,amountMinor,roundId,reason});
  return {created:true,adjustment:created!};
 });
 res.status(result.created?201:200).json(result);
}));
adjustmentsRouter.post("/adjustments/:id/decision",route(async(req,res)=>{
 const scope=await financeScope(req,true),adjustmentId=ident(req.params.id),data=bodyObject(req);
 const decision=data.decision;
 if(decision!=="approve"&&decision!=="reject")fail(400,"INVALID_DECISION","Approve or reject.");
 const version=int(data.version,"Version",1,2_000_000_000),note=field(data.note??"",250,"Decision note");
 const result=await db.transaction(async tx=>{
  const [target]=await tx.select({checkId:financeAdjustment.checkId}).from(financeAdjustment)
   .where(and(eq(financeAdjustment.id,adjustmentId),eq(financeAdjustment.tenantId,scope.tenantId),
    eq(financeAdjustment.locationId,scope.locationId))).limit(1);
  if(!target)fail(404,"NOT_FOUND","Correction unavailable.");
  const check=await lockedCheck(tx,scope,target.checkId);
  await tx.execute(sql`SELECT id FROM finance_adjustments WHERE id=${adjustmentId}
   AND tenant_id=${scope.tenantId} FOR UPDATE`);
  const [item]=await tx.select().from(financeAdjustment).where(and(
   eq(financeAdjustment.id,adjustmentId),eq(financeAdjustment.tenantId,scope.tenantId),
   eq(financeAdjustment.locationId,scope.locationId))).limit(1);
  if(!item)fail(404,"NOT_FOUND","Correction unavailable.");
  if(item.status!=="pending"||item.version!==version)fail(409,"VERSION_CONFLICT","Correction was already reviewed.");
  if(item.requestedBy===scope.actorId)fail(403,"SEGREGATION_REQUIRED","A different manager must review this request.");
  const now=new Date();
  if(decision==="reject"){
   const [rejected]=await tx.update(financeAdjustment).set({status:"rejected",approvedBy:scope.actorId,
    decidedAt:now,decisionNote:note,version:item.version+1,updatedAt:now})
    .where(eq(financeAdjustment.id,item.id)).returning();
   await writeAudit(tx,scope,check.id,"adjustment.rejected",{adjustmentId:item.id,note});
   return rejected!;
  }
  if(item.kind==="refund"){
   if(check.status!=="settled")fail(409,"NOT_SETTLED","Original payment is not settled.");
   const limits=await refundAvailable(tx,scope,check.id);
   if(item.amountMinor>limits.available)fail(409,"REFUND_CAP","Already refunded or exceeding paid funds.");
   const [approved]=await tx.update(financeAdjustment).set({status:"approved",approvedBy:scope.actorId,
    decidedAt:now,decisionNote:note,version:item.version+1,updatedAt:now})
    .where(eq(financeAdjustment.id,item.id)).returning();
   await writeAudit(tx,scope,check.id,"refund.approved",{adjustmentId:item.id,amountMinor:item.amountMinor});
   return approved!;
  }
  demandEditable(check);
  if(check.version!==item.checkVersion)fail(409,"CHECK_CHANGED","Check changed after the request; request again.");
  let subtotal=check.subtotalMinor,discount=check.discountMinor;
  if(item.kind==="discount"){
   if(discount+item.amountMinor>subtotal)fail(409,"DISCOUNT_CAP","Discount exceeds subtotal.");
   discount+=item.amountMinor;
  }else if(item.kind==="void"){
   const {round,ticket}=await validRound(tx,scope,check,item.targetRoundId!);
   subtotal-=round.totalMinor;
   if(discount>subtotal)fail(409,"DISCOUNT_CAP","Existing discounts exceed the revised subtotal.");
   await tx.update(orderRound).set({status:"voided"}).where(eq(orderRound.id,round.id));
   await tx.update(kitchenTicket).set({status:"voided",version:ticket.version+1,updatedAt:now})
    .where(eq(kitchenTicket.id,ticket.id));
   await tx.update(orderLine).set({kitchenStatus:"voided"}).where(and(
    eq(orderLine.roundId,round.id),eq(orderLine.tenantId,scope.tenantId)));
   await orderChanged(tx,scope,round.id,"order.voided",{
    adjustmentId:item.id,reason:item.reason,amountMinor:item.amountMinor,approvedBy:scope.actorId});
  }
  const totals=calculate(subtotal,check.chargePolicy,discount);
  await tx.update(diningCheck).set({...totals,version:check.version+1,updatedAt:now})
   .where(eq(diningCheck.id,check.id));
  await tx.update(checkShare).set({amountMinor:totals.totalMinor})
   .where(and(eq(checkShare.checkId,check.id),eq(checkShare.shareIndex,1)));
  const [applied]=await tx.update(financeAdjustment).set({status:"applied",approvedBy:scope.actorId,
   decidedAt:now,decisionNote:note,appliedBy:scope.actorId,appliedAt:now,
   version:item.version+1,updatedAt:now}).where(eq(financeAdjustment.id,item.id)).returning();
  await writeAudit(tx,scope,check.id,item.kind==="void"?"order.voided":"discount.applied",{
   adjustmentId:item.id,amountMinor:item.amountMinor,reason:item.reason,checkTotalMinor:totals.totalMinor});
  return applied!;
 });
 res.json({adjustment:result});
}));
adjustmentsRouter.post("/adjustments/:id/refund",route(async(req,res)=>{
 const scope=await financeScope(req),adjustmentId=ident(req.params.id),data=bodyObject(req);
 const version=int(data.version,"Version",1,2_000_000_000);
 const method=data.method;
 if(method!=="cash"&&method!=="manual_transfer")fail(400,"INVALID_METHOD","Cash or externally verified transfer only.");
 const reference=field(data.externalReference??"",100,"Transfer reference");
 const note=field(data.note??"",250,"Refund note");
 if(method==="manual_transfer"&&(!reference||data.verifiedExternally!==true))
  fail(400,"TRANSFER_VERIFICATION_REQUIRED","Enter transfer reference and confirm external refund.");
 if(method==="cash"&&reference)fail(400,"INVALID_METHOD","Cash refunds cannot include transfer reference.");
 const result=await db.transaction(async tx=>{
  const [target]=await tx.select({checkId:financeAdjustment.checkId}).from(financeAdjustment)
   .where(and(eq(financeAdjustment.id,adjustmentId),eq(financeAdjustment.tenantId,scope.tenantId),
    eq(financeAdjustment.locationId,scope.locationId))).limit(1);
  if(!target)fail(404,"NOT_FOUND","Refund request unavailable.");
  const check=await lockedCheck(tx,scope,target.checkId);
  await tx.execute(sql`SELECT id FROM finance_adjustments WHERE id=${adjustmentId}
   AND tenant_id=${scope.tenantId} FOR UPDATE`);
  const [item]=await tx.select().from(financeAdjustment).where(and(
   eq(financeAdjustment.id,adjustmentId),eq(financeAdjustment.tenantId,scope.tenantId),
   eq(financeAdjustment.locationId,scope.locationId))).limit(1);
  if(!item||item.kind!=="refund")fail(404,"NOT_FOUND","Refund request unavailable.");
  if(item.status==="applied"){
   const [old]=await tx.select().from(financeRefund).where(eq(financeRefund.adjustmentId,item.id)).limit(1);
   if(!old)fail(409,"LEDGER_MISMATCH","Refund reversal unavailable.");
   if(old.method!==method||old.externalReference!==(method==="manual_transfer"?reference:null))
    fail(409,"IDEMPOTENCY_CONFLICT","Refund has already been posted with another method.");
   return {created:false,refund:old};
  }
  if(item.status!=="approved"||item.version!==version)fail(409,"NOT_APPROVED","A manager must approve the current refund request.");
  if(item.approvedBy===scope.actorId)fail(403,"SEGREGATION_REQUIRED","Another cashier must execute the approved refund.");
  if(check.status!=="settled")fail(409,"NOT_SETTLED","Only settled charges can be refunded.");
  const limit=await refundAvailable(tx,scope,check.id);
  if(item.amountMinor>limit.available||item.amountMinor>limit.byMethod(method))
   fail(409,"REFUND_CAP","Refund exceeds paid amount for this tender method.");
  await tx.execute(sql`SELECT id FROM cashier_shifts WHERE tenant_id=${scope.tenantId}
    AND location_id=${scope.locationId} AND cashier_id=${scope.actorId}
    AND status='open' FOR UPDATE`);
  const [shift]=await tx.select().from(cashierShift).where(and(
   eq(cashierShift.tenantId,scope.tenantId),eq(cashierShift.locationId,scope.locationId),
   eq(cashierShift.cashierId,scope.actorId),eq(cashierShift.status,"open"))).limit(1);
  if(!shift)fail(409,"SHIFT_REQUIRED","Open your cashier shift before refunding.");
  const now=new Date();
  const [refund]=await tx.insert(financeRefund).values({id:randomUUID(),adjustmentId:item.id,
   tenantId:scope.tenantId,locationId:scope.locationId,checkId:check.id,
   shiftId:shift.id,cashierId:scope.actorId,method,amountMinor:item.amountMinor,
   externalReference:method==="manual_transfer"?reference:null,note,postedAt:now}).returning();
  await tx.update(financeAdjustment).set({status:"applied",appliedBy:scope.actorId,appliedAt:now,
   version:item.version+1,updatedAt:now}).where(eq(financeAdjustment.id,item.id));
  await writeAudit(tx,scope,check.id,"refund.posted",{
   adjustmentId:item.id,refundId:refund!.id,amountMinor:item.amountMinor,method,
   approvedBy:item.approvedBy,externalReference:method==="manual_transfer"?reference:undefined});
  return {created:true,refund:refund!};
 });
 res.status(result.created?201:200).json(result);
}));
