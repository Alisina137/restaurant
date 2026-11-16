import {Router,type Request} from "express";
import {fromNodeHeaders} from "better-auth/node";
import {createHash,randomUUID} from "node:crypto";
import {eq,desc,sql} from "drizzle-orm";
import {auth} from "./auth";
import {db} from "./db";
import {contextFor} from "./context";
import {auditEvent,pilotGateEvent,pilotSignoffEvent,platformAdmin,tenant} from "./schema";
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
 const [rows,signoffs]=await Promise.all([
  q.select().from(pilotGateEvent).where(eq(pilotGateEvent.tenantId,tenantId))
   .orderBy(desc(pilotGateEvent.id)).limit(500),
  q.select().from(pilotSignoffEvent).where(eq(pilotSignoffEvent.tenantId,tenantId))
   .orderBy(desc(pilotSignoffEvent.id)).limit(50)
 ]);
 const latest=new Map<string,typeof rows[number]>();
 for(const row of rows)if(!latest.has(row.gateKey))latest.set(row.gateKey,row);
 const gates=pilotGates.map(gate=>({...gate,review:latest.get(gate.key)??null}));
 const complete=gates.every(g=>g.review?.result==="passed");
 const fingerprint=createHash("sha256").update(gates.map(g=>g.key+":"+String(g.review?.id??"-")).join("|")).digest("hex");
 const owner=signoffs.find(s=>s.stage==="owner")??null;
 const platform=signoffs.find(s=>s.stage==="platform")??null;
 const ownerCurrent=!!owner&&owner.fingerprint===fingerprint&&complete;
 const approved=ownerCurrent&&platform?.decision==="approved"&&platform.fingerprint===fingerprint&&
  platform.ownerSignoffId===owner.id;
 const status=approved?"signed_off":!complete?"blocked":!ownerCurrent?"awaiting_owner":
  platform?.ownerSignoffId===owner?.id&&platform.decision==="hold"?"held":"awaiting_platform";
 return {tenantId,gates,completed:gates.filter(g=>g.review?.result==="passed").length,
  total:gates.length,complete,fingerprint,ownerSignoff:owner,platformDecision:platform,status,
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
  if(decision==="approved"&&(!state.complete||!state.ownerSignoff||
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
