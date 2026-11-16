import "dotenv/config";
import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import {and,desc,eq} from "drizzle-orm";
import {db,pool} from "./db";
import {diningCheck,checkPayment,checkReceipt,diningSection,menuItem,menuItemGroup,
 menuModifierGroup,menuModifierOption,orderRound,kitchenTicket,user} from "./schema";
if(process.env.NODE_ENV==="production"||!process.env.DEMO_PASSWORD)
 throw new Error("P10 accepts disposable development database only.");
const BASE=process.env.E2E_API_URL??"http://localhost:4000";
async function call(path:string,method="GET",body?:unknown,cookie?:string){
 return fetch(BASE+path,{method,headers:{"Content-Type":"application/json",
  Origin:"http://localhost:3000",...(cookie?{Cookie:cookie}:{})},
  body:body===undefined?undefined:JSON.stringify(body)});
}
async function expect<T>(response:Response,status:number){
 const payload=await response.json() as T;
 assert.equal(response.status,status,JSON.stringify(payload));return payload;
}
async function login(email:string){
 for(let attempt=0;attempt<9;attempt++){
  const response=await call("/api/auth/sign-in/email","POST",
   {email,password:process.env.DEMO_PASSWORD});
  if(response.status===429){await new Promise(done=>setTimeout(done,11000));continue;}
  assert.equal(response.status,200,email+": "+await response.text());
  return response.headers.getSetCookie().map(x=>x.split(";")[0]).join("; ");
 }
 throw new Error("Login throttle did not clear for "+email);
}
async function main(){
 const cashier=await login("cashier-ci@example.test");
 const owner=await login("owner-ci@example.test");
 const waiter=await login("waiter-ci@example.test");
 const kitchen=await login("kitchen-ci@example.test");
 const other=await login("new-owner-ci@example.test");
 const [staff]=await db.select().from(user).where(eq(user.email,"waiter-ci@example.test")).limit(1);
 const [section]=await db.select().from(diningSection)
  .where(eq(diningSection.tenantId,"dev-restaurant")).limit(1);
 const [burger]=await db.select().from(menuItem).where(eq(menuItem.sku,"P05-BURGER")).limit(1);
 assert.ok(staff&&section&&burger);
 const [link]=await db.select().from(menuItemGroup).where(eq(menuItemGroup.itemId,burger.id)).limit(1);
 assert.ok(link);
 const [group]=await db.select().from(menuModifierGroup).where(eq(menuModifierGroup.id,link.groupId)).limit(1);
 const [option]=await db.select().from(menuModifierOption).where(and(
  eq(menuModifierOption.groupId,link.groupId),eq(menuModifierOption.deltaMinor,2500))).limit(1);
 assert.ok(group&&option);
 const tbl=await expect<{id:string}>(await call("/api/floor/tables","POST",{
  sectionId:section.id,label:"Q"+randomUUID().slice(0,6),seats:4,sortOrder:95,
  notes:"P10 correction integration",active:true,assignedWaiterId:staff.id},owner),201);
 const visit=await expect<{visit:{id:string}}>(await call("/api/floor/visits/tables/"+tbl.id+
  "/open","POST",{partySize:2},waiter),201);
 const line={itemId:burger.id,itemVersion:burger.version,quantity:1,note:"P10",
  selections:[{groupId:group.id,version:group.version,optionIds:[option.id]}]};
 const round=await expect<{round:{id:string;totalMinor:number};ticket:{id:string}}>(
  await call("/api/orders/visits/"+visit.visit.id+"/rounds","POST",{
   idempotencyKey:"p10-round-"+randomUUID(),note:"Customer correction",lines:[line]},waiter),201);
 const check=await expect<{id:string;version:number}>(await call("/api/finance/visits/"+visit.visit.id+
  "/check","POST",{},cashier),200);
 assert.equal((await call("/api/finance/checks/"+check.id+"/adjustments","POST",{
  kind:"discount",amountMinor:100,reason:"Reason meets minimum length",
  version:check.version,requestKey:"p10-forbid-"+randomUUID()},waiter)).status,403);
 const key="p10-void-"+randomUUID();
 const voidBody={kind:"void",roundId:round.round.id,version:check.version,
  reason:"Incorrect customer order",requestKey:key};
 const requested=await expect<{adjustment:{id:string;status:string;version:number;amountMinor:number}}>(
  await call("/api/finance/checks/"+check.id+"/adjustments","POST",voidBody,cashier),201);
 assert.equal(requested.adjustment.amountMinor,round.round.totalMinor);
 const replay=await expect<{created:boolean;adjustment:{id:string}}>(
  await call("/api/finance/checks/"+check.id+"/adjustments","POST",voidBody,cashier),200);
 assert.equal(replay.created,false);assert.equal(replay.adjustment.id,requested.adjustment.id);
 assert.equal((await call("/api/finance/checks/"+check.id+"/adjustments","POST",
  {...voidBody,reason:"Changed reason"},cashier)).status,409);
 assert.equal((await call("/api/finance/adjustments/"+requested.adjustment.id+"/decision",
  "POST",{version:1,decision:"approve"},cashier)).status,403,
  "requester cannot self-approve");
 assert.equal((await call("/api/finance/adjustments/"+requested.adjustment.id+"/decision",
  "POST",{version:1,decision:"approve"},other)).status,404,
  "another tenant cannot review correction");
 const voided=await expect<{adjustment:{status:string}}>(
  await call("/api/finance/adjustments/"+requested.adjustment.id+"/decision",
   "POST",{version:1,decision:"approve",note:"Duplicate entry"},owner),200);
 assert.equal(voided.adjustment.status,"applied");
 const [afterRound]=await db.select().from(orderRound).where(eq(orderRound.id,round.round.id)).limit(1);
 const [ticket]=await db.select().from(kitchenTicket).where(eq(kitchenTicket.id,round.ticket.id)).limit(1);
 assert.equal(afterRound?.status,"voided");assert.equal(ticket?.status,"voided");
 const empty=await expect<{check:{totalMinor:number;subtotalMinor:number}}>(
  await call("/api/finance/checks/"+check.id,"GET",undefined,cashier),200);
 assert.equal(empty.check.totalMinor,0);
 assert.equal((await call("/api/finance/adjustments/"+requested.adjustment.id+"/decision",
  "POST",{version:1,decision:"approve"},owner)).status,409);
 const round2=await expect<{round:{id:string;totalMinor:number}}>(
  await call("/api/orders/visits/"+visit.visit.id+"/rounds","POST",{
   idempotencyKey:"p10-revised-"+randomUUID(),note:"Correct meal",lines:[line]},waiter),201);
 const current=await expect<{check:{version:number;subtotalMinor:number;discountMinor:number;totalMinor:number}}>(
  await call("/api/finance/checks/"+check.id,"GET",undefined,cashier),200);
 assert.equal(current.check.subtotalMinor,round2.round.totalMinor);
 const disc=await expect<{adjustment:{id:string;version:number}}>(
  await call("/api/finance/checks/"+check.id+"/adjustments","POST",{
   kind:"discount",amountMinor:100,reason:"Guest service discount",
   version:current.check.version,requestKey:"p10-discount-"+randomUUID()},cashier),201);
 await expect<{adjustment:{status:string}}>(
  await call("/api/finance/adjustments/"+disc.adjustment.id+"/decision",
   "POST",{version:1,decision:"approve"},owner),200);
 const discounted=await expect<{check:{discountMinor:number;totalMinor:number}}>(
  await call("/api/finance/checks/"+check.id,"GET",undefined,cashier),200);
 assert.equal(discounted.check.discountMinor,100);
 assert.equal(discounted.check.totalMinor,current.check.totalMinor-100,
  "zero tax and fixed service policy make discount exactly 100 minor units");
 // A correction request cannot secretly cancel food once a kitchen worker starts.
 const [stillOpen]=await db.select().from(diningCheck).where(eq(diningCheck.id,check.id)).limit(1);
 const [newTicket]=await db.select().from(kitchenTicket).where(eq(kitchenTicket.roundId,round2.round.id)).limit(1);
 assert.ok(stillOpen&&newTicket);
 const late=await expect<{adjustment:{id:string;version:number}}>(
  await call("/api/finance/checks/"+check.id+"/adjustments","POST",{
   kind:"void",roundId:round2.round.id,reason:"Guest requested late change",
   version:stillOpen.version,requestKey:"p10-late-"+randomUUID()},cashier),201);
 assert.equal((await call("/api/finance/checks/"+check.id+"/split","POST",{
  mode:"single",version:stillOpen.version},cashier)).status,409,
  "cashiers cannot split a check while correction is awaiting approval");
 await expect<{saved:boolean}>(await call("/api/orders/tickets/"+newTicket.id+"/transition",
  "POST",{version:newTicket.version,nextStatus:"preparing"},kitchen),200);
 assert.equal((await call("/api/finance/adjustments/"+late.adjustment.id+"/decision",
  "POST",{version:late.adjustment.version,decision:"approve"},owner)).status,409,
  "manager must not void an order once kitchen preparation has started");
 const [prepared]=await db.select().from(kitchenTicket).where(eq(kitchenTicket.id,newTicket.id)).limit(1);
 assert.equal(prepared?.status,"preparing","prepared kitchen ticket survives denied void");
 await expect<{adjustment:{status:string}}>(await call("/api/finance/adjustments/"+late.adjustment.id+
  "/decision","POST",{version:late.adjustment.version,decision:"reject",
   note:"Kitchen already started preparation"},owner),200);
 // Waiter mobile requests are scoped to the assigned visit and reviewed in the manager queue.
 const round3=await expect<{round:{id:string;totalMinor:number}}>(
  await call("/api/orders/visits/"+visit.visit.id+"/rounds","POST",{
   idempotencyKey:"p10-waiter-round-"+randomUUID(),note:"Guest correction",lines:[line]},waiter),201);
 const preview=await expect<{request:null;canRequest:boolean}>(
  await call("/api/orders/rounds/"+round3.round.id+"/correction","GET",undefined,waiter),200);
 assert.equal(preview.request,null);assert.equal(preview.canRequest,true);
 const wk="p10-waiter-change-"+randomUUID();
 const wb={reason:"Guest cancelled this round",idempotencyKey:wk};
 const waiterRequest=await expect<{request:{id:string;status:string};created:boolean}>(
  await call("/api/orders/rounds/"+round3.round.id+"/correction","POST",wb,waiter),201);
 assert.equal(waiterRequest.request.status,"pending");
 const waiterReplay=await expect<{created:boolean;request:{id:string}}>(
  await call("/api/orders/rounds/"+round3.round.id+"/correction","POST",wb,waiter),200);
 assert.equal(waiterReplay.created,false);assert.equal(waiterReplay.request.id,waiterRequest.request.id);
 assert.equal((await call("/api/orders/rounds/"+round3.round.id+"/correction",
  "GET",undefined,other)).status,404);
 await expect<{adjustment:{status:string}}>(
  await call("/api/finance/adjustments/"+waiterRequest.request.id+"/decision",
   "POST",{version:1,decision:"approve",note:"Guest corrected order"},owner),200);
 const waiterFinal=await expect<{request:{status:string};canRequest:boolean}>(
  await call("/api/orders/rounds/"+round3.round.id+"/correction","GET",undefined,waiter),200);
 assert.equal(waiterFinal.request.status,"applied");assert.equal(waiterFinal.canRequest,false);
 const [cancelled]=await db.select().from(orderRound).where(eq(orderRound.id,round3.round.id)).limit(1);
 assert.equal(cancelled?.status,"voided");
 const [original]=await db.select().from(orderRound).where(eq(orderRound.id,round2.round.id)).limit(1);
 assert.equal(original?.totalMinor,round2.round.totalMinor,"order price snapshots never change");
 // Use a Phase 9 settled check containing an original cash tender.
 const pay=await db.select().from(checkPayment).where(and(
  eq(checkPayment.tenantId,"dev-restaurant"),eq(checkPayment.method,"cash")))
  .orderBy(desc(checkPayment.createdAt)).limit(30);
 let settled:typeof diningCheck.$inferSelect|undefined;
 let credited=0;
 for(const p of pay){
  const [c]=await db.select().from(diningCheck).where(eq(diningCheck.id,p.checkId)).limit(1);
  if(c?.status==="settled"){settled=c;credited=p.amountMinor;break;}
 }
 assert.ok(settled&&credited>0,"Phase 9 must provide a settled cash check");
 const [receiptBefore]=await db.select().from(checkReceipt).where(eq(checkReceipt.checkId,settled.id)).limit(1);
 assert.ok(receiptBefore);
 const toReturn=Math.min(100,credited);
 const refundReq=await expect<{adjustment:{id:string;version:number}}>(
  await call("/api/finance/checks/"+settled.id+"/adjustments","POST",{
   kind:"refund",amountMinor:toReturn,reason:"Customer quality complaint",
   version:settled.version,requestKey:"p10-refund-"+randomUUID()},cashier),201);
 assert.equal((await call("/api/finance/adjustments/"+refundReq.adjustment.id+"/refund",
  "POST",{version:1,method:"cash"},cashier)).status,409,"refund requires approval");
 await expect<{adjustment:{status:string}}>(
  await call("/api/finance/adjustments/"+refundReq.adjustment.id+"/decision",
   "POST",{version:1,decision:"approve"},owner),200);
 await expect<{shift:{id:string}}>(await call("/api/finance/shifts/open","POST",
  {openingFloatMinor:10000},cashier),201);
 const refundPath="/api/finance/adjustments/"+refundReq.adjustment.id+"/refund";
 const paid=await expect<{created:boolean;refund:{id:string;amountMinor:number}}>(
  await call(refundPath,"POST",{version:2,method:"cash",note:"Paid back to guest"},cashier),201);
 assert.equal(paid.refund.amountMinor,toReturn);
 const duplicate=await expect<{created:boolean;refund:{id:string}}>(
  await call(refundPath,"POST",{version:2,method:"cash",note:"Paid back to guest"},cashier),200);
 assert.equal(duplicate.created,false);assert.equal(duplicate.refund.id,paid.refund.id);
 const refundHistory=await expect<{items:{id:string;amountMinor:number;status:string}[]}>(
  await call("/api/finance/transactions?view=refunds","GET",undefined,cashier),200);
 assert.ok(refundHistory.items.some(x=>x.id===paid.refund.id&&x.amountMinor===-toReturn&&x.status==="refunded"),
  "Refund must appear as a separate negative ledger entry.");
 assert.equal((await call("/api/finance/transactions?view=made-up","GET",undefined,cashier)).status,400);
 const ledger=await expect<{refunds:{amountMinor:number}[];refundedMinor:number}>(
  await call("/api/finance/checks/"+settled.id,"GET",undefined,cashier),200);
 assert.ok(ledger.refunds.some(r=>r.amountMinor===toReturn));
 assert.ok(ledger.refundedMinor>=toReturn);
 const [receiptAfter]=await db.select().from(checkReceipt).where(eq(checkReceipt.id,receiptBefore.id)).limit(1);
 assert.deepEqual(receiptAfter?.snapshot,receiptBefore.snapshot,"prior receipt must remain immutable");
 const shift=await expect<{refundedCashMinor:number;expectedMinor:number;cashMinor:number;shift:{openingFloatMinor:number}}>(
  await call("/api/finance/shifts/current","GET",undefined,cashier),200);
 assert.ok(shift.refundedCashMinor>=toReturn);
 assert.equal(shift.expectedMinor,shift.shift.openingFloatMinor+shift.cashMinor-shift.refundedCashMinor);
 assert.equal((await call("/api/finance/checks/"+settled.id+"/adjustments","POST",{
  kind:"refund",amountMinor:settled.paidMinor,reason:"Attempt over refund",
  version:settled.version,requestKey:"p10-cap-"+randomUUID()},cashier)).status,409);
 const queue=await expect<{items:{id:string}[]}>(
  await call("/api/finance/adjustments?status=applied","GET",undefined,owner),200);
 assert.ok(queue.items.some(x=>x.id===refundReq.adjustment.id));
 const tenantCheck=await call("/api/finance/checks/"+settled.id,"GET",undefined,other);
 assert.equal(tenantCheck.status,404);
 console.info("P10 passed: tenant isolation, idempotency, self-review blocks, void/discount invariants, refund caps and shift reconciliation.");
}
void main().then(async()=>{await pool.end();}).catch(async error=>{console.error(error);await pool.end();process.exitCode=1;});
