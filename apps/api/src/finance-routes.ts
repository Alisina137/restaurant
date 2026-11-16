import {Router} from "express";
import {and,asc,count,desc,eq,gte,inArray,lt,sql} from "drizzle-orm";
import {createHash,randomUUID} from "node:crypto";
import {db} from "./db";
import {auditEvent,cashierShift,checkActivity,checkPayment,checkReceipt,checkShare,
 checkShareLine,diningCheck,diningTable,diningVisit,financeSetting,guestSubmission,kitchenTicket,
 orderLine,orderRound,restaurantSetting,tenant,tenantMembership,user} from "./schema";
import {bodyObject,fail,field,int,route} from "./menu-helpers";
import {bump} from "./floor-helpers";
import {lockTable,currentOrders,calculate,currentPolicy,ensureCheck,financeScope,
 getCheckForVisit,fullCheck,lockedCheck,orderGuard,pendingGuard,splitValues,writeAudit,
 amountMax,type Tx,type FinanceScope} from "./finance-core";
import {guestAccess} from "./guest-security";
export const financeRouter=Router();
function id(req:import("express").Request){return field(req.params.id,100,"Identifier",1);}
const validPage=(v:unknown)=>typeof v==="string"&&/^\d+$/.test(v)?Math.min(Math.max(Number(v),1),10000):1;
function cashInt(input:unknown,label:string,min=0,max=amountMax){return int(input,label,min,max);}
async function currentShift(tx:Tx,scope:FinanceScope){
 const [shift]=await tx.select().from(cashierShift).where(and(
  eq(cashierShift.tenantId,scope.tenantId),eq(cashierShift.locationId,scope.locationId),
  eq(cashierShift.cashierId,scope.actorId),eq(cashierShift.status,"open"))).limit(1);
 return shift??null;
}
const financeGuard=(scope:FinanceScope)=>scope.role==="owner"||scope.role==="manager"||scope.role==="cashier";
financeRouter.get("/policy",route(async(req,res)=>{
 const scope=await financeScope(req,true);
 await db.insert(financeSetting).values({tenantId:scope.tenantId}).onConflictDoNothing();
 const [row]=await db.select().from(financeSetting).where(eq(financeSetting.tenantId,scope.tenantId)).limit(1);
 res.setHeader("Cache-Control","no-store");res.json(row);
}));
financeRouter.patch("/policy",route(async(req,res)=>{
 const scope=await financeScope(req,true),data=bodyObject(req),version=cashInt(data.version,"Version",1);
 const taxRateBps=cashInt(data.taxRateBps,"Tax rate (basis points)",0,10000);
 const serviceRateBps=cashInt(data.serviceRateBps,"Service rate (basis points)",0,10000);
 const serviceFixedMinor=cashInt(data.serviceFixedMinor,"Service amount",0,100_000_000);
 if(typeof data.taxInclusive!=="boolean")fail(400,"INVALID_POLICY","Tax inclusion must be boolean.");
 const receiptFooter=field(data.receiptFooter??"",250,"Receipt footer",0);
 const updated=await db.transaction(async tx=>{
   const [saved]=await tx.update(financeSetting).set({taxRateBps,serviceRateBps,
     serviceFixedMinor,taxInclusive:data.taxInclusive as boolean,receiptFooter,
     version:version+1,updatedAt:new Date()})
     .where(and(eq(financeSetting.tenantId,scope.tenantId),eq(financeSetting.version,version))).returning();
   if(!saved)fail(409,"VERSION_CONFLICT","Finance settings have changed. Reload.");
   await tx.insert(auditEvent).values({id:randomUUID(),tenantId:scope.tenantId,userId:scope.actorId,
     action:"finance.policy_changed",details:{taxRateBps,serviceRateBps,
       serviceFixedMinor,taxInclusive:data.taxInclusive,version:version+1}});
   return saved;
 });
 res.json(updated);
}));
financeRouter.get("/checks",route(async(req,res)=>{
 const scope=await financeScope(req);
 const page=validPage(req.query.page),tab=typeof req.query.tab==="string"?req.query.tab:"all";
 if(!["all","requested","partial"].includes(tab))fail(400,"INVALID_FILTER","Unsupported check view.");
 const search=typeof req.query.search==="string"?field(req.query.search,100,"Search"): "";
 const [visits,setting]=await Promise.all([
   db.select({visit:diningVisit,table:diningTable}).from(diningVisit)
     .innerJoin(diningTable,eq(diningVisit.tableId,diningTable.id))
     .where(and(eq(diningVisit.tenantId,scope.tenantId),eq(diningVisit.locationId,scope.locationId),
       eq(diningVisit.status,"open")))
     .orderBy(asc(diningVisit.openedAt)).limit(1000),
   db.select().from(financeSetting).where(eq(financeSetting.tenantId,scope.tenantId)).limit(1)
 ]);
 const checked=visits.map(x=>x.visit.id);
 const [checks,rounds]=await Promise.all([
   checked.length?db.select().from(diningCheck).where(and(eq(diningCheck.tenantId,scope.tenantId),
     inArray(diningCheck.visitId,checked))):Promise.resolve([]),
   checked.length?db.select({visitId:orderRound.visitId,totalMinor:orderRound.totalMinor})
      .from(orderRound).where(and(eq(orderRound.tenantId,scope.tenantId),
        inArray(orderRound.visitId,checked))):Promise.resolve([])
 ]);
 const policy=setting[0]?{taxRateBps:setting[0].taxRateBps,taxInclusive:setting[0].taxInclusive,
  serviceRateBps:setting[0].serviceRateBps,serviceFixedMinor:setting[0].serviceFixedMinor,
  receiptFooter:setting[0].receiptFooter}:{taxRateBps:0,taxInclusive:false,serviceRateBps:0,serviceFixedMinor:0,receiptFooter:""};
 const result=visits.map(({visit,table})=>{
  const c=checks.find(x=>x.visitId===visit.id);
  const sum=rounds.filter(x=>x.visitId===visit.id).reduce((s,x)=>s+x.totalMinor,0);
  const totals=c??calculate(sum,policy);
  return {id:c?.id??null,visitId:visit.id,tableId:table.id,tableLabel:table.label,
   waiterId:visit.waiterId,openedAt:visit.openedAt,status:c?.status??"open",
   amountMinor:totals.totalMinor,paidMinor:c?.paidMinor??0,
   dueMinor:totals.totalMinor-(c?.paidMinor??0),partial:(c?.paidMinor??0)>0,
   requested:false,version:c?.version??0,splitMode:c?.splitMode??"single"};
 }).filter(x=>x.dueMinor>0&&(tab==="all"||tab==="partial"&&x.partial||
    tab==="requested"&&x.requested)&&
    (!search||[x.tableLabel,x.visitId,x.id??""].some(y=>y.toLowerCase().includes(search.toLowerCase()))));
 // Requested state is only populated when P08 service requests exist; never invent a bill request.
 res.setHeader("Cache-Control","no-store");
 res.json({items:result.slice((page-1)*20,page*20),total:result.length,page,perPage:20,
   requestedAvailable:false});
}));
financeRouter.post("/visits/:id/check",route(async(req,res)=>{
 const scope=await financeScope(req),check=await getCheckForVisit(scope,id(req));
 res.status(200).json({id:check.id,number:check.number,version:check.version,status:check.status});
}));
financeRouter.get("/checks/:id",route(async(req,res)=>{
 const scope=await financeScope(req);
 const item=await fullCheck(scope,id(req));
 res.setHeader("Cache-Control","no-store");res.json(item);
}));
financeRouter.post("/checks/:id/split",route(async(req,res)=>{
 const scope=await financeScope(req),checkId=id(req),body=bodyObject(req);
 const version=cashInt(body.version,"Version",1),mode=body.mode;
 if(!["single","equal","items"].includes(mode))fail(400,"INVALID_SPLIT","Select single, equal or by item.");
 const n=mode==="single"?1:cashInt(body.count,"Number of shares",2,10);
 const allocations=body.allocations;
 const response=await db.transaction(async tx=>{
   const check=await lockedCheck(tx,scope,checkId);
   if(check.status!=="open"||check.paidMinor>0)fail(409,"SPLIT_LOCKED","Cannot change split after tender.");
   if(check.version!==version)fail(409,"VERSION_CONFLICT","Another cashier updated this check.");
   // Allow reconfiguration after a first split, but no new orders after a split has been created.
   const current=await currentOrders(tx,scope,check.visitId);
   if(!current.length)fail(409,"EMPTY_CHECK","No accepted items on this table.");
   if(current.reduce((s,r)=>s+r.totalMinor,0)!==check.subtotalMinor)
     fail(409,"CHECK_CHANGED","Order total changed. Reload.");
   let shareValues:number[],assignments:Array<{shareIndex:number;lineId:string;quantity:number;lineAmountMinor:number}>=[];
   if(mode==="items"){
     if(!Array.isArray(allocations)||allocations.length<1||allocations.length>300)
       fail(400,"INVALID_SPLIT","Allocate all item quantities among shares.");
     const lines=await tx.select().from(orderLine).where(and(eq(orderLine.tenantId,scope.tenantId),
       inArray(orderLine.roundId,current.map(r=>r.id))));
     const allocated=new Map<string,number>();const base=Array.from({length:n},()=>0);
     for(const entry of allocations){
       if(!entry||typeof entry!=="object"||Array.isArray(entry))fail(400,"INVALID_SPLIT","Invalid allocation.");
       const e=entry as Record<string,unknown>,index=cashInt(e.shareIndex,"Share",1,n);
       const lineId=field(e.lineId,100,"Line",1),quantity=cashInt(e.quantity,"Quantity",1,99);
       const line=lines.find(x=>x.id===lineId);
       if(!line)fail(409,"INVALID_SPLIT","One item is not in this check.");
       const found=allocated.get(lineId)??0;
       if(found+quantity>line.quantity)fail(409,"INVALID_SPLIT","Item quantity allocated more than once.");
       allocated.set(lineId,found+quantity);
       const price=line.unitPriceMinor*quantity;
       base[index-1]+=price;
       assignments.push({shareIndex:index,lineId,quantity,lineAmountMinor:price});
     }
     if(lines.some(x=>allocated.get(x.id)!==x.quantity))
       fail(409,"INCOMPLETE_SPLIT","Every accepted item quantity must be allocated exactly once.");
     if(base.some(x=>x===0))fail(409,"EMPTY_SHARE","Every share must contain at least one item.");
     const extra=check.totalMinor-check.subtotalMinor;
     let allocatedCharge=0;
     shareValues=base.map((x,i)=>{
       const portion=i===base.length-1?extra-allocatedCharge:
         Math.floor(extra*x/Math.max(1,check.subtotalMinor));
       allocatedCharge+=portion;return x+portion;
     });
   }else{
     shareValues=splitValues(check.totalMinor,n);
   }
   if(shareValues.reduce((s,x)=>s+x,0)!==check.totalMinor)
     fail(503,"SPLIT_MISMATCH","Split amounts do not match the check.");
   await tx.delete(checkShareLine).where(eq(checkShareLine.checkId,check.id));
   await tx.delete(checkShare).where(eq(checkShare.checkId,check.id));
   const rows=[];
   for(let i=0;i<n;i++){
     const [share]=await tx.insert(checkShare).values({id:randomUUID(),checkId:check.id,
       tenantId:scope.tenantId,shareIndex:i+1,label:"Share "+(i+1),
       amountMinor:shareValues[i]!,paidMinor:0}).returning();
     if(!share)fail(503,"SPLIT_MISMATCH","Unable to allocate share.");rows.push(share);
   }
   for(const a of assignments){
     await tx.insert(checkShareLine).values({id:randomUUID(),checkId:check.id,
       shareId:rows[a.shareIndex-1]!.id,lineId:a.lineId,quantity:a.quantity,
       lineAmountMinor:a.lineAmountMinor});
   }
   const [next]=await tx.update(diningCheck).set({splitMode:mode as string,splitCount:n,
     version:version+1,lockedAt:mode==="single"&&check.paidMinor===0?null:(check.lockedAt??new Date()),
     updatedAt:new Date()}).where(eq(diningCheck.id,check.id)).returning();
   await writeAudit(tx,scope,check.id,"check.split",{mode,count:n,shares:shareValues});
   return {check:next,shares:rows};
 });
 res.json(response);
}));
financeRouter.post("/checks/:id/payments",route(async(req,res)=>{
 const scope=await financeScope(req),checkId=id(req),body=bodyObject(req);
 const idem=field(body.idempotencyKey,100,"Payment key",12);
 if(!/^[A-Za-z0-9_-]{12,100}$/.test(idem))fail(400,"INVALID_KEY","Invalid payment key.");
 const version=cashInt(body.version,"Version",1);
 const shareId=field(body.shareId,100,"Share",1);
 const method=body.method;
 if(method!=="cash"&&method!=="manual_transfer")fail(400,"INVALID_TENDER","Use cash or verified external transfer.");
 const amountMinor=cashInt(body.amountMinor,"Payment amount",1);
 const receivedMinor=cashInt(body.receivedMinor,"Received amount",1);
 const externalReference=field(body.externalReference??"",100,"Transfer reference");
 const note=field(body.note??"",250,"Payment note");
 if(receivedMinor<amountMinor)fail(400,"INSUFFICIENT_CASH","Received amount cannot be below the credited amount.");
 if(method==="manual_transfer"&&(!externalReference||body.verifiedExternally!==true))
   fail(400,"TRANSFER_VERIFICATION_REQUIRED","Confirm external transfer and provide reference.");
 if(method==="manual_transfer"&&receivedMinor!==amountMinor)
   fail(400,"INVALID_TRANSFER","Manual transfer cannot issue change.");
 if(method==="cash"&&externalReference)fail(400,"INVALID_TENDER","Cash payments must not have transfer reference.");
 const payload=JSON.stringify({shareId,method,amountMinor,receivedMinor,externalReference,note});
 const requestHash=createHash("sha256").update(payload).digest("hex");
 const result=await db.transaction(async tx=>{
   const check=await lockedCheck(tx,scope,checkId);
   const [prior]=await tx.select().from(checkPayment).where(and(
     eq(checkPayment.checkId,check.id),eq(checkPayment.idempotencyKey,idem))).limit(1);
   if(prior){
     if(prior.requestHash!==requestHash)
       fail(409,"IDEMPOTENCY_CONFLICT","Payment key belongs to a different amount.");
     return {created:false,payment:prior,check};
   }
   if(check.status!=="open")fail(409,"CHECK_SETTLED","Check already settled.");
   if(check.version!==version)fail(409,"VERSION_CONFLICT","Check changed on another device.");
   const [share]=await tx.select().from(checkShare).where(and(eq(checkShare.id,shareId),
     eq(checkShare.checkId,check.id),eq(checkShare.tenantId,scope.tenantId))).limit(1);
   if(!share)fail(404,"NOT_FOUND","Split share unavailable.");
   if(amountMinor>share.amountMinor-share.paidMinor||amountMinor>check.totalMinor-check.paidMinor)
      fail(409,"OVERPAYMENT","Amount exceeds remaining share or check balance.");
   const shift=await currentShift(tx,scope);
   if(!shift)fail(409,"SHIFT_REQUIRED","Open your cashier shift before recording tender.");
   const changeMinor=receivedMinor-amountMinor,now=new Date();
   const [payment]=await tx.insert(checkPayment).values({id:randomUUID(),tenantId:scope.tenantId,
     locationId:scope.locationId,checkId:check.id,shareId,shiftId:shift.id,
     cashierId:scope.actorId,idempotencyKey:idem,requestHash,method,
     amountMinor,receivedMinor,changeMinor,
     externalReference:method==="manual_transfer"?externalReference:null,note,createdAt:now}).returning();
   if(!payment)fail(503,"PAYMENT_FAILED","Tender could not be posted.");
   await tx.update(checkShare).set({paidMinor:share.paidMinor+amountMinor})
     .where(eq(checkShare.id,share.id));
   const [next]=await tx.update(diningCheck).set({paidMinor:check.paidMinor+amountMinor,
     lockedAt:check.lockedAt??now,version:version+1,updatedAt:now})
     .where(eq(diningCheck.id,check.id)).returning();
   await writeAudit(tx,scope,check.id,"payment.posted",{
      paymentId:payment.id,shareId,method,amountMinor,receivedMinor,changeMinor,
      ...(externalReference?{externalReference}:{})});
   return {created:true,payment,check:next};
 });
 res.status(result.created?201:200).json(result);
}));
financeRouter.get("/shifts/current",route(async(req,res)=>{
 const scope=await financeScope(req);
 const shift=await db.transaction(tx=>currentShift(tx,scope));
 const payments=shift?await db.select().from(checkPayment).where(and(
    eq(checkPayment.shiftId,shift.id),eq(checkPayment.tenantId,scope.tenantId))):[];
 const cashMinor=payments.filter(x=>x.method==="cash").reduce((n,x)=>n+x.amountMinor,0);
 res.setHeader("Cache-Control","no-store");
 res.json({shift,transactions:payments.length,cashMinor,transferMinor:payments.filter(x=>x.method==="manual_transfer")
   .reduce((n,x)=>n+x.amountMinor,0),expectedMinor:(shift?.openingFloatMinor??0)+cashMinor});
}));
financeRouter.post("/shifts/open",route(async(req,res)=>{
 const scope=await financeScope(req),body=bodyObject(req);
 const openingFloatMinor=cashInt(body.openingFloatMinor??0,"Opening cash float");
 const result=await db.transaction(async tx=>{
   // Unique active-shift constraint makes concurrent open attempts converge.
   const shift=await currentShift(tx,scope);
   if(shift)return {created:false,shift};
   const [created]=await tx.insert(cashierShift).values({id:randomUUID(),
     tenantId:scope.tenantId,locationId:scope.locationId,cashierId:scope.actorId,
     openingFloatMinor}).onConflictDoNothing().returning();
   if(!created){
     const existing=await currentShift(tx,scope);
     if(!existing)fail(503,"SHIFT_UNAVAILABLE","Try opening the shift again.");
     return {created:false,shift:existing};
   }
   await tx.insert(auditEvent).values({id:randomUUID(),tenantId:scope.tenantId,userId:scope.actorId,
     action:"finance.shift_opened",details:{shiftId:created.id,openingFloatMinor}});
   return {created:true,shift:created};
 });
 res.status(result.created?201:200).json(result);
}));
financeRouter.post("/shifts/:id/close",route(async(req,res)=>{
 const scope=await financeScope(req),shiftId=id(req),body=bodyObject(req);
 const countMinor=cashInt(body.countMinor,"Counted cash");
 const response=await db.transaction(async tx=>{
   await tx.execute(sql`SELECT id FROM cashier_shifts WHERE id=${shiftId}
    AND tenant_id=${scope.tenantId} FOR UPDATE`);
   const [shift]=await tx.select().from(cashierShift).where(and(
     eq(cashierShift.id,shiftId),eq(cashierShift.tenantId,scope.tenantId),
     eq(cashierShift.locationId,scope.locationId))).limit(1);
   if(!shift)fail(404,"NOT_FOUND","Shift unavailable.");
   if(shift.cashierId!==scope.actorId&&scope.role!=="owner"&&scope.role!=="manager")
     fail(403,"ACCESS_DENIED","Only shift cashier or manager can close it.");
   if(shift.status!=="open")fail(409,"SHIFT_CLOSED","Shift has already closed.");
   const items=await tx.select().from(checkPayment).where(eq(checkPayment.shiftId,shiftId));
   const expected=shift.openingFloatMinor+items.filter(x=>x.method==="cash").reduce((n,x)=>n+x.amountMinor,0);
   const variance=countMinor-expected;
   if(Math.abs(variance)>5_000&&scope.role!=="owner"&&scope.role!=="manager")
     fail(403,"MANAGER_ACK_REQUIRED","Large cash variance requires a manager to close this shift.");
   const [closed]=await tx.update(cashierShift).set({status:"closed",closingCountMinor:countMinor,
     expectedMinor:expected,varianceMinor:variance,supervisorId:Math.abs(variance)>5_000?scope.actorId:null,
     closedAt:new Date()}).where(eq(cashierShift.id,shiftId)).returning();
   await tx.insert(auditEvent).values({id:randomUUID(),tenantId:scope.tenantId,userId:scope.actorId,
     action:"finance.shift_closed",details:{shiftId,expected,countMinor,variance,
       acknowledged:Math.abs(variance)>5_000}});
   return closed!;
 });
 res.json({shift:response});
}));
financeRouter.get("/shifts/history",route(async(req,res)=>{
 const scope=await financeScope(req),page=validPage(req.query.page);
 const where=and(eq(cashierShift.tenantId,scope.tenantId),eq(cashierShift.locationId,scope.locationId),
   eq(cashierShift.status,"closed"),
   scope.role==="cashier"?eq(cashierShift.cashierId,scope.actorId):undefined);
 const [items,totals]=await Promise.all([
   db.select().from(cashierShift).where(where).orderBy(desc(cashierShift.closedAt))
     .limit(10).offset((page-1)*10),
   db.select({n:count()}).from(cashierShift).where(where)
 ]);
 res.json({items,total:totals[0]?.n??0,page,perPage:10});
}));
