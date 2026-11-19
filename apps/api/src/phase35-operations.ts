/**
 * Phase 35: bounded, instance-local observability for durable revision outbox.
 *
 * These metrics are process observations, NOT durable delivery acknowledgements,
 * external alerts, or evidence that a guest/kitchen device received an event.
 * Keep token-bearing errors, tenant identifiers and order details out of snapshots.
 */
export type WorkerMode="starting"|"active"|"disabled"|"stopped";
export type OutboxRuntimeSnapshot={
 mode:WorkerMode;startedAt:string|null;lastAttemptAt:string|null;
 lastSuccessAt:string|null;lastFailureAt:string|null;
 consecutiveFailures:number;inFlight:boolean;processedSinceStart:number;
};
export type OperationalSignal=
 "OUTBOX_BACKLOG"|"OUTBOX_DELAY"|"OUTBOX_CRITICAL_DELAY"|
 "WORKER_DISABLED"|"WORKER_RETRYING"|"WORKER_STALLED"|"WORKER_STARTING";
export type OperationsAssessment={
 status:"ok"|"attention";severity:"ok"|"investigate"|"urgent";
 signals:OperationalSignal[];checkedAt:string;
 actionRequired:boolean;pilotCertified:false;scope:"server_instance_and_shared_outbox";
};

export function createOutboxRuntimeMonitor(now:()=>number=Date.now){
 let mode:WorkerMode="stopped",startedAt:string|null=null;
 let lastAttemptAt:string|null=null,lastSuccessAt:string|null=null,lastFailureAt:string|null=null;
 let consecutiveFailures=0,processedSinceStart=0,inFlight=false;
 const stamp=()=>new Date(now()).toISOString();
 const snapshot=():OutboxRuntimeSnapshot=>({
  mode,startedAt,lastAttemptAt,lastSuccessAt,lastFailureAt,
  consecutiveFailures,inFlight,processedSinceStart
 });
 return {
  start(){mode="starting";startedAt=stamp();lastAttemptAt=null;lastSuccessAt=null;
   lastFailureAt=null;consecutiveFailures=0;processedSinceStart=0;inFlight=false;},
  disable(){mode="disabled";startedAt=stamp();inFlight=false;},
  begin(){if(mode==="stopped"||mode==="disabled")return;
   inFlight=true;lastAttemptAt=stamp();},
  success(count:number){if(mode==="stopped"||mode==="disabled")return;
   mode="active";inFlight=false;consecutiveFailures=0;lastSuccessAt=stamp();
   if(Number.isSafeInteger(count)&&count>0)
    processedSinceStart=Math.min(Number.MAX_SAFE_INTEGER,processedSinceStart+count);
  },
  failure(){if(mode==="stopped"||mode==="disabled")return;
   inFlight=false;consecutiveFailures=Math.min(100000,consecutiveFailures+1);
   lastFailureAt=stamp();},
  stop(){mode="stopped";inFlight=false;},
  snapshot
 };
}
export const outboxRuntimeMonitor=createOutboxRuntimeMonitor();

function elapsedSeconds(value:string|null,nowMs:number):number|null{
 if(!value)return null;
 const parsed=Date.parse(value);
 return Number.isFinite(parsed)?Math.max(0,Math.floor((nowMs-parsed)/1000)):null;
}

/** Returns diagnostic classification only. No auto-release or auto-signoff. */
export function evaluateOperations(
 pendingOutbox:number,
 oldestPendingAgeSeconds:number|null,
 runtime:OutboxRuntimeSnapshot,
 nowMs=Date.now()
):OperationsAssessment{
 const signals:OperationalSignal[]=[];
 if(pendingOutbox>5000)signals.push("OUTBOX_BACKLOG");
 if(oldestPendingAgeSeconds!==null&&oldestPendingAgeSeconds>60)
  signals.push("OUTBOX_DELAY");
 if(oldestPendingAgeSeconds!==null&&oldestPendingAgeSeconds>300)
  signals.push("OUTBOX_CRITICAL_DELAY");
 if(runtime.mode==="disabled")signals.push("WORKER_DISABLED");
 else if(runtime.mode!=="stopped"){
  if(runtime.consecutiveFailures>0)signals.push("WORKER_RETRYING");
  const sinceSuccess=elapsedSeconds(runtime.lastSuccessAt??runtime.startedAt,nowMs);
  if(sinceSuccess!==null&&sinceSuccess>30)signals.push("WORKER_STALLED");
  if(runtime.mode==="starting"&&sinceSuccess!==null&&sinceSuccess<=30)
   signals.push("WORKER_STARTING");
 }
 else signals.push("WORKER_STALLED");
 const urgent=signals.includes("OUTBOX_CRITICAL_DELAY")||
  pendingOutbox>5000||runtime.consecutiveFailures>=3||
  (signals.includes("WORKER_STALLED")&&pendingOutbox>0);
 const attention=signals.some(x=>x!=="WORKER_STARTING");
 return {status:attention?"attention":"ok",
  severity:urgent?"urgent":attention?"investigate":"ok",
  signals,checkedAt:new Date(nowMs).toISOString(),actionRequired:attention,pilotCertified:false,
  scope:"server_instance_and_shared_outbox"};
}
