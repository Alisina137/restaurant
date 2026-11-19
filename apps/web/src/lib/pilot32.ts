/** Live operator signals, NOT evidence any supervised pilot gate was performed. */
export type PilotOperations={
 tenantId:string;locationId:string;minutes:60|180|360;from:string;checkedAt:string;
 evidence:"tenant_scoped_database_snapshot";pilotCertified:false;
 acceptedWindow:number;observedWindow:number;activeTickets:number;
 activeWithoutReport:number;oldestUnreportedAt:string|null;pickupPending:number;
 openVisits:number;openChecks:number;openCashierShifts:number;
 activeTables:number;publishedItems:number;
 pendingOutbox:number;oldestPendingOutboxAt:string|null;
 oldestPendingOutboxAgeSeconds:number|null;measurement:string;
};
const dateOrNull=(s:unknown)=>s===null||(typeof s==="string"&&Number.isFinite(Date.parse(s)));
const metrics=[
 "acceptedWindow","observedWindow","activeTickets","activeWithoutReport","pickupPending",
 "openVisits","openChecks","openCashierShifts","activeTables","publishedItems","pendingOutbox"
] as const;
export function validPilotOperations(raw:unknown,minutes:number):raw is PilotOperations{
 if(!raw||typeof raw!=="object")return false;
 const p=raw as Partial<PilotOperations>;
 return p.evidence==="tenant_scoped_database_snapshot"&&p.pilotCertified===false&&
  p.minutes===minutes&&[60,180,360].includes(p.minutes)&&
  typeof p.tenantId==="string"&&p.tenantId.length>0&&
  typeof p.locationId==="string"&&p.locationId.length>0&&
  dateOrNull(p.from)&&p.from!==null&&dateOrNull(p.checkedAt)&&p.checkedAt!==null&&
  metrics.every(name=>Number.isSafeInteger(p[name])&&Number(p[name])>=0)&&
  Number(p.observedWindow)<=Number(p.acceptedWindow)&&
  Number(p.activeWithoutReport)<=Number(p.activeTickets)&&
  Number(p.pickupPending)<=Number(p.activeTickets)&&
  dateOrNull(p.oldestPendingOutboxAt)&&dateOrNull(p.oldestUnreportedAt)&&
  (p.oldestPendingOutboxAgeSeconds===null||
   Number.isSafeInteger(p.oldestPendingOutboxAgeSeconds)&&Number(p.oldestPendingOutboxAgeSeconds)>=0)&&
  (p.pendingOutbox===0?
   p.oldestPendingOutboxAt===null&&p.oldestPendingOutboxAgeSeconds===null:
   p.oldestPendingOutboxAt!==null&&p.oldestPendingOutboxAgeSeconds!==null)&&
  typeof p.measurement==="string"&&p.measurement.length>20;
}
/** Not a launch verdict: only indicate signals warranting investigation. */
export function pilot32Signals(p:PilotOperations):Array<"unreported"|"outbox"|"receipt">{
 const out:Array<"unreported"|"outbox"|"receipt">=[];
 if(p.activeWithoutReport>0)out.push("unreported");
 if(p.oldestPendingOutboxAgeSeconds!==null&&p.oldestPendingOutboxAgeSeconds>60)
  out.push("outbox");
 if(p.pickupPending>0)out.push("receipt");
 return out;
}
