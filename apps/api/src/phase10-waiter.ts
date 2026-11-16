import {Router} from "express";
import {and,desc,eq,inArray,sql} from "drizzle-orm";
import {createHash,randomUUID} from "node:crypto";
import {db} from "./db";
import {diningVisit,financeAdjustment,kitchenTicket,orderLine,orderRound,diningCheck} from "./schema";
import {scopeFor,fail,field,bodyObject,route} from "./menu-helpers";
import {lockTable,ensureCheck,syncCheck,writeAudit} from "./finance-core";
export const waiterCorrectionRouter=Router();

async function authorizedRound(scope:{tenantId:string;locationId:string;actorId:string;role:string},roundId:string){
 const [round]=await db.select().from(orderRound).where(and(eq(orderRound.id,roundId),
  eq(orderRound.tenantId,scope.tenantId),eq(orderRound.locationId,scope.locationId))).limit(1);
 if(!round)fail(404,"NOT_FOUND","Order round unavailable.");
 const [visit]=await db.select().from(diningVisit).where(and(eq(diningVisit.id,round.visitId),
  eq(diningVisit.tenantId,scope.tenantId),eq(diningVisit.locationId,scope.locationId))).limit(1);
 if(!visit)fail(404,"NOT_FOUND","Visit unavailable.");
 if(scope.role==="waiter"&&visit.waiterId!==scope.actorId)
  fail(403,"NOT_ASSIGNED","This visit is assigned to another waiter.");
 if(!["owner","manager","waiter"].includes(scope.role))
  fail(403,"ACCESS_DENIED","Only the assigned waiter and management can request a change.");
 return {round,visit};
}
waiterCorrectionRouter.get("/rounds/:id/correction",route(async(req,res)=>{
 const scope=await scopeFor(req),roundId=field(req.params.id,100,"Order ID",1);
 const {round}=await authorizedRound(scope,roundId);
 const [last,ticket]=await Promise.all([
  db.select().from(financeAdjustment).where(and(eq(financeAdjustment.tenantId,scope.tenantId),
   eq(financeAdjustment.locationId,scope.locationId),eq(financeAdjustment.targetRoundId,roundId),
   eq(financeAdjustment.kind,"void"))).orderBy(desc(financeAdjustment.createdAt)).limit(1),
  db.select({status:kitchenTicket.status}).from(kitchenTicket).where(and(
   eq(kitchenTicket.roundId,round.id),eq(kitchenTicket.tenantId,scope.tenantId))).limit(1)
 ]);
 res.setHeader("Cache-Control","no-store");
 res.json({request:last[0]??null,canRequest:round.status==="accepted"&&ticket[0]?.status==="new"});
}));
waiterCorrectionRouter.post("/rounds/:id/correction",route(async(req,res)=>{
 const scope=await scopeFor(req),roundId=field(req.params.id,100,"Order ID",1);
 const data=bodyObject(req),reason=field(data.reason,500,"Reason",8);
 const requestKey=field(data.idempotencyKey,100,"Idempotency key",12);
 if(!/^[A-Za-z0-9_-]{12,100}$/.test(requestKey))
  fail(400,"INVALID_KEY","Invalid request key.");
 const requestHash=createHash("sha256").update(JSON.stringify({roundId,reason,kind:"void"})).digest("hex");
 const {visit}=await authorizedRound(scope,roundId);
 const result=await db.transaction(async tx=>{
  await lockTable(tx,scope,visit.tableId);
  const [currentVisit]=await tx.select().from(diningVisit).where(and(
   eq(diningVisit.id,visit.id),eq(diningVisit.tenantId,scope.tenantId),
   eq(diningVisit.locationId,scope.locationId))).limit(1);
  if(!currentVisit||currentVisit.status!=="open")fail(409,"VISIT_CLOSED","Visit is no longer active.");
  if(scope.role==="waiter"&&currentVisit.waiterId!==scope.actorId)
   fail(403,"NOT_ASSIGNED","The table was assigned to another waiter.");
  const [round]=await tx.select().from(orderRound).where(and(eq(orderRound.id,roundId),
   eq(orderRound.tenantId,scope.tenantId),eq(orderRound.locationId,scope.locationId),
   eq(orderRound.visitId,currentVisit.id))).limit(1);
  if(!round)fail(404,"NOT_FOUND","Order round unavailable.");
  const [existing]=await tx.select().from(diningCheck).where(and(
   eq(diningCheck.visitId,currentVisit.id),eq(diningCheck.tenantId,scope.tenantId),
   eq(diningCheck.locationId,scope.locationId))).limit(1);
  const currentCheck=existing??await ensureCheck(tx,scope,currentVisit);
  await tx.execute(sql`SELECT id FROM dining_checks WHERE id=${currentCheck.id}
   AND tenant_id=${scope.tenantId} AND location_id=${scope.locationId} FOR UPDATE`);
  const [stored]=await tx.select().from(diningCheck).where(eq(diningCheck.id,currentCheck.id)).limit(1);
  const check=await syncCheck(tx,scope,stored!);
  const [prior]=await tx.select().from(financeAdjustment).where(and(
   eq(financeAdjustment.checkId,check.id),eq(financeAdjustment.requestKey,requestKey))).limit(1);
  if(prior){
   if(prior.requestHash!==requestHash)
    fail(409,"IDEMPOTENCY_CONFLICT","This request key has already been used.");
   return {created:false,request:prior};
  }
  if(check.status!=="open"||check.paidMinor||check.lockedAt||check.splitMode!=="single")
   fail(409,"CHECK_LOCKED","This check has entered payment; ask the cashier.");
  if(round.status!=="accepted")fail(409,"ROUND_VOIDED","This round is no longer active.");
  const [ticket]=await tx.select().from(kitchenTicket).where(and(
   eq(kitchenTicket.roundId,roundId),eq(kitchenTicket.tenantId,scope.tenantId),
   eq(kitchenTicket.locationId,scope.locationId))).limit(1);
  if(ticket?.status!=="new")
   fail(409,"KITCHEN_STARTED","Preparation has started; ask your manager for assistance.");
  const lines=await tx.select({status:orderLine.kitchenStatus}).from(orderLine).where(and(
   eq(orderLine.roundId,roundId),eq(orderLine.tenantId,scope.tenantId)));
  if(lines.some(x=>x.status!=="new"))
   fail(409,"KITCHEN_STARTED","This order is already being prepared.");
  const [pending]=await tx.select({id:financeAdjustment.id}).from(financeAdjustment).where(and(
   eq(financeAdjustment.tenantId,scope.tenantId),eq(financeAdjustment.checkId,check.id),
   eq(financeAdjustment.targetRoundId,roundId),
   inArray(financeAdjustment.status,["pending","approved"]))).limit(1);
  if(pending)fail(409,"REVIEW_PENDING","A change request is already waiting for review.");
  const [created]=await tx.insert(financeAdjustment).values({
   id:randomUUID(),tenantId:scope.tenantId,locationId:scope.locationId,
   checkId:check.id,kind:"void",targetRoundId:roundId,amountMinor:round.totalMinor,
   reason,requestKey,requestHash,status:"pending",requestedBy:scope.actorId,
   checkVersion:check.version}).returning();
  await writeAudit(tx,scope,check.id,"round_cancel_requested",{
   adjustmentId:created!.id,roundId,reason,amountMinor:round.totalMinor,requestedBy:scope.actorId});
  return {created:true,request:created!};
 });
 res.status(result.created?201:200).json(result);
}));
