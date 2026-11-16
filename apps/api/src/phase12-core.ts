
import {fromNodeHeaders} from "better-auth/node";
import {and,count,eq,gt,sql} from "drizzle-orm";
import {randomUUID} from "node:crypto";
import type {Request} from "express";
import {auth} from "./auth";
import {db} from "./db";
import {contextFor} from "./context";
import {auditEvent,diningTable,location,staffInvitation,tenant,tenantMembership} from "./schema";
import {saasPlan,saasPlatformSettings,saasSubscription} from "./phase12-schema";
import {fail,field,int} from "./menu-helpers";

export type Tx=Parameters<Parameters<typeof db.transaction>[0]>[0];
export type PlatformScope={actorId:string};
export type RestaurantScope={actorId:string;tenantId:string;role:string};
export async function identity(req:Request){
 const session=await auth.api.getSession({headers:fromNodeHeaders(req.headers)});
 if(!session)fail(401,"UNAUTHENTICATED","Sign in required.");
 const ctx=await contextFor({id:session.user.id,name:session.user.name,email:session.user.email});
 if(!ctx)fail(403,"ACCESS_DENIED","Access not available for this account.");
 return {id:session.user.id,ctx};
}
export async function platformScope(req:Request):Promise<PlatformScope>{
 const a=await identity(req);
 if(a.ctx.role!=="platform_admin")fail(403,"ACCESS_DENIED","Platform administrator only.");
 return {actorId:a.id};
}
export async function restaurantScope(req:Request,ownerOnly=false):Promise<RestaurantScope>{
 const a=await identity(req);
 if(!a.ctx.tenantId||!["owner","manager"].includes(a.ctx.role)||
   (ownerOnly&&a.ctx.role!=="owner"))
  fail(403,"ACCESS_DENIED",ownerOnly?"Only the restaurant owner may change this.":"Owner or manager required.");
 return {actorId:a.id,tenantId:a.ctx.tenantId,role:a.ctx.role};
}
export async function audit(tx:Tx,actorId:string,tenantId:string|null,action:string,details:Record<string,unknown>={}){
 await tx.insert(auditEvent).values({id:randomUUID(),userId:actorId,tenantId,action,details});
}
export function record(req:Request){
 if(!req.body||typeof req.body!=="object"||Array.isArray(req.body))
  fail(400,"INVALID_BODY","JSON object expected.");
 return req.body as Record<string,unknown>;
}
export function value(x:unknown,max:number,name:string,min=1){
 return field(x,max,name,min);
}
export function choice<T extends string>(x:unknown,allowed:readonly T[],name:string):T{
 if(typeof x!=="string"||!allowed.includes(x as T))fail(400,"INVALID_FIELD","Select a valid "+name+".");
 return x as T;
}
export function positive(x:unknown,max:number,name:string){
 return int(x,name,0,max);
}
export async function settings(tx:Tx|typeof db=db){
 const [s]=await tx.select().from(saasPlatformSettings).where(eq(saasPlatformSettings.id,"default")).limit(1);
 if(!s)fail(503,"SETUP_REQUIRED","Platform subscription policy was not initialized.");
 return s;
}
export async function subscription(tx:Tx|typeof db,tenantId:string){
 const [row]=await tx.select({status:saasSubscription.status,trialEndsAt:saasSubscription.trialEndsAt,
   paidUntil:saasSubscription.paidUntil,graceEndsAt:saasSubscription.graceEndsAt,
   planId:saasPlan.id,planName:saasPlan.name,planCode:saasPlan.code,planVersion:saasPlan.version,
   priceMinor:saasPlan.priceMinor,periodDays:saasPlan.periodDays,
   staffLimit:saasPlan.staffLimit,tableLimit:saasPlan.tableLimit,locationLimit:saasPlan.locationLimit})
  .from(saasSubscription).innerJoin(saasPlan,eq(saasSubscription.planId,saasPlan.id))
  .where(eq(saasSubscription.tenantId,tenantId)).limit(1);
 if(!row)fail(409,"SUBSCRIPTION_REQUIRED","Ask the platform to assign a subscription plan.");
 return row;
}
export function effectiveStatus(sub:Awaited<ReturnType<typeof subscription>>,graceDays:number,now=new Date()){
 if(sub.status==="suspended")return "suspended";
 // A zero-cost plan is free, not an invoice which can become overdue.
 if(sub.priceMinor===0)return sub.trialEndsAt&&sub.trialEndsAt>now&&sub.status==="trial"?"trial":"active";
 const end=sub.status==="trial"?sub.trialEndsAt:sub.paidUntil;
 if(!end)return sub.status==="grace"?"suspended":sub.status;
 if(end.getTime()>=now.getTime())return sub.status==="trial"?"trial":"active";
 const graceEnd=sub.graceEndsAt??new Date(end.getTime()+graceDays*86400000);
 return graceEnd.getTime()>now.getTime()?"grace":"suspended";
}
export async function assertMayOpenVisit(tx:Tx,tenantId:string){
 // Platform suspension and visit creation synchronize against this row.
 await tx.execute(sql`SELECT id FROM tenants WHERE id=${tenantId} FOR UPDATE`);
 const [org]=await tx.select({status:tenant.status}).from(tenant).where(eq(tenant.id,tenantId));
 if(!org||org.status==="suspended"||org.status==="rejected"||org.status==="pending")
  fail(409,"SUBSCRIPTION_SUSPENDED","New visits are paused. Existing visits remain available for settlement.");
 const sub=await subscription(tx,tenantId),config=await settings(tx);
 if(effectiveStatus(sub,config.graceDays)==="suspended")
  fail(409,"SUBSCRIPTION_EXPIRED","The subscription grace period ended. Contact the owner or platform.");
}
export async function enforceLimit(tx:Tx,tenantId:string,kind:"staff"|"tables"|"locations"){
 await tx.execute(sql`SELECT id FROM tenants WHERE id=${tenantId} FOR UPDATE`);
 const plan=await subscription(tx,tenantId);
 let used=0,limit=0;
 if(kind==="staff"){
  const [members]=await tx.select({n:count()}).from(tenantMembership)
   .where(and(eq(tenantMembership.tenantId,tenantId),eq(tenantMembership.status,"active")));
  const [pending]=await tx.select({n:count()}).from(staffInvitation)
   .where(and(eq(staffInvitation.tenantId,tenantId),eq(staffInvitation.status,"pending"),
    gt(staffInvitation.expiresAt,new Date())));
  used=(members?.n??0)+(pending?.n??0);limit=plan.staffLimit;
 }else if(kind==="tables"){
  const result=await tx.execute(sql`SELECT COUNT(*)::integer AS n FROM dining_tables
    WHERE tenant_id=${tenantId} AND archived_at IS NULL`);
  used=Number((result as unknown as {rows:Array<{n:number}>}).rows[0]?.n??0);
  limit=plan.tableLimit;
 }else{
  const [locations]=await tx.select({n:count()}).from(location).where(eq(location.tenantId,tenantId));
  used=locations?.n??0;limit=plan.locationLimit;
 }
 if(used>=limit)fail(409,"PLAN_LIMIT_REACHED",
   "This restaurant reached the "+kind+" limit ("+limit+"). Contact the owner to upgrade.");
 return {used,limit};
}
