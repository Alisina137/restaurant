import {and, count, eq, isNull, gt, sql} from "drizzle-orm";
import {db} from "./db";
import {diningTable,staffInvitation,subscriptionPlan,tenant,tenantMembership,tenantSubscription,tenantTrial,platformSetting} from "./schema";
import {fail} from "./menu-helpers";

type Tx=Parameters<Parameters<typeof db.transaction>[0]>[0];
export type Capacity="tables"|"staff"|"locations";
export async function subscriptionGate(tx:Tx,tenantId:string):Promise<void>{
 const [org]=await tx.select({status:tenant.status}).from(tenant).where(eq(tenant.id,tenantId)).limit(1);
 if(!org)fail(404,"NOT_FOUND","Restaurant unavailable.");
 if(org.status==="suspended"||org.status==="pending"||org.status==="rejected")
   fail(403,"SUBSCRIPTION_SUSPENDED","New service is paused. Contact the platform or review billing.");
 const [subscription]=await tx.select().from(tenantSubscription).where(eq(tenantSubscription.tenantId,tenantId)).limit(1);
 const now=Date.now();
 if(!subscription){
  if(org.status==="trial"){
   const [trial]=await tx.select().from(tenantTrial).where(eq(tenantTrial.tenantId,tenantId)).limit(1);
   if(!trial || trial.expiresAt.getTime()<=now)fail(402,"TRIAL_EXPIRED","Trial ended. Ask the owner to review billing.");
  }
  return; // Existing active pre-P12 tenants are grandfathered until assigned a plan.
 }
 if(subscription.status==="suspended")fail(403,"SUBSCRIPTION_SUSPENDED","Subscription suspended. Existing visits may still close.");
 if(subscription.status==="trial"){
  if(!subscription.trialEndsAt || subscription.trialEndsAt.getTime()<=now)
    fail(402,"TRIAL_EXPIRED","Trial ended. Ask the owner to review billing.");
 }else if(subscription.status==="active"){
  const [policy]=await tx.select({graceDays:platformSetting.graceDays}).from(platformSetting)
   .where(eq(platformSetting.id,"default")).limit(1);
  const automaticGraceMs=(policy?.graceDays??7)*86_400_000;
  if(!subscription.periodEnd || subscription.periodEnd.getTime()+automaticGraceMs<=now)
    fail(402,"RENEWAL_REQUIRED","Paid period and grace ended. Review outstanding invoices.");
 }else if(subscription.status==="grace"){
  if(!subscription.graceEndsAt || subscription.graceEndsAt.getTime()<=now)
    fail(402,"GRACE_ENDED","Grace period ended. New visits are unavailable.");
 }
}
/** Caller holds the tenant row FOR UPDATE across this check and insertion.
 * Counts pending invitations as reserved staff seats so invitation acceptance cannot exceed quota.
 */
export async function assertCapacity(tx:Tx,tenantId:string,kind:Capacity):Promise<void>{
 await subscriptionGate(tx,tenantId);
 const [sub]=await tx.select({planId:tenantSubscription.planId}).from(tenantSubscription)
  .where(eq(tenantSubscription.tenantId,tenantId)).limit(1);
 if(!sub?.planId)return;
 const [plan]=await tx.select().from(subscriptionPlan).where(eq(subscriptionPlan.id,sub.planId)).limit(1);
 if(!plan)fail(409,"PLAN_MISSING","Contact support to configure subscription.");
 if(kind==="locations")fail(403,"LOCATION_LIMIT","Multiple locations are not supported in this release.");
 if(kind==="tables"){
  const [c]=await tx.select({n:count()}).from(diningTable).where(and(eq(diningTable.tenantId,tenantId),isNull(diningTable.archivedAt)));
  if((c?.n??0)>=plan.maxTables)fail(409,"TABLE_LIMIT","Table limit reached. Ask owner to upgrade.");
 }else{
  const [active,pending]=await Promise.all([
   tx.select({n:count()}).from(tenantMembership).where(and(eq(tenantMembership.tenantId,tenantId),eq(tenantMembership.status,"active"))),
   tx.select({n:count()}).from(staffInvitation).where(and(eq(staffInvitation.tenantId,tenantId),eq(staffInvitation.status,"pending"),gt(staffInvitation.expiresAt,new Date())))
  ]);
  if((active[0]?.n??0)+(pending[0]?.n??0)>=plan.maxStaff)
    fail(409,"STAFF_LIMIT","Staff limit reached. Ask owner to upgrade.");
 }
}
