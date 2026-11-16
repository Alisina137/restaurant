import "dotenv/config";
import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import {and,asc,count,eq} from "drizzle-orm";
import {db,pool} from "./db";
import {diningVisit,kitchenTicket,menuItem,menuItemGroup,menuModifierGroup,menuModifierOption,
 orderActivity,orderLine,orderOutbox,orderRound,staffNotification,tenantMembership,user} from "./schema";
if(process.env.NODE_ENV==="production"||!process.env.DEMO_PASSWORD)
 throw new Error("P06 requires disposable nonproduction CI database.");
const URL=process.env.E2E_API_URL??"http://localhost:4000",password=process.env.DEMO_PASSWORD;
async function req(path:string,method="GET",body?:unknown,cookie?:string){
 return fetch(URL+path,{method,headers:{"Content-Type":"application/json",
   Origin:"http://localhost:3000",...(cookie?{Cookie:cookie}:{})},
   body:body===undefined?undefined:JSON.stringify(body)});
}
async function json<T>(r:Response,expected:number){
 const body=await r.json() as T;
 assert.equal(r.status,expected,JSON.stringify(body));return body;
}
async function login(email:string){
 for(let n=0;n<5;n++){
   const r=await req("/api/auth/sign-in/email","POST",{email,password});
   if(r.status===429){await new Promise(done=>setTimeout(done,11000));continue;}
   assert.equal(r.status,200,"Failed sign-in "+email+" "+await r.text());
   return r.headers.getSetCookie().map(c=>c.split(";")[0]).join("; ");
 }
 throw new Error("Auth login throttled");
}
async function main(){
 const [owner,waiter,kitchen,other]=await Promise.all([
   login("owner-ci@example.test"),login("waiter-ci@example.test"),
   login("kitchen-ci@example.test"),login("new-owner-ci@example.test")]);
 const [who]=await db.select({id:user.id}).from(user).where(eq(user.email,"waiter-ci@example.test")).limit(1);
 assert.ok(who);
 const visits=await db.select().from(diningVisit).where(and(eq(diningVisit.waiterId,who.id),eq(diningVisit.status,"open"))).limit(1);
 const visit=visits[0];assert.ok(visit,"P04/P05 fixture has open visit");
 const rounds=await db.select().from(orderRound).where(eq(orderRound.visitId,visit.id)).orderBy(asc(orderRound.roundNumber));
 assert.equal(rounds.length,2,"P05 accepted two immutable rounds");
 const [first,second]=rounds;assert.ok(first&&second);
 const [initial]=await db.select().from(kitchenTicket).where(eq(kitchenTicket.roundId,first.id)).limit(1);
 const [secondTicket]=await db.select().from(kitchenTicket).where(eq(kitchenTicket.roundId,second.id)).limit(1);
 assert.ok(initial&&secondTicket);assert.equal(initial.status,"ready");assert.equal(initial.version,3);
 const alerts=await json<{items:{id:string;ticketId:string;roundId:string;readAt:string|null}[];unread:number}>(
   await req("/api/orders/notifications",undefined,undefined,waiter),200);
 assert.ok(alerts.items.some(a=>a.roundId===first.id&&a.readAt===null));
 assert.equal((await req("/api/orders/notifications",undefined,undefined,kitchen)).status,403);
 assert.equal((await req("/api/orders/notifications/"+alerts.items[0]!.id+"/read","POST",{},other)).status,403);
 const stream=await json<{events:{cursor:number;roundId:string;eventType:string}[];
   nextCursor:number;hasMore:boolean}>(await req("/api/orders/changes?after=0",undefined,undefined,waiter),200);
 assert.ok(stream.events.some(x=>x.roundId===first.id&&x.eventType==="kitchen.ready"));
 assert.ok(stream.events.every(x=>Number.isInteger(x.cursor)&&x.cursor>0));
 assert.ok(stream.events.every((x,i,a)=>i===0||x.cursor>a[i-1]!.cursor));
 assert.equal((await req("/api/orders/changes?after=NaN","GET",undefined,waiter)).status,400);
 const [a,b]=await Promise.all([
  req("/api/orders/tickets/"+initial.id+"/handoff","POST",{version:3},kitchen),
  req("/api/orders/tickets/"+initial.id+"/handoff","POST",{version:3},kitchen)]);
 assert.deepEqual([a.status,b.status].sort(),[200,409],"concurrent handoff only once");
 const pickup=await json<{items:{id:string;status:string;ticketVersion:number}[]}>(
   await req("/api/orders/my?status=ready",undefined,undefined,waiter),200);
 assert.ok(pickup.items.some(x=>x.id===first.id&&x.status==="picked_up"));
 assert.equal((await req("/api/orders/tickets/"+initial.id+"/notify","POST",{version:4},kitchen)).status,429,
  "reminder is throttled");
 await db.update(kitchenTicket).set({lastNotifiedAt:new Date(Date.now()-100_000)})
   .where(eq(kitchenTicket.id,initial.id));
 const reminder=await json<{notified:boolean;version:number}>(
   await req("/api/orders/tickets/"+initial.id+"/notify","POST",{version:4},kitchen),200);
 assert.equal(reminder.version,5);
 const [sameAlertCount]=await db.select({n:count()}).from(staffNotification).where(eq(staffNotification.roundId,first.id));
 assert.equal(sameAlertCount?.n,1,"reminder deduplicated to one inbox item");
 assert.equal((await req("/api/orders/rounds/"+first.id+"/serve","POST",{version:5},kitchen)).status,403,
  "kitchen cannot mark served");
 assert.equal((await req("/api/orders/rounds/"+first.id+"/serve","POST",{version:4},waiter)).status,409,
  "stale version prevents duplicate service");
 const served=await json<{complete:boolean;status:string}>(
   await req("/api/orders/rounds/"+first.id+"/serve","POST",{version:5},waiter),200);
 assert.equal(served.complete,true);assert.equal(served.status,"served");
 const details=await json<{ticket:{status:string;servedBy:string};lines:{kitchenStatus:string}[]}>(
   await req("/api/orders/rounds/"+first.id,undefined,undefined,waiter),200);
 assert.equal(details.ticket.status,"served");assert.ok(details.lines.every(x=>x.kitchenStatus==="served"));
 assert.equal((await req("/api/orders/rounds/"+first.id+"/serve","POST",{version:6},waiter)).status,409,
  "cannot serve twice");
 const done=await json<{items:{id:string;status:string}[]}>(
   await req("/api/orders/my?status=completed",undefined,undefined,waiter),200);
 assert.ok(done.items.some(x=>x.id===first.id&&x.status==="served"));
 const unread=await json<{items:{id:string}[];unread:number}>(
   await req("/api/orders/notifications?unread=1",undefined,undefined,waiter),200);
 assert.equal(unread.items.some(a=>a.id===alerts.items[0]!.id),false,
  "served round automatically clears its ready alert");
 // P06 per-line readiness: unstarted line cannot skip preparing.
 const [line]=await db.select().from(orderLine).where(eq(orderLine.roundId,second.id)).limit(1);
 assert.ok(line);
 assert.equal((await req("/api/orders/tickets/"+secondTicket.id+"/lines/"+line.id+"/ready",
   "POST",{version:1},kitchen)).status,409);
 await json<{saved:boolean}>(await req("/api/orders/tickets/"+secondTicket.id+"/transition",
   "POST",{version:1,nextStatus:"preparing"},kitchen),200);
 const [l1,l2]=await Promise.all([
  req("/api/orders/tickets/"+secondTicket.id+"/lines/"+line.id+"/ready","POST",{version:2},kitchen),
  req("/api/orders/tickets/"+secondTicket.id+"/lines/"+line.id+"/ready","POST",{version:2},kitchen)]);
 assert.deepEqual([l1.status,l2.status].sort(),[200,409],"concurrent line-ready converges");
 const [itemReady]=await db.select().from(kitchenTicket).where(eq(kitchenTicket.id,secondTicket.id));
 assert.equal(itemReady?.status,"ready");assert.equal(itemReady?.version,3);
 const [readyAlertCount]=await db.select({n:count()}).from(staffNotification)
   .where(eq(staffNotification.roundId,second.id));
 assert.equal(readyAlertCount?.n,1);
 await json<{complete:boolean}>(await req("/api/orders/rounds/"+second.id+"/lines/"+line.id+"/serve",
   "POST",{version:3},waiter),200);
 const [one]=await db.select().from(kitchenTicket).where(eq(kitchenTicket.id,secondTicket.id));
 assert.equal(one?.status,"served");
 assert.equal((await req("/api/orders/tickets/"+secondTicket.id+"/notify","POST",{version:4},kitchen)).status,409,
   "cannot remind after served");
 const history=await json<{items:{id:string;status:string}[];total:number}>(
   await req("/api/orders/kitchen/history?status=served",undefined,undefined,kitchen),200);
 assert.ok(history.items.some(x=>x.id===initial.id));
 assert.ok(history.items.some(x=>x.id===secondTicket.id));
 assert.equal((await req("/api/orders/kitchen/history?from=2026-99-99","GET",undefined,kitchen)).status,400);
 assert.equal((await req("/api/orders/kitchen/history?status=bogus","GET",undefined,kitchen)).status,400);
 const outside=await json<{items:{id:string}[]}>(
   await req("/api/orders/kitchen/history?status=served",undefined,undefined,other),200);
 assert.ok(!outside.items.some(x=>x.id===initial.id),"other tenant history is isolated");
 assert.equal((await req("/api/orders/tickets/"+initial.id+"/handoff","POST",{version:6},other)).status,404);
 assert.equal((await req("/api/orders/rounds/"+first.id+"/serve","POST",{version:6},other)).status,404);
 // A busy kitchen must reliably observe ten distinct accepted rounds and not lose an event.
 const [meal]=await db.select().from(menuItem).where(eq(menuItem.sku,"P05-BURGER")).limit(1);
 assert.ok(meal&&meal.version===2);
 const [link]=await db.select().from(menuItemGroup).where(eq(menuItemGroup.itemId,meal.id)).limit(1);
 assert.ok(link);
 const [group]=await db.select().from(menuModifierGroup).where(eq(menuModifierGroup.id,link.groupId)).limit(1);
 const [option]=await db.select().from(menuModifierOption).where(and(eq(menuModifierOption.groupId,link.groupId),
   eq(menuModifierOption.deltaMinor,2500))).limit(1);
 assert.ok(group&&option);
 const roundInput=(n:number)=>({idempotencyKey:"p06-rush-"+n+"-"+randomUUID(),
  note:"Rush service",lines:[{itemId:meal.id,itemVersion:meal.version,quantity:1,
   note:"Batch "+n,selections:[{groupId:group.id,version:group.version,optionIds:[option.id]}]}]});
 const rush=await Promise.all(Array.from({length:10},(_,i)=>
   req("/api/orders/visits/"+visit.id+"/rounds","POST",roundInput(i),waiter)));
 const newIds:string[]=[];
 for(const r of rush){const x=await json<{created:boolean;round:{id:string}}>(r,201);
   assert.equal(x.created,true);newIds.push(x.round.id);}
 assert.equal(new Set(newIds).size,10);
 const p6Tickets=await db.select().from(kitchenTicket);
 for(const id of newIds)assert.ok(p6Tickets.some(t=>t.roundId===id));
 const streamAfter=await json<{events:{cursor:number;roundId:string}[];nextCursor:number}>(
   await req("/api/orders/changes?after="+stream.nextCursor,undefined,undefined,waiter),200);
 assert.ok(streamAfter.events.length>0);
 assert.ok(streamAfter.events.every(x=>x.cursor>stream.nextCursor));
 // Revoking active waiter membership immediately disables the notification stream/API.
 const [membership]=await db.select().from(tenantMembership).where(and(
    eq(tenantMembership.tenantId,visit.tenantId),eq(tenantMembership.userId,who.id),
    eq(tenantMembership.role,"waiter"))).limit(1);
 assert.ok(membership);
 try{
   await db.update(tenantMembership).set({status:"disabled"}).where(eq(tenantMembership.id,membership.id));
   assert.equal((await req("/api/orders/notifications","GET",undefined,waiter)).status,403);
   assert.equal((await req("/api/orders/changes?after=0","GET",undefined,waiter)).status,403);
 }finally{
   await db.update(tenantMembership).set({status:"active"}).where(eq(tenantMembership.id,membership.id));
 }
 const [roundCount]=await db.select({n:count()}).from(orderRound).where(eq(orderRound.visitId,visit.id));
 assert.equal(roundCount?.n,12);
 const [outCount]=await db.select({n:count()}).from(orderOutbox);
 assert.ok((outCount?.n??0)>=17);
 console.info("PASS P06: 10-ticket rush, line-ready collisions, one-time ready notifications, throttle, pickup vs serving, history, cursor and RBAC.");
}
main().then(async()=>{await pool.end();}).catch(async e=>{console.error(e);await pool.end();process.exitCode=1;});
