import {Router} from "express";
import {and,asc,count,desc,eq,gt,inArray,isNull,sql} from "drizzle-orm";
import {randomUUID} from "node:crypto";
import {db} from "./db";
import {diningTable,diningVisit,guestSubmission,guestVisitPin,guestVisitSession,tableQr,
 kitchenTicket,orderLine,orderRound,restaurantSetting,menuItem} from "./schema";
import {bodyObject,fail,field,int,route} from "./menu-helpers";
import {orderChanged,parseOrder,priceLines,type CartLine} from "./order-core";
import {bumpGuest,guestAccess,type GuestScope,type Tx} from "./guest-security";

export const guestOrdersRouter=Router();
type Submission=typeof guestSubmission.$inferSelect;
type Scope={tenantId:string;locationId:string;actorId:string|null};
/** Called under the visit's table row lock by direct submissions or reviewed pending orders. */
export async function acceptGuest(tx:Tx,scope:Scope,order:Submission,approvedBy:string|null){
 if(order.status!=="pending"||order.roundId)fail(409,"ALREADY_DECIDED","Order has already been reviewed.");
 const [visit]=await tx.select().from(diningVisit).where(and(eq(diningVisit.id,order.visitId),
   eq(diningVisit.tenantId,scope.tenantId),eq(diningVisit.locationId,scope.locationId))).limit(1);
 if(!visit||visit.status!=="open")fail(409,"VISIT_LOCKED","This table visit has closed.");
 const [session]=await tx.select().from(guestVisitSession)
   .where(and(eq(guestVisitSession.id,order.guestSessionId),
     eq(guestVisitSession.tenantId,scope.tenantId))).limit(1);
 const [pin]=await tx.select().from(guestVisitPin).where(eq(guestVisitPin.visitId,order.visitId)).limit(1);
 const [qr]=await tx.select().from(tableQr).where(eq(tableQr.tableId,order.tableId)).limit(1);
 if(!session||session.revokedAt||session.expiresAt<=new Date()||
   !pin||!qr||session.pinGeneration!==pin.generation||session.qrVersion!==qr.version)
   fail(409,"GUEST_SESSION_EXPIRED","Guest session was revoked. Reject this order or ask guests to scan again.");
 const priced=await priceLines(tx,scope,order.cart);
 if(priced.subtotal!==order.estimatedMinor)
   fail(409,"PRICE_CHANGED","Meal price changed. Reject this pending order and ask guest to reorder.");
 const [existing]=await tx.select({n:count()}).from(orderRound).where(eq(orderRound.visitId,visit.id));
 const roundId=randomUUID(),ticketId=randomUUID(),roundNumber=(existing?.n??0)+1,now=new Date();
 await tx.insert(orderRound).values({id:roundId,tenantId:scope.tenantId,locationId:scope.locationId,
   visitId:visit.id,tableId:visit.tableId,roundNumber,submittedBy:null,guestSessionId:order.guestSessionId,
   idempotencyKey:order.idempotencyKey,requestHash:order.requestHash,source:"guest_qr",status:"accepted",
   currency:"AFN",subtotalMinor:priced.subtotal,taxMinor:0,serviceMinor:0,totalMinor:priced.subtotal,
   orderNote:order.orderNote});
 for(let i=0;i<priced.lines.length;i++)await tx.insert(orderLine).values({id:randomUUID(),
   tenantId:scope.tenantId,locationId:scope.locationId,roundId,lineIndex:i,...priced.lines[i]!});
 const [table]=await tx.select({label:diningTable.label}).from(diningTable).where(and(
   eq(diningTable.id,visit.tableId),eq(diningTable.tenantId,scope.tenantId))).limit(1);
 if(!table)fail(409,"TABLE_UNAVAILABLE","Table is unavailable.");
 await tx.insert(kitchenTicket).values({id:ticketId,tenantId:scope.tenantId,locationId:scope.locationId,
   roundId,visitId:visit.id,tableId:visit.tableId,tableLabel:table.label,status:"new",version:1});
 await tx.update(guestSubmission).set({status:"approved",version:order.version+1,roundId,
    decidedAt:now,decidedBy:approvedBy,rejectionReason:null})
   .where(and(eq(guestSubmission.id,order.id),eq(guestSubmission.status,"pending")));
 await orderChanged(tx,scope,roundId,"guest.approved",
   {guestOrderId:order.id,visitId:order.visitId,ticketId,source:"guest_qr",policy:order.policy,
     roundNumber,lines:priced.lines.length,totalMinor:priced.subtotal});
 await bumpGuest(tx,scope);
 return {roundId,ticketId,roundNumber};
}
async function lockedGuest(tx:Tx,scope:GuestScope){
 await tx.execute(sql`SELECT id FROM dining_tables WHERE id=${scope.tableId} AND tenant_id=${scope.tenantId} FOR UPDATE`);
 const [visit]=await tx.select().from(diningVisit).where(and(eq(diningVisit.id,scope.visitId),
   eq(diningVisit.tableId,scope.tableId),eq(diningVisit.status,"open"))).limit(1);
 const [session]=await tx.select().from(guestVisitSession).where(and(eq(guestVisitSession.id,scope.sessionId),
   eq(guestVisitSession.tenantId,scope.tenantId))).limit(1);
 const [pin]=await tx.select().from(guestVisitPin).where(eq(guestVisitPin.visitId,scope.visitId)).limit(1);
 const [qr]=await tx.select().from(tableQr).where(eq(tableQr.tableId,scope.tableId)).limit(1);
 if(!visit||!session||session.revokedAt||session.expiresAt<=new Date()||!pin||!qr||
   pin.generation!==session.pinGeneration||qr.version!==session.qrVersion)
   fail(401,"GUEST_SESSION_EXPIRED","Ask your waiter for a fresh table PIN.");
}
guestOrdersRouter.post("/orders",route(async(req,res)=>{
 const scope=await guestAccess(req),cart=parseOrder(bodyObject(req)),now=new Date();
 const created=await db.transaction(async tx=>{
   await lockedGuest(tx,scope);
   const [existing]=await tx.select().from(guestSubmission).where(and(
     eq(guestSubmission.guestSessionId,scope.sessionId),
     eq(guestSubmission.idempotencyKey,cart.idempotencyKey))).limit(1);
   if(existing){
     if(existing.requestHash!==cart.hash)fail(409,"IDEMPOTENCY_CONFLICT","This submission key was used for a different cart.");
     return {created:false,submission:existing};
   }
   const [recent]=await tx.select({n:count()}).from(guestSubmission).where(and(
     eq(guestSubmission.guestSessionId,scope.sessionId),
     gt(guestSubmission.createdAt,new Date(now.getTime()-5*60_000))));
   if((recent?.n??0)>=12)fail(429,"ORDER_RATE_LIMITED","Too many orders in five minutes. Ask your waiter.");
   const priced=await priceLines(tx,scope,cart.lines);
   const [settings]=await tx.select({orderingPolicy:restaurantSetting.orderingPolicy})
      .from(restaurantSetting).where(eq(restaurantSetting.tenantId,scope.tenantId)).limit(1);
   const policy=settings?.orderingPolicy==="direct_to_kitchen"?"direct_to_kitchen":"waiter_approval";
   const preview=priced.lines.map(l=>({
     nameFa:l.itemNameFa,namePs:l.itemNamePs,nameEn:l.itemNameEn,quantity:l.quantity,
     unitPriceMinor:l.unitPriceMinor,lineTotalMinor:l.lineTotalMinor,note:l.note,
     modifierSummary:l.modifierSnapshot.flatMap(g=>g.options.map(o=>o.nameFa))}));
   const [submission]=await tx.insert(guestSubmission).values({id:randomUUID(),
     tenantId:scope.tenantId,locationId:scope.locationId,visitId:scope.visitId,
     tableId:scope.tableId,guestSessionId:scope.sessionId,idempotencyKey:cart.idempotencyKey,
     requestHash:cart.hash,status:"pending",version:1,policy,orderNote:cart.note,
     cart:cart.lines,preview,estimatedMinor:priced.subtotal}).returning();
   if(!submission)fail(503,"ORDER_FAILED","Could not save order.");
   if(policy==="direct_to_kitchen"){
      const accepted=await acceptGuest(tx,scope,submission,null);
      return {created:true,submission:{...submission,status:"approved" as const,
        roundId:accepted.roundId,version:2}};
   }
   await bumpGuest(tx,scope);
   return {created:true,submission};
 });
 res.status(created.created?201:200).json({created:created.created,
   id:created.submission.id,status:created.submission.status,
   version:created.submission.version,roundId:created.submission.roundId,
   estimatedMinor:created.submission.estimatedMinor,
   policy:created.submission.policy,
   message:created.submission.status==="approved"?"Accepted by restaurant.":"Waiting for waiter approval."});
}));
guestOrdersRouter.get("/orders/by-key/:key",route(async(req,res)=>{
 const scope=await guestAccess(req),key=field(req.params.key,100,"Order key",12);
 const [row]=await db.select().from(guestSubmission).where(and(
   eq(guestSubmission.guestSessionId,scope.sessionId),eq(guestSubmission.idempotencyKey,key),
   eq(guestSubmission.tenantId,scope.tenantId))).limit(1);
 if(!row)fail(404,"NOT_FOUND","Submission not found.");
 res.json({id:row.id,status:row.status,roundId:row.roundId,version:row.version,
   estimatedMinor:row.estimatedMinor,rejectionReason:row.rejectionReason});
}));
guestOrdersRouter.get("/orders",route(async(req,res)=>{
 const scope=await guestAccess(req);
 const [mine,accepted]=await Promise.all([
   db.select({id:guestSubmission.id,status:guestSubmission.status,
    roundId:guestSubmission.roundId,createdAt:guestSubmission.createdAt,
    estimatedMinor:guestSubmission.estimatedMinor,rejectionReason:guestSubmission.rejectionReason,
    preview:guestSubmission.preview,decidedAt:guestSubmission.decidedAt})
     .from(guestSubmission).where(and(eq(guestSubmission.guestSessionId,scope.sessionId),
       eq(guestSubmission.tenantId,scope.tenantId))).orderBy(desc(guestSubmission.createdAt)).limit(50),
   db.select({id:orderRound.id,roundNumber:orderRound.roundNumber,createdAt:orderRound.createdAt,
     source:orderRound.source,totalMinor:orderRound.totalMinor,status:kitchenTicket.status})
     .from(orderRound).innerJoin(kitchenTicket,eq(kitchenTicket.roundId,orderRound.id))
     .where(and(eq(orderRound.visitId,scope.visitId),eq(orderRound.tenantId,scope.tenantId),
       eq(orderRound.locationId,scope.locationId)))
     .orderBy(desc(orderRound.createdAt)).limit(50)
 ]);
 const roundIds=accepted.map(x=>x.id);
 const lines=roundIds.length?await db.select({roundId:orderLine.roundId,
   nameFa:orderLine.itemNameFa,namePs:orderLine.itemNamePs,nameEn:orderLine.itemNameEn,
   quantity:orderLine.quantity,lineTotalMinor:orderLine.lineTotalMinor,
   kitchenStatus:orderLine.kitchenStatus})
   .from(orderLine).where(and(eq(orderLine.tenantId,scope.tenantId),
     inArray(orderLine.roundId,roundIds))).orderBy(asc(orderLine.lineIndex)):[];
 res.json({pending:mine.filter(x=>x.status!=="approved"),rounds:accepted.map(x=>({
   ...x,lines:lines.filter(l=>l.roundId===x.id)})),currency:"AFN"});
}));
