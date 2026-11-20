import {Router,type Request} from "express";
import {fromNodeHeaders} from "better-auth/node";
import {createHash,randomUUID} from "node:crypto";
import {and,count,eq,desc,inArray,isNull,min,max,sql} from "drizzle-orm";
import {auth} from "./auth";
import {db} from "./db";
import {contextFor} from "./context";
import {auditEvent,pilotGateEvent,pilotSignoffEvent,platformAdmin,tenant,location,diningVisit,diningCheck,cashierShift,diningTable,menuItem,kitchenTicket,orderOutbox,pilotIncident,pilotIncidentEvent} from "./schema";
import {bodyObject,fail,field,route} from "./menu-helpers";

/** The user must perform these gates: this page only records accountable, manually verified evidence. */
export const pilotGates=[
 {key:"roles",title:"Role journey & permissions",help:"Owner, manager, waiter, kitchen, cashier, guest and platform admin; revoke access and confirm tenant denial."},
 {key:"qr",title:"QR and guest session security",help:"Real printed QR/PIN, rotation and expiry, invalid attempts and reconnect without duplicate orders."},
 {key:"orders",title:"Kitchen to table lifecycle",help:"Real waiter and guest orders, kitchen prepare/ready, handoff and additional order rounds."},
 {key:"cash",title:"Cash and refund reconciliation",help:"Real shifts, split tender, cash change, approved refunds; reconcile physical drawer, immutable receipts and CSV."},
 {key:"billing",title:"Subscription and invoice verification",help:"Two unrelated restaurants, real manual proof review and subscription suspend/grace/resume."},
 {key:"languages",title:"Dari, Pashto and English",help:"RTL/LTR in all real roles including price/date labels, navigation, dialogs, invoices and printing."},
 {key:"devices",title:"Target devices and printers",help:"Low-end Android Expo Go, kitchen display, 320–1280 px browsers, receipt printer with real paper."},
 {key:"accessibility",title:"Accessible service operation",help:"Keyboard-only flows, visible focus, screen-reader labels, contrast and reduced-motion checks."},
 {key:"reliability",title:"Simulated rush & reconnect",help:"Peak simultaneous orders across two tenants, dropped network, outbox backlog recovery and no lost tickets."},
 {key:"backups",title:"Database and media restore",help:"Isolated PostgreSQL restore rehearsal, media recovery, measured RPO/RTO and secrets/retention checks."},
 {key:"rollback",title:"Deployment and incident drill",help:"Staging migration, previous-image rollback, readiness/alerts, incident contact and operator availability."},
 {key:"shift",title:"Supervised full restaurant shift",help:"Restaurant contact signs off a completed live shift; count visits, reconcile receipts, refunds and final reports."}
] as const;
type Actor={id:string;tenantId:string|null;role:string};
type Tx=Parameters<Parameters<typeof db.transaction>[0]>[0];
export const tenantPilotRouter=Router(),platformPilotRouter=Router();
async function actor(req:Request,platform=false):Promise<Actor>{
 const session=await auth.api.getSession({headers:fromNodeHeaders(req.headers)});
 if(!session)fail(401,"UNAUTHENTICATED","Sign in to continue.");
 const ctx=await contextFor({id:session.user.id,name:session.user.name,email:session.user.email});
 if(!ctx)fail(403,"ACCESS_DENIED","Active membership required.");
 if(platform){
  const [row]=await db.select({id:platformAdmin.userId}).from(platformAdmin)
   .where(eq(platformAdmin.userId,session.user.id)).limit(1);
  if(ctx.role!=="platform_admin"||!row)fail(403,"ACCESS_DENIED","Platform operator required.");
  return {id:session.user.id,tenantId:null,role:ctx.role};
 }
 if(!ctx.tenantId||(ctx.role!=="owner"&&ctx.role!=="manager"))
  fail(403,"ACCESS_DENIED","Restaurant owner or manager required.");
 return {id:session.user.id,tenantId:ctx.tenantId,role:ctx.role};
}
async function snapshot(q:Pick<typeof db,"select">,tenantId:string){
 // A full restaurant pilot may re-test the same gate hundreds of times.
 // Limiting the latest 500 *global* rows loses evidence for other gates, and
 // limiting the latest 50 signatures can hide an older still-current owner
 // sign-off beneath platform holds. Select ONE latest row per gate/stage using
 // tenant-scoped indexed max IDs instead. This is safe in db + locked tx.
 const latestGateIds=q.select({id:max(pilotGateEvent.id)}).from(pilotGateEvent)
  .where(eq(pilotGateEvent.tenantId,tenantId)).groupBy(pilotGateEvent.gateKey);
 const latestSignoffIds=q.select({id:max(pilotSignoffEvent.id)}).from(pilotSignoffEvent)
  .where(eq(pilotSignoffEvent.tenantId,tenantId)).groupBy(pilotSignoffEvent.stage);
 const [rows,signoffs,incidentCounts,incidentCursor]=await Promise.all([
  q.select().from(pilotGateEvent).where(and(
   eq(pilotGateEvent.tenantId,tenantId),inArray(pilotGateEvent.id,latestGateIds)))
   .orderBy(desc(pilotGateEvent.id)),
  q.select().from(pilotSignoffEvent).where(and(
   eq(pilotSignoffEvent.tenantId,tenantId),inArray(pilotSignoffEvent.id,latestSignoffIds)))
   .orderBy(desc(pilotSignoffEvent.id)),
  q.select({total:count(),
   open:sql<number>`count(*) filter (where ${pilotIncident.status}='open')::integer`,
   blocking:sql<number>`count(*) filter (where ${pilotIncident.status}='open'
    and ${pilotIncident.severity} in ('p0','p1'))::integer`})
   .from(pilotIncident).where(eq(pilotIncident.tenantId,tenantId)),
  q.select({id:pilotIncidentEvent.id}).from(pilotIncidentEvent)
   .where(eq(pilotIncidentEvent.tenantId,tenantId))
   .orderBy(desc(pilotIncidentEvent.id)).limit(1)
 ]);
 const latest=new Map<string,typeof rows[number]>();
 for(const row of rows)if(!latest.has(row.gateKey))latest.set(row.gateKey,row);
 const gates=pilotGates.map(gate=>({...gate,review:latest.get(gate.key)??null}));
 const complete=gates.every(g=>g.review?.result==="passed");
 const incidentSummary={total:incidentCounts[0]?.total??0,
  open:Number(incidentCounts[0]?.open??0),blocking:Number(incidentCounts[0]?.blocking??0)};
 // Every new incident event invalidates previous owner AND platform signatures.
 // A resolved blocker still requires fresh accountable signatures.
 const fingerprint=createHash("sha256").update(
  gates.map(g=>g.key+":"+String(g.review?.id??"-")).join("|")+
  "|incidentEvent:"+String(incidentCursor[0]?.id??"-")).digest("hex");
 const owner=signoffs.find(s=>s.stage==="owner")??null;
 const platform=signoffs.find(s=>s.stage==="platform")??null;
 const ownerCurrent=!!owner&&owner.fingerprint===fingerprint&&complete&&incidentSummary.blocking===0;
 const approved=ownerCurrent&&platform?.decision==="approved"&&platform.fingerprint===fingerprint&&
  platform.ownerSignoffId===owner.id;
 const status=approved?"signed_off":!complete||incidentSummary.blocking>0?"blocked":!ownerCurrent?"awaiting_owner":
  platform?.ownerSignoffId===owner?.id&&platform.decision==="hold"?"held":"awaiting_platform";
 return {tenantId,gates,completed:gates.filter(g=>g.review?.result==="passed").length,
  total:gates.length,complete,incidents:incidentSummary,fingerprint,ownerSignoff:owner,platformDecision:platform,status,
  note:"Evidence and signatures are operator assertions; they do not certify external device, cash, backup or production deployment tests."};
}
function audit(tx:Tx,a:Actor,tenantId:string,action:string,details:Record<string,unknown>){
 return tx.insert(auditEvent).values({id:randomUUID(),tenantId,userId:a.id,action,details});
}
function tenantKey(req:Request){
 const id=req.params.id;
 if(typeof id!=="string"||id.length<1||id.length>100)fail(404,"NOT_FOUND","Restaurant unavailable.");
 return id;
}
async function present(tenantId:string){
 const [org]=await db.select({id:tenant.id,name:tenant.name,status:tenant.status})
  .from(tenant).where(eq(tenant.id,tenantId)).limit(1);
 if(!org)fail(404,"NOT_FOUND","Restaurant unavailable.");
 return org;
}
tenantPilotRouter.get("/",route(async(req,res)=>{
 const a=await actor(req),status=await snapshot(db,a.tenantId!);
 res.setHeader("Cache-Control","no-store");
 res.json({...status,canEdit:a.role==="owner"});
}));

/**
 * P32 read-only operational pulse for the real restaurant owner/manager pilot.
 * This is diagnostic evidence only: it does not update, validate, or sign any
 * of the twelve accountable physical acceptance gates.
 */
tenantPilotRouter.get("/operations",route(async(req,res)=>{
 const a=await actor(req);
 const minutes=typeof req.query.minutes==="string"?Number(req.query.minutes):60;
 if(![60,180,360].includes(minutes))
  fail(400,"INVALID_FILTER","Select a 60, 180 or 360-minute reporting window.");
 const [loc]=await db.select({id:location.id}).from(location)
  .where(eq(location.tenantId,a.tenantId!)).limit(1);
 if(!loc)fail(409,"LOCATION_NOT_READY","Restaurant location has not been provisioned.");
 const since=new Date(Date.now()-minutes*60000),tenantId=a.tenantId!;
 const [ticketRows,visits,checks,shifts,outbox,tables,menu]=await Promise.all([
  db.select({
   acceptedWindow:sql<number>`count(*) filter (where ${kitchenTicket.createdAt} >= ${since})::integer`,
   observedWindow:sql<number>`count(*) filter (where
    ${kitchenTicket.createdAt} >= ${since} AND ${kitchenTicket.firstDisplayedAt} IS NOT NULL)::integer`,
   activeTickets:sql<number>`count(*) filter (where
    ${kitchenTicket.status} IN ('new','preparing','ready','picked_up'))::integer`,
   activeWithoutReport:sql<number>`count(*) filter (where
    ${kitchenTicket.status} IN ('new','preparing','ready','picked_up')
    AND ${kitchenTicket.firstDisplayedAt} IS NULL)::integer`,
   pickupPending:sql<number>`count(*) filter (where
    ${kitchenTicket.status} = 'picked_up'
    AND ${kitchenTicket.pickupAcknowledgedAt} IS NULL)::integer`,
   oldestUnreportedAt:sql<Date|null>`min(${kitchenTicket.createdAt}) filter (where
    ${kitchenTicket.status} IN ('new','preparing','ready','picked_up')
    AND ${kitchenTicket.firstDisplayedAt} IS NULL)`
  }).from(kitchenTicket).where(and(eq(kitchenTicket.tenantId,tenantId),
   eq(kitchenTicket.locationId,loc.id))),
  db.select({n:count()}).from(diningVisit).where(and(eq(diningVisit.tenantId,tenantId),
   eq(diningVisit.locationId,loc.id),eq(diningVisit.status,"open"))),
  db.select({n:count()}).from(diningCheck).where(and(eq(diningCheck.tenantId,tenantId),
   eq(diningCheck.locationId,loc.id),eq(diningCheck.status,"open"))),
  db.select({n:count()}).from(cashierShift).where(and(eq(cashierShift.tenantId,tenantId),
   eq(cashierShift.locationId,loc.id),eq(cashierShift.status,"open"))),
  db.select({n:count(),oldestAt:min(orderOutbox.createdAt)})
   .from(orderOutbox).where(and(eq(orderOutbox.tenantId,tenantId),
    eq(orderOutbox.locationId,loc.id),isNull(orderOutbox.deliveredAt))),
  db.select({n:count()}).from(diningTable).where(and(eq(diningTable.tenantId,tenantId),
   eq(diningTable.locationId,loc.id),eq(diningTable.active,true),
   isNull(diningTable.archivedAt))),
  db.select({n:count()}).from(menuItem).where(and(eq(menuItem.tenantId,tenantId),
   eq(menuItem.locationId,loc.id),eq(menuItem.published,true),
   isNull(menuItem.archivedAt)))
 ]);
 const ticket=ticketRows[0],pending=outbox[0];
 const age=(date:Date|null|undefined)=>date?
  Math.max(0,Math.floor((Date.now()-date.getTime())/1000)):null;
 res.setHeader("Cache-Control","no-store");
 res.json({minutes,from:since.toISOString(),checkedAt:new Date().toISOString(),
  evidence:"tenant_scoped_database_snapshot",tenantId,locationId:loc.id,
  acceptedWindow:ticket?.acceptedWindow??0,observedWindow:ticket?.observedWindow??0,
  activeTickets:ticket?.activeTickets??0,
  activeWithoutReport:ticket?.activeWithoutReport??0,
  oldestUnreportedAt:ticket?.oldestUnreportedAt??null,
  pickupPending:ticket?.pickupPending??0,
  openVisits:visits[0]?.n??0,openChecks:checks[0]?.n??0,
  openCashierShifts:shifts[0]?.n??0,
  activeTables:tables[0]?.n??0,publishedItems:menu[0]?.n??0,
  pendingOutbox:pending?.n??0,oldestPendingOutboxAt:pending?.oldestAt??null,
  oldestPendingOutboxAgeSeconds:age(pending?.oldestAt),
  measurement:"Outbox delivery means internal in-app revision processing, NOT delivery to a kitchen device. Missing display reports are not proof humans missed orders.",
  pilotCertified:false});
}));

/**
 * Phase 33: incident log is deliberately distinct from pilot gate attestations.
 * No operator entry, resolution or dashboard observation can auto-pass a gate.
 * The shared tenant lock serializes incident revisions with P14 signatures.
 */
function incidentId(req:Request):string{
 const id=req.params.id;
 if(typeof id!=="string"||!/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(id))
  fail(404,"NOT_FOUND","Pilot incident not found.");
 return id;
}
function incidentGate(key:unknown):string{
 if(typeof key!=="string"||!pilotGates.some(g=>g.key===key))
  fail(400,"INVALID_GATE","Choose a valid pilot acceptance gate.");
 return key;
}
function incidentSeverity(severity:unknown):string{
 if(severity!=="p0"&&severity!=="p1"&&severity!=="p2")
  fail(400,"INVALID_SEVERITY","Use P0, P1 or P2.");
 return severity;
}
tenantPilotRouter.get("/incidents",route(async(req,res)=>{
 const a=await actor(req),raw=typeof req.query.page==="string"?Number(req.query.page):1;
 if(!Number.isSafeInteger(raw)||raw<1||raw>1000)
  fail(400,"INVALID_PAGE","Page must be between 1 and 1000.");
 const status=typeof req.query.status==="string"?req.query.status:"open";
 if(!["open","resolved","all"].includes(status))
  fail(400,"INVALID_FILTER","Status must be open, resolved or all.");
 const severity=typeof req.query.severity==="string"?req.query.severity:"all";
 if(!["p0","p1","p2","all"].includes(severity))
  fail(400,"INVALID_FILTER","Severity must be P0, P1, P2 or all.");
 const where=and(eq(pilotIncident.tenantId,a.tenantId!),
  status==="all"?undefined:eq(pilotIncident.status,status),
  severity==="all"?undefined:eq(pilotIncident.severity,severity));
 const [rows,totals]=await Promise.all([
  db.select().from(pilotIncident).where(where)
   .orderBy(desc(pilotIncident.createdAt),desc(pilotIncident.id))
   .limit(10).offset((raw-1)*10),
  db.select({total:count()}).from(pilotIncident).where(where)
 ]);
 res.setHeader("Cache-Control","no-store");
 res.json({items:rows,total:totals[0]?.total??0,page:raw,perPage:10,status,
  severity,checkedAt:new Date().toISOString()});
}));
tenantPilotRouter.post("/incidents",route(async(req,res)=>{
 const a=await actor(req),body=bodyObject(req);
 const gateKey=incidentGate(body.gateKey),severity=incidentSeverity(body.severity);
 const title=field(body.title,120,"Incident title",8);
 const details=field(body.details,1500,"Observed incident and response",25);
 const id=randomUUID();
 await db.transaction(async tx=>{
  await lock(tx,a.tenantId!);
  await tx.insert(pilotIncident).values({id,tenantId:a.tenantId!,gateKey,severity,
   title,details,openedBy:a.id});
  await tx.insert(pilotIncidentEvent).values({tenantId:a.tenantId!,
   incidentId:id,action:"opened",severity,gateKey,note:details,
   actorId:a.id,version:1});
  await audit(tx,a,a.tenantId!,"pilot.incident_opened",{incidentId:id,severity,gateKey});
 });
 res.setHeader("Cache-Control","no-store");
 res.status(201).json({id,version:1,status:"open"});
}));
tenantPilotRouter.get("/incidents/:id/events",route(async(req,res)=>{
 const a=await actor(req),id=incidentId(req);
 const [incident]=await db.select({id:pilotIncident.id,version:pilotIncident.version})
  .from(pilotIncident).where(and(eq(pilotIncident.tenantId,a.tenantId!),
   eq(pilotIncident.id,id))).limit(1);
 if(!incident)fail(404,"NOT_FOUND","Pilot incident not found.");
 const events=await db.select().from(pilotIncidentEvent).where(and(
  eq(pilotIncidentEvent.tenantId,a.tenantId!),eq(pilotIncidentEvent.incidentId,id)))
  .orderBy(desc(pilotIncidentEvent.id)).limit(100);
 res.setHeader("Cache-Control","no-store");
 res.json({incidentId:id,version:incident.version,events});
}));
tenantPilotRouter.post("/incidents/:id/:action",route(async(req,res)=>{
 const a=await actor(req),id=incidentId(req),action=req.params.action;
 if(action!=="resolve"&&action!=="reopen")fail(404,"NOT_FOUND","Incident action not found.");
 if(action==="resolve"&&a.role!=="owner")
  fail(403,"OWNER_REQUIRED","Only the restaurant owner can attest a resolved incident.");
 const body=bodyObject(req),v=body.expectedVersion;
 if(typeof v!=="number"||!Number.isSafeInteger(v)||v<1)
  fail(400,"INVALID_VERSION","Expected incident version is required.");
 const note=field(body.note,1500,action==="resolve"?
  "Manual retest evidence and resolution":"Reopening reason",action==="resolve"?35:25);
 const result=await db.transaction(async tx=>{
  await lock(tx,a.tenantId!);
  const [old]=await tx.select().from(pilotIncident).where(and(
   eq(pilotIncident.tenantId,a.tenantId!),eq(pilotIncident.id,id))).limit(1);
  if(!old)fail(404,"NOT_FOUND","Pilot incident not found.");
  if(old.version!==v)fail(409,"INCIDENT_VERSION_CHANGED",
   "Another operator revised this incident. Refresh and review.");
  if(old.status!==(action==="resolve"?"open":"resolved"))
   fail(409,"INCIDENT_STATE_CHANGED","Refresh the current incident before changing it.");
  const nextStatus=action==="resolve"?"resolved":"open",version=old.version+1;
  await tx.update(pilotIncident).set({status:nextStatus,version,updatedAt:new Date(),
   resolvedAt:action==="resolve"?new Date():null})
   .where(and(eq(pilotIncident.id,id),eq(pilotIncident.tenantId,a.tenantId!)));
  await tx.insert(pilotIncidentEvent).values({tenantId:a.tenantId!,incidentId:id,
   action:action==="resolve"?"resolved":"reopened",severity:old.severity,
   gateKey:old.gateKey,note,actorId:a.id,version});
  await audit(tx,a,a.tenantId!,"pilot.incident_"+(action==="resolve"?"resolved":"reopened"),
   {incidentId:id,severity:old.severity,gateKey:old.gateKey,version});
  return {id,status:nextStatus,version};
 });
 res.setHeader("Cache-Control","no-store");
 res.json(result);
}));

tenantPilotRouter.post("/gates",route(async(req,res)=>{
 const a=await actor(req);if(a.role!=="owner")fail(403,"OWNER_REQUIRED","Only the owner can attest pilot evidence.");
 const body=bodyObject(req),key=body.key,result=body.result;
 if(typeof key!=="string"||!pilotGates.some(g=>g.key===key))fail(400,"INVALID_GATE","Unknown pilot gate.");
 if(result!=="passed"&&result!=="failed")fail(400,"INVALID_RESULT","Choose passed or failed.");
 const evidence=field(body.evidence,1500,"Evidence and reviewer observations",25);
 const output=await db.transaction(async tx=>{

  await lock(tx,a.tenantId!);
  const [row]=await tx.insert(pilotGateEvent).values({tenantId:a.tenantId!,gateKey:key,
   result,evidence,actorId:a.id}).returning({id:pilotGateEvent.id});
  await audit(tx,a,a.tenantId!,"pilot.gate_recorded",{gate:key,result,reviewId:row!.id});
  return row!;
 });
 res.status(201).json({id:output.id,status:"recorded"});
}));

async function lock(tx:Tx,tenantId:string){
 await tx.execute(sql`SELECT id FROM tenants WHERE id=${tenantId} FOR UPDATE`);
}
tenantPilotRouter.post("/signoff",route(async(req,res)=>{
 const a=await actor(req);if(a.role!=="owner")fail(403,"OWNER_REQUIRED","Restaurant owner required.");
 const note=field(bodyObject(req).note,1500,"Owner sign-off notes",30);
 const result=await db.transaction(async tx=>{
  await lock(tx,a.tenantId!);
  const state=await snapshot(tx,a.tenantId!);
  if(!state.complete)fail(409,"PILOT_GATES_PENDING","Every pilot gate must be marked passed with evidence.");
  if(state.incidents.blocking>0)fail(409,"PILOT_INCIDENTS_OPEN",
   "Resolve all open P0/P1 incidents and repeat required evidence review before signing.");
  const [row]=await tx.insert(pilotSignoffEvent).values({tenantId:a.tenantId!,
   stage:"owner",decision:"ready",fingerprint:state.fingerprint,note,actorId:a.id})
   .returning({id:pilotSignoffEvent.id});
  await audit(tx,a,a.tenantId!,"pilot.owner_signed",{signoffId:row!.id});
  return row!;
 });
 res.status(201).json({id:result.id,status:"awaiting_platform"});
}));
platformPilotRouter.get("/",route(async(req,res)=>{
 await actor(req,true);
 const pageRaw=Number(req.query.page??1);
 const page=Number.isSafeInteger(pageRaw)&&pageRaw>0?Math.min(pageRaw,1000):1;
 const orgs=await db.select({id:tenant.id,name:tenant.name,status:tenant.status})
  .from(tenant).orderBy(desc(tenant.createdAt)).limit(20).offset((page-1)*20);
 const rows=await Promise.all(orgs.map(async org=>{
  const state=await snapshot(db,org.id);
  return {...org,pilotStatus:state.status,completed:state.completed,total:state.total};
 }));
 res.setHeader("Cache-Control","no-store");res.json({items:rows,page,perPage:20});
}));
platformPilotRouter.get("/:id",route(async(req,res)=>{
 await actor(req,true);const org=await present(tenantKey(req));
 res.setHeader("Cache-Control","no-store");
 res.json({restaurant:org,...await snapshot(db,org.id)});
}));
platformPilotRouter.post("/:id/decision",route(async(req,res)=>{
 const a=await actor(req,true),id=tenantKey(req),body=bodyObject(req);
 const decision=body.decision;if(decision!=="approved"&&decision!=="hold")
  fail(400,"INVALID_DECISION","Choose approved or hold.");
 const note=field(body.note,1500,"Independent platform review notes",30);
 const result=await db.transaction(async tx=>{
  await lock(tx,id);
  const [org]=await tx.select({id:tenant.id}).from(tenant).where(eq(tenant.id,id)).limit(1);
  if(!org)fail(404,"NOT_FOUND","Restaurant unavailable.");
  const state=await snapshot(tx,id);
  if(decision==="approved"&&(state.incidents.blocking>0||!state.complete||!state.ownerSignoff||
      state.ownerSignoff.fingerprint!==state.fingerprint))
   fail(409,"OWNER_SIGNOFF_REQUIRED","Current verified evidence and owner sign-off are required.");
  const [row]=await tx.insert(pilotSignoffEvent).values({tenantId:id,
   stage:"platform",decision,fingerprint:state.fingerprint,
   ownerSignoffId:state.ownerSignoff?.id??null,note,actorId:a.id})
    .returning({id:pilotSignoffEvent.id});
  await audit(tx,a,id,"pilot.platform_decision",{decision,signoffId:row!.id});
  return row!;
 });
 res.status(201).json({id:result.id,decision});
}));
