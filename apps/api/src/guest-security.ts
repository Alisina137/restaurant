import type {Request} from "express";
import {and,eq,gt,isNull,sql} from "drizzle-orm";
import {createHash,createHmac,randomBytes,randomUUID,timingSafeEqual} from "node:crypto";
import {db} from "./db";
import {diningTable,diningVisit,guestPinAttempt,guestVisitPin,guestVisitSession,
 guestRevision,restaurantSetting,tableQr,tenant,guestSubmission,auditEvent} from "./schema";
import {fail} from "./menu-helpers";
export type Tx=Parameters<Parameters<typeof db.transaction>[0]>[0];
export type GuestScope={actorId:string|null;tenantId:string;locationId:string;role:"guest";
 sessionId:string;visitId:string;tableId:string;qrVersion:number;pinGeneration:number;
 tenantName:string;tableLabel:string;slug:string;policy:"waiter_approval"|"direct_to_kitchen"};
const key=()=>{const s=process.env.GUEST_PIN_SECRET??process.env.BETTER_AUTH_SECRET;
 if(!s||s.length<32)fail(503,"PIN_SECRET_UNAVAILABLE","Visit code service has not been configured.");return s;};
export const hash=(x:string)=>createHash("sha256").update(x).digest("hex");
export const makeQr=()=>randomBytes(32).toString("base64url");
export function pinFor(visitId:string,generation:number){
 const bytes=createHmac("sha256",key()).update("dineflow:visit-pin:v1:"+visitId+":"+generation).digest();
 return String(bytes.readUInt32BE(0)%1_000_000).padStart(6,"0");
}
export async function ensurePin(tx:Tx,visit:{id:string;tenantId:string;locationId:string}){
 await tx.insert(guestVisitPin).values({visitId:visit.id,tenantId:visit.tenantId,
   locationId:visit.locationId,generation:1}).onConflictDoNothing();
 const [row]=await tx.select().from(guestVisitPin).where(eq(guestVisitPin.visitId,visit.id)).limit(1);
 if(!row)fail(503,"PIN_UNAVAILABLE","Could not create visit PIN.");return row;
}
export const entryURL=(slug:string,code:string)=>{
 const base=(process.env.PUBLIC_WEB_URL??"http://localhost:3000").replace(/\/+$/,"");
 return base+"/g/"+encodeURIComponent(slug)+"/t/"+encodeURIComponent(code);
};
export async function guestAccess(req:Request):Promise<GuestScope>{
 const header=req.header("authorization")??"";
 const match=/^Bearer ([A-Za-z0-9_-]{40,120})$/.exec(header);
 if(!match)fail(401,"GUEST_SESSION_REQUIRED","Verify the current table PIN to continue.");
 const [result]=await db.select({session:guestVisitSession,visit:diningVisit,
   code:guestVisitPin,qr:tableQr,restaurant:tenant,table:diningTable,
   setting:restaurantSetting}).from(guestVisitSession)
   .innerJoin(diningVisit,eq(guestVisitSession.visitId,diningVisit.id))
   .innerJoin(guestVisitPin,eq(guestVisitPin.visitId,guestVisitSession.visitId))
   .innerJoin(tableQr,eq(tableQr.tableId,guestVisitSession.tableId))
   .innerJoin(diningTable,eq(diningTable.id,guestVisitSession.tableId))
   .innerJoin(tenant,eq(tenant.id,guestVisitSession.tenantId))
   .innerJoin(restaurantSetting,eq(restaurantSetting.tenantId,guestVisitSession.tenantId))
   .where(eq(guestVisitSession.tokenHash,hash(match![1]!))).limit(1);
 if(!result||result.session.revokedAt||result.session.expiresAt<=new Date()||
   result.visit.status!=="open"||result.visit.tableId!==result.session.tableId||
   result.session.tenantId!==result.visit.tenantId||
   result.session.locationId!==result.visit.locationId||
   result.session.pinGeneration!==result.code.generation||
   result.session.qrVersion!==result.qr.version||
   !result.table.active||!!result.table.archivedAt||
   !["active","trial"].includes(result.restaurant.status))
    fail(401,"GUEST_SESSION_EXPIRED","This table session expired. Ask your waiter for the current PIN.");
 return {actorId:null,role:"guest",sessionId:result.session.id,visitId:result.session.visitId,
   tableId:result.session.tableId,tenantId:result.session.tenantId,locationId:result.session.locationId,
   qrVersion:result.qr.version,pinGeneration:result.code.generation,
   tenantName:result.restaurant.name,tableLabel:result.table.label,slug:result.restaurant.slug,
   policy:result.setting.orderingPolicy==="direct_to_kitchen"?"direct_to_kitchen":"waiter_approval"};
}
export async function bumpGuest(tx:Tx,scope:{tenantId:string;locationId:string}){
 await tx.insert(guestRevision).values({tenantId:scope.tenantId,locationId:scope.locationId,version:1})
 .onConflictDoUpdate({target:guestRevision.locationId,
   set:{version:sql`${guestRevision.version}+1`,changedAt:new Date()}});
}
export async function invalidateVisitSessions(tx:Tx,visitId:string,scope:{tenantId:string;locationId:string},reason:string){
 const now=new Date();
 await tx.update(guestVisitSession).set({revokedAt:now}).where(and(
   eq(guestVisitSession.visitId,visitId),eq(guestVisitSession.tenantId,scope.tenantId),
   isNull(guestVisitSession.revokedAt)));
 await tx.update(guestSubmission).set({status:"rejected",version:sql`${guestSubmission.version}+1`,
   rejectionReason:reason,decidedAt:now})
 .where(and(eq(guestSubmission.visitId,visitId),eq(guestSubmission.tenantId,scope.tenantId),
   eq(guestSubmission.status,"pending")));
 await bumpGuest(tx,scope);
}
async function attempt(tx:Tx,visitId:string,fingerprint:string,limit:number,pinMatched:boolean){
 const id=hash(visitId+"|"+fingerprint),now=new Date(),windowMs=10*60_000;
 await tx.insert(guestPinAttempt).values({id,visitId,fingerprint,failures:0,windowStarted:now})
   .onConflictDoNothing();
 await tx.execute(sql`SELECT id FROM guest_pin_attempts WHERE id=${id} FOR UPDATE`);
 const [state]=await tx.select().from(guestPinAttempt).where(eq(guestPinAttempt.id,id)).limit(1);
 if(!state)fail(503,"RATE_LIMIT_UNAVAILABLE","PIN verification unavailable.");
 if(state.lockedUntil&&state.lockedUntil>now)return {locked:true};
 const expired=now.getTime()-state.windowStarted.getTime()>windowMs;
 const failures=expired?0:state.failures;
 if(failures>=limit)return {locked:true};
 if(!pinMatched){
   const next=failures+1;
   await tx.update(guestPinAttempt).set({failures:next,windowStarted:expired?now:state.windowStarted,
     lockedUntil:next>=limit?new Date(now.getTime()+windowMs):null})
   .where(eq(guestPinAttempt.id,id));
   return {locked:next>=limit};
 }
 if(fingerprint!=="*")await tx.update(guestPinAttempt).set({failures:0,windowStarted:now,lockedUntil:null})
   .where(eq(guestPinAttempt.id,id));
 return {locked:false};
}
export async function verifyCode(req:Request,visit:{id:string;tenantId:string;locationId:string;tableId:string},
 qrVersion:number,pin:string){
 // Locks per-visit global limiter first, then per-fingerprint limiter, for stable lock order.
 const fingerprint=hash((req.ip??"unknown")+"|"+(req.get("user-agent")??"unknown").slice(0,250));
 const answer=await db.transaction(async tx=>{
   const state=await ensurePin(tx,visit);
   const expected=pinFor(visit.id,state.generation);
   const match=pin.length===6&&timingSafeEqual(Buffer.from(expected),Buffer.from(pin));
   const global=await attempt(tx,visit.id,"*",50,match);
   if(global.locked)return {status:429 as const};
   const local=await attempt(tx,visit.id,fingerprint,5,match);
   if(local.locked)return {status:429 as const};
   if(!match)return {status:401 as const};
   const raw=randomBytes(48).toString("base64url");
   const sessionId=randomUUID(),expiresAt=new Date(Date.now()+4*3600_000);
   await tx.insert(guestVisitSession).values({id:sessionId,tenantId:visit.tenantId,
     locationId:visit.locationId,tableId:visit.tableId,visitId:visit.id,tokenHash:hash(raw),
     qrVersion,pinGeneration:state.generation,expiresAt});
   return {status:200 as const,token:raw,expiresAt,sessionId};
 });
 if(answer.status===429)fail(429,"PIN_RATE_LIMITED","Too many attempts. Try again later or ask your waiter.");
 if(answer.status===401)fail(401,"INVALID_PIN","PIN incorrect. Ask your waiter for the current six-digit code.");
 return answer;
}
