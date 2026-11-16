
import {Router} from "express";
import {and,asc,count,desc,eq,ilike,inArray,like,or,sql} from "drizzle-orm";
import {randomUUID} from "node:crypto";
import {db} from "./db";
import {auditEvent,location,tenant,tenantMembership,user} from "./schema";
import {saasInvoice,saasPaymentClaim,saasPlan,saasPlatformSettings,saasSubscription,saasTicket} from "./phase12-schema";
import {audit,choice,effectiveStatus,platformScope,positive,record,settings,subscription,value} from "./phase12-core";
import {fail,paramId,route} from "./menu-helpers";

export const saasPlatformRouter=Router();
const now=()=>new Date();
const tenantId=(id:string)=>id.length>0&&id.length<=100?id:fail(404,"NOT_FOUND","Restaurant unavailable.");
const page=(v:unknown)=>typeof v==="string"&&Number.isInteger(Number(v))&&Number(v)>0?Math.min(500,Number(v)):1;
saasPlatformRouter.get("/overview",route(async(req,res)=>{
 await platformScope(req);
 const [orgs,subs,invoices,claims,tickets]=await Promise.all([
  db.select({id:tenant.id,status:tenant.status}).from(tenant),
  db.select().from(saasSubscription).innerJoin(saasPlan,eq(saasSubscription.planId,saasPlan.id)),
  db.select({status:saasInvoice.status,dueAt:saasInvoice.dueAt}).from(saasInvoice),
  db.select({id:saasPaymentClaim.id}).from(saasPaymentClaim).where(eq(saasPaymentClaim.status,"pending")).limit(1000),
  db.select({id:saasTicket.id}).from(saasTicket).where(inArray(saasTicket.status,["open","in_progress"])).limit(1000)]);
 const policy=await settings(db),bySub=new Map(subs.map(x=>[x.saas_subscriptions.tenantId,x]));
 const status=(org:{id:string;status:string})=>{
  const sub=bySub.get(org.id);
  if(org.status==="suspended")return "suspended";
  return sub?effectiveStatus({...sub.saas_subscriptions,...sub.saas_plans,planId:sub.saas_plans.id,
    planName:sub.saas_plans.name,planCode:sub.saas_plans.code,planVersion:sub.saas_plans.version},policy.graceDays):org.status;
 };
 res.setHeader("Cache-Control","no-store");
 res.json({tenants:orgs.length,trial:orgs.filter(x=>status(x)==="trial").length,
  active:orgs.filter(x=>status(x)==="active").length,
  grace:orgs.filter(x=>status(x)==="grace").length,
  suspended:orgs.filter(x=>status(x)==="suspended").length,
  pending:orgs.filter(x=>x.status==="pending").length,
  overdueInvoices:invoices.filter(x=>x.status==="issued"&&x.dueAt<now()).length,
  paymentClaims:claims.length,openTickets:tickets.length});
}));
saasPlatformRouter.get("/plans",route(async(req,res)=>{
 await platformScope(req);
 const rows=await db.select().from(saasPlan).orderBy(asc(saasPlan.code),desc(saasPlan.version));
 res.json({items:rows});
}));
saasPlatformRouter.post("/plans",route(async(req,res)=>{
 const actor=await platformScope(req),b=record(req);
 const code=value(b.code,40,"Plan code",2).toLowerCase();
 if(!/^[a-z][a-z0-9_-]*$/.test(code))fail(400,"INVALID_PLAN","Use lowercase Latin letters, numbers or hyphens.");
 const name=value(b.name,90,"Plan name",2);
 const priceMinor=positive(b.priceMinor,100000000,"Price");
 const periodDays=positive(b.periodDays,365,"Period"),staffLimit=positive(b.staffLimit,10000,"Staff limit");
 const tableLimit=positive(b.tableLimit,10000,"Table limit"),locationLimit=positive(b.locationLimit,100,"Location limit");
 if(!periodDays||!staffLimit||!tableLimit||!locationLimit)fail(400,"INVALID_PLAN","Limits and billing period must be positive.");
 const created=await db.transaction(async tx=>{
  // Allocate immutable versions atomically across concurrent platform admins.
  await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${"plan:"+code}))`);
  const [last]=await tx.select({version:saasPlan.version}).from(saasPlan)
   .where(eq(saasPlan.code,code)).orderBy(desc(saasPlan.version)).limit(1);
  const version=(last?.version??0)+1,id=randomUUID();
  const [plan]=await tx.insert(saasPlan).values({id,code,name,version,priceMinor,periodDays,
   staffLimit,tableLimit,locationLimit}).returning();
  await audit(tx,actor.actorId,null,"saas.plan_version_created",{planId:id,code,version,priceMinor,limits:{staffLimit,tableLimit,locationLimit}});
  return plan;
 });
 res.status(201).json({plan:created});
}));
saasPlatformRouter.get("/tenants",route(async(req,res)=>{
 await platformScope(req);
 const p=page(req.query.page),status=typeof req.query.status==="string"?req.query.status:"",
  q=typeof req.query.q==="string"?req.query.q.trim().slice(0,80):"";
 const where=and(status?eq(tenant.status,status):undefined,
  q?or(ilike(tenant.name,"%"+q+"%"),ilike(tenant.slug,"%"+q+"%")):undefined);
 const [rows,totals]=await Promise.all([
  db.select({id:tenant.id,name:tenant.name,slug:tenant.slug,status:tenant.status,createdAt:tenant.createdAt})
   .from(tenant).where(where).orderBy(desc(tenant.createdAt)).limit(20).offset((p-1)*20),
  db.select({n:count()}).from(tenant).where(where)]);
 const results=await Promise.all(rows.map(async org=>{
  const [sub,locs,owners]=await Promise.all([
   db.select({planName:saasPlan.name,status:saasSubscription.status,paidUntil:saasSubscription.paidUntil})
    .from(saasSubscription).innerJoin(saasPlan,eq(saasSubscription.planId,saasPlan.id))
    .where(eq(saasSubscription.tenantId,org.id)).limit(1),
   db.select({n:count()}).from(location).where(eq(location.tenantId,org.id)),
   db.select({email:user.email}).from(tenantMembership).innerJoin(user,eq(user.id,tenantMembership.userId))
    .where(and(eq(tenantMembership.tenantId,org.id),eq(tenantMembership.role,"owner"),
     eq(tenantMembership.status,"active"))).limit(1)]);
  return {...org,planName:sub[0]?.planName??"—",subscriptionStatus:sub[0]?.status??null,
   nextRenewal:sub[0]?.paidUntil??null,locationCount:locs[0]?.n??0,ownerEmail:owners[0]?.email??null};
 }));
 res.json({items:results,total:totals[0]?.n??0,page:p,perPage:20});
}));
saasPlatformRouter.get("/tenants/:id",route(async(req,res)=>{
 await platformScope(req);const id=tenantId(paramId(req));
 const [org]=await db.select().from(tenant).where(eq(tenant.id,id)).limit(1);
 if(!org)fail(404,"NOT_FOUND","Restaurant unavailable.");
 const [sub,locs,staff,invoices,logs,owners]=await Promise.all([
  db.select().from(saasSubscription).where(eq(saasSubscription.tenantId,id)).limit(1),
  db.select({name:location.name,city:location.city}).from(location).where(eq(location.tenantId,id)),
  db.select({n:count()}).from(tenantMembership).where(and(eq(tenantMembership.tenantId,id),eq(tenantMembership.status,"active"))),
  db.select({id:saasInvoice.id,number:saasInvoice.number,amountMinor:saasInvoice.amountMinor,
   status:saasInvoice.status,dueAt:saasInvoice.dueAt})
   .from(saasInvoice).where(eq(saasInvoice.tenantId,id)).orderBy(desc(saasInvoice.createdAt)).limit(15),
  db.select({id:auditEvent.id,action:auditEvent.action,createdAt:auditEvent.createdAt})
   .from(auditEvent).where(and(eq(auditEvent.tenantId,id),or(like(auditEvent.action,"saas.%"),like(auditEvent.action,"platform.%"))))
   .orderBy(desc(auditEvent.createdAt)).limit(25),
  db.select({email:user.email}).from(tenantMembership).innerJoin(user,eq(user.id,tenantMembership.userId))
   .where(and(eq(tenantMembership.tenantId,id),eq(tenantMembership.role,"owner"))).limit(1)]);
 res.json({restaurant:org,subscription:sub[0]??null,locations:locs,staffCount:staff[0]?.n??0,
  ownerEmail:owners[0]?.email??null,invoices,history:logs});
}));
saasPlatformRouter.post("/tenants/:id/plan",route(async(req,res)=>{
 const a=await platformScope(req),id=tenantId(paramId(req)),b=record(req),planId=value(b.planId,100,"Plan ID");
 await db.transaction(async tx=>{
  await tx.execute(sql`SELECT id FROM tenants WHERE id=${id} FOR UPDATE`);
  const [org]=await tx.select({id:tenant.id}).from(tenant).where(eq(tenant.id,id));
  if(!org)fail(404,"NOT_FOUND","Restaurant unavailable.");
  const [plan]=await tx.select().from(saasPlan).where(and(eq(saasPlan.id,planId),eq(saasPlan.active,true)));
  if(!plan)fail(404,"NOT_FOUND","Plan unavailable.");
  const [old]=await tx.select().from(saasSubscription).where(eq(saasSubscription.tenantId,id)).limit(1);
  const limits=await Promise.all([
   tx.select({n:count()}).from(tenantMembership).where(and(eq(tenantMembership.tenantId,id),eq(tenantMembership.status,"active"))),
   tx.select({n:count()}).from(location).where(eq(location.tenantId,id)),
   tx.execute(sql`SELECT COUNT(*)::integer AS n FROM dining_tables WHERE tenant_id=${id} AND archived_at IS NULL`)]);
  const tableCount=Number((limits[2] as unknown as {rows:Array<{n:number}>}).rows[0]?.n??0);
  if((limits[0][0]?.n??0)>plan.staffLimit||(limits[1][0]?.n??0)>plan.locationLimit||tableCount>plan.tableLimit)
   fail(409,"PLAN_LIMIT_REACHED","Existing resources exceed selected plan limits.");
  await tx.insert(saasSubscription).values({tenantId:id,planId,status:"trial"})
   .onConflictDoUpdate({target:saasSubscription.tenantId,set:{planId,updatedAt:now()}});
  await audit(tx,a.actorId,id,"saas.plan_assigned",{oldPlanId:old?.planId??null,newPlanId:planId});
 });
 res.json({assigned:true});
}));
saasPlatformRouter.post("/tenants/:id/:action",route(async(req,res)=>{
 const a=await platformScope(req),id=tenantId(paramId(req)),action=req.params.action;
 if(!["approve","reject","suspend","restore"].includes(action))fail(404,"NOT_FOUND","Action unavailable.");
 const b=record(req),reason=value(b.reason,300,"Reason",5);
 await db.transaction(async tx=>{
  await tx.execute(sql`SELECT id FROM tenants WHERE id=${id} FOR UPDATE`);
  const [org]=await tx.select().from(tenant).where(eq(tenant.id,id));
  if(!org)fail(404,"NOT_FOUND","Restaurant not found.");
  const sub=await subscription(tx,id),policy=await settings(tx);
  if(action==="restore"&&effectiveStatus(sub,policy.graceDays)==="suspended"&&sub.status!=="suspended")
   fail(409,"PAYMENT_REQUIRED","A verified invoice or active trial is required to restore this restaurant.");
  if(action==="restore"&&sub.status==="suspended"){
   if((sub.paidUntil?.getTime()??0)<=Date.now()&&(sub.trialEndsAt?.getTime()??0)<=Date.now())
    fail(409,"PAYMENT_REQUIRED","Verify a current invoice before restoring service.");
  }
  if(action==="approve"&&org.status!=="pending")fail(409,"INVALID_STATE","Only pending restaurants can be approved.");
  if(action==="reject"&&org.status!=="pending")fail(409,"INVALID_STATE","Only pending restaurants can be rejected.");
  const target=action==="approve"?(sub.status==="trial"?"trial":"active"):
   action==="restore"?(sub.trialEndsAt&&sub.trialEndsAt>now()?"trial":"active"):
   action==="suspend"?"suspended":"rejected";
  if(action==="suspend"&&org.status==="suspended")fail(409,"INVALID_STATE","Already suspended.");
  await tx.update(tenant).set({status:target}).where(eq(tenant.id,id));
  if(action==="suspend")await tx.update(saasSubscription).set({status:"suspended",updatedAt:now()})
   .where(eq(saasSubscription.tenantId,id));
  if(action==="restore")await tx.update(saasSubscription).set({status:target==="trial"?"trial":"active",updatedAt:now()})
   .where(eq(saasSubscription.tenantId,id));
  await audit(tx,a.actorId,id,"saas.tenant_"+action,{reason,previousStatus:org.status,newStatus:target});
 });
 res.json({updated:true});
}));
saasPlatformRouter.get("/invoices",route(async(req,res)=>{
 await platformScope(req);
 const p=page(req.query.page),state=typeof req.query.status==="string"?req.query.status:"";
 const where=state?eq(saasInvoice.status,state):undefined;
 const [rows,totals]=await Promise.all([
  db.select({id:saasInvoice.id,number:saasInvoice.number,tenantId:saasInvoice.tenantId,
   tenantName:tenant.name,amountMinor:saasInvoice.amountMinor,status:saasInvoice.status,
   periodStart:saasInvoice.periodStart,periodEnd:saasInvoice.periodEnd,
   dueAt:saasInvoice.dueAt,createdAt:saasInvoice.createdAt})
   .from(saasInvoice).innerJoin(tenant,eq(tenant.id,saasInvoice.tenantId))
   .where(where).orderBy(desc(saasInvoice.createdAt)).limit(20).offset((p-1)*20),
  db.select({n:count()}).from(saasInvoice).where(where)]);
 res.json({items:rows,total:totals[0]?.n??0,page:p,perPage:20});
}));
saasPlatformRouter.post("/invoices",route(async(req,res)=>{
 const a=await platformScope(req),b=record(req),id=value(b.tenantId,100,"Restaurant");
 const created=await db.transaction(async tx=>{
  await tx.execute(sql`SELECT id FROM tenants WHERE id=${id} FOR UPDATE`);
  const sub=await subscription(tx,id),start=now(),end=new Date(start.getTime()+sub.periodDays*86400000);
  const due=new Date(start.getTime()+14*86400000),invoiceId=randomUUID();
  const [invoice]=await tx.insert(saasInvoice).values({id:invoiceId,tenantId:id,planId:sub.planId,
   number:"INV-"+invoiceId.slice(0,12).toUpperCase(),periodStart:start,periodEnd:end,
   amountMinor:sub.priceMinor,dueAt:due,status:"draft"}).returning();
  await audit(tx,a.actorId,id,"saas.invoice_created",{invoiceId,planId:sub.planId,amountMinor:sub.priceMinor});
  return invoice;
 });
 res.status(201).json({invoice:created});
}));
saasPlatformRouter.post("/invoices/:id/:action",route(async(req,res)=>{
 const a=await platformScope(req),id=paramId(req),act=req.params.action;
 if(!["issue","void"].includes(act))fail(404,"NOT_FOUND","Action unavailable.");
 const reason=act==="void"?value(record(req).reason,200,"Void reason",5):"";
 await db.transaction(async tx=>{
  await tx.execute(sql`SELECT id FROM saas_invoices WHERE id=${id} FOR UPDATE`);
  const [invoice]=await tx.select().from(saasInvoice).where(eq(saasInvoice.id,id));
  if(!invoice)fail(404,"NOT_FOUND","Invoice unavailable.");
  if(act==="issue"&&invoice.status!=="draft"||act==="void"&&!["draft","issued"].includes(invoice.status))
   fail(409,"INVALID_STATE","Invoice cannot be "+act+"d.");
  await tx.update(saasInvoice).set(act==="issue"?{status:"issued",issuedAt:now()}:{status:"voided"})
   .where(eq(saasInvoice.id,id));
  await audit(tx,a.actorId,invoice.tenantId,"saas.invoice_"+act+"d",{invoiceId:id,reason});
 });
 res.json({updated:true});
}));
saasPlatformRouter.get("/payments",route(async(req,res)=>{
 await platformScope(req);
 const p=page(req.query.page),status=typeof req.query.status==="string"?req.query.status:"";
 const where=status?eq(saasPaymentClaim.status,status):undefined;
 const [items,total]=await Promise.all([
  db.select({id:saasPaymentClaim.id,tenantId:saasPaymentClaim.tenantId,
   invoiceId:saasPaymentClaim.invoiceId,invoiceNumber:saasInvoice.number,
   reference:saasPaymentClaim.reference,method:saasPaymentClaim.method,
   amountMinor:saasPaymentClaim.amountMinor,proofNote:saasPaymentClaim.proofNote,
   status:saasPaymentClaim.status,createdAt:saasPaymentClaim.createdAt})
   .from(saasPaymentClaim).innerJoin(saasInvoice,eq(saasPaymentClaim.invoiceId,saasInvoice.id))
   .where(where).orderBy(desc(saasPaymentClaim.createdAt)).limit(20).offset((p-1)*20),
  db.select({n:count()}).from(saasPaymentClaim).where(where)]);
 res.json({items,total:total[0]?.n??0,page:p,perPage:20});
}));
saasPlatformRouter.post("/payments/:id/review",route(async(req,res)=>{
 const a=await platformScope(req),id=paramId(req),b=record(req);
 const decision=choice(b.decision,["verify","reject"] as const,"decision"),
  reason=decision==="reject"?value(b.reason,300,"Rejection reason",5):
   typeof b.reason==="string"?b.reason.trim().slice(0,300):"";
 await db.transaction(async tx=>{
  const [claimRef]=await tx.select({invoiceId:saasPaymentClaim.invoiceId}).from(saasPaymentClaim).where(eq(saasPaymentClaim.id,id));
  if(!claimRef)fail(404,"NOT_FOUND","Proof unavailable.");
  await tx.execute(sql`SELECT id FROM saas_invoices WHERE id=${claimRef.invoiceId} FOR UPDATE`);
  await tx.execute(sql`SELECT id FROM saas_payment_claims WHERE id=${id} FOR UPDATE`);
  const [claim]=await tx.select().from(saasPaymentClaim).where(eq(saasPaymentClaim.id,id));
  const [invoice]=await tx.select().from(saasInvoice).where(eq(saasInvoice.id,claimRef.invoiceId));
  if(!claim||!invoice||claim.status!=="pending")fail(409,"INVALID_STATE","Proof was already reviewed.");
  if(decision==="verify"){
   if(invoice.status!=="issued"||claim.amountMinor!==invoice.amountMinor)
    fail(409,"AMOUNT_MISMATCH","Only a full exact amount can settle an issued invoice.");
   const [duplicate]=await tx.select({id:saasPaymentClaim.id}).from(saasPaymentClaim)
    .where(and(eq(saasPaymentClaim.status,"verified"),sql`lower(${saasPaymentClaim.reference})=lower(${claim.reference})`)).limit(1);
   if(duplicate)fail(409,"DUPLICATE_REFERENCE","This payment reference has already been verified.");
   await tx.update(saasInvoice).set({status:"paid",paidAt:now()}).where(eq(saasInvoice.id,invoice.id));
   await tx.update(saasSubscription).set({status:"active",paidUntil:invoice.periodEnd,
    graceEndsAt:null,updatedAt:now()}).where(eq(saasSubscription.tenantId,invoice.tenantId));
   await tx.update(tenant).set({status:"active"}).where(eq(tenant.id,invoice.tenantId));
  }
  await tx.update(saasPaymentClaim).set({status:decision==="verify"?"verified":"rejected",
   reviewedBy:a.actorId,reviewedAt:now(),reviewReason:reason||null}).where(eq(saasPaymentClaim.id,id));
  await audit(tx,a.actorId,invoice.tenantId,"saas.payment_"+(decision==="verify"?"verified":"rejected"),
   {claimId:id,invoiceId:invoice.id,amountMinor:claim.amountMinor,reason});
 });
 res.json({reviewed:true});
}));
saasPlatformRouter.get("/audit",route(async(req,res)=>{
 await platformScope(req);
 const p=page(req.query.page),q=typeof req.query.action==="string"?req.query.action.slice(0,80):"",
  tenantFilter=typeof req.query.tenantId==="string"?req.query.tenantId.slice(0,100):"",
  actorFilter=typeof req.query.actorId==="string"?req.query.actorId.slice(0,100):"";
 const safe=or(like(auditEvent.action,"saas.%"),like(auditEvent.action,"platform.%"));
 const where=and(safe,q?ilike(auditEvent.action,"%"+q+"%"):undefined,
  tenantFilter?eq(auditEvent.tenantId,tenantFilter):undefined,
  actorFilter?eq(auditEvent.userId,actorFilter):undefined);
 const [rows,total]=await Promise.all([
  db.select().from(auditEvent).where(where).orderBy(desc(auditEvent.createdAt))
   .limit(50).offset((p-1)*50),
  db.select({n:count()}).from(auditEvent).where(where)]);
 res.json({items:rows,total:total[0]?.n??0,page:p,perPage:50});
}));
saasPlatformRouter.get("/settings",route(async(req,res)=>{
 await platformScope(req);res.json({settings:await settings(db)});
}));
saasPlatformRouter.patch("/settings",route(async(req,res)=>{
 const a=await platformScope(req),b=record(req);
 const trialDays=positive(b.trialDays,90,"Trial days"),graceDays=positive(b.graceDays,30,"Grace days");
 if(!trialDays)fail(400,"INVALID_TRIAL","Trial must be between 1 and 90 days.");
 const supportContact=value(b.supportContact,150,"Support contact",0);
 const incidentBanner=value(b.incidentBanner,250,"Incident banner",0);
 const reason=value(b.reason,250,"Change reason",5);
 await db.transaction(async tx=>{
  const old=await settings(tx);
  await tx.update(saasPlatformSettings).set({trialDays,graceDays,supportContact,incidentBanner,updatedAt:now()})
   .where(eq(saasPlatformSettings.id,"default"));
  await audit(tx,a.actorId,null,"platform.settings_updated",{reason,old:{trialDays:old.trialDays,
   graceDays:old.graceDays},next:{trialDays,graceDays},incidentBannerChanged:old.incidentBanner!==incidentBanner});
 });
 res.json({saved:true});
}));
