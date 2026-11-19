import {and,inArray,isNull,sql} from "drizzle-orm";
import {db} from "./db";
import {orderOutbox,orderRevision} from "./schema";
import {outboxRuntimeMonitor} from "./phase35-operations";

/**
 * Outbox entries are committed alongside accepted order/kitchen changes.
 * A replay updates the durable in-app revision cursor and THEN marks that
 * entry reconciled. It DOES NOT claim mobile push or external webhook delivery.
 * SKIP LOCKED enables multiple API replicas without duplicate processing.
 */
export async function reconcileOutboxBatch(limit=200):Promise<number>{
 if(!Number.isSafeInteger(limit)||limit<1||limit>1000)throw new Error("Invalid outbox batch.");
 return db.transaction(async tx=>{
  const result=await tx.execute(sql<{id:string;tenant_id:string;location_id:string}>`
   SELECT id,tenant_id,location_id FROM order_outbox
   WHERE delivered_at IS NULL ORDER BY created_at,id
   LIMIT ${limit} FOR UPDATE SKIP LOCKED`);
  const rows=result.rows as Array<{id:string;tenant_id:string;location_id:string}>;
  if(!rows.length)return 0;
  const byLocation=new Map<string,string>();
  for(const row of rows)byLocation.set(row.location_id,row.tenant_id);
  const now=new Date();
  for(const [locationId,tenantId] of byLocation){
   await tx.insert(orderRevision).values({locationId,tenantId,version:1,changedAt:now})
    .onConflictDoUpdate({target:orderRevision.locationId,
      set:{version:sql`${orderRevision.version} + 1`,changedAt:now}});
  }
  await tx.update(orderOutbox).set({deliveredAt:now})
   .where(and(isNull(orderOutbox.deliveredAt),inArray(orderOutbox.id,rows.map(row=>row.id))));
  return rows.length;
 });
}

export function startOutboxReconciliation():()=>void{
 if(process.env.OUTBOX_RECONCILIATION==="off"){
  outboxRuntimeMonitor.disable();return ()=>outboxRuntimeMonitor.stop();
 }
 outboxRuntimeMonitor.start();
 let active=false,stopped=false;
 const tick=async()=>{
  if(active||stopped)return;active=true;
  outboxRuntimeMonitor.begin();
  try{
   const processed=await reconcileOutboxBatch();
   outboxRuntimeMonitor.success(processed);
   if(processed)console.info(JSON.stringify({kind:"outbox_reconciled",count:processed}));
  }catch{
   // Some SQL/driver failures include connection strings or hostnames.
   // Emit only a bounded diagnostic count, never the raw exception.
   outboxRuntimeMonitor.failure();
   const failures=outboxRuntimeMonitor.snapshot().consecutiveFailures;
   if(failures===1||failures===3||failures%10===0)
    console.error(JSON.stringify({kind:"outbox_reconcile_retry",consecutiveFailures:failures}));
  }finally{active=false;}
 };
 const timer=setInterval(()=>{void tick();},3000);
 timer.unref();
 void tick();
 return ()=>{stopped=true;clearInterval(timer);outboxRuntimeMonitor.stop();};
}
