import "dotenv/config";
import assert from "node:assert/strict";
import {and,eq,isNull} from "drizzle-orm";
import {db,pool} from "./db";
import {diningVisit,staffNotification,user} from "./schema";
if(process.env.NODE_ENV==="production"||!process.env.DEMO_PASSWORD)
 throw new Error("P26 needs disposable CI fixtures; production is forbidden.");
const URL=process.env.E2E_API_URL??"http://localhost:4000";
const password=process.env.DEMO_PASSWORD;
async function req(path:string,method="GET",cookie?:string){
 return fetch(URL+path,{method,headers:{Origin:"http://localhost:3000",
  "Content-Type":"application/json",...(cookie?{Cookie:cookie}:{})},
  body:method==="POST"?"{}":undefined});
}
async function login(email:string){
 const r=await req("/api/auth/sign-in/email","POST");
 // Always use a password, never rely on the unauthenticated probe above.
 void r;
 const result=await fetch(URL+"/api/auth/sign-in/email",{method:"POST",
  headers:{Origin:"http://localhost:3000","Content-Type":"application/json"},
  body:JSON.stringify({email,password})});
 assert.equal(result.status,200,"Failed sign-in "+email+" "+await result.text());
 return result.headers.getSetCookie().map(c=>c.split(";")[0]).join("; ");
}
async function main(){
 const waiter=await login("waiter-ci@example.test");
 const kitchen=await login("kitchen-ci@example.test");
 const owner=await login("owner-ci@example.test");
 const [actor]=await db.select({id:user.id}).from(user).where(eq(user.email,"waiter-ci@example.test")).limit(1);
 assert.ok(actor);
 const rows=await db.select({id:staffNotification.id,visitId:staffNotification.visitId})
  .from(staffNotification).innerJoin(diningVisit,eq(staffNotification.visitId,diningVisit.id))
  .where(and(eq(staffNotification.recipientId,actor.id),eq(diningVisit.waiterId,actor.id))).limit(1);
 assert.ok(rows.length,"Phase 6 should have created a ready-food inbox fixture");
 const row=rows[0]!;
 await db.update(staffNotification).set({readAt:null}).where(eq(staffNotification.id,row.id));
 assert.equal((await req("/api/orders/notifications/read-all","POST")).status,401);
 assert.equal((await req("/api/orders/notifications/read-all","POST",kitchen)).status,403);
 assert.equal((await req("/api/orders/notifications/read-all","POST",owner)).status,403);
 const before=await req("/api/orders/notifications?unread=1","GET",waiter);
 assert.equal(before.status,200);
 const beforeData=await before.json() as {items:{id:string}[];unread:number};
 assert.ok(beforeData.items.some(a=>a.id===row.id));
 const result=await req("/api/orders/notifications/read-all","POST",waiter);
 assert.equal(result.status,200);
 assert.match(result.headers.get("cache-control")??"",/no-store/);
 const resultData=await result.json() as {read:boolean;count:number};
 assert.equal(resultData.read,true);assert.ok(resultData.count>=1);
 const readAgain=await req("/api/orders/notifications/read-all","POST",waiter);
 assert.equal((await readAgain.json() as {count:number}).count,0,"Bulk read is idempotent");
 const after=await req("/api/orders/notifications?unread=1","GET",waiter);
 const afterData=await after.json() as {unread:number};
 assert.equal(afterData.unread,0);
 const [saved]=await db.select({readAt:staffNotification.readAt}).from(staffNotification)
  .where(eq(staffNotification.id,row.id)).limit(1);
 assert.ok(saved?.readAt,"Read state is persisted, not a fake client acknowledgement");
 // Existing explicit tenant and reassignment guards are covered by Phase 6 live suite.
 console.info("PASS P26 HTTP: auth/role restricted bulk read, durable unread filter, idempotency, no-store.");
}
main().then(async()=>{await pool.end();}).catch(async e=>{console.error(e);await pool.end();process.exitCode=1;});
