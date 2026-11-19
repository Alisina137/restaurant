import "dotenv/config";
import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import {and,eq,isNull} from "drizzle-orm";
import {db,pool} from "./db";
import {diningSection,user} from "./schema";
if(process.env.NODE_ENV==="production"||!process.env.DEMO_PASSWORD)
 throw Error("P32 tests require seeded disposable nonproduction PostgreSQL.");
const base=process.env.E2E_API_URL??"http://localhost:4000",password=process.env.DEMO_PASSWORD;
async function request(path:string,method="GET",body?:unknown,cookie?:string){
 return fetch(base+path,{method,headers:{
  "Content-Type":"application/json",Origin:"http://localhost:3000",...(cookie?{Cookie:cookie}:{})},
  body:body===undefined?undefined:JSON.stringify(body)});
}
async function expect<T>(reply:Response,status:number):Promise<T>{
 const text=await reply.text();assert.equal(reply.status,status,text);
 return JSON.parse(text) as T;
}
async function login(email:string){
 for(let attempt=0;attempt<7;attempt++){
  const r=await request("/api/auth/sign-in/email","POST",{email,password});
  if(r.status===429){await new Promise(done=>setTimeout(done,11000));continue;}
  assert.equal(r.status,200,email+": "+await r.text());
  return r.headers.getSetCookie().map(c=>c.split(";")[0]).join("; ");
 }
 throw Error("P32 sign in throttled");
}
type Pulse={tenantId:string;locationId:string;minutes:number;from:string;checkedAt:string;
 evidence:string;pilotCertified:boolean;acceptedWindow:number;observedWindow:number;
 activeTickets:number;activeWithoutReport:number;pickupPending:number;
 openVisits:number;openChecks:number;openCashierShifts:number;
 activeTables:number;publishedItems:number;pendingOutbox:number;
 oldestPendingOutboxAt:string|null;oldestPendingOutboxAgeSeconds:number|null;
 oldestUnreportedAt:string|null;measurement:string};
async function main(){
 const [owner,waiter,kitchen,cashier,platform,other]=await Promise.all([
  login("owner-ci@example.test"),login("waiter-ci@example.test"),
  login("kitchen-ci@example.test"),login("cashier-ci@example.test"),
  login("platform-ci@example.test"),login("new-owner-ci@example.test")
 ]);
 const endpoint="/api/pilot/operations?minutes=60";
 const anonymous=await request(endpoint);
 assert.equal(anonymous.status,401);
 for(const token of [waiter,kitchen,cashier,platform])
  assert.equal((await request(endpoint,"GET",undefined,token)).status,403);
 for(const minutes of ["0","15","59","120","360.5","abc","9999"])
  assert.equal((await request("/api/pilot/operations?minutes="+minutes,
   "GET",undefined,owner)).status,400,minutes);
 const beforeReply=await request(endpoint,"GET",undefined,owner);
 assert.equal(beforeReply.status,200);
 assert.match(beforeReply.headers.get("cache-control")??"",/no-store/);
 const before=await beforeReply.json() as Pulse;
 assert.equal(before.tenantId,"dev-restaurant");
 assert.equal(before.evidence,"tenant_scoped_database_snapshot");
 assert.equal(before.pilotCertified,false);
 assert.ok(before.acceptedWindow>=before.observedWindow);
 assert.ok(before.activeTickets>=before.activeWithoutReport);
 assert.ok(before.activeTickets>=before.pickupPending);
 assert.ok(before.measurement.includes("NOT")||before.measurement.includes("NOT"));
 assert.ok(Number.isFinite(Date.parse(before.checkedAt)));
 for(const key of ["activeTickets","acceptedWindow","observedWindow","openVisits",
  "openChecks","openCashierShifts","activeTables","publishedItems","pendingOutbox"] as const)
  assert.ok(Number.isSafeInteger(before[key])&&before[key]>=0,key+" must be a real count");
 const otherPulse=await expect<Pulse>(await request(endpoint,"GET",undefined,other),200);
 assert.notEqual(otherPulse.tenantId,before.tenantId);
 assert.notEqual(otherPulse.locationId,before.locationId);
 assert.equal(otherPulse.pilotCertified,false);
 const pilotBefore=await expect<{fingerprint:string;status:string}>(
  await request("/api/pilot","GET",undefined,owner),200);
 const [section]=await db.select({id:diningSection.id}).from(diningSection)
  .where(and(eq(diningSection.tenantId,"dev-restaurant"),eq(diningSection.active,true),
   isNull(diningSection.archivedAt))).limit(1);
 const [actor]=await db.select({id:user.id}).from(user)
  .where(eq(user.email,"waiter-ci@example.test")).limit(1);
 assert.ok(section&&actor,"Seeded section and waiter required");
 const suffix=randomUUID().slice(0,8),label="P32"+suffix;
 const table=await expect<{id:string}>(await request("/api/floor/tables","POST",{
  sectionId:section.id,label,seats:3,sortOrder:66,notes:"P32 pilot metrics test",
  active:true,assignedWaiterId:actor.id
 },owner),201);
 const visit=await expect<{visit:{id:string}}>(await request(
  "/api/floor/visits/tables/"+table.id+"/open","POST",{partySize:2},waiter),201);
 const category=await expect<{id:string}>(await request("/api/menu/categories","POST",{
  nameFa:"آزمایش "+suffix,namePs:"ازموینه "+suffix,
  nameEn:"P32 "+suffix,description:"",sortOrder:65,published:true
 },owner),201);
 const item=await expect<{id:string}>(await request("/api/menu/items","POST",{
  categoryId:category.id,nameFa:"خوراک عملیاتی",namePs:"عملياتي خواړه",
  nameEn:"P32 Test Meal",description:"",sku:"P32-"+suffix,
  priceMinor:12600,imageId:null,allergens:[],preparationMinutes:6,
  sortOrder:0,published:true,groupIds:[]
 },owner),201);
 const catalog=await expect<{items:{id:string;version:number}[]}>(
  await request("/api/menu/catalog","GET",undefined,waiter),200);
 const dish=catalog.items.find(x=>x.id===item.id);assert.ok(dish);
 const round=await expect<{round:{id:string};ticket:{id:string;version:number}}>(
  await request("/api/orders/visits/"+visit.visit.id+"/rounds","POST",{
   idempotencyKey:"p32_"+randomUUID().replaceAll("-",""),
   note:"Pilot metrics observation",lines:[{itemId:item.id,
    itemVersion:dish.version,quantity:1,note:"No peanuts",selections:[]}]
  },waiter),201);
 const after=await expect<Pulse>(await request(endpoint,"GET",undefined,owner),200);
 assert.equal(after.acceptedWindow,before.acceptedWindow+1);
 assert.equal(after.observedWindow,before.observedWindow,
  "Reading pilot snapshot must never manufacture a foreground render");
 assert.equal(after.activeTickets,before.activeTickets+1);
 assert.equal(after.activeWithoutReport,before.activeWithoutReport+1);
 assert.equal(after.openVisits,before.openVisits+1);
 assert.equal(after.activeTables,before.activeTables+1);
 assert.equal(after.publishedItems,before.publishedItems+1);
 assert.equal(after.tenantId,before.tenantId);
 const stillOther=await expect<Pulse>(await request(endpoint,"GET",undefined,other),200);
 assert.equal(stillOther.acceptedWindow,otherPulse.acceptedWindow);
 assert.equal(stillOther.openVisits,otherPulse.openVisits);
 const ack=await expect<{accepted:number;submitted:number}>(await request(
  "/api/orders/kitchen/display-observed","POST",{ticketIds:[round.ticket.id]},kitchen),200);
 assert.deepEqual(ack,{accepted:1,submitted:1});
 const observed=await expect<Pulse>(await request(endpoint,"GET",undefined,owner),200);
 assert.equal(observed.acceptedWindow,after.acceptedWindow);
 assert.equal(observed.observedWindow,after.observedWindow+1);
 assert.equal(observed.activeWithoutReport,after.activeWithoutReport-1);
 assert.equal(observed.pilotCertified,false);
 for(const period of [180,360]){
  const p=await expect<Pulse>(await request(
   "/api/pilot/operations?minutes="+period,"GET",undefined,owner),200);
  assert.equal(p.minutes,period);assert.ok(p.acceptedWindow>=1);
 }
 const pilotAfter=await expect<{fingerprint:string;status:string}>(
  await request("/api/pilot","GET",undefined,owner),200);
 assert.deepEqual(pilotAfter,pilotBefore,
  "Telemetry and operator readiness reads must never affect manual pilot signatures");
 console.info("PASS P32 live: owner-only scoped signals, 3 windows, accepted/observed counts, open floor and setup metrics, no fake signoff, cross-tenant role isolation.");
}
main().then(async()=>{await pool.end();}).catch(async err=>{
 console.error(err);await pool.end();process.exitCode=1;
});
