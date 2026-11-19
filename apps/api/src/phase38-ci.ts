import "dotenv/config";
import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import {setTimeout as delay} from "node:timers/promises";
import {and,count,eq,isNull} from "drizzle-orm";
import {db,pool} from "./db";
import {diningSection,user,orderRound,orderLine,orderOutbox,kitchenTicket} from "./schema";

/**
 * Dedicated P38 integration runs AFTER the fixture-dependent P05/P06 suites.
 * Never add a new order to P04's special visit: P06 intentionally expects
 * exactly two rounds on it. Use a wholly new table and an opt-in CI-only DB.
 */
const dbUrl=new URL(process.env.DATABASE_URL??"postgresql://invalid@invalid/invalid");
const apiUrl=new URL(process.env.E2E_API_URL??"http://localhost:4000");
if(process.env.NODE_ENV==="production"||process.env.CI!=="true"||
 !["localhost","127.0.0.1"].includes(dbUrl.hostname)||
 dbUrl.pathname!=="/dineflow_ci"||
 !["localhost","127.0.0.1"].includes(apiUrl.hostname)||
 apiUrl.protocol!=="http:"||!process.env.DEMO_PASSWORD)
 throw Error("P38 requires CI=true, disposable localhost PostgreSQL dineflow_ci and local API.");
const api=apiUrl.origin,pass=process.env.DEMO_PASSWORD;
async function request(path:string,method="GET",body?:unknown,cookie?:string){
 return fetch(api+path,{method,headers:{"Content-Type":"application/json",
  Origin:"http://localhost:3000",...(cookie?{Cookie:cookie}:{})},
  body:body===undefined?undefined:JSON.stringify(body)});
}
async function expect<T>(response:Response,status:number):Promise<T>{
 const json=await response.json() as T;
 assert.equal(response.status,status,JSON.stringify(json));
 return json;
}
async function login(email:string){
 for(let retry=0;retry<7;retry++){
  const response=await request("/api/auth/sign-in/email","POST",{email,password:pass});
  if(response.status===429){await delay(11000);continue;}
  assert.equal(response.status,200,"Fixture sign-in failed for "+email);
  return response.headers.getSetCookie().map(v=>v.split(";")[0]).join("; ");
 }
 throw Error("P38 fixture sign-in exceeded rate limits");
}
type Order={
 created:boolean;round:{id:string;totalMinor:number;roundNumber:number};
 ticket:{id:string;version:number};
 lines:{quantity:number;note:string;itemNameEn:string;itemVersion:number;
  lineTotalMinor:number;modifierSnapshot:{options:{id:string;deltaMinor:number}[]}[]}[];
};
type Cards={total:number;items:{id:string;ticketId:string}[];
 detailsByRound:Record<string,{lines:Order["lines"];ticket:{version:number}}>};
async function main(){
 const [owner,waiter,kitchen,other]=await Promise.all([
  login("owner-ci@example.test"),login("waiter-ci@example.test"),
  login("kitchen-ci@example.test"),login("new-owner-ci@example.test")]);
 const [section]=await db.select({id:diningSection.id}).from(diningSection)
  .where(and(eq(diningSection.tenantId,"dev-restaurant"),eq(diningSection.active,true),
   isNull(diningSection.archivedAt))).limit(1);
 const [actor]=await db.select({id:user.id}).from(user)
  .where(eq(user.email,"waiter-ci@example.test")).limit(1);
 assert.ok(section&&actor,"P38 requires seeded active floor and waiter");
 const unique=randomUUID().slice(0,8),label="P38-"+unique;
 const category=await expect<{id:string}>(await request("/api/menu/categories","POST",{
  nameFa:"آزمون "+unique,namePs:"ازموینه "+unique,nameEn:"P38 Category "+unique,
  description:"",sortOrder:89,published:true
 },owner),201);
 const mod=await expect<{id:string}>(await request("/api/menu/groups","POST",{
  nameFa:"اندازه "+unique,namePs:"کچه "+unique,nameEn:"P38 Size "+unique,
  selectionMode:"single",minSelections:1,maxSelections:1,
  options:[
   {nameFa:"معمولی",namePs:"عادي",nameEn:"Regular",
    deltaMinor:0,active:true,sortOrder:0},
   {nameFa:"اضافی",namePs:"اضافي",nameEn:"Extra",
    deltaMinor:1300,active:true,sortOrder:1}
  ]
 },owner),201);
 const meal=await expect<{id:string}>(await request("/api/menu/items","POST",{
  categoryId:category.id,nameFa:"غذا "+unique,namePs:"خواړه "+unique,
  nameEn:"P38 Repeated Meal",description:"Disposable CI-only ingredient",
  sku:"P38-"+unique,priceMinor:22000,imageId:null,allergens:[],
  preparationMinutes:10,sortOrder:0,published:true,groupIds:[mod.id]
 },owner),201);
 const table=await expect<{id:string}>(await request("/api/floor/tables","POST",{
  sectionId:section.id,label,seats:4,sortOrder:88,active:true,
  assignedWaiterId:actor.id,notes:"P38 disposable independent visit"
 },owner),201);
 const opened=await expect<{visit:{id:string}}>(await request(
  "/api/floor/visits/tables/"+table.id+"/open","POST",{partySize:2},waiter),201);
 const catalog=await expect<{items:{id:string;version:number}[];
  groups:{id:string;version:number;options:{id:string;deltaMinor:number}[]}[]}>(
  await request("/api/menu/catalog","GET",undefined,waiter),200);
 const dish=catalog.items.find(x=>x.id===meal.id);
 const group=catalog.groups.find(x=>x.id===mod.id);
 assert.ok(dish&&group);
 const regular=group.options.find(x=>x.deltaMinor===0);
 const extra=group.options.find(x=>x.deltaMinor===1300);
 assert.ok(regular&&extra);
 const lines=Array.from({length:40},(_,i)=>({
  itemId:meal.id,itemVersion:dish.version,quantity:i%3+1,
  note:"P38 separate instruction "+String(i+1).padStart(2,"0"),
  selections:[{groupId:mod.id,version:group.version,
   optionIds:[i%2===0?regular.id:extra.id]}]
 }));
 const subtotal=lines.reduce((sum,line,index)=>sum+
  (22000+(index%2===0?0:1300))*line.quantity,0);
 const payload={idempotencyKey:"p38_"+randomUUID().replaceAll("-",""),
  note:"All 40 lines must price separately",lines};
 assert.equal((await request("/api/orders/visits/"+opened.visit.id+"/rounds",
  "POST",payload,other)).status,404,"Another restaurant cannot access this visit");
 const result=await expect<Order>(await request(
  "/api/orders/visits/"+opened.visit.id+"/rounds","POST",payload,waiter),201);
 assert.equal(result.created,true);
 assert.equal(result.round.roundNumber,1);
 assert.equal(result.round.totalMinor,subtotal);
 assert.equal(result.lines.length,40);
 result.lines.forEach((line,index)=>{
  assert.equal(line.itemVersion,dish.version);
  assert.equal(line.quantity,lines[index]!.quantity);
  assert.equal(line.note,lines[index]!.note);
  assert.equal(line.itemNameEn,"P38 Repeated Meal");
  assert.equal(line.modifierSnapshot[0]?.options[0]?.deltaMinor,index%2===0?0:1300);
  assert.equal(line.lineTotalMinor,
   (22000+(index%2===0?0:1300))*lines[index]!.quantity);
 });
 const duplicate=await expect<Order>(await request(
  "/api/orders/visits/"+opened.visit.id+"/rounds","POST",payload,waiter),200);
 assert.equal(duplicate.created,false);
 assert.equal(duplicate.round.id,result.round.id);
 const roundLines=await db.select({id:orderLine.id}).from(orderLine)
  .where(eq(orderLine.roundId,result.round.id));
 const [events]=await db.select({n:count()}).from(orderOutbox)
  .where(eq(orderOutbox.roundId,result.round.id));
 const [tickets]=await db.select({n:count()}).from(kitchenTicket)
  .where(eq(kitchenTicket.roundId,result.round.id));
 const [rounds]=await db.select({n:count()}).from(orderRound)
  .where(eq(orderRound.visitId,opened.visit.id));
 assert.equal(roundLines.length,40);
 assert.equal(events?.n,1);
 assert.equal(tickets?.n,1);
 assert.equal(rounds?.n,1);
 for(const [change,code] of [
  [{...lines[39]!,itemVersion:dish.version+1},"PRICE_CHANGED"],
  [{...lines[39]!,selections:[{
    ...lines[39]!.selections[0]!,version:group.version+1}]},"MODIFIER_CHANGED"],
  [{...lines[39]!,selections:[{
    ...lines[39]!.selections[0]!,optionIds:[randomUUID()]}]},"INVALID_MODIFIERS"]
 ] as const){
  const faulty={...payload,idempotencyKey:"p38_"+randomUUID().replaceAll("-"),
   lines:[...lines.slice(0,39),change]};
  const invalid=await request("/api/orders/visits/"+opened.visit.id+"/rounds",
   "POST",faulty,waiter);
  assert.equal(invalid.status,409,"Reject entire cart for invalid final line");
  assert.equal((await invalid.json() as {code:string}).code,code);
 }
 const [stillOne]=await db.select({n:count()}).from(orderRound)
  .where(eq(orderRound.visitId,opened.visit.id));
 assert.equal(stillOne?.n,1,"Invalid final line must not commit a round");
 const cards=await expect<Cards>(await request("/api/orders/kitchen/cards?status=new&table="+
  encodeURIComponent(label),"GET",undefined,kitchen),200);
 assert.equal(cards.total,1);
 assert.equal(cards.items[0]?.ticketId,result.ticket.id);
 assert.equal(cards.detailsByRound[result.round.id]?.lines.length,40);
 const isolated=await expect<Cards>(await request("/api/orders/kitchen/cards?status=new&table="+
  encodeURIComponent(label),"GET",undefined,other),200);
 assert.equal(isolated.total,0);
 assert.equal((await request("/api/orders/kitchen/cards?status=new&table="+
  encodeURIComponent(label),"GET",undefined,waiter)).status,403);
 console.info("PASS P38 disposable HTTP: 40-line unique amounts and modifiers; single ticket/outbox; idempotency; failed-final-line rollback; kitchen and tenant protection.");
}
main().then(async()=>{await pool.end();}).catch(async error=>{
 console.error(error);await pool.end();process.exitCode=1;
});
