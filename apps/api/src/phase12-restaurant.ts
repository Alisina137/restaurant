
import {Router} from "express";
import {and,desc,eq,inArray,sql} from "drizzle-orm";
import {randomUUID} from "node:crypto";
import {db} from "./db";
import {tenant} from "./schema";
import {saasInvoice,saasPaymentClaim,saasTicket,saasTicketMessage,saasPlan,saasPlatformSettings,saasSubscription} from "./phase12-schema";
import {audit,choice,effectiveStatus,record,restaurantScope,settings,subscription,value} from "./phase12-core";
import {fail,paramId,route} from "./menu-helpers";
export const saasRestaurantRouter=Router();
saasRestaurantRouter.get("/subscription",route(async(req,res)=>{
 const s=await restaurantScope(req),sub=await subscription(db,s.tenantId),cfg=await settings(db);
 const [org]=await db.select({status:tenant.status}).from(tenant).where(eq(tenant.id,s.tenantId)).limit(1);
 res.setHeader("Cache-Control","no-store");
 res.json({subscription:sub,effectiveStatus:org?.status==="suspended"?"suspended":effectiveStatus(sub,cfg.graceDays),
  graceDays:cfg.graceDays,supportContact:cfg.supportContact,canChange:s.role==="owner",
  paymentInstructions:"Contact platform support before transferring funds. No automatic payment gateway is connected."});
}));
saasRestaurantRouter.get("/invoices",route(async(req,res)=>{
 const s=await restaurantScope(req);
 const invoices=await db.select({id:saasInvoice.id,number:saasInvoice.number,
  status:saasInvoice.status,amountMinor:saasInvoice.amountMinor,periodStart:saasInvoice.periodStart,
  periodEnd:saasInvoice.periodEnd,issuedAt:saasInvoice.issuedAt,dueAt:saasInvoice.dueAt,
  paidAt:saasInvoice.paidAt,createdAt:saasInvoice.createdAt})
  .from(saasInvoice).where(eq(saasInvoice.tenantId,s.tenantId))
  .orderBy(desc(saasInvoice.createdAt)).limit(100);
 res.json({items:invoices});
}));
saasRestaurantRouter.get("/invoices/:id",route(async(req,res)=>{
 const s=await restaurantScope(req),id=paramId(req);
 const [invoice]=await db.select({id:saasInvoice.id,number:saasInvoice.number,
  status:saasInvoice.status,amountMinor:saasInvoice.amountMinor,
  periodStart:saasInvoice.periodStart,periodEnd:saasInvoice.periodEnd,
  dueAt:saasInvoice.dueAt,issuedAt:saasInvoice.issuedAt,paidAt:saasInvoice.paidAt,
  planName:saasPlan.name,planVersion:saasPlan.version})
  .from(saasInvoice).innerJoin(saasPlan,eq(saasInvoice.planId,saasPlan.id))
  .where(and(eq(saasInvoice.id,id),eq(saasInvoice.tenantId,s.tenantId))).limit(1);
 if(!invoice)fail(404,"NOT_FOUND","Invoice unavailable.");
 res.json({invoice});
}));
saasRestaurantRouter.get("/payments",route(async(req,res)=>{
 const s=await restaurantScope(req);
 const rows=await db.select({id:saasPaymentClaim.id,invoiceId:saasPaymentClaim.invoiceId,
  reference:saasPaymentClaim.reference,amountMinor:saasPaymentClaim.amountMinor,
  method:saasPaymentClaim.method,status:saasPaymentClaim.status,createdAt:saasPaymentClaim.createdAt,
  reviewReason:saasPaymentClaim.reviewReason})
  .from(saasPaymentClaim).where(eq(saasPaymentClaim.tenantId,s.tenantId))
  .orderBy(desc(saasPaymentClaim.createdAt)).limit(100);
 res.json({items:rows});
}));
saasRestaurantRouter.post("/invoices/:id/proof",route(async(req,res)=>{
 const s=await restaurantScope(req,true),id=paramId(req),b=record(req);
 const method=choice(b.method,["cash","bank_transfer","mobile_money"] as const,"payment method");
 const reference=value(b.reference,120,"Payment reference",5),proofNote=value(b.proofNote,900,"Proof description",10);
 const claimId=randomUUID();
 await db.transaction(async tx=>{
  await tx.execute(sql`SELECT id FROM saas_invoices WHERE id=${id} AND tenant_id=${s.tenantId} FOR UPDATE`);
  const [invoice]=await tx.select().from(saasInvoice).where(and(eq(saasInvoice.id,id),eq(saasInvoice.tenantId,s.tenantId)));
  if(!invoice)fail(404,"NOT_FOUND","Invoice unavailable.");
  if(invoice.status!=="issued"||invoice.amountMinor<=0)fail(409,"INVOICE_UNAVAILABLE","Only issued positive invoices can receive payment proof.");
  const [pending]=await tx.select({id:saasPaymentClaim.id}).from(saasPaymentClaim)
   .where(and(eq(saasPaymentClaim.invoiceId,id),eq(saasPaymentClaim.status,"pending"))).limit(1);
  if(pending)fail(409,"PROOF_PENDING","A proof is already pending verification.");
  const [duplicate]=await tx.select({id:saasPaymentClaim.id}).from(saasPaymentClaim)
   .where(and(eq(saasPaymentClaim.status,"verified"),sql`lower(${saasPaymentClaim.reference})=lower(${reference})`)).limit(1);
  if(duplicate)fail(409,"DUPLICATE_REFERENCE","This reference was already verified for another invoice.");
  await tx.insert(saasPaymentClaim).values({id:claimId,invoiceId:id,tenantId:s.tenantId,
   reference,proofNote,method,amountMinor:invoice.amountMinor,submittedBy:s.actorId});
  await audit(tx,s.actorId,s.tenantId,"saas.payment_proof_submitted",{claimId,invoiceId:id,reference,amountMinor:invoice.amountMinor});
 });
 res.status(201).json({id:claimId,status:"pending",message:"Proof submitted. Invoice remains unpaid until verified by platform."});
}));
saasRestaurantRouter.post("/upgrade-request",route(async(req,res)=>{
 const s=await restaurantScope(req,true),b=record(req),message=value(b.message,1000,"Request details",10);
 const id=randomUUID();
 await db.transaction(async tx=>{
  await tx.insert(saasTicket).values({id,tenantId:s.tenantId,category:"billing",priority:"normal",
   subject:"Subscription upgrade request",openedBy:s.actorId});
  await tx.insert(saasTicketMessage).values({id:randomUUID(),ticketId:id,senderId:s.actorId,body:message});
  await audit(tx,s.actorId,s.tenantId,"saas.upgrade_requested",{ticketId:id});
 });
 res.status(201).json({ticketId:id});
}));
