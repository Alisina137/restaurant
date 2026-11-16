
import {Router} from "express";
import {and,count,desc,eq,sql} from "drizzle-orm";
import {randomUUID} from "node:crypto";
import {db} from "./db";
import {location,tenant,user} from "./schema";
import {saasSupportGrant,saasTicket,saasTicketMessage} from "./phase12-schema";
import {audit,choice,identity,record,value} from "./phase12-core";
import {fail,paramId,route} from "./menu-helpers";
export const saasSupportRouter=Router();
async function actor(req:import("express").Request){
 const a=await identity(req);
 const isPlatform=a.ctx.role==="platform_admin",isTenant=!!a.ctx.tenantId&&["owner","manager"].includes(a.ctx.role);
 if(!isPlatform&&!isTenant)fail(403,"ACCESS_DENIED","Support is for owners, managers and platform support.");
 return {userId:a.id,isPlatform,tenantId:a.ctx.tenantId,role:a.ctx.role};
}
saasSupportRouter.get("/tickets",route(async(req,res)=>{
 const a=await actor(req);
 const rows=await db.select().from(saasTicket)
  .where(a.isPlatform?undefined:eq(saasTicket.tenantId,a.tenantId!))
  .orderBy(desc(saasTicket.createdAt)).limit(100);
 res.json({items:rows});
}));
saasSupportRouter.post("/tickets",route(async(req,res)=>{
 const a=await actor(req),b=record(req);
 const target=a.isPlatform?(b.tenantId===null||b.tenantId===undefined?null:value(b.tenantId,100,"Tenant ID")):a.tenantId!;
 const category=choice(b.category,["billing","technical","account"] as const,"category");
 const priority=choice(b.priority??"normal",["low","normal","urgent"] as const,"priority");
 const subject=value(b.subject,160,"Subject",5),message=value(b.message,1800,"Message",5);
 const id=randomUUID();
 await db.transaction(async tx=>{
  if(target){
   const [org]=await tx.select({id:tenant.id}).from(tenant).where(eq(tenant.id,target));
   if(!org)fail(404,"NOT_FOUND","Restaurant unavailable.");
  }
  await tx.insert(saasTicket).values({id,tenantId:target,category,priority,subject,openedBy:a.userId});
  await tx.insert(saasTicketMessage).values({id:randomUUID(),ticketId:id,senderId:a.userId,body:message});
  await audit(tx,a.userId,target,"saas.support_ticket_created",{ticketId:id,category,priority});
 });
 res.status(201).json({id});
}));
saasSupportRouter.get("/tickets/:id",route(async(req,res)=>{
 const a=await actor(req),id=paramId(req);
 const [ticket]=await db.select().from(saasTicket).where(eq(saasTicket.id,id));
 if(!ticket||!a.isPlatform&&ticket.tenantId!==a.tenantId)fail(404,"NOT_FOUND","Ticket unavailable.");
 const messages=await db.select({id:saasTicketMessage.id,body:saasTicketMessage.body,
  senderId:saasTicketMessage.senderId,senderName:user.name,createdAt:saasTicketMessage.createdAt})
  .from(saasTicketMessage).innerJoin(user,eq(user.id,saasTicketMessage.senderId))
  .where(eq(saasTicketMessage.ticketId,id))
  .orderBy(saasTicketMessage.createdAt).limit(300);
 res.json({ticket,messages});
}));
saasSupportRouter.post("/tickets/:id/messages",route(async(req,res)=>{
 const a=await actor(req),id=paramId(req),body=value(record(req).body,1800,"Message",1);
 await db.transaction(async tx=>{
  await tx.execute(sql`SELECT id FROM saas_support_tickets WHERE id=${id} FOR UPDATE`);
  const [ticket]=await tx.select().from(saasTicket).where(eq(saasTicket.id,id));
  if(!ticket||!a.isPlatform&&ticket.tenantId!==a.tenantId)fail(404,"NOT_FOUND","Ticket unavailable.");
  if(ticket.status==="closed")fail(409,"TICKET_CLOSED","Closed tickets are read-only.");
  await tx.insert(saasTicketMessage).values({id:randomUUID(),ticketId:id,senderId:a.userId,body});
  await tx.update(saasTicket).set({updatedAt:new Date()}).where(eq(saasTicket.id,id));
  await audit(tx,a.userId,ticket.tenantId,"saas.ticket_message_sent",{ticketId:id});
 });
 res.status(201).json({sent:true});
}));
saasSupportRouter.post("/tickets/:id/status",route(async(req,res)=>{
 const a=await actor(req),id=paramId(req);
 if(!a.isPlatform)fail(403,"ACCESS_DENIED","Only platform support may change ticket state.");
 const status=choice(record(req).status,["open","in_progress","resolved","closed"] as const,"ticket status");
 await db.transaction(async tx=>{
  const [ticket]=await tx.update(saasTicket).set({status,updatedAt:new Date()})
   .where(eq(saasTicket.id,id)).returning();
  if(!ticket)fail(404,"NOT_FOUND","Ticket unavailable.");
  await audit(tx,a.userId,ticket.tenantId,"saas.ticket_state_changed",{ticketId:id,status});
 });
 res.json({status});
}));
saasSupportRouter.get("/grants",route(async(req,res)=>{
 const a=await actor(req);
 const rows=await db.select().from(saasSupportGrant)
  .where(a.isPlatform?undefined:eq(saasSupportGrant.tenantId,a.tenantId!))
  .orderBy(desc(saasSupportGrant.createdAt)).limit(100);
 // No requester-private platform data beyond authenticated tenant and operator identity.
 res.json({items:rows});
}));
saasSupportRouter.post("/grants",route(async(req,res)=>{
 const a=await actor(req);
 if(!a.isPlatform)fail(403,"ACCESS_DENIED","Platform support requests temporary metadata access.");
 const b=record(req),tenantId=value(b.tenantId,100,"Restaurant ID"),
  reason=value(b.reason,300,"Access reason",10);
 const [org]=await db.select({id:tenant.id}).from(tenant).where(eq(tenant.id,tenantId));
 if(!org)fail(404,"NOT_FOUND","Restaurant unavailable.");
 const id=randomUUID();
 await db.transaction(async tx=>{
  await tx.insert(saasSupportGrant).values({id,tenantId,requestedBy:a.userId,reason,scope:"metadata"});
  await audit(tx,a.userId,tenantId,"saas.support_access_requested",{grantId:id,scope:"metadata",reason});
 });
 res.status(201).json({id,status:"pending"});
}));
saasSupportRouter.post("/grants/:id/review",route(async(req,res)=>{
 const a=await actor(req),id=paramId(req);
 if(a.role!=="owner"||!a.tenantId)fail(403,"ACCESS_DENIED","Only the tenant owner can approve support access.");
 const decision=choice(record(req).decision,["approve","reject","revoke"] as const,"decision");
 await db.transaction(async tx=>{
  await tx.execute(sql`SELECT id FROM saas_support_grants WHERE id=${id} FOR UPDATE`);
  const [grant]=await tx.select().from(saasSupportGrant).where(eq(saasSupportGrant.id,id));
  if(!grant||grant.tenantId!==a.tenantId)fail(404,"NOT_FOUND","Grant unavailable.");
  if(decision==="revoke"&&grant.status!=="approved"||decision!=="revoke"&&grant.status!=="pending")
   fail(409,"INVALID_STATE","Grant is not in the required state.");
  const time=new Date();
  await tx.update(saasSupportGrant).set(decision==="approve"?
   {status:"approved",approvedBy:a.userId,approvedAt:time,expiresAt:new Date(time.getTime()+3600000)}:
   decision==="reject"?{status:"rejected",approvedBy:a.userId}:
   {status:"revoked",revokedAt:time}).where(eq(saasSupportGrant.id,id));
  await audit(tx,a.userId,a.tenantId,"saas.support_access_"+decision,{grantId:id});
 });
 res.json({status:decision==="approve"?"approved":decision==="reject"?"rejected":"revoked"});
}));
saasSupportRouter.get("/grants/:id/metadata",route(async(req,res)=>{
 const a=await actor(req),id=paramId(req);
 if(!a.isPlatform)fail(403,"ACCESS_DENIED","Platform staff only.");
 // Serializable security decision: revoke and metadata retrieval lock the same grant row.
 const data=await db.transaction(async tx=>{
  await tx.execute(sql`SELECT id FROM saas_support_grants WHERE id=${id} FOR UPDATE`);
  const [grant]=await tx.select().from(saasSupportGrant).where(eq(saasSupportGrant.id,id));
  if(!grant||grant.requestedBy!==a.userId||grant.status!=="approved"||
   !grant.expiresAt||grant.expiresAt<=new Date())
   fail(403,"ACCESS_EXPIRED","Grant missing, expired or revoked.");
  const [org,locs]=await Promise.all([
   tx.select({name:tenant.name,status:tenant.status,slug:tenant.slug}).from(tenant)
    .where(eq(tenant.id,grant.tenantId)).limit(1),
   tx.select({n:count()}).from(location).where(eq(location.tenantId,grant.tenantId))]);
  await audit(tx,a.userId,grant.tenantId,"saas.support_metadata_accessed",{grantId:id,scope:"metadata"});
  return {restaurant:org[0]??null,locations:locs[0]?.n??0,expiresAt:grant.expiresAt};
 });
 res.setHeader("Cache-Control","no-store");
 res.json(data);
}));
