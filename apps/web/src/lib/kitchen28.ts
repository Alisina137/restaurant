/** P28 reconciling kitchen actions; no blind retry of ambiguous POSTs. */
export type TicketStage="new"|"preparing"|"ready"|"picked_up"|"served"|"voided";
export type KitchenTicketState={
 ticketId:string;roundId:string;tableLabel:string;status:TicketStage;version:number;
 createdAt:string;startedAt:string|null;readyAt:string|null;pickedUpAt:string|null;
 pickupAcknowledgedAt:string|null;servedAt:string|null;notifiedAt:string|null;
 notifyCount:number;waiterSeenAt:string|null;waiterAlertExists:boolean;
 items:{total:number;ready:number;pickedUp:number;served:number};
};
export type KitchenWatermark={cursor:number;revision:number;checkedAt:string};
export type KitchenEvent={cursor:number;eventType:string;roundId:string;createdAt:string};
export type KitchenChanges={events:KitchenEvent[];nextCursor:number;hasMore:boolean};
export type UncertainAction={ticketId:string;action:"start"|"ready"|"handoff"|"notify";version:number;time:number};
export const UNCERTAIN_MAX_AGE_MS=12*60*60_000;
export function cleanUncertain(raw:unknown,now:number):UncertainAction[]{
 if(!Array.isArray(raw))return [];
 return raw.filter((value:unknown):value is UncertainAction=>{
  if(!value||typeof value!=="object")return false;
  const a=value as Partial<UncertainAction>;
  return typeof a.ticketId==="string"&&a.ticketId.length>0&&a.ticketId.length<=100&&
   ["start","ready","handoff","notify"].includes(a.action??"")&&
   Number.isSafeInteger(a.version)&&Number(a.version)>0&&
   Number.isFinite(a.time)&&Number(a.time)<=now&&
   now-Number(a.time)<UNCERTAIN_MAX_AGE_MS;
 }).slice(-30);
}
export function saveUncertain(current:ReadonlyArray<UncertainAction>,next:UncertainAction){
 return [...current.filter(item=>item.ticketId!==next.ticketId),next].slice(-30);
}
export function isTicketState(value:unknown):value is KitchenTicketState{
 if(!value||typeof value!=="object")return false;
 const s=value as Partial<KitchenTicketState>;
 const counts=s.items;
 return typeof s.ticketId==="string"&&typeof s.roundId==="string"&&
  typeof s.tableLabel==="string"&&
  ["new","preparing","ready","picked_up","served","voided"].includes(s.status??"")&&
  Number.isSafeInteger(s.version)&&Number(s.version)>0&&
  !!counts&&[counts.total,counts.ready,counts.pickedUp,counts.served].every(n=>
   Number.isSafeInteger(n)&&Number(n)>=0)&&
  Number(counts.ready)+Number(counts.pickedUp)+Number(counts.served)<=Number(counts.total)&&
  typeof s.waiterAlertExists==="boolean"&&
  (s.waiterSeenAt===null||typeof s.waiterSeenAt==="string")&&
  (s.pickupAcknowledgedAt===null||typeof s.pickupAcknowledgedAt==="string");
}
export function validateWatermark(value:unknown):value is KitchenWatermark{
 if(!value||typeof value!=="object")return false;
 const w=value as Partial<KitchenWatermark>;
 return Number.isSafeInteger(w.cursor)&&Number(w.cursor)>=0&&
  Number.isSafeInteger(w.revision)&&Number(w.revision)>=0&&
  typeof w.checkedAt==="string";
}
/** Do not advance the cursor on malformed, unordered, or incomplete responses. */
export function advanceCursor(previous:number,batch:KitchenChanges):number|null{
 if(!Number.isSafeInteger(previous)||previous<0||!batch||!Array.isArray(batch.events)||
  batch.events.length>50||typeof batch.hasMore!=="boolean"||
  !Number.isSafeInteger(batch.nextCursor)||batch.nextCursor<previous)return null;
 let last=previous;
 for(const e of batch.events){
  if(!e||!Number.isSafeInteger(e.cursor)||e.cursor<=last||typeof e.eventType!=="string"||
   typeof e.roundId!=="string")return null;
  last=e.cursor;
 }
 if(last!==batch.nextCursor)return null;
 if(batch.hasMore&&!batch.events.length)return null;
 return last;
}
export function actionOutcome(status:number|null,code:string|null):"unknown"|"conflict"|"denied"|"rejected"{
 if(status===null||status>=500)return "unknown";
 if(status===409||code==="VERSION_CONFLICT"||code==="INVALID_TRANSITION")return "conflict";
 if(status===401||status===403||status===404)return "denied";
 return "rejected";
}
