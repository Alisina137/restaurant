import "dotenv/config";
import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import {and,eq,inArray} from "drizzle-orm";
import {db,pool} from "./db";
import {auth} from "./auth";
import {staffInvitation,tenantMembership,user} from "./schema";
if(process.env.NODE_ENV==="production"||!process.env.DEMO_PASSWORD)
 throw new Error("Phase 22 acceptance requires disposable CI-only data.");
const ROOT=process.env.E2E_API_URL??"http://localhost:4000",password=process.env.DEMO_PASSWORD;
async function request(path:string,method="GET",body?:unknown,cookie?:string){
 return fetch(ROOT+path,{method,headers:{"Content-Type":"application/json",Origin:"http://localhost:3000",
  ...(cookie?{Cookie:cookie}:{})},body:body===undefined?undefined:JSON.stringify(body)});
}
async function session(email:string){
 for(let count=0;count<9;count++){
  const response=await request("/api/auth/sign-in/email","POST",{email,password});
  if(response.status===429){await new Promise(done=>setTimeout(done,11000));continue;}
  assert.equal(response.status,200,email+": "+await response.text());
  return response.headers.getSetCookie().map(value=>value.split(";")[0]).join("; ");
 }
 throw new Error("Could not sign in after rate limit");
}
async function json<T>(response:Response,status=200):Promise<T>{
 const body=await response.text();
 assert.equal(response.status,status,"Unexpected response: "+body.slice(0,1300));
 return JSON.parse(body) as T;
}
type Hours=Record<string,null|{open:string;close:string}>;
type Settings={restaurant:{name:string};location:{name:string;city:string};
 setting:{updatedAt:string;timezone:string;locale:string;phone:string|null;address:string|null;
 receiptFooter:string;managerCanInvite:boolean;openingHours:Hours}};
type Summary={members:{active:number;disabled:number;total:number;byRole:Record<string,number>};
 invitations:{pending:number;failedDelivery:number};
 policy:{managerCanInvite:boolean};
 permissions:{canInvite:boolean;canManagePrivilegedRoles:boolean;allowedInviteRoles:string[]}};
type Member={id:string;userId:string;role:string;status:string;email:string};
type Invite={id:string;status:string;email:string;deliveryStatus:string};
type Page<T>={items:T[];total:number;page:number;perPage:number};
const api="/api/tenant";
const settingsBody=(settings:Settings,changes:Record<string,unknown>={})=>({
 name:settings.restaurant.name,locationName:settings.location.name,city:settings.location.city,
 phone:settings.setting.phone??"",address:settings.setting.address??"",timezone:settings.setting.timezone,
 locale:settings.setting.locale,receiptFooter:settings.setting.receiptFooter,
 managerCanInvite:settings.setting.managerCanInvite,openingHours:settings.setting.openingHours,
 expectedUpdatedAt:settings.setting.updatedAt,...changes
});
async function register(email:string,name:string,role:"manager"|"waiter"){
 const signed=await auth.api.signUpEmail({body:{email,name,password:password!}});
 assert.ok(signed?.user?.id,"Temporary test staff signup must work");
 await db.update(user).set({emailVerified:true}).where(eq(user.id,signed!.user!.id));
 const id=randomUUID();
 await db.insert(tenantMembership).values({id,tenantId:"dev-restaurant",userId:signed!.user!.id,
  role,status:"active"});
 return {id,userId:signed!.user!.id};
}
async function main(){
 const owner=await session("owner-ci@example.test"),
  other=await session("new-owner-ci@example.test"),
  kitchen=await session("kitchen-ci@example.test");
 assert.equal((await request(api+"/staff/overview")).status,401);
 assert.equal((await request(api+"/staff/overview","GET",undefined,kitchen)).status,403);
 const baseline=await json<Summary>(await request(api+"/staff/overview","GET",undefined,owner));
 assert.ok(baseline.members.active>=1);
 assert.equal(baseline.members.total,baseline.members.active+baseline.members.disabled);
 assert.equal(baseline.permissions.canManagePrivilegedRoles,true);
 const settings=await json<Settings>(await request(api+"/settings","GET",undefined,owner));
 const initialHours=settings.setting.openingHours;
 const newHours={mon:{open:"09:00",close:"21:30"},tue:null,
  fri:{open:"10:15",close:"22:45"}};
 assert.equal((await request(api+"/settings","PATCH",
  settingsBody(settings,{openingHours:{mon:{open:"22:00",close:"08:00"}}}),owner)).status,400,
  "Invalid closing-before-opening timetable rejected");
 assert.equal((await request(api+"/settings","PATCH",
  settingsBody(settings,{openingHours:{holiday:{open:"09:00",close:"17:00"}}}),owner)).status,400,
  "Unrecognized day rejected");
 assert.equal((await request(api+"/settings","PATCH",
  settingsBody(settings,{openingHours:{sun:{open:"9:00",close:"17:00"}}}),owner)).status,400,
  "Hours require valid strict HH:MM strings");
 assert.equal((await request(api+"/settings","PATCH",
  settingsBody(settings,{openingHours:newHours,managerCanInvite:false}),other)).status,403);
 const saved=await json<{saved:boolean}>(await request(api+"/settings","PATCH",
  settingsBody(settings,{openingHours:newHours,managerCanInvite:false}),owner));
 assert.equal(saved.saved,true);
 const fresh=await json<Settings>(await request(api+"/settings","GET",undefined,owner));
 assert.deepEqual(fresh.setting.openingHours,newHours,"Real restaurant opening hours persist");
 assert.equal(fresh.setting.managerCanInvite,false);
 assert.notEqual(fresh.setting.updatedAt,settings.setting.updatedAt);
 const stale=await json<{code:string}>(await request(api+"/settings","PATCH",
  settingsBody(settings,{managerCanInvite:true}),owner),409);
 assert.equal(stale.code,"VERSION_CONFLICT","Optimistic settings guard prevents lost updates");
 const suffix=randomUUID().slice(0,10);
 const manager=await register("p22-manager-"+suffix+"@example.test","P22 Manager "+suffix,"manager");
 const teammate=await register("p22-waiter-"+suffix+"@example.test","P22 Teammate "+suffix,"waiter");
 const managerCookie=await session("p22-manager-"+suffix+"@example.test");
 const managed=await json<Summary>(await request(api+"/staff/overview","GET",undefined,managerCookie));
 assert.equal(managed.permissions.canManagePrivilegedRoles,false);
 assert.equal(managed.permissions.canInvite,false,"Owner invitation policy disables manager invites immediately");
 assert.equal(managed.members.active,baseline.members.active+2);
 assert.equal(managed.members.byRole.manager,(baseline.members.byRole.manager??0)+1);
 assert.equal(managed.members.byRole.waiter,(baseline.members.byRole.waiter??0)+1);
 assert.equal((await request(api+"/invitations","POST",{
  email:"blocked-"+suffix+"@example.test",role:"waiter",message:"hello"},managerCookie)).status,403);
 assert.equal((await request(api+"/staff?role=pirate","GET",undefined,owner)).status,400);
 assert.equal((await request(api+"/staff?status=reserved","GET",undefined,owner)).status,400);
 assert.equal((await request(api+"/invitations?status=reserved","GET",undefined,owner)).status,400);
 const filtered=await json<Page<Member>>(await request(
  api+"/staff?q="+suffix+"&role=waiter&status=active","GET",undefined,owner));
 assert.equal(filtered.total,1);
 assert.equal(filtered.items[0]?.id,teammate.id);
 assert.equal(filtered.perPage,10,"Directory respects fixed server-side pagination");
 const nonexistent=await json<Page<Member>>(await request(api+"/staff?q="+suffix,"GET",undefined,other));
 assert.equal(nonexistent.total,0,"Other tenant cannot discover restaurant employees by email or name");
 const staleMember=await json<{code:string}>(await request(api+"/staff/"+teammate.id,"PATCH",
  {role:"cashier",status:"active",expectedRole:"kitchen",expectedStatus:"active"},owner),409);
 assert.equal(staleMember.code,"VERSION_CONFLICT");
 assert.equal((await request(api+"/staff/"+manager.id,"PATCH",
  {role:"waiter",status:"active",expectedRole:"manager",expectedStatus:"active"},managerCookie)).status,403,
  "Manager may not modify managers, including themselves");
 assert.equal((await request(api+"/staff/"+teammate.id,"PATCH",
  {role:"cashier",status:"disabled",expectedRole:"waiter",expectedStatus:"active"},managerCookie)).status,200,
  "Manager can change nonprivileged staff with revision lock");
 const disabled=await json<Page<Member>>(await request(
  api+"/staff?q="+suffix+"&status=disabled","GET",undefined,owner));
 assert.deepEqual(disabled.items.map(row=>row.id),[teammate.id]);
 assert.equal(disabled.items[0]?.role,"cashier");
 assert.equal((await request(api+"/staff/"+teammate.id,"PATCH",
  {role:"waiter",status:"active",expectedRole:"waiter",expectedStatus:"active"},owner)).status,409,
  "Stale member data cannot overwrite disabled role");
 const own=await json<Page<Member>>(await request(api+"/staff?role=owner","GET",undefined,owner));
 const self=own.items.find(x=>x.email==="owner-ci@example.test");
 assert.ok(self,"The only owner is visible in owner directory");
 assert.equal((await request(api+"/staff/"+self.id,"PATCH",
  {role:"manager",status:"active",expectedRole:"owner",expectedStatus:"active"},owner)).status,403,
  "Final owner must remain an owner");
 const updated=await json<Settings>(await request(api+"/settings","GET",undefined,owner));
 await json<{saved:boolean}>(await request(api+"/settings","PATCH",
  settingsBody(updated,{managerCanInvite:true}),owner));
 const enabled=await json<Summary>(await request(api+"/staff/overview","GET",undefined,managerCookie));
 assert.equal(enabled.permissions.canInvite,true);
 assert.equal((await request(api+"/invitations","POST",{
  email:"blocked-manager-"+suffix+"@example.test",role:"manager",message:""},managerCookie)).status,400,
  "Manager may never invite manager/owner, even with owner allowance");
 const email="p22-invite-"+suffix+"@example.test";
 const invited=await json<{id:string;deliveryStatus:string}>(await request(api+"/invitations","POST",
  {email,role:"waiter",message:"Join our floor"},managerCookie),201);
 assert.equal(invited.deliveryStatus,"sent","CI mail console mode must confirm send");
 const pending=await json<Page<Invite>>(await request(
  api+"/invitations?q="+suffix+"&status=pending&delivery=sent&role=waiter","GET",undefined,owner));
 assert.equal(pending.total,1);
 assert.equal(pending.items[0]?.id,invited.id);
 assert.equal((await request(api+"/invitations?q="+suffix,"GET",undefined,other)).status,200);
 const othersInvites=await json<Page<Invite>>(await request(api+"/invitations?q="+suffix,"GET",undefined,other));
 assert.equal(othersInvites.total,0,"Foreign restaurant cannot search invitation email addresses");
 const [inv]=await db.select().from(staffInvitation).where(eq(staffInvitation.id,invited.id)).limit(1);
 assert.equal(inv?.status,"pending");
 await db.update(staffInvitation).set({expiresAt:new Date(Date.now()-1000)})
  .where(eq(staffInvitation.id,invited.id));
 const expired=await json<Page<Invite>>(await request(
  api+"/invitations?q="+suffix+"&status=expired","GET",undefined,owner));
 assert.equal(expired.total,1,"Expiration must be filtered in SQL before pagination");
 const resent=await json<{deliveryStatus:string}>(await request(
  api+"/invitations/"+invited.id+"/resend","POST",{},managerCookie));
 assert.equal(resent.deliveryStatus,"sent","Resend renews expired pending token");
 const pendingAgain=await json<Page<Invite>>(await request(
  api+"/invitations?q="+suffix+"&status=pending","GET",undefined,owner));
 assert.equal(pendingAgain.total,1);
 await json<{revoked:boolean}>(await request(
  api+"/invitations/"+invited.id+"/revoke","POST",{},managerCookie));
 const revoked=await json<Page<Invite>>(await request(
  api+"/invitations?q="+suffix+"&status=revoked","GET",undefined,owner));
 assert.equal(revoked.total,1);
 assert.equal((await request(api+"/invitations/"+invited.id+"/resend","POST",{},owner)).status,409);
 // Restore the original owner policy and hours; tests run on disposable fixtures but avoid drift anyway.
 const latest=await json<Settings>(await request(api+"/settings","GET",undefined,owner));
 await json<{saved:boolean}>(await request(api+"/settings","PATCH",settingsBody(latest,{
  managerCanInvite:settings.setting.managerCanInvite,
  openingHours:initialHours}),owner));
 await db.delete(tenantMembership).where(inArray(tenantMembership.id,[manager.id,teammate.id]));
 const after=await json<Summary>(await request(api+"/staff/overview","GET",undefined,owner));
 assert.equal(after.members.active,baseline.members.active);
 assert.equal(after.members.disabled,baseline.members.disabled);
 assert.equal(after.members.byRole.manager,baseline.members.byRole.manager);
 console.info("PASS P22: real summaries and filtered staff/invites, role isolation, policy changes, expiry/resend/revoke, weekly hours and optimistic settings/member locks.");
}
main().then(async()=>{await pool.end();}).catch(async err=>{
 console.error(err);await pool.end();process.exitCode=1;
});
