import "dotenv/config";
import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import {performance} from "node:perf_hooks";
import {and,eq,isNull} from "drizzle-orm";
import {db,pool} from "./db";
import {diningSection,subscriptionPlan,tenantSubscription,user} from "./schema";
/**
 * Opt-in P31 disposable load rehearsal, NEVER on production or a shared DB.
 * Generates 20 fresh tables and 200 real order rounds via 10 bounded parallel
 * HTTP workers. Workers share a seeded waiter identity: they are NOT 10 devices.
 * Browser paint/physical Wi-Fi/receipt hardware are explicitly not simulated.
 */
const conn=new URL(process.env.DATABASE_URL??"postgresql://invalid@invalid/invalid");
const address=new URL(process.env.E2E_API_URL??"http://localhost:4000");
if(process.env.ALLOW_DISPOSABLE_LOAD_REHEARSAL!=="true"||
 process.env.NODE_ENV==="production"||
 !["localhost","127.0.0.1"].includes(conn.hostname)||
 conn.pathname!=="/dineflow_ci"||
 !["localhost","127.0.0.1"].includes(address.hostname)||
 address.protocol!=="http:"||!process.env.DEMO_PASSWORD)
 throw Error("P31 load rehearsal requires ALLOW_DISPOSABLE_LOAD_REHEARSAL=true, localhost API and PostgreSQL dineflow_ci disposable database.");
const password=process.env.DEMO_PASSWORD;
const base=address.origin;
async function request(path:string,method="GET",body?:unknown,cookie?:string){
 const before=performance.now();
 const response=await fetch(base+path,{method,headers:{"Content-Type":"application/json",
  Origin:"http://localhost:3000",...(cookie?{Cookie:cookie}:{})},
  body:body===undefined?undefined:JSON.stringify(body)});
 return {response,elapsed:performance.now()-before};
}
async function expect<T>(result:{response:Response;elapsed:number},status:number):Promise<T>{
 const data=await result.response.json() as T;
 assert.equal(result.response.status,status,JSON.stringify(data));
 return data;
}
async function login(email:string){
 for(let attempt=0;attempt<7;attempt++){
  const result=await request("/api/auth/sign-in/email","POST",{email,password});
  if(result.response.status===429){await new Promise(resolve=>setTimeout(resolve,11000));continue;}
  assert.equal(result.response.status,200,email+": "+await result.response.text());
  return result.response.headers.getSetCookie().map(c=>c.split(";")[0]).join("; ");
 }
 throw Error("P31 staging test sign-in throttled");
}
type Round={created:boolean;round:{id:string;roundNumber:number};
 ticket:{id:string;version:number;status:string}};
type Page={total:number;perPage:number;items:{ticketId:string;id:string}[]};
type GapPage={total:number;items:{ticketId:string}[];perPage:number};
type Changes={events:{cursor:number;eventType:string;roundId:string}[];
 nextCursor:number;hasMore:boolean};
function percentile(samples:number[],quantile:number){
 const sorted=[...samples].sort((a,b)=>a-b);
 if(!sorted.length)return null;
 return Math.round(sorted[Math.ceil(quantile*sorted.length)-1]!);
}
async function main(){
 const [owner,waiter,kitchen]=await Promise.all([
  login("owner-ci@example.test"),login("waiter-ci@example.test"),
  login("kitchen-ci@example.test")]);
 const [section]=await db.select({id:diningSection.id}).from(diningSection)
  .where(and(eq(diningSection.tenantId,"dev-restaurant"),eq(diningSection.active,true),
   isNull(diningSection.archivedAt))).limit(1);
 const [actor]=await db.select({id:user.id}).from(user)
  .where(eq(user.email,"waiter-ci@example.test")).limit(1);
 assert.ok(section&&actor,"Fixture requires seeded active section and waiter.");
 const suffix=randomUUID().slice(0,8),prefix="LOAD31"+suffix;
 const category=await expect<{id:string}>(await request("/api/menu/categories","POST",{
  nameFa:"آزمایش "+suffix,namePs:"ازموینه "+suffix,
  nameEn:"P31 Load "+suffix,description:"",sortOrder:99,published:true},owner),201);
 const item=await expect<{id:string}>(await request("/api/menu/items","POST",{
  categoryId:category.id,nameFa:"غذای آزمایشی",namePs:"ازمایښتي خواړه",
  nameEn:"P31 Load Dish",description:"Disposable rehearsal",sku:"P31L-"+suffix,
  priceMinor:10000,imageId:null,allergens:[],preparationMinutes:9,
  sortOrder:0,published:true,groupIds:[]
 },owner),201);
 const catalog=await expect<{items:{id:string;version:number}[]}>(
  await request("/api/menu/catalog","GET",undefined,waiter),200);
 const dish=catalog.items.find(x=>x.id===item.id);
 assert.ok(dish,"Load fixture menu item missing from live catalog");
 const [baseline]=await db.select({planId:tenantSubscription.planId})
  .from(tenantSubscription).where(eq(tenantSubscription.tenantId,"dev-restaurant")).limit(1);
 const originalPlan=baseline?.planId?
  (await db.select({maxTables:subscriptionPlan.maxTables}).from(subscriptionPlan)
   .where(eq(subscriptionPlan.id,baseline.planId)).limit(1))[0]:null;
 // Temporary development-fixture accommodation on this strictly disposable DB.
 // Restore even if a staged HTTP request fails.
 if(originalPlan&&originalPlan.maxTables<1000)
  await db.update(subscriptionPlan).set({maxTables:1000})
   .where(eq(subscriptionPlan.id,baseline!.planId!));
 try{
  const tables:{id:string;visitId:string;label:string}[]=[];
  for(let i=0;i<20;i++){
   const label=prefix+"-"+String(i+1).padStart(2,"0");
   const table=await expect<{id:string}>(await request("/api/floor/tables","POST",{
    sectionId:section.id,label,seats:4,sortOrder:30+i,
    notes:"P31 disposable staging rehearsal",active:true,assignedWaiterId:actor.id},owner),201);
   const visit=await expect<{visit:{id:string}}>(await request(
    "/api/floor/visits/tables/"+table.id+"/open","POST",{partySize:2},waiter),201);
   tables.push({id:table.id,visitId:visit.visit.id,label});
  }
  assert.equal(tables.length,20);
  const baselineCursor=await expect<{cursor:number}>(await request(
   "/api/orders/kitchen/watermark","GET",undefined,kitchen),200);
  const started=performance.now(),latencies:number[]=[];
  const rounds:Round[]=[];
  const workers=Array.from({length:10},async(_value,client)=>{
   const work:Round[]=[];
   for(let table=0;table<20;table++){
    const result=await request(
     "/api/orders/visits/"+tables[table]!.visitId+"/rounds","POST",{
     idempotencyKey:"p31load_"+randomUUID().replaceAll("-",""),
     note:"P31 staging worker "+client+" table "+table,
     lines:[{itemId:item.id,itemVersion:dish.version,quantity:1,
      note:"No salt",selections:[]}]
    },waiter);
    latencies.push(result.elapsed);
    work.push(await expect<Round>(result,201));
   }
   return work;
  });
  const finished=await Promise.all(workers);
  rounds.push(...finished.flat());
  const duration=Math.round(performance.now()-started);
  assert.equal(rounds.length,200);
  assert.ok(rounds.every(r=>r.created&&r.ticket.status==="new"));
  assert.equal(new Set(rounds.map(r=>r.round.id)).size,200);
  assert.equal(new Set(rounds.map(r=>r.ticket.id)).size,200);
  const byTable=new Map<number,number[]>();
  for(let worker=0;worker<10;worker++)for(let table=0;table<20;table++){
   const result=finished[worker]![table]!;
   byTable.set(table,[...(byTable.get(table)??[]),result.round.roundNumber]);
  }
  for(let table=0;table<20;table++)
   assert.deepEqual(byTable.get(table)!.sort((a,b)=>a-b),
    Array.from({length:10},(_,n)=>n+1),"Visit rounds numbered without collision "+table);
  const seen=new Set<string>();
  for(let page=1;page<=20;page++){
   const q=await expect<Page>(await request("/api/orders/kitchen/cards?status=new&page="+page+
    "&table="+encodeURIComponent(prefix),"GET",undefined,kitchen),200);
   assert.equal(q.total,200);assert.equal(q.perPage,10);assert.equal(q.items.length,10);
   for(const x of q.items)assert.ok(!seen.has(x.ticketId)&&seen.add(x.ticketId));
  }
  assert.equal(seen.size,200,"Twenty bounded pages returned exactly the accepted 200 tickets");
  const ids=new Set(rounds.map(x=>x.round.id));
  const events=new Set<string>();let cursor=baselineCursor.cursor;
  for(let page=0;page<8;page++){
   const batch=await expect<Changes>(await request(
    "/api/orders/changes?after="+cursor,"GET",undefined,kitchen),200);
   assert.ok(batch.events.length<=50,"Outbox replay is page-bounded");
   for(const e of batch.events)if(e.eventType==="order.accepted"&&ids.has(e.roundId))
    events.add(e.roundId);
   assert.ok(batch.nextCursor>=cursor);cursor=batch.nextCursor;
   if(!batch.hasMore)break;
  }
  assert.equal(events.size,200,"Accepted order outbox covers all 200 tickets");
  const gap=(page:number)=>"/api/orders/kitchen/unobserved?minAgeSeconds=0&page="+page+
   "&table="+encodeURIComponent(prefix);
  let backlog=new Set<string>();
  for(let page=1;page<=20;page++){
   const data=await expect<GapPage>(await request(gap(page),"GET",undefined,kitchen),200);
   assert.equal(data.total,200);assert.equal(data.items.length,10);
   for(const row of data.items)backlog.add(row.ticketId);
  }
  assert.equal(backlog.size,200);
  const tickets=rounds.map(x=>x.ticket.id);
  for(let n=0;n<20;n++){
   const subset=tickets.slice(n*10,(n+1)*10);
   const receipt=await expect<{accepted:number;submitted:number}>(await request(
    "/api/orders/kitchen/display-observed","POST",{ticketIds:subset},kitchen),200);
   assert.deepEqual(receipt,{accepted:10,submitted:10});
  }
  assert.equal((await expect<GapPage>(await request(gap(1),"GET",undefined,kitchen),200)).total,0,
   "All 200 client-report fixtures cleared the diagnostic backlog");
  const after=await expect<{cursor:number}>(await request(
   "/api/orders/kitchen/watermark","GET",undefined,kitchen),200);
  assert.equal(after.cursor,cursor,"Visibility receipt must not fabricate new order events");
  const p50=percentile(latencies,.5),p95=percentile(latencies,.95);
  console.info(JSON.stringify({scenario:"P31 disposable 20-table / 10 parallel HTTP worker / 200-ticket",
   accepted:200,uniqueRounds:200,queuePages:20,replayedAcceptEvents:events.size,
   visibilityReceipts:200,wallMs:duration,httpRoundTripMedianMs:p50,httpRoundTripP95Ms:p95,
   physicalDevices:0,certifiedHealthyNetworkSla:false}));
  console.info("PASS P31 disposable rehearsal: unique ordered rounds, bounded queue pages, ordered outbox replay and recovery of visibility gaps. HTTP workers are not 10 physical clients.");
 }finally{
  if(originalPlan&&baseline?.planId&&originalPlan.maxTables<1000)
   await db.update(subscriptionPlan).set({maxTables:originalPlan.maxTables})
    .where(eq(subscriptionPlan.id,baseline.planId));
 }
}
main().then(async()=>{await pool.end();}).catch(async err=>{
 console.error(err);await pool.end();process.exitCode=1;
});
