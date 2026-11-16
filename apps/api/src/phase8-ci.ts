import "dotenv/config";
import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import {and,eq} from "drizzle-orm";
import {db,pool} from "./db";
import {diningSection,diningTable,diningVisit,menuItem,menuItemGroup,menuModifierGroup,
 menuModifierOption,orderLine,orderRound,orderChangeRequest,kitchenTicket,serviceRequest,user} from "./schema";
if(process.env.NODE_ENV==="production"||!process.env.DEMO_PASSWORD)
 throw new Error("P08 acceptance must use a disposable development database.");
const BASE=process.env.E2E_API_URL??"http://localhost:4000",password=process.env.DEMO_PASSWORD;
async function call(path:string,method="GET",body?:unknown,cookie?:string,token?:string){
 return fetch(BASE+path,{method,headers:{"Content-Type":"application/json",Origin:"http://localhost:3000",
   ...(cookie?{Cookie:cookie}:{}),...(token?{Authorization:"Bearer "+token}:{})},
   body:body===undefined?undefined:JSON.stringify(body)});
}
async function expect<T>(response:Response,status:number){
 const result=await response.json() as T;
 assert.equal(response.status,status,JSON.stringify(result));return result;
}
async function login(email:string){
 for(let i=0;i<6;i++){
  const r=await call("/api/auth/sign-in/email","POST",{email,password});
  if(r.status===429){await new Promise(ok=>setTimeout(ok,11000));continue;}
  assert.equal(r.status,200,await r.text());return r.headers.getSetCookie().map(x=>x.split(";")[0]).join("; ");
 }
 throw new Error("Login throttled "+email);
}
async function main(){
 const [owner,waiter,cashier,kitchen,other]=await Promise.all([
  login("owner-ci@example.test"),login("waiter-ci@example.test"),login("cashier-ci@example.test"),
  login("kitchen-ci@example.test"),login("new-owner-ci@example.test")]);
 const [staff]=await db.select().from(user).where(eq(user.email,"waiter-ci@example.test")).limit(1);
 const [section]=await db.select().from(diningSection).where(eq(diningSection.tenantId,"dev-restaurant")).limit(1);
 const [meal]=await db.select().from(menuItem).where(eq(menuItem.sku,"P05-BURGER")).limit(1);
 assert.ok(staff&&section&&meal);
 const [link]=await db.select().from(menuItemGroup).where(eq(menuItemGroup.itemId,meal.id)).limit(1);
 assert.ok(link);
 const [group]=await db.select().from(menuModifierGroup).where(eq(menuModifierGroup.id,link.groupId)).limit(1);
 const [option]=await db.select().from(menuModifierOption).where(and(
  eq(menuModifierOption.groupId,link.groupId),eq(menuModifierOption.deltaMinor,2500))).limit(1);
 assert.ok(group&&option);
 const table=await expect<{id:string}>(await call("/api/floor/tables","POST",{
   sectionId:section.id,label:"Z7",seats:4,sortOrder:97,notes:"P08 service recovery",
   active:true,assignedWaiterId:staff.id},owner),201);
 const visit=await expect<{visit:{id:string}}>(await call("/api/floor/visits/tables/"+table.id+
   "/open","POST",{partySize:2},waiter),201);
 const qr=await expect<{url:string}>(await call("/api/guest/staff/qrs/"+table.id,"POST",{},owner),201);
 const path=new URL(qr.url).pathname.split("/");
 const pin=await expect<{pin:string}>(await call("/api/guest/staff/visits/"+visit.visit.id+"/pin",
   "GET",undefined,waiter),200);
 const guest=await expect<{token:string}>(await call("/api/guest/entry/"+path[2]+"/"+path[4]+
   "/verify","POST",{pin:pin.pin}),200);
 const water={type:"assistance",reason:"water",note:"Cold water please",idempotencyKey:"p08-"+randomUUID()};
 const made=await expect<{id:string;created:boolean;version:number;status:string}>(
    await call("/api/guest/service","POST",water,undefined,guest.token),201);
 assert.equal(made.status,"pending");
 const repeat=await expect<{id:string;created:boolean;replayed:boolean}>(
    await call("/api/guest/service","POST",water,undefined,guest.token),200);
 assert.equal(repeat.id,made.id);assert.equal(repeat.created,false);assert.equal(repeat.replayed,true);
 const duplicate=await expect<{id:string;created:boolean}>(
    await call("/api/guest/service","POST",{...water,idempotencyKey:"p08-"+randomUUID()},
      undefined,guest.token),200);
 assert.equal(duplicate.id,made.id);
 assert.equal((await call("/api/guest/service","POST",{...water,note:"different"},
    undefined,guest.token)).status,409,"same key cannot alter payload");
 const callPage=await expect<{items:{id:string;status:string}[]}>(
    await call("/api/guest/service","GET",undefined,undefined,guest.token),200);
 assert.equal(callPage.items[0]?.id,made.id);
 assert.equal((await call("/api/service/requests?status=active","GET",undefined,kitchen)).status,403);
 assert.equal((await call("/api/service/requests?status=active","GET",undefined,other)).status,200);
 const waiterPage=await expect<{items:{id:string;tableLabel:string}[];total:number}>(
    await call("/api/service/requests?status=active&tableId="+table.id,"GET",undefined,waiter),200);
 assert.ok(waiterPage.items.some(x=>x.id===made.id&&x.tableLabel==="Z7"));
 assert.equal((await call("/api/service/requests/"+made.id+"/ack","POST",{
    version:1},cashier)).status,403);
 assert.equal((await call("/api/service/requests/"+made.id+"/ack","POST",{
    version:1},other)).status,404);
 const ack=await expect<{version:number;status:string}>(
    await call("/api/service/requests/"+made.id+"/ack","POST",{version:1},waiter),200);
 assert.equal(ack.version,2);assert.equal(ack.status,"acknowledged");
 assert.equal((await call("/api/service/requests/"+made.id+"/ack","POST",{
    version:1},waiter)).status,409);
 const resolved=await expect<{status:string;version:number}>(
    await call("/api/service/requests/"+made.id+"/resolve","POST",{
      version:ack.version,resolutionNote:"Brought clean water"},waiter),200);
 assert.equal(resolved.status,"resolved");
 assert.equal((await call("/api/guest/service","POST",{
    ...water,idempotencyKey:"p08-"+randomUUID()},undefined,guest.token)).status,429,
    "same-type request throttled 60 seconds even immediately after resolving");
 const bill=await expect<{id:string;status:string;splitPreference:string}>(
    await call("/api/guest/service","POST",{
      type:"bill",splitPreference:"split",idempotencyKey:"p08-"+randomUUID()},undefined,guest.token),201);
 assert.equal(bill.splitPreference,"split");
 const payable=await expect<{items:{visitId:string;requested:boolean}[];requestedAvailable:boolean}>(
    await call("/api/finance/checks?tab=requested","GET",undefined,cashier),200);
 assert.ok(payable.requestedAvailable);
 assert.ok(payable.items.some(x=>x.visitId===visit.visit.id&&x.requested),
  "real guest bill request appears in cashier requested tab before ordering and does not lock a check");
 const cashRequests=await expect<{items:{id:string;type:string}[]}>(
    await call("/api/service/requests?status=active","GET",undefined,cashier),200);
 assert.ok(cashRequests.items.some(x=>x.id===bill.id&&x.type==="bill"));
 assert.ok(!cashRequests.items.some(x=>x.id===made.id),"cashier only sees bill requests");
 const makeLine=(note:string)=>({itemId:meal.id,itemVersion:meal.version,quantity:1,note,
    selections:[{groupId:group.id,version:group.version,optionIds:[option.id]}]});
 const ordered=await expect<{round:{id:string;totalMinor:number};
    ticket:{id:string;version:number}}>(
   await call("/api/orders/visits/"+visit.visit.id+"/rounds","POST",{
      idempotencyKey:"p08-round-"+randomUUID(),note:"Water request did not lock ordering",
      lines:[makeLine("Cancel this"),makeLine("Keep this")]},waiter),201);
 const single=meal.priceMinor+option.deltaMinor,original=ordered.round.totalMinor;
 assert.equal(original,2*single);
 const check=await expect<{id:string}>(await call("/api/finance/visits/"+visit.visit.id+"/check",
    "POST",{},cashier),200);
 const before=await expect<{check:{totalMinor:number;version:number;subtotalMinor:number};
    lines:{id:string;lineTotalMinor:number}[]}>(
    await call("/api/finance/checks/"+check.id,"GET",undefined,cashier),200);
 assert.equal(before.check.subtotalMinor,original);
 assert.equal(before.lines.length,2);
 const second=await expect<{round:{id:string;roundNumber:number}}>(
   await call("/api/orders/visits/"+visit.visit.id+"/rounds","POST",{
      idempotencyKey:"p08-late-"+randomUUID(),note:"Late drinks",lines:[makeLine("Late round")]},waiter),201);
 assert.equal(second.round.roundNumber,2);
 const preChange=await expect<{check:{subtotalMinor:number;version:number}}>(
   await call("/api/finance/checks/"+check.id,"GET",undefined,cashier),200);
 assert.equal(preChange.check.subtotalMinor,original+single,
  "Additional round remains attached to same active visit/check");
 const [first,secondLine]=before.lines;
 assert.ok(first&&secondLine);
 const key="p08-change-"+randomUUID();
 const change=await expect<{id:string;status:string;created:boolean;version:number}>(
    await call("/api/service/changes","POST",{
     lineId:first.id,reason:"Guest requests cancellation",idempotencyKey:key},waiter),201);
 assert.equal(change.status,"pending");
 assert.equal((await call("/api/service/changes","POST",{
     lineId:first.id,reason:"Guest requests cancellation",idempotencyKey:key},waiter)).status,200);
 const changes=await expect<{items:{id:string}[]}>(
    await call("/api/service/changes?status=pending","GET",undefined,owner),200);
 assert.ok(changes.items.some(x=>x.id===change.id));
 assert.equal((await call("/api/service/changes/"+change.id+"/decision","POST",{
    version:change.version,decision:"approve"},waiter)).status,403);
 await expect<{saved:boolean}>(await call("/api/orders/tickets/"+ordered.ticket.id+"/transition",
    "POST",{version:1,nextStatus:"preparing"},kitchen),200);
 const approved=await expect<{deltaMinor:number;status:string;version:number}>(
   await call("/api/service/changes/"+change.id+"/decision","POST",{
     version:change.version,decision:"approve",decisionReason:"Guest changed their mind"},owner),200);
 assert.equal(approved.deltaMinor,-first.lineTotalMinor);
 assert.equal(approved.status,"approved");
 assert.equal((await call("/api/service/changes/"+change.id+"/decision","POST",{
     version:change.version,decision:"approve"},owner)).status,409);
 const [snapshot]=await db.select().from(orderRound).where(eq(orderRound.id,ordered.round.id)).limit(1);
 assert.equal(snapshot?.totalMinor,original,"Original accepted round price remains immutable");
 const [cancelled]=await db.select().from(orderLine).where(eq(orderLine.id,first.id)).limit(1);
 assert.equal(cancelled?.kitchenStatus,"cancelled");
 assert.equal(cancelled.lineTotalMinor,first.lineTotalMinor,"immutable line snapshot is preserved");
 const [adjustment]=await db.select().from(orderChangeRequest).where(eq(orderChangeRequest.id,change.id)).limit(1);
 assert.equal(adjustment?.deltaMinor,-first.lineTotalMinor);
 const reconciled=await expect<{check:{subtotalMinor:number;version:number};lines:{id:string}[]}>(
    await call("/api/finance/checks/"+check.id,"GET",undefined,cashier),200);
 assert.equal(reconciled.check.subtotalMinor,original+single-first.lineTotalMinor,
  "Cashier sees approved cancellation delta before payment");
 assert.ok(reconciled.check.version>preChange.check.version);
 const guestBill=await expect<{subtotalMinor:number;lines:{nameFa:string;lineTotalMinor:number}[]}>(
    await call("/api/guest/bill","GET",undefined,undefined,guest.token),200);
 assert.equal(guestBill.subtotalMinor,reconciled.check.subtotalMinor);
 assert.equal(guestBill.lines.length,2,"Cancelled line not billed to guest");
 const unsafe=await expect<{id:string;version:number}>(
    await call("/api/service/changes","POST",{
     lineId:secondLine.id,reason:"Request after cooking",idempotencyKey:"p08-change-"+randomUUID()},waiter),201);
 await expect<{saved:boolean}>(await call("/api/orders/tickets/"+ordered.ticket.id+"/transition",
    "POST",{version:3,nextStatus:"ready"},kitchen),200);
 assert.equal((await call("/api/service/changes/"+unsafe.id+"/decision","POST",{
    version:unsafe.version,decision:"approve"},owner)).status,409,
    "Kitchen ready item cannot be cancelled even by manager");
 const rejection=await expect<{status:string;decisionReason:string}>(
    await call("/api/service/changes/"+unsafe.id+"/decision","POST",{
      version:unsafe.version,decision:"reject",
      decisionReason:"Meal already prepared and ready"},owner),200);
 assert.equal(rejection.status,"rejected");
 assert.equal((await call("/api/service/changes","POST",{
     lineId:secondLine.id,reason:"Too late",idempotencyKey:"p08-change-"+randomUUID()},waiter)).status,409);
 const page=await expect<{items:{id:string;status:string}[]}>(
    await call("/api/service/requests?status=active","GET",undefined,owner),200);
 const billRequest=page.items.find(x=>x.id===bill.id);assert.ok(billRequest);
 await expect<{status:string}>(await call("/api/service/requests/"+bill.id+"/resolve",
    "POST",{version:billRequest.version,resolutionNote:"Bill request sent to cashier"},owner),200);
 const afterBill=await expect<{items:{visitId:string}[]}>(
    await call("/api/finance/checks?tab=requested","GET",undefined,cashier),200);
 assert.ok(!afterBill.items.some(x=>x.visitId===visit.visit.id));
 const all=await expect<{items:{id:string;status:string}[]}>(
    await call("/api/guest/service","GET",undefined,undefined,guest.token),200);
 assert.equal(all.items.find(x=>x.id===bill.id)?.status,"resolved");
 console.info("PASS P08: guest service, dedup, throttle, visitor status, staff ACK, real cashier requested queue, late round, manager-only cancellation, ticket delta, preserved financial originals and unsafe-ready conflict.");
}
main().then(async()=>{await pool.end();}).catch(async e=>{console.error(e);await pool.end();process.exitCode=1;});
