import "dotenv/config";
import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import {and,eq} from "drizzle-orm";
import {db,pool} from "./db";
import {diningSection,diningTable,diningVisit,menuItem,menuItemGroup,menuModifierGroup,
 menuModifierOption,orderLine,orderRound,kitchenTicket,diningCheck,checkPayment,checkReceipt,
 checkShare,cashierShift,user} from "./schema";
if(process.env.NODE_ENV==="production"||!process.env.DEMO_PASSWORD)
 throw new Error("P09 requires disposable development Postgres.");
const BASE=process.env.E2E_API_URL??"http://localhost:4000",pw=process.env.DEMO_PASSWORD;
async function call(path:string,method="GET",body?:unknown,cookie?:string,guestToken?:string){
 return fetch(BASE+path,{method,headers:{"Content-Type":"application/json",Origin:"http://localhost:3000",
   ...(cookie?{Cookie:cookie}:{}),...(guestToken?{Authorization:"Bearer "+guestToken}:{})},
   body:body===undefined?undefined:JSON.stringify(body)});
}
async function expect<T>(r:Response,status:number):Promise<T>{
 const obj=await r.json() as T;
 assert.equal(r.status,status,JSON.stringify(obj));return obj;
}
async function login(email:string){
 for(let attempt=0;attempt<6;attempt++){
   const r=await call("/api/auth/sign-in/email","POST",{email,password:pw});
   if(r.status===429){await new Promise(done=>setTimeout(done,11000));continue;}
   assert.equal(r.status,200,email+": "+await r.text());
   return r.headers.getSetCookie().map(x=>x.split(";")[0]).join("; ");
 }
 throw new Error("Login throttled: "+email);
}
async function main(){
 const [owner,cashier,waiter,kitchen,other]=await Promise.all([
   login("owner-ci@example.test"),login("cashier-ci@example.test"),
   login("waiter-ci@example.test"),login("kitchen-ci@example.test"),
   login("new-owner-ci@example.test")]);
 const [w]=await db.select().from(user).where(eq(user.email,"waiter-ci@example.test")).limit(1);
 const [section]=await db.select().from(diningSection).where(eq(diningSection.tenantId,"dev-restaurant")).limit(1);
 const [burger]=await db.select().from(menuItem).where(eq(menuItem.sku,"P05-BURGER")).limit(1);
 assert.ok(w&&section&&burger);
 const [link]=await db.select().from(menuItemGroup).where(eq(menuItemGroup.itemId,burger.id)).limit(1);
 assert.ok(link);
 const [group]=await db.select().from(menuModifierGroup).where(eq(menuModifierGroup.id,link.groupId)).limit(1);
 const [option]=await db.select().from(menuModifierOption).where(and(
   eq(menuModifierOption.groupId,link.groupId),eq(menuModifierOption.deltaMinor,2500))).limit(1);
 assert.ok(group&&option);
 const table=await expect<{id:string}>(await call("/api/floor/tables","POST",{
   sectionId:section.id,label:"Z9",seats:4,sortOrder:99,notes:"P09 cashier test",active:true,
   assignedWaiterId:w.id},owner),201);
 const visit=await expect<{visit:{id:string}}>(await call(
   "/api/floor/visits/tables/"+table.id+"/open","POST",{partySize:2},waiter),201);
 const policy=await expect<{version:number}>(await call("/api/finance/policy","GET",undefined,owner),200);
 assert.equal((await call("/api/finance/policy","GET",undefined,waiter)).status,403);
 const changed=await expect<{version:number;serviceFixedMinor:number}>(
   await call("/api/finance/policy","PATCH",{
     version:policy.version,taxRateBps:0,taxInclusive:false,serviceRateBps:0,
     serviceFixedMinor:1,receiptFooter:"Thank you. مرحبا"},owner),200);
 assert.equal(changed.version,policy.version+1);
 assert.equal(changed.serviceFixedMinor,1);
 assert.equal((await call("/api/finance/policy","PATCH",{
   version:policy.version,taxRateBps:0,taxInclusive:false,serviceRateBps:0,
   serviceFixedMinor:0,receiptFooter:""},owner)).status,409);
 const line=(note:string)=>({itemId:burger.id,itemVersion:burger.version,quantity:1,note,
    selections:[{groupId:group.id,version:group.version,optionIds:[option.id]}]});
 const orderBody={idempotencyKey:"p09-"+randomUUID(),note:"Split check test",lines:[line("A"),line("B")]};
 const accepted=await expect<{round:{id:string;totalMinor:number};ticket:{id:string;version:number}}>(
   await call("/api/orders/visits/"+visit.visit.id+"/rounds","POST",orderBody,waiter),201);
 const totalMinor=accepted.round.totalMinor+1;
 assert.equal(totalMinor%2,1,"odd total tests exact split remainder");
 const check=await expect<{id:string;version:number;number:number}>(
   await call("/api/finance/visits/"+visit.visit.id+"/check","POST",{},cashier),200);
 const detail=await expect<{check:{id:string;version:number;totalMinor:number;subtotalMinor:number;
    serviceMinor:number;chargePolicy:{receiptFooter:string}};shares:{id:string;amountMinor:number}[];
    lines:{id:string;quantity:number}[];dueMinor:number}>(
   await call("/api/finance/checks/"+check.id,"GET",undefined,cashier),200);
 assert.equal(detail.check.totalMinor,totalMinor);
 assert.equal(detail.check.serviceMinor,1);
 assert.equal(detail.check.chargePolicy.receiptFooter,"Thank you. مرحبا");
 assert.equal(detail.shares.length,1);
 assert.equal(detail.lines.length,2);
 assert.equal(detail.dueMinor,totalMinor);
 const cases=await expect<{items:{visitId:string;dueMinor:number}[]}>(
   await call("/api/finance/checks?tab=all","GET",undefined,cashier),200);
 assert.ok(cases.items.some(x=>x.visitId===visit.visit.id&&x.dueMinor===totalMinor));
 assert.equal((await call("/api/finance/checks/"+check.id,"GET",undefined,other)).status,404);
 assert.equal((await call("/api/finance/checks/"+check.id,"GET",undefined,kitchen)).status,403);
 // A real QR/PIN session sees only the current table's read-only bill and submits
 // an unaccepted request that must not appear in the cashier ledger/kitchen tickets.
 const qr=await expect<{url:string;code:string}>(await call("/api/guest/staff/qrs/"+table.id,
   "POST",{},owner),201);
 const parts=new URL(qr.url).pathname.split("/");
 const slug=parts[2]!,code=parts[4]!;
 const pin=await expect<{pin:string}>(await call("/api/guest/staff/visits/"+visit.visit.id+"/pin",
   "GET",undefined,waiter),200);
 const guest=await expect<{token:string}>(await call("/api/guest/entry/"+slug+"/"+code+
   "/verify","POST",{pin:pin.pin}),200);
 const bill=await expect<{totalMinor:number;paidMinor:number;lines:{nameFa:string}[]}>(
   await call("/api/guest/bill","GET",undefined,undefined,guest.token),200);
 assert.equal(bill.totalMinor,totalMinor);assert.equal(bill.paidMinor,0);assert.equal(bill.lines.length,2);
 const pending=await expect<{id:string;status:string}>(
   await call("/api/guest/orders","POST",{
     idempotencyKey:"p09-guest-"+randomUUID(),note:"Guest still deciding",lines:[line("Guest")]}
   ,undefined,guest.token),201);
 assert.equal(pending.status,"pending");
 assert.equal((await db.select().from(orderRound).where(eq(orderRound.visitId,visit.visit.id))).length,1);
 const noSplit=await call("/api/finance/checks/"+check.id+"/split","POST",{
   version:check.version,mode:"items",count:2,
   allocations:[{lineId:detail.lines[0]!.id,shareIndex:1,quantity:1}]},cashier);
 assert.equal(noSplit.status,409,"incomplete allocation rejected");
 const itemSplit=await expect<{check:{version:number;splitMode:string};shares:{amountMinor:number}[]}>(
   await call("/api/finance/checks/"+check.id+"/split","POST",{
     version:check.version,mode:"items",count:2,
     allocations:[{lineId:detail.lines[0]!.id,shareIndex:1,quantity:1},
       {lineId:detail.lines[1]!.id,shareIndex:2,quantity:1}]},cashier),200);
 assert.equal(itemSplit.check.splitMode,"items");
 assert.equal(itemSplit.shares.reduce((s,x)=>s+x.amountMinor,0),totalMinor);
 const equal=await expect<{check:{version:number};shares:{id:string;amountMinor:number}[]}>(
   await call("/api/finance/checks/"+check.id+"/split","POST",{
     version:itemSplit.check.version,mode:"equal",count:2},cashier),200);
 assert.equal(equal.shares.length,2);
 assert.equal(equal.shares[0]?.amountMinor,Math.floor(totalMinor/2));
 assert.equal(equal.shares[1]?.amountMinor,Math.ceil(totalMinor/2));
 assert.equal(equal.shares.reduce((s,x)=>s+x.amountMinor,0),totalMinor);
 assert.equal((await call("/api/orders/visits/"+visit.visit.id+"/rounds","POST",{
   ...orderBody,idempotencyKey:"p09-block-"+randomUUID()},waiter)).status,409,
   "late waiter order rejected after split lock");
 assert.equal((await call("/api/guest/orders","POST",{
   idempotencyKey:"p09-blockguest-"+randomUUID(),note:"Too late",lines:[line("Guest")]}
   ,undefined,guest.token)).status,409,"guest order rejected after check lock");
 const first=equal.shares[0]!,second=equal.shares[1]!;
 const bodyCash={version:equal.check.version,shareId:first.id,method:"cash",
   amountMinor:first.amountMinor,receivedMinor:first.amountMinor+500,
   note:"Cash tender with change",externalReference:"",idempotencyKey:"p09-cash-"+randomUUID()};
 assert.equal((await call("/api/finance/checks/"+check.id+"/payments","POST",bodyCash,cashier)).status,409,
   "shift required for cashier tender");
 const open1=await expect<{shift:{id:string};created:boolean}>(
   await call("/api/finance/shifts/open","POST",{openingFloatMinor:10000},cashier),201);
 const open2=await expect<{shift:{id:string};created:boolean}>(
   await call("/api/finance/shifts/open","POST",{openingFloatMinor:0},owner),201);
 const reqA=call("/api/finance/checks/"+check.id+"/payments","POST",bodyCash,cashier);
 const reqB=call("/api/finance/checks/"+check.id+"/payments","POST",{
   ...bodyCash,idempotencyKey:"p09-race-"+randomUUID()},owner);
 const [a,b]=await Promise.all([reqA,reqB]);
 assert.deepEqual([a.status,b.status].sort(),[201,409],"double cashier cannot overpay same share");
 const winner=a.status===201?{resp:a,request:bodyCash,cookie:cashier}:
   {resp:b,request:{...bodyCash},cookie:owner};
 const paid=await expect<{payment:{id:string;amountMinor:number;changeMinor:number};check:{paidMinor:number;version:number}}>(
   winner.resp,201);
 assert.equal(paid.payment.amountMinor,first.amountMinor);
 assert.equal(paid.payment.changeMinor,500);
 const firstPayment=await expect<{created:boolean;payment:{id:string}}>(
   await call("/api/finance/checks/"+check.id+"/payments","POST",
    {...bodyCash,version:equal.check.version},cashier),a.status===201?200:409);
 if(a.status===201)assert.equal(firstPayment.created,false);
 assert.equal((await call("/api/finance/checks/"+check.id+"/split","POST",{
   version:paid.check.version,mode:"single"},cashier)).status,409,"split locked after payment");
 const transfer={version:paid.check.version,shareId:second.id,method:"manual_transfer",
   amountMinor:second.amountMinor,receivedMinor:second.amountMinor,
   externalReference:"P09-DEMO-TRANSFER-1",note:"Verified by cashier",idempotencyKey:"p09-transfer-"+randomUUID()};
 assert.equal((await call("/api/finance/checks/"+check.id+"/payments","POST",{
   ...transfer,verifiedExternally:false},owner)).status,400);
 const transferPosted=await expect<{payment:{id:string};check:{version:number;paidMinor:number}}>(
   await call("/api/finance/checks/"+check.id+"/payments","POST",
    {...transfer,verifiedExternally:true},owner),201);
 assert.equal(transferPosted.check.paidMinor,totalMinor);
 const fullPaidOpen=await expect<{items:{visitId:string;dueMinor:number}[]}>(
   await call("/api/finance/checks?tab=all","GET",undefined,cashier),200);
 assert.ok(fullPaidOpen.items.some(x=>x.visitId===visit.visit.id&&x.dueMinor===0),
   "A paid-but-not-yet-settled visit must remain accessible for final settlement.");
 const partial=await expect<{items:{visitId:string}[]}>(
   await call("/api/finance/checks?tab=partial","GET",undefined,cashier),200);
 assert.ok(!partial.items.some(x=>x.visitId===visit.visit.id),"fully paid check absent from unpaid partial view");
 assert.equal((await call("/api/finance/checks/"+check.id+"/settle","POST",{
   version:transferPosted.check.version},cashier)).status,409,"cannot settle before service/pending guest order");
 await expect<{saved:boolean}>(await call("/api/orders/tickets/"+accepted.ticket.id+"/transition",
    "POST",{version:1,nextStatus:"preparing"},kitchen),200);
 await expect<{saved:boolean}>(await call("/api/orders/tickets/"+accepted.ticket.id+"/transition",
    "POST",{version:2,nextStatus:"ready"},kitchen),200);
 const served=await expect<{complete:boolean}>(await call("/api/orders/rounds/"+accepted.round.id+"/serve",
   "POST",{version:3},waiter),200);
 assert.equal(served.complete,true);
 const blockPending=await call("/api/finance/checks/"+check.id+"/settle","POST",{
   version:transferPosted.check.version},cashier);
 assert.equal(blockPending.status,409,"pending guest approval cannot be lost at settlement");
 const pendingDetails=await expect<{version:number}>(
   await call("/api/guest/staff/approvals/"+pending.id,"GET",undefined,owner),200);
 await expect<{status:string}>(await call("/api/guest/staff/approvals/"+pending.id+"/decision",
   "POST",{version:pendingDetails.version,decision:"reject",reason:"Table is paying now"},owner),200);
 const settled=await expect<{created:boolean;receiptId:string;receiptNumber:string}>(
   await call("/api/finance/checks/"+check.id+"/settle","POST",{
      version:transferPosted.check.version},cashier),201);
 assert.equal(settled.created,true);
 const retry=await expect<{created:boolean;receiptId:string}>(
   await call("/api/finance/checks/"+check.id+"/settle","POST",{
      version:transferPosted.check.version},owner),200);
 assert.equal(retry.created,false);assert.equal(retry.receiptId,settled.receiptId);
 const receipt=await expect<{snapshot:{totalMinor:number;paidMinor:number;taxMinor:number;
   serviceMinor:number;lines:{lineTotalMinor:number}[];payments:{amountMinor:number}[];
   footer:string};reprintCount:number}>(
   await call("/api/finance/receipts/"+settled.receiptId,"GET",undefined,cashier),200);
 assert.equal(receipt.snapshot.totalMinor,totalMinor);
 assert.equal(receipt.snapshot.paidMinor,totalMinor);
 assert.equal(receipt.snapshot.serviceMinor,1);
 assert.equal(receipt.snapshot.lines.reduce((s,x)=>s+x.lineTotalMinor,0),totalMinor-1);
 assert.equal(receipt.snapshot.payments.reduce((s,x)=>s+x.amountMinor,0),totalMinor);
 assert.equal(receipt.snapshot.footer,"Thank you. مرحبا");
 assert.equal((await call("/api/finance/receipts/"+settled.receiptId,"GET",undefined,other)).status,404);
 await expect<{reprintCount:number}>(await call("/api/finance/receipts/"+settled.receiptId+"/reprint",
   "POST",{},cashier),200);
 const [after]=await db.select().from(checkReceipt).where(eq(checkReceipt.id,settled.receiptId)).limit(1);
 assert.equal(after?.reprintCount,1);
 const [closedVisit]=await db.select().from(diningVisit).where(eq(diningVisit.id,visit.visit.id)).limit(1);
 const [tableRecord]=await db.select().from(diningTable).where(eq(diningTable.id,table.id)).limit(1);
 assert.equal(closedVisit?.status,"closed");
 assert.equal(tableRecord?.cleaning,true);
 assert.equal((await call("/api/guest/bill","GET",undefined,undefined,guest.token)).status,401);
 assert.equal((await call("/api/orders/visits/"+visit.visit.id+"/rounds","POST",{
   ...orderBody,idempotencyKey:"p09-final-"+randomUUID()},waiter)).status,409);
 const transactions=await expect<{items:{amountMinor:number}[];total:number}>(
    await call("/api/finance/transactions","GET",undefined,owner),200);
 assert.ok(transactions.items.some(x=>x.amountMinor===second.amountMinor));
 const current=await expect<{shift:{id:string};cashMinor:number;expectedMinor:number}>(
    await call("/api/finance/shifts/current","GET",undefined,cashier),200);
 assert.equal(current.expectedMinor,10000+(a.status===201?first.amountMinor:0),
   "Cashier shift must count only cash credited by the actual winning cashier.");
 const closeShift=await expect<{shift:{expectedMinor:number;varianceMinor:number}}>(
    await call("/api/finance/shifts/"+open1.shift.id+"/close","POST",{
      countMinor:current.expectedMinor},cashier),200);
 assert.equal(closeShift.shift.varianceMinor,0);
 const listing=await expect<{items:{number:string}[]}>(
   await call("/api/finance/receipts","GET",undefined,owner),200);
 assert.ok(listing.items.some(x=>x.number===settled.receiptNumber));
 // A new accepted round after the first check read must reconcile both the
 // cashier detail and open-check board before any financial lock is placed.
 const t2=await expect<{id:string}>(await call("/api/floor/tables","POST",{
   sectionId:section.id,label:"Z8",seats:3,sortOrder:98,notes:"Late round test",
   active:true,assignedWaiterId:w.id},owner),201);
 const v2=await expect<{visit:{id:string}}>(await call(
   "/api/floor/visits/tables/"+t2.id+"/open","POST",{partySize:2},waiter),201);
 const freshRound=(label:string)=>({
   idempotencyKey:"p09-late-"+randomUUID(),note:label,lines:[line(label)]});
 await expect<{round:{id:string}}>(await call(
   "/api/orders/visits/"+v2.visit.id+"/rounds","POST",freshRound("First"),waiter),201);
 const firstCheck=await expect<{id:string}>(await call(
   "/api/finance/visits/"+v2.visit.id+"/check","POST",{},cashier),200);
 const firstDetail=await expect<{check:{totalMinor:number;version:number;subtotalMinor:number}}>
   (await call("/api/finance/checks/"+firstCheck.id,"GET",undefined,cashier),200);
 const onePrice=burger.priceMinor+option.deltaMinor;
 assert.equal(firstDetail.check.totalMinor,onePrice+1);
 await expect<{round:{id:string}}>(await call(
   "/api/orders/visits/"+v2.visit.id+"/rounds","POST",freshRound("Second"),waiter),201);
 const twoDetails=await expect<{check:{totalMinor:number;version:number;subtotalMinor:number};
   shares:{id:string;amountMinor:number}[];lines:{id:string}[]}>(
   await call("/api/finance/checks/"+firstCheck.id,"GET",undefined,cashier),200);
 assert.equal(twoDetails.check.totalMinor,2*onePrice+1,
   "Open check detail includes the late round and charges service fee once.");
 assert.equal(twoDetails.check.subtotalMinor,2*onePrice);
 assert.ok(twoDetails.check.version>firstDetail.check.version);
 assert.equal(twoDetails.shares[0]?.amountMinor,twoDetails.check.totalMinor);
 assert.equal(twoDetails.lines.length,2);
 const boardLate=await expect<{items:{visitId:string;dueMinor:number}[]}>(
   await call("/api/finance/checks?tab=all","GET",undefined,cashier),200);
 assert.equal(boardLate.items.find(x=>x.visitId===v2.visit.id)?.dueMinor,2*onePrice+1);
 assert.equal((await call("/api/finance/checks/"+firstCheck.id+"/payments","POST",{
   version:twoDetails.check.version,shareId:twoDetails.shares[0]!.id,
   method:"cash",amountMinor:1,receivedMinor:1,externalReference:"",
   note:"Closed shift must reject",idempotencyKey:"p09-closed-"+randomUUID()
 },cashier)).status,409,"Posting cash to an already-closed shift is forbidden.");
 console.info("PASS P09: split quantities, penny rounding, cash change, verified transfer, shift ledger, concurrent cashiers, receipts, closed table, guest guards and tenant isolation.");
}
main().then(async()=>{await pool.end();}).catch(async e=>{console.error(e);await pool.end();process.exitCode=1;});
