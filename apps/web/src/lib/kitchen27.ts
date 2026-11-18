/** Phase 27: presentation-only kitchen prioritization, never an SLA or transition rule. */
export const VISUAL_ATTENTION_MINUTES=15;
export type QueueStatus="new"|"preparing"|"ready"|"picked_up"|"served"|"voided";
export type KitchenOverview={
 new:number;preparing:number;ready:number;waiting15m:number;
 oldestNewAt:string|null;oldestPreparingAt:string|null;oldestReadyAt:string|null;checkedAt:string;
};
export function elapsedMinutes(timestamp:string|null,now:number):number|null{
 if(!timestamp||!Number.isFinite(now))return null;
 const start=Date.parse(timestamp);
 return Number.isFinite(start)?Math.max(0,Math.floor((now-start)/60_000)):null;
}
export function elapsedLabel(minutes:number|null):string{
 if(minutes===null)return "—";
 return minutes<60?minutes+"m":Math.floor(minutes/60)+"h "+minutes%60+"m";
}
export function priority(status:QueueStatus,receivedAt:string,readyAt:string|null,now:number):
 "normal"|"attention"{
 const age=elapsedMinutes((status==="ready"||status==="picked_up")?(readyAt??receivedAt):receivedAt,now);
 return age!==null&&age>=VISUAL_ATTENTION_MINUTES?"attention":"normal";
}
export function readyCount(summary:KitchenOverview|null):number|null{
 return summary?summary.ready:null;
}
export function validSummary(value:unknown):value is KitchenOverview{
 if(!value||typeof value!=="object")return false;
 const s=value as Partial<KitchenOverview>;
 return ["new","preparing","ready","waiting15m"].every(k=>{
  const n=s[k as "new"];return Number.isSafeInteger(n)&&n!==undefined&&n>=0;
 })&&["oldestNewAt","oldestPreparingAt","oldestReadyAt"].every(k=>{
  const n=s[k as "oldestNewAt"];return n===null||typeof n==="string";
 })&&typeof s.checkedAt==="string";
}
export function newTicketIds(previous:ReadonlySet<string>,current:ReadonlySet<string>,
 hydrated:boolean):string[]{
 if(!hydrated)return [];
 return [...current].filter(id=>!previous.has(id));
}
export function preparedSummary(lines:ReadonlyArray<{kitchenStatus:string}>):{ready:number;total:number}{
 return {ready:lines.filter(line=>["ready","picked_up","served"].includes(line.kitchenStatus)).length,
  total:lines.length};
}
