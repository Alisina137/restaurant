import {Router,type Request} from "express";
import {fromNodeHeaders} from "better-auth/node";
import {randomUUID} from "node:crypto";
import {and,asc,count,desc,eq,gt,ilike,inArray,sql} from "drizzle-orm";
import {auth} from "./auth";
import {db} from "./db";
import {contextFor} from "./context";
import {bodyObject,fail,field,int,paramId,route} from "./menu-helpers";
import {auditEvent,invoiceProof,location,platformAdmin,platformSetting,restaurantSetting,
 subscriptionInvoice,subscriptionPlan,supportGrant,supportMessage,supportTicket,
 tenant,tenantMembership,tenantSubscription,tenantTrial,user} from "./schema";

type Tx=Parameters<Parameters<typeof db.transaction>[0]>[0];
type Actor={id:string;tenantId:string|null;role:string};
async function actor(req:Request,platform=false,owner=false):Promise<Actor>{
 const s=await auth.api.getSession({headers:fromNodeHeaders(req.headers)});
 if(!s)fail(401,"UNAUTHENTICATED","Sign in first.");
 const ctx=await contextFor({id:s.user.id,name:s.user.name,email:s.user.email});
 if(!ctx)fail(403,"ACCESS_DENIED","No active role.");
 if(platform){
  // Never allow a restaurant actor to masquerade as platform operator.
  const [admin]=await db.select({id:platformAdmin.userId}).from(platformAdmin).where(eq(platformAdmin.userId,s.user.id)).limit(1);
  if(!admin||ctx.role!=="platform_admin")fail(403,"ACCESS_DENIED","Platform administrators only.");
  return {id:s.user.id,tenantId:null,role:ctx.role};
 }
 if(!ctx.tenantId||!(owner?ctx.role==="owner":ctx.role==="owner"||ctx.role==="manager"))
  fail(403,"ACCESS_DENIED",owner?"Restaurant owner required.":"Owner or manager required.");
 return {id:s.user.id,tenantId:ctx.tenantId,role:ctx.role};
}
function audit(tx:Tx,a:Actor,tenantId:string|null,action:string,details:Record<string,unknown>={}){
 return tx.insert(auditEvent).values({id:randomUUID(),tenantId,userId:a.id,action,details});
}
function page(req:Request){const n=Number(req.query.page??1);return Number.isSafeInteger(n)&&n>0?Math.min(n,10000):1;}
function identity(req:Request){const id=req.params.id;if(typeof id!=="string"||id.length<1||id.length>100)fail(404,"NOT_FOUND","Not found.");return id;}
function amount(x:unknown){return int(x,"Amount in minor units",0,100_000_000);}
function method(x:unknown){if(x!=="cash"&&x!=="bank_transfer"&&x!=="mobile_money")fail(400,"INVALID_METHOD","Select a valid manual payment method.");return x;}
async function targetTenant(tx:Tx,id:string){
 const [row]=await tx.select({id:tenant.id,status:tenant.status,name:tenant.name}).from(tenant).where(eq(tenant.id,id)).limit(1);
 if(!row)fail(404,"NOT_FOUND","Restaurant unavailable.");
 return row;
}
function invoiceSnapshot(p:typeof subscriptionPlan.$inferSelect){
 return {name:p.name,planKey:p.planKey,version:p.version,periodDays:p.periodDays,
  priceMinor:p.priceMinor,maxTables:p.maxTables,maxStaff:p.maxStaff,maxLocations:p.maxLocations};
}
function validPlanKey(k:string){if(!/^[a-z][a-z0-9_-]{2,29}$/.test(k))fail(400,"INVALID_PLAN","Use a plan key of 3–30 lowercase characters.");return k;}
const daysMs=86_400_000;
export const tenantSaasRouter=Router();
export const platformSaasRouter=Router();

// Restaurant: clear billing state, immutable invoice snapshots, no phantom checkout.
tenantSaasRouter.get("/",route(async(req,res)=>{
 const a=await actor(req);const tenantId=a.tenantId!;
 const [org,sub,trial,invoices,prefs]=await Promise.all([
  db.select({name:tenant.name,status:tenant.status}).from(tenant).where(eq(tenant.id,tenantId)).limit(1),
  db.select().from(tenantSubscription).where(eq(tenantSubscription.tenantId,tenantId)).limit(1),
  db.select().from(tenantTrial).where(eq(tenantTrial.tenantId,tenantId)).limit(1),
  db.select({n:count()}).from(subscriptionInvoice).where(eq(subscriptionInvoice.tenantId,tenantId)),
  db.select().from(platformSetting).where(eq(platformSetting.id,"default")).limit(1)
 ]);
 const plan=sub[0]?.planId?(await db.select().from(subscriptionPlan).where(eq(subscriptionPlan.id,sub[0].planId!)).limit(1))[0]??null:null;
 const now=Date.now(),deadline=sub[0]?.status==="trial"?sub[0].trialEndsAt??trial[0]?.expiresAt:
  sub[0]?.status==="active"?sub[0].periodEnd:
  sub[0]?.status==="grace"?sub[0].graceEndsAt:null;
 res.setHeader("Cache-Control","no-store");
 res.json({restaurant:org[0]??null,subscription:sub[0]??null,plan,
  trialEndsAt:sub[0]?.trialEndsAt??trial[0]?.expiresAt??null,
  renewalAt:sub[0]?.periodEnd??null,canOpenNewVisits:org[0]?.status!=="suspended"&&
   org[0]?.status!=="rejected"&&org[0]?.status!=="pending"&&
   sub[0]?.status!=="suspended"&&(!deadline||deadline.getTime()>now),
  invoiceCount:invoices[0]?.n??0,
  instructions:"Submit manual payment reference and amount; a platform operator must verify it. There is no online payment gateway.",
  supportEmail:prefs[0]?.supportEmail??""});
}));
tenantSaasRouter.get("/invoices",route(async(req,res)=>{
 const a=await actor(req),p=page(req),tenantId=a.tenantId!;
 const where=eq(subscriptionInvoice.tenantId,tenantId);
 const [items,total]=await Promise.all([
  db.select().from(subscriptionInvoice).where(where).orderBy(desc(subscriptionInvoice.issuedAt))
    .limit(20).offset((p-1)*20),
  db.select({n:count()}).from(subscriptionInvoice).where(where)
 ]);
 res.setHeader("Cache-Control","no-store");
 res.json({items,total:total[0]?.n??0,page:p,perPage:20});
}));
tenantSaasRouter.post("/invoices/:id/proofs",route(async(req,res)=>{
 const a=await actor(req,false,true),x=bodyObject(req),invoiceId=identity(req),tenantId=a.tenantId!;
 const reference=field(x.reference,100,"Payment reference",4),payMethod=method(x.method),note=field(x.note??"",500,"Note");
 const result=await db.transaction(async tx=>{
  await tx.execute(sql`SELECT id FROM subscription_invoices WHERE id=${invoiceId} AND tenant_id=${tenantId} FOR UPDATE`);
  const [invoice]=await tx.select().from(subscriptionInvoice).where(and(eq(subscriptionInvoice.id,invoiceId),
    eq(subscriptionInvoice.tenantId,tenantId))).limit(1);
  if(!invoice)fail(404,"NOT_FOUND","Invoice not found.");
  if(invoice.status!=="issued")fail(409,"INVOICE_CLOSED","Invoice is already settled or voided.");
  const entered=amount(x.amountMinor);
  if(entered!==invoice.amountMinor||entered===0)
   fail(400,"AMOUNT_MISMATCH","Payment evidence amount must exactly equal the invoice.");
  const [existing]=await tx.select({id:invoiceProof.id}).from(invoiceProof)
   .where(and(eq(invoiceProof.invoiceId,invoiceId),eq(invoiceProof.status,"pending"))).limit(1);
  if(existing)fail(409,"PROOF_PENDING","An earlier proof awaits review.");
  const [row]=await tx.insert(invoiceProof).values({id:randomUUID(),tenantId,invoiceId,
   reference,method:payMethod,amountMinor:entered,note,submittedBy:a.id}).returning({id:invoiceProof.id});
  await audit(tx,a,tenantId,"subscription.proof_submitted",{invoiceId,proofId:row!.id});
  return row!;
 });
 res.status(201).json({id:result.id,status:"pending",message:"Submitted for manual platform verification. Invoice remains unpaid."});
}));
async function openTicket(tx:Tx,a:Actor,x:Record<string,unknown>){
 const tenantId=a.tenantId!,subject=field(x.subject,140,"Subject",5);
 const kind=x.kind;
 if(kind!=="billing"&&kind!=="technical"&&kind!=="account")
   fail(400,"INVALID_KIND","Select Billing, Technical, or Account.");
 const priority=x.priority==="high"?"high":"normal",body=field(x.message,2000,"Message",5);
 const [ticket]=await tx.insert(supportTicket).values({id:randomUUID(),tenantId,kind,priority,subject,createdBy:a.id})
  .returning({id:supportTicket.id});
 await tx.insert(supportMessage).values({id:randomUUID(),tenantId,ticketId:ticket!.id,actorId:a.id,body});
 await audit(tx,a,tenantId,"support.ticket_opened",{ticketId:ticket!.id,kind,priority});
 return ticket!.id;
}
tenantSaasRouter.post("/upgrade-request",route(async(req,res)=>{
 const a=await actor(req,false,true),x=bodyObject(req);
 const target=field(x.planKey,30,"Plan",3);
 const [p]=await db.select({id:subscriptionPlan.id}).from(subscriptionPlan)
  .where(and(eq(subscriptionPlan.planKey,target),eq(subscriptionPlan.active,true))).limit(1);
 if(!p)fail(404,"PLAN_MISSING","Requested plan is unavailable.");
 const id=await db.transaction(tx=>openTicket(tx,a,{
  kind:"billing",subject:"Subscription upgrade request",priority:"normal",
  message:"Requested plan: "+target+". "+field(x.message??"",300,"Message")
 }));
 res.status(201).json({id,message:"Upgrade request created; platform will review before any billing change."});
}));
tenantSaasRouter.get("/tickets",route(async(req,res)=>{
 const a=await actor(req),p=page(req),tenantId=a.tenantId!;
 const where=eq(supportTicket.tenantId,tenantId);
 const [items,total]=await Promise.all([
  db.select().from(supportTicket).where(where).orderBy(desc(supportTicket.createdAt)).limit(20).offset((p-1)*20),
  db.select({n:count()}).from(supportTicket).where(where)]);
 res.json({items,total:total[0]?.n??0,page:p,perPage:20});
}));
tenantSaasRouter.post("/tickets",route(async(req,res)=>{
 const a=await actor(req,false,true);
 const id=await db.transaction(tx=>openTicket(tx,a,bodyObject(req)));
 res.status(201).json({id});
}));
tenantSaasRouter.get("/tickets/:id",route(async(req,res)=>{
 const a=await actor(req),id=identity(req),tenantId=a.tenantId!;
 const [ticket]=await db.select().from(supportTicket).where(and(eq(supportTicket.id,id),eq(supportTicket.tenantId,tenantId))).limit(1);
 if(!ticket)fail(404,"NOT_FOUND","Support request unavailable.");
 const messages=await db.select({id:supportMessage.id,actorId:supportMessage.actorId,body:supportMessage.body,createdAt:supportMessage.createdAt})
  .from(supportMessage).where(and(eq(supportMessage.tenantId,tenantId),eq(supportMessage.ticketId,id)))
  .orderBy(asc(supportMessage.createdAt));
 res.json({ticket,messages});
}));
tenantSaasRouter.post("/tickets/:id/messages",route(async(req,res)=>{
 const a=await actor(req,false,true),id=identity(req),tenantId=a.tenantId!,body=field(bodyObject(req).body,2000,"Message",1);
 await db.transaction(async tx=>{
  const [ticket]=await tx.select().from(supportTicket)
   .where(and(eq(supportTicket.id,id),eq(supportTicket.tenantId,tenantId))).limit(1);
  if(!ticket)fail(404,"NOT_FOUND","Ticket unavailable.");
  if(ticket.status==="closed")fail(409,"TICKET_CLOSED","Ticket is closed.");
  await tx.insert(supportMessage).values({id:randomUUID(),tenantId,ticketId:id,actorId:a.id,body});
  await tx.update(supportTicket).set({updatedAt:new Date(),status:"open"}).where(eq(supportTicket.id,id));
  await audit(tx,a,tenantId,"support.message_created",{ticketId:id});
 });
 res.status(201).json({sent:true});
}));
tenantSaasRouter.get("/grants",route(async(req,res)=>{
 const a=await actor(req),tenantId=a.tenantId!;
 const items=await db.select().from(supportGrant).where(eq(supportGrant.tenantId,tenantId))
  .orderBy(desc(supportGrant.createdAt)).limit(50);
 res.json({items});
}));
tenantSaasRouter.post("/grants",route(async(req,res)=>{
 const a=await actor(req,false,true),x=bodyObject(req),tenantId=a.tenantId!;
 const scope=x.scope;
 if(scope!=="billing_metadata"&&scope!=="configuration_metadata")
  fail(400,"INVALID_SCOPE","Support scope is limited to billing/configuration metadata.");
 const reason=field(x.reason,280,"Reason",10);
 const minutes=int(x.minutes??30,"Minutes",1,60),expiry=new Date(Date.now()+minutes*60_000);
 const [r]=await db.transaction(async tx=>{
  const rows=await tx.insert(supportGrant).values({id:randomUUID(),tenantId,
   createdBy:a.id,scope,reason,expiresAt:expiry}).returning();
  await audit(tx,a,tenantId,"support.grant_created",{grantId:rows[0]!.id,scope,minutes});
  return rows;
 });
 res.status(201).json({id:r.id,expiresAt:r.expiresAt});
}));
tenantSaasRouter.post("/grants/:id/revoke",route(async(req,res)=>{
 const a=await actor(req,false,true),id=identity(req),tenantId=a.tenantId!;
 const [row]=await db.transaction(async tx=>{
  const rows=await tx.update(supportGrant).set({revokedAt:new Date()})
   .where(and(eq(supportGrant.id,id),eq(supportGrant.tenantId,tenantId),sql`${supportGrant.revokedAt} IS NULL`)).returning();
  if(!rows.length)fail(404,"NOT_FOUND","Active grant unavailable.");
  await audit(tx,a,tenantId,"support.grant_revoked",{grantId:id});
  return rows;
 });
 res.json({id:row.id,revokedAt:row.revokedAt});
}));

// Platform routes: restaurant private orders and money ledgers are never exposed.
platformSaasRouter.get("/overview",route(async(req,res)=>{
 await actor(req,true);
 const [all,trial,suspended,overdue,pendingProof,tickets,pendingRestaurants]=await Promise.all([
  db.select({n:count()}).from(tenant),db.select({n:count()}).from(tenant).where(eq(tenant.status,"trial")),
  db.select({n:count()}).from(tenant).where(eq(tenant.status,"suspended")),
  db.select({n:count()}).from(subscriptionInvoice).where(and(eq(subscriptionInvoice.status,"issued"),sql`${subscriptionInvoice.dueAt}<now()`)),
  db.select({n:count()}).from(invoiceProof).where(eq(invoiceProof.status,"pending")),
  db.select({n:count()}).from(supportTicket).where(inArray(supportTicket.status,["open","in_progress"])),
  db.select({n:count()}).from(tenant).where(eq(tenant.status,"pending"))
 ]);
 res.json({tenants:all[0]?.n??0,trials:trial[0]?.n??0,suspended:suspended[0]?.n??0,
  overdueInvoices:overdue[0]?.n??0,paymentReviews:pendingProof[0]?.n??0,
  openTickets:tickets[0]?.n??0,pendingRestaurants:pendingRestaurants[0]?.n??0});
}));
platformSaasRouter.get("/tenants",route(async(req,res)=>{
 await actor(req,true);const p=page(req),s=String(req.query.status??""),q=String(req.query.q??"").trim().slice(0,80);
 const where=and(["trial","active","suspended","pending","rejected"].includes(s)?eq(tenant.status,s):undefined,
  q?ilike(tenant.name,"%"+q.replace(/[%_]/g,"")+"%"):undefined);
 const [items,total]=await Promise.all([
  db.select({id:tenant.id,name:tenant.name,slug:tenant.slug,status:tenant.status,createdAt:tenant.createdAt,
   planId:tenantSubscription.planId,subscriptionStatus:tenantSubscription.status,
   periodEnd:tenantSubscription.periodEnd,trialEndsAt:tenantSubscription.trialEndsAt})
   .from(tenant).leftJoin(tenantSubscription,eq(tenant.id,tenantSubscription.tenantId))
   .where(where).orderBy(desc(tenant.createdAt),desc(tenant.id)).limit(20).offset((p-1)*20),
  db.select({n:count()}).from(tenant).where(where)
 ]);
 res.json({items,total:total[0]?.n??0,page:p,perPage:20});
}));
platformSaasRouter.get("/tenants/:id",route(async(req,res)=>{
 await actor(req,true);const id=identity(req);
 const [org]=await db.select().from(tenant).where(eq(tenant.id,id)).limit(1);
 if(!org)fail(404,"NOT_FOUND","Restaurant not found.");
 const [sub,branches,owners,invoices]=await Promise.all([
  db.select().from(tenantSubscription).where(eq(tenantSubscription.tenantId,id)).limit(1),
  db.select({id:location.id,name:location.name,city:location.city}).from(location).where(eq(location.tenantId,id)),
  db.select({name:user.name,email:user.email}).from(tenantMembership).innerJoin(user,eq(user.id,tenantMembership.userId))
   .where(and(eq(tenantMembership.tenantId,id),eq(tenantMembership.role,"owner"),eq(tenantMembership.status,"active"))),
  db.select({id:subscriptionInvoice.id,number:subscriptionInvoice.number,status:subscriptionInvoice.status,
   amountMinor:subscriptionInvoice.amountMinor,dueAt:subscriptionInvoice.dueAt}).from(subscriptionInvoice)
   .where(eq(subscriptionInvoice.tenantId,id)).orderBy(desc(subscriptionInvoice.issuedAt)).limit(20)
 ]);
 res.json({restaurant:org,subscription:sub[0]??null,locations:branches,owners,invoices});
}));
platformSaasRouter.post("/tenants/:id/status",route(async(req,res)=>{
 const a=await actor(req,true),id=identity(req),x=bodyObject(req);
 const action=x.action;if(!["suspend","grace","restore","approve","reject"].includes(String(action)))
  fail(400,"INVALID_ACTION","Choose suspend, grace, restore, approve, or reject.");
 const reason=field(x.reason,300,"Reason",5);
 const result=await db.transaction(async tx=>{
  await tx.execute(sql`SELECT id FROM tenants WHERE id=${id} FOR UPDATE`);
  const org=await targetTenant(tx,id);
  const [sub]=await tx.select().from(tenantSubscription).where(eq(tenantSubscription.tenantId,id)).limit(1);
  const [trial]=await tx.select().from(tenantTrial).where(eq(tenantTrial.tenantId,id)).limit(1);
  const [settings]=await tx.select().from(platformSetting).where(eq(platformSetting.id,"default")).limit(1);
  const now=new Date();
  let status="suspended",tenantStatus="suspended",changes:Record<string,unknown>={};
  if(action==="approve"||action==="reject"){
   if(org.status!=="pending")fail(409,"INVALID_STATE","Only pending restaurants can be reviewed.");
   status=action==="approve"?"trial":"suspended";
   tenantStatus=action==="approve"?"trial":"rejected";
   changes={suspensionReason:action==="reject"?reason:null};
  }else if(action==="grace"){
   if(!sub)fail(409,"NO_SUBSCRIPTION","Assign a plan before activating grace.");
   status="grace";tenantStatus="active";
   changes={graceEndsAt:new Date(Date.now()+(settings?.graceDays??7)*daysMs),suspensionReason:null};
  }else if(action==="restore"){
   if(!sub)fail(409,"NO_SUBSCRIPTION","Assign a valid plan first.");
   if(sub.periodEnd&&sub.periodEnd>now){status="active";tenantStatus="active";}
   else if((sub.trialEndsAt??trial?.expiresAt)&&((sub.trialEndsAt??trial?.expiresAt)!)>now){status="trial";tenantStatus="trial";}
   else if(sub.graceEndsAt&&sub.graceEndsAt>now){status="grace";tenantStatus="active";}
   else fail(409,"NO_PAID_PERIOD","A valid trial, paid invoice or active grace period is required to restore.");
   changes={suspensionReason:null};
  }else{status="suspended";tenantStatus="suspended";changes={suspensionReason:reason};}
  await tx.insert(tenantSubscription).values({tenantId:id,planId:sub?.planId??settings?.defaultPlanId??null,
   trialEndsAt:sub?.trialEndsAt??trial?.expiresAt??null,status,...changes})
   .onConflictDoUpdate({target:tenantSubscription.tenantId,set:{status,...changes,updatedAt:now}});
  await tx.update(tenant).set({status:tenantStatus}).where(eq(tenant.id,id));
  await audit(tx,a,id,"platform.tenant_"+String(action),{from:org.status,to:tenantStatus,reason});
  return {status:tenantStatus,subscriptionStatus:status};
 });
 res.json(result);
}));
platformSaasRouter.get("/plans",route(async(req,res)=>{
 await actor(req,true);
 const items=await db.select().from(subscriptionPlan).orderBy(asc(subscriptionPlan.planKey),desc(subscriptionPlan.version));
 res.json({items});
}));
platformSaasRouter.post("/plans",route(async(req,res)=>{
 const a=await actor(req,true),x=bodyObject(req),key=validPlanKey(field(x.planKey,30,"Plan key",3));
 const name=field(x.name,70,"Plan name",3),priceMinor=amount(x.priceMinor);
 const periodDays=int(x.periodDays,"Period days",1,365),
 maxTables=int(x.maxTables,"Table limit",1,10000),maxStaff=int(x.maxStaff,"Staff limit",1,2000);
 const maxLocations=int(x.maxLocations??1,"Location limit",1,1);
 const features=Array.isArray(x.features)?x.features.filter((z):z is string=>typeof z==="string"&&/^[a-z_]{2,35}$/.test(z)).slice(0,20):[];
 const result=await db.transaction(async tx=>{
  await tx.execute(sql`SELECT id FROM platform_settings WHERE id='default' FOR UPDATE`);
  const versions=await tx.select({version:subscriptionPlan.version}).from(subscriptionPlan)
   .where(eq(subscriptionPlan.planKey,key)).orderBy(desc(subscriptionPlan.version)).limit(1);
  const version=(versions[0]?.version??0)+1,id=randomUUID();
  await tx.insert(subscriptionPlan).values({id,planKey:key,version,name,priceMinor,periodDays,maxTables,maxStaff,maxLocations,features});
  await audit(tx,a,null,"platform.plan_version_created",{id,key,version,priceMinor});
  return {id,version};
 });
 res.status(201).json(result);
}));
platformSaasRouter.post("/tenants/:id/plan",route(async(req,res)=>{
 const a=await actor(req,true),tenantId=identity(req),x=bodyObject(req),planId=field(x.planId,100,"Plan",1);
 const result=await db.transaction(async tx=>{
  await tx.execute(sql`SELECT id FROM tenants WHERE id=${tenantId} FOR UPDATE`);
  await targetTenant(tx,tenantId);
  const [plan]=await tx.select().from(subscriptionPlan).where(and(eq(subscriptionPlan.id,planId),eq(subscriptionPlan.active,true))).limit(1);
  if(!plan)fail(404,"PLAN_NOT_FOUND","Plan version unavailable.");
  const [before]=await tx.select().from(tenantSubscription).where(eq(tenantSubscription.tenantId,tenantId)).limit(1);
  const [trial]=await tx.select().from(tenantTrial).where(eq(tenantTrial.tenantId,tenantId)).limit(1);
  const status=before?.status??"trial";
  await tx.insert(tenantSubscription).values({tenantId,planId,status,trialEndsAt:trial?.expiresAt??null})
   .onConflictDoUpdate({target:tenantSubscription.tenantId,set:{planId,updatedAt:new Date()}});
  await audit(tx,a,tenantId,"platform.plan_assigned",{before:before?.planId??null,planId});
  return {planId,status};
 });
 res.json(result);
}));
platformSaasRouter.get("/invoices",route(async(req,res)=>{
 await actor(req,true);const p=page(req),status=String(req.query.status??"");
 const where=["issued","paid","voided"].includes(status)?eq(subscriptionInvoice.status,status):undefined;
 const [items,total]=await Promise.all([
  db.select({id:subscriptionInvoice.id,tenantId:subscriptionInvoice.tenantId,tenantName:tenant.name,
   number:subscriptionInvoice.number,status:subscriptionInvoice.status,
   amountMinor:subscriptionInvoice.amountMinor,issuedAt:subscriptionInvoice.issuedAt,
   dueAt:subscriptionInvoice.dueAt,paidAt:subscriptionInvoice.paidAt,planSnapshot:subscriptionInvoice.planSnapshot})
   .from(subscriptionInvoice).innerJoin(tenant,eq(tenant.id,subscriptionInvoice.tenantId))
   .where(where).orderBy(desc(subscriptionInvoice.issuedAt),desc(subscriptionInvoice.id)).limit(20).offset((p-1)*20),
  db.select({n:count()}).from(subscriptionInvoice).where(where)]);
 res.json({items,total:total[0]?.n??0,page:p,perPage:20});
}));
platformSaasRouter.post("/invoices",route(async(req,res)=>{
 const a=await actor(req,true),x=bodyObject(req),tenantId=field(x.tenantId,100,"Restaurant",1);
 const planId=field(x.planId,100,"Plan",1),dueDays=int(x.dueDays??14,"Due days",1,90);
 const result=await db.transaction(async tx=>{
  await tx.execute(sql`SELECT id FROM tenants WHERE id=${tenantId} FOR UPDATE`);
  await targetTenant(tx,tenantId);
  const [plan]=await tx.select().from(subscriptionPlan).where(eq(subscriptionPlan.id,planId)).limit(1);
  if(!plan)fail(404,"PLAN_NOT_FOUND","Plan version unavailable.");
  const [sub]=await tx.select().from(tenantSubscription).where(eq(tenantSubscription.tenantId,tenantId)).limit(1);
  const start=sub?.periodEnd&&sub.periodEnd>new Date()?sub.periodEnd:new Date();
  const end=new Date(start.getTime()+plan.periodDays*daysMs);
  const id=randomUUID(),number="DF-"+new Date().toISOString().slice(0,7).replace("-","")+"-"+id.slice(0,8).toUpperCase();
  const [row]=await tx.insert(subscriptionInvoice).values({id,tenantId,planId,number,
   planSnapshot:invoiceSnapshot(plan),amountMinor:plan.priceMinor,currency:plan.currency,
   periodStart:start,periodEnd:end,dueAt:new Date(Date.now()+dueDays*daysMs),createdBy:a.id})
   .returning({id:subscriptionInvoice.id,number:subscriptionInvoice.number});
  await audit(tx,a,tenantId,"platform.invoice_issued",{invoiceId:id,planId,amountMinor:plan.priceMinor});
  return row!;
 });
 res.status(201).json(result);
}));
platformSaasRouter.post("/invoices/:id/void",route(async(req,res)=>{
 const a=await actor(req,true),id=identity(req),reason=field(bodyObject(req).reason,300,"Reason",5);
 await db.transaction(async tx=>{
  await tx.execute(sql`SELECT id FROM subscription_invoices WHERE id=${id} FOR UPDATE`);
  const [invoice]=await tx.select().from(subscriptionInvoice).where(eq(subscriptionInvoice.id,id)).limit(1);
  if(!invoice)fail(404,"NOT_FOUND","Invoice unavailable.");
  if(invoice.status!=="issued")fail(409,"INVOICE_CLOSED","Paid or voided invoice cannot be cancelled.");
  await tx.update(subscriptionInvoice).set({status:"voided"}).where(eq(subscriptionInvoice.id,id));
  await audit(tx,a,invoice.tenantId,"platform.invoice_voided",{invoiceId:id,reason});
 });
 res.json({voided:true});
}));
platformSaasRouter.get("/payments",route(async(req,res)=>{
 await actor(req,true);const p=page(req),status=String(req.query.status??"pending");
 const where=["pending","verified","rejected"].includes(status)?eq(invoiceProof.status,status):undefined;
 const [items,total]=await Promise.all([
  db.select({id:invoiceProof.id,tenantId:invoiceProof.tenantId,tenantName:tenant.name,
   invoiceId:invoiceProof.invoiceId,invoiceNumber:subscriptionInvoice.number,
   amountMinor:invoiceProof.amountMinor,method:invoiceProof.method,reference:invoiceProof.reference,note:invoiceProof.note,
   status:invoiceProof.status,createdAt:invoiceProof.createdAt,reviewedAt:invoiceProof.reviewedAt,
   reviewReason:invoiceProof.reviewReason})
   .from(invoiceProof).innerJoin(subscriptionInvoice,eq(subscriptionInvoice.id,invoiceProof.invoiceId))
   .innerJoin(tenant,eq(tenant.id,invoiceProof.tenantId))
   .where(where).orderBy(desc(invoiceProof.createdAt),desc(invoiceProof.id)).limit(20).offset((p-1)*20),
  db.select({n:count()}).from(invoiceProof).where(where)]);
 res.json({items,total:total[0]?.n??0,page:p,perPage:20});
}));
platformSaasRouter.post("/payments/:id/review",route(async(req,res)=>{
 const a=await actor(req,true),id=identity(req),x=bodyObject(req);
 if(x.decision!=="verify"&&x.decision!=="reject")fail(400,"INVALID_DECISION","Verify or reject.");
 const reason=field(x.reason,280,"Review reason",5);
 const result=await db.transaction(async tx=>{
  // Lock invoice first to serialize all proofs for the same invoice.
  const [lookup]=await tx.select({invoiceId:invoiceProof.invoiceId}).from(invoiceProof).where(eq(invoiceProof.id,id)).limit(1);
  if(!lookup)fail(404,"NOT_FOUND","Payment proof unavailable.");
  await tx.execute(sql`SELECT id FROM subscription_invoices WHERE id=${lookup.invoiceId} FOR UPDATE`);
  const [invoice]=await tx.select().from(subscriptionInvoice).where(eq(subscriptionInvoice.id,lookup.invoiceId)).limit(1);
  const [proof]=await tx.select().from(invoiceProof).where(eq(invoiceProof.id,id)).limit(1);
  if(!invoice||!proof||proof.tenantId!==invoice.tenantId)fail(404,"NOT_FOUND","Proof unavailable.");
  if(proof.status!=="pending")fail(409,"ALREADY_REVIEWED","This proof has already been reviewed.");
  if(invoice.status!=="issued")fail(409,"INVOICE_CLOSED","Invoice is no longer outstanding.");
  if(x.decision==="verify"){
   if(proof.amountMinor!==invoice.amountMinor||proof.amountMinor<=0)
    fail(409,"AMOUNT_MISMATCH","Proof must settle the exact invoice amount.");
   const [duplicate]=await tx.select({id:invoiceProof.id}).from(invoiceProof)
    .where(and(sql`lower(${invoiceProof.reference})=lower(${proof.reference})`,eq(invoiceProof.status,"verified"))).limit(1);
   if(duplicate)fail(409,"DUPLICATE_REFERENCE","Reference was previously verified. Investigate before confirming.");
   const [sub]=await tx.select().from(tenantSubscription)
    .where(eq(tenantSubscription.tenantId,invoice.tenantId)).limit(1);
   if(sub?.periodEnd && invoice.periodEnd < sub.periodEnd)
    fail(409,"STALE_INVOICE","A later paid subscription exists; review billing sequence.");
   await tx.update(subscriptionInvoice).set({status:"paid",paidAt:new Date()}).where(eq(subscriptionInvoice.id,invoice.id));
   await tx.insert(tenantSubscription).values({tenantId:invoice.tenantId,planId:invoice.planId,
    status:"active",periodEnd:invoice.periodEnd})
    .onConflictDoUpdate({target:tenantSubscription.tenantId,set:{planId:invoice.planId,status:"active",
      periodEnd:invoice.periodEnd,graceEndsAt:null,suspensionReason:null,updatedAt:new Date()}});
   await tx.update(tenant).set({status:"active"}).where(eq(tenant.id,invoice.tenantId));
  }
  await tx.update(invoiceProof).set({status:x.decision==="verify"?"verified":"rejected",
   reviewedBy:a.id,reviewedAt:new Date(),reviewReason:reason}).where(eq(invoiceProof.id,id));
  await audit(tx,a,invoice.tenantId,"platform.payment_"+String(x.decision),
   {invoiceId:invoice.id,proofId:id,reference:proof.reference,amountMinor:proof.amountMinor,reason});
  return {invoiceId:invoice.id,status:x.decision==="verify"?"paid":"issued"};
 });
 res.json(result);
}));
platformSaasRouter.get("/support/tickets",route(async(req,res)=>{
 await actor(req,true);const p=page(req),status=String(req.query.status??"");
 const where=["open","in_progress","resolved","closed"].includes(status)?eq(supportTicket.status,status):undefined;
 const [items,total]=await Promise.all([
  db.select({id:supportTicket.id,tenantId:supportTicket.tenantId,tenantName:tenant.name,
   subject:supportTicket.subject,kind:supportTicket.kind,priority:supportTicket.priority,
   status:supportTicket.status,createdAt:supportTicket.createdAt,updatedAt:supportTicket.updatedAt})
   .from(supportTicket).innerJoin(tenant,eq(tenant.id,supportTicket.tenantId))
   .where(where).orderBy(desc(supportTicket.createdAt)).limit(20).offset((p-1)*20),
  db.select({n:count()}).from(supportTicket).where(where)]);
 res.json({items,total:total[0]?.n??0,page:p,perPage:20});
}));
platformSaasRouter.get("/support/tickets/:id",route(async(req,res)=>{
 await actor(req,true);const id=identity(req);
 const [ticket]=await db.select().from(supportTicket).where(eq(supportTicket.id,id)).limit(1);
 if(!ticket)fail(404,"NOT_FOUND","Ticket unavailable.");
 const messages=await db.select({id:supportMessage.id,actorId:supportMessage.actorId,
   body:supportMessage.body,createdAt:supportMessage.createdAt}).from(supportMessage)
  .where(and(eq(supportMessage.ticketId,id),eq(supportMessage.tenantId,ticket.tenantId)))
  .orderBy(asc(supportMessage.createdAt));
 res.json({ticket,messages});
}));
platformSaasRouter.post("/support/tickets/:id",route(async(req,res)=>{
 const a=await actor(req,true),id=identity(req),x=bodyObject(req),status=x.status;
 if(!["open","in_progress","resolved","closed"].includes(String(status)))
  fail(400,"INVALID_STATUS","Choose a valid ticket status.");
 const response=field(x.message??"",2000,"Message");
 await db.transaction(async tx=>{
  const [ticket]=await tx.update(supportTicket).set({status:status as string,assignedTo:a.id,updatedAt:new Date()})
    .where(eq(supportTicket.id,id)).returning({tenantId:supportTicket.tenantId});
  if(!ticket)fail(404,"NOT_FOUND","Ticket unavailable.");
  if(response)await tx.insert(supportMessage).values({id:randomUUID(),tenantId:ticket.tenantId,ticketId:id,actorId:a.id,body:response});
  await audit(tx,a,ticket.tenantId,"platform.ticket_updated",{ticketId:id,status});
 });
 res.json({saved:true});
}));
platformSaasRouter.get("/support/grants",route(async(req,res)=>{
 await actor(req,true);
 const items=await db.select({id:supportGrant.id,tenantId:supportGrant.tenantId,tenantName:tenant.name,
  scope:supportGrant.scope,reason:supportGrant.reason,expiresAt:supportGrant.expiresAt,
  createdAt:supportGrant.createdAt,revokedAt:supportGrant.revokedAt})
  .from(supportGrant).innerJoin(tenant,eq(tenant.id,supportGrant.tenantId))
  .orderBy(desc(supportGrant.createdAt)).limit(50);
 res.json({items});
}));
platformSaasRouter.get("/support/grants/:id/metadata",route(async(req,res)=>{
 const a=await actor(req,true),id=identity(req);
 const result=await db.transaction(async tx=>{
  const [grant]=await tx.select().from(supportGrant)
   .where(and(eq(supportGrant.id,id),sql`${supportGrant.revokedAt} IS NULL`,gt(supportGrant.expiresAt,new Date()))).limit(1);
  if(!grant)fail(403,"GRANT_INACTIVE","Grant has expired or was revoked.");
  const [org]=await tx.select({name:tenant.name,status:tenant.status,slug:tenant.slug})
   .from(tenant).where(eq(tenant.id,grant.tenantId)).limit(1);
  const [settings]=grant.scope==="configuration_metadata"
    ?await tx.select({timezone:restaurantSetting.timezone,locale:restaurantSetting.locale})
      .from(restaurantSetting).where(eq(restaurantSetting.tenantId,grant.tenantId)).limit(1):[];
  const [subscription]=grant.scope==="billing_metadata"
    ?await tx.select({status:tenantSubscription.status,planId:tenantSubscription.planId,
      periodEnd:tenantSubscription.periodEnd}).from(tenantSubscription)
      .where(eq(tenantSubscription.tenantId,grant.tenantId)).limit(1):[];
  await audit(tx,a,grant.tenantId,"platform.support_metadata_viewed",{grantId:id,scope:grant.scope});
  return {tenantId:grant.tenantId,scope:grant.scope,expiresAt:grant.expiresAt,
    restaurant:org??null,settings:settings??null,subscription:subscription??null};
 });
 res.setHeader("Cache-Control","no-store");
 res.json(result);
}));
platformSaasRouter.get("/audit",route(async(req,res)=>{
 await actor(req,true);const p=page(req),q=String(req.query.action??"").slice(0,90);
 const where=and(sql`(${auditEvent.action} LIKE 'platform.%' OR ${auditEvent.action} LIKE 'subscription.%' OR ${auditEvent.action} LIKE 'support.%')`,
  q?ilike(auditEvent.action,"%"+q.replace(/[%_]/g,"")+"%"):undefined);
 const [items,total]=await Promise.all([
  db.select({id:auditEvent.id,actorId:auditEvent.userId,tenantId:auditEvent.tenantId,action:auditEvent.action,
   createdAt:auditEvent.createdAt}).from(auditEvent).where(where)
   .orderBy(desc(auditEvent.createdAt),desc(auditEvent.id)).limit(50).offset((p-1)*50),
  db.select({n:count()}).from(auditEvent).where(where)]);
 res.json({items,total:total[0]?.n??0,page:p,perPage:50});
}));
platformSaasRouter.get("/settings",route(async(req,res)=>{
 await actor(req,true);
 const [settings]=await db.select().from(platformSetting).where(eq(platformSetting.id,"default")).limit(1);
 res.json(settings??null);
}));
platformSaasRouter.patch("/settings",route(async(req,res)=>{
 const a=await actor(req,true),x=bodyObject(req);
 if(x.confirm!==true)fail(400,"CONFIRM_REQUIRED","Confirm platform policy changes.");
 const trialDays=int(x.trialDays,"Trial days",1,90),graceDays=int(x.graceDays,"Grace days",0,30);
 const incidentBanner=field(x.incidentBanner??"",300,"Incident banner");
 const supportEmail=field(x.supportEmail??"",254,"Support email");
 if(supportEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(supportEmail))
  fail(400,"INVALID_EMAIL","Provide a valid support email.");
 await db.transaction(async tx=>{
  const [before]=await tx.select().from(platformSetting).where(eq(platformSetting.id,"default")).limit(1);
  await tx.update(platformSetting).set({trialDays,graceDays,incidentBanner,supportEmail,updatedAt:new Date()})
   .where(eq(platformSetting.id,"default"));
  await audit(tx,a,null,"platform.settings_updated",{before:{trialDays:before?.trialDays,graceDays:before?.graceDays},
   after:{trialDays,graceDays},incidentBannerChanged:incidentBanner!==before?.incidentBanner});
 });
 res.json({saved:true});
}));
