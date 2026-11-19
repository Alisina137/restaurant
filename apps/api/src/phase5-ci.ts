import "dotenv/config";
import assert from "node:assert/strict";
import {and,count,eq} from "drizzle-orm";
import {db,pool} from "./db";
import {kitchenTicket,orderRound,orderLine,orderActivity,orderOutbox} from "./schema";
if(process.env.NODE_ENV==="production"||!process.env.DEMO_PASSWORD)
 throw new Error("P05 integration must run against non-production database.");
const URL=process.env.E2E_API_URL??"http://localhost:4000",pwd=process.env.DEMO_PASSWORD;
async function call(path:string,method="GET",body?:unknown,cookie?:string){
 return fetch(URL+path,{method,headers:{"Content-Type":"application/json",Origin:"http://localhost:3000",
   ...(cookie?{Cookie:cookie}:{})},body:body===undefined?undefined:JSON.stringify(body)});
}
async function expect<T>(response:Response,status:number){
 const json=await response.json() as T;
 assert.equal(response.status,status,JSON.stringify(json));
 return json;
}
async function login(email:string):Promise<string>{
 for(let attempts=0;attempts<5;attempts++){
  const r=await call("/api/auth/sign-in/email","POST",{email,password:pwd});
  if(r.status===429){await new Promise(done=>setTimeout(done,11000));continue;}
  assert.equal(r.status,200,"Login failed: "+email+" "+await r.text());
  return r.headers.getSetCookie().map(x=>x.split(";")[0]).join("; ");
 }
 throw new Error("Auth limit remains active");
}
function category(){return {nameFa:"آشپزخانه فاز پنج",namePs:"د فاز پنځه خواړه",nameEn:"P05 Foods",
 description:"",sortOrder:0,published:true};}
function group(){return {nameFa:"اندازه برگر",namePs:"اندازه",nameEn:"Size",
 selectionMode:"single",minSelections:1,maxSelections:1,options:[
  {nameFa:"کوچک",namePs:"کوچنی",nameEn:"Small",deltaMinor:0,active:true,sortOrder:0},
  {nameFa:"بزرگ",namePs:"لوی",nameEn:"Large",deltaMinor:2500,active:true,sortOrder:1}]};}
function item(categoryId:string,groupId:string,priceMinor=38000,version=1){return {
 categoryId,nameFa:"برگر ویژه ۵",namePs:"ځانګړی برګر",nameEn:"P05 Burger",
 description:"Bread and beef",sku:"P05-BURGER",priceMinor,imageId:null,
 allergens:["wheat"],preparationMinutes:15,sortOrder:0,published:true,groupIds:[groupId],version};}
async function main(){
 const owner=await login("owner-ci@example.test"),waiter=await login("waiter-ci@example.test"),
  kitchen=await login("kitchen-ci@example.test"),other=await login("new-owner-ci@example.test");
 const board=await expect<{actorId:string;tables:{id:string;label:string;visitId:string|null;assignedWaiterId:string|null;status:string}[]}>(
  await call("/api/floor/tables/board","GET",undefined,waiter),200);
 const table=board.tables.find(t=>t.visitId&&t.assignedWaiterId===board.actorId);
 assert.ok(table,"P04 leaves one assigned active visit for P05");
 const cat=await expect<{id:string}>(await call("/api/menu/categories","POST",category(),owner),201);
 const mod=await expect<{id:string}>(await call("/api/menu/groups","POST",group(),owner),201);
 const meal=await expect<{id:string}>(await call("/api/menu/items","POST",
   item(cat.id,mod.id),owner),201);
 const catalog=await expect<{items:{id:string;version:number}[];groups:{id:string;version:number;
   options:{id:string;deltaMinor:number}[]}[]}>(
   await call("/api/menu/catalog","GET",undefined,waiter),200);
 const groupData=catalog.groups.find(g=>g.id===mod.id);
 assert.ok(groupData&&groupData.version===1);
 const selected=groupData.options.find(o=>o.deltaMinor===2500);assert.ok(selected);
 const note="No onions <script>alert('x')</script>";
 const lines=[{itemId:meal.id,itemVersion:1,quantity:2,note,
   selections:[{groupId:mod.id,version:groupData.version,optionIds:[selected.id]}]}];
 const payload={idempotencyKey:"p05-retry-"+crypto.randomUUID(),note:"For table",lines};
 assert.equal((await call("/api/orders/visits/"+table.visitId+"/rounds","POST",
  {...payload,lines:[{...lines[0],selections:[]}]},waiter)).status,409,
  "required modifier cannot be skipped");
 assert.equal((await call("/api/orders/visits/"+table.visitId+"/rounds","POST",
  {...payload,lines:[{...lines[0],selections:[{groupId:mod.id,version:1,optionIds:[]}] }]},waiter)).status,409,
  "minimum modifier selection enforced");
 assert.equal((await call("/api/orders/visits/"+table.visitId+"/rounds","POST",
  {...payload,lines:[{...lines[0],itemVersion:2}]},waiter)).status,409,"stale version rejected");
 assert.equal((await call("/api/orders/visits/"+table.visitId+"/rounds","POST",payload,kitchen)).status,403,
  "kitchen cannot create waiter orders");
 assert.equal((await call("/api/orders/visits/"+table.visitId+"/rounds","POST",payload,other)).status,404,
  "other tenant cannot access visit");
 const first=await expect<{created:boolean;round:{id:string;totalMinor:number;roundNumber:number};
  ticket:{id:string;status:string;version:number};lines:{itemNameEn:string;lineTotalMinor:number;
  note:string;modifierSnapshot:{options:{deltaMinor:number}[]}[]}[]}>(
  await call("/api/orders/visits/"+table.visitId+"/rounds","POST",payload,waiter),201);
 assert.equal(first.created,true);assert.equal(first.round.roundNumber,1);
 assert.equal(first.round.totalMinor,(38000+2500)*2);
 assert.equal(first.lines.length,1);assert.equal(first.lines[0]?.note,note);
 assert.equal(first.lines[0]?.modifierSnapshot[0]?.options[0]?.deltaMinor,2500);
 const retried=await expect<{created:boolean;round:{id:string}}>(
  await call("/api/orders/visits/"+table.visitId+"/rounds","POST",payload,waiter),200);
 assert.equal(retried.created,false);assert.equal(retried.round.id,first.round.id);
 const burst=await Promise.all(Array.from({length:100},()=>call("/api/orders/visits/"+table.visitId+"/rounds","POST",payload,waiter)));
 for(const reply of burst){
  const x=await expect<{created:boolean;round:{id:string}}>(reply,200);
  assert.equal(x.created,false);assert.equal(x.round.id,first.round.id);
 }
 const [orders]=await db.select({n:count()}).from(orderRound).where(eq(orderRound.id,first.round.id));
 const [tickets]=await db.select({n:count()}).from(kitchenTicket).where(eq(kitchenTicket.roundId,first.round.id));
 const [events]=await db.select({n:count()}).from(orderOutbox).where(eq(orderOutbox.roundId,first.round.id));
 assert.equal(orders?.n,1);assert.equal(tickets?.n,1);assert.equal(events?.n,1);
 const roundLines=await db.select().from(orderLine).where(eq(orderLine.roundId,first.round.id));
 assert.equal(roundLines.length,1,"one immutable line");
 const kitchenList=await expect<{items:{id:string;ticketId:string;ticketVersion:number}[]}>(
   await call("/api/orders/kitchen?status=new","GET",undefined,kitchen),200);
 assert.ok(kitchenList.items.some(x=>x.id===first.round.id),"kitchen immediately receives exactly one ticket");
 const details=await expect<{round:{totalMinor:number};lines:{note:string}[]}>(
  await call("/api/orders/rounds/"+first.round.id,"GET",undefined,kitchen),200);
 assert.equal(details.lines[0]?.note,note);
 assert.equal((await call("/api/orders/rounds/"+first.round.id,"GET",undefined,other)).status,404);
 assert.equal((await call("/api/orders/tickets/"+first.ticket.id+"/transition","POST",
  {version:1,nextStatus:"ready"},kitchen)).status,409,"cannot skip preparing");
 assert.equal((await call("/api/orders/tickets/"+first.ticket.id+"/transition","POST",
  {version:1,nextStatus:"preparing"},waiter)).status,403,"waiter cannot cook ticket");
 assert.equal((await call("/api/orders/tickets/"+first.ticket.id+"/transition","POST",
  {version:1,nextStatus:"preparing"},kitchen)).status,200);
 assert.equal((await call("/api/orders/tickets/"+first.ticket.id+"/transition","POST",
  {version:1,nextStatus:"ready"},kitchen)).status,409,"stale kitchen version fails");
 assert.equal((await call("/api/orders/tickets/"+first.ticket.id+"/transition","POST",
  {version:2,nextStatus:"ready"},kitchen)).status,200);
 const ready=await expect<{items:{id:string;status:string}[]}>(
  await call("/api/orders/my?status=ready","GET",undefined,waiter),200);
 assert.ok(ready.items.some(x=>x.id===first.round.id),"ready ticket visible to waiter");
 const preparing=await expect<{items:{id:string}[]}>(
  await call("/api/orders/kitchen?status=preparing","GET",undefined,kitchen),200);
 assert.ok(!preparing.items.some(x=>x.id===first.round.id));
 const finish=await call("/api/floor/visits/"+table.visitId+"/finish","POST",
  {reason:"Pilot after real order"},owner);
 assert.equal(finish.status,409,"must not close an unsettled ordered visit");
 const finishBody=await finish.json() as {code:string};
 assert.equal(finishBody.code,"UNSETTLED_CHECK");
 const priceUpdate=await call("/api/menu/items/"+meal.id,"PATCH",
   item(cat.id,mod.id,41000,1),owner);
 assert.equal(priceUpdate.status,200);
 const stored=await expect<{round:{totalMinor:number};lines:{basePriceMinor:number}[]}>(
  await call("/api/orders/rounds/"+first.round.id,"GET",undefined,owner),200);
 assert.equal(stored.round.totalMinor,81000);
 assert.equal(stored.lines[0]?.basePriceMinor,38000,"price snapshot immutable after menu change");
 assert.equal((await call("/api/orders/visits/"+table.visitId+"/rounds","POST",
   {...payload,idempotencyKey:"p05-new-"+crypto.randomUUID()},waiter)).status,409,"stale cart must reconfirm");
 const second=await expect<{round:{id:string;roundNumber:number;totalMinor:number};created:boolean}>(
  await call("/api/orders/visits/"+table.visitId+"/rounds","POST",
    {...payload,idempotencyKey:"p05-second-"+crypto.randomUUID(),
      lines:[{...lines[0],itemVersion:2}]},waiter),201);
 assert.equal(second.round.roundNumber,2);assert.equal(second.round.totalMinor,87000);
 const visitOrders=await expect<{rounds:{id:string}[];estimateMinor:number}>(
  await call("/api/orders/visits/"+table.visitId+"/rounds","GET",undefined,waiter),200);
 assert.ok(visitOrders.rounds.some(r=>r.id===first.round.id));
 assert.equal(visitOrders.estimateMinor,81000+87000);
 const revision=await expect<{version:number}>(await call("/api/orders/revision","GET",undefined,kitchen),200);
 assert.ok(revision.version>=4,"events version increments for accepted and preparation");
 const activity=await db.select().from(orderActivity).where(eq(orderActivity.roundId,first.round.id));
 assert.equal(activity.length,3,"accepted, preparing, ready in activity");
 console.info("PASS P05: modifiers, snapshots, 100 idempotent replays, kitchen lifecycle, tenant isolation, live reading and unsettled closure guard.");
}
main().then(async()=>{await pool.end();}).catch(async e=>{console.error(e);await pool.end();process.exitCode=1;});
