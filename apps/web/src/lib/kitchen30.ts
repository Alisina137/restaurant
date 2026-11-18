import type {KitchenCardDetail} from "./order-web-types";
export type KitchenVisibility={
 minutes:60|180|360;from:string;checkedAt:string;
 acceptedCount:number;observedCount:number;displayMedianSeconds:number|null;
 displayP95Seconds:number|null;activeWithoutReceipt:number;
 oldestWithoutReceiptAt:string|null;evidence:"foreground_client_report";
};
export type KitchenObservationResult={accepted:number;submitted:number};
type RenderedTicket={id:string;ticketId:string;ticketVersion:number;status:string};
/** Only a server-verified page with matching immutable line details is reportable.
 * Never report cached results after an error, history, hidden-page state or
 * mismatching stage. Returns at most one API page (10 tickets).
 */
export function eligibleObservationIds(
 rows:ReadonlyArray<RenderedTicket>,details:Record<string,KitchenCardDetail>,
 sent:ReadonlySet<string>,
):string[]{
 const ids:string[]=[];
 for(const row of rows.slice(0,10)){
  if(!row||!["new","preparing","ready","picked_up"].includes(row.status)||
   !/^[\da-f]{8}-(?:[\da-f]{4}-){3}[\da-f]{12}$/i.test(row.ticketId)||
   sent.has(row.ticketId))continue;
  const detail=details[row.id];
  if(!detail||detail.ticket.version!==row.ticketVersion||!detail.lines.length)continue;
  ids.push(row.ticketId);
 }
 return [...new Set(ids)];
}
export function validKitchenVisibility(raw:unknown):raw is KitchenVisibility{
 if(!raw||typeof raw!=="object")return false;
 const v=raw as Partial<KitchenVisibility>;
 if(![60,180,360].includes(v.minutes??-1)||
  typeof v.from!=="string"||!Number.isFinite(Date.parse(v.from))||
  typeof v.checkedAt!=="string"||!Number.isFinite(Date.parse(v.checkedAt))||
  v.evidence!=="foreground_client_report")return false;
 if(![v.acceptedCount,v.observedCount,v.activeWithoutReceipt].every(
  n=>Number.isSafeInteger(n)&&Number(n)>=0)||
  Number(v.observedCount)>Number(v.acceptedCount))return false;
 if(!["displayMedianSeconds","displayP95Seconds"].every(key=>{
  const n=v[key as "displayMedianSeconds"];
  return n===null||(typeof n==="number"&&Number.isFinite(n)&&n>=0);
 }))return false;
 if(v.observedCount===0&&(v.displayMedianSeconds!==null||v.displayP95Seconds!==null))return false;
 if(v.observedCount>0&&(v.displayMedianSeconds===null||v.displayP95Seconds===null||
  Number(v.displayP95Seconds)<Number(v.displayMedianSeconds)))return false;
 return v.oldestWithoutReceiptAt===null||
  (typeof v.oldestWithoutReceiptAt==="string"&&Number.isFinite(Date.parse(v.oldestWithoutReceiptAt)));
}
export function validObservationResult(raw:unknown,requested:number):raw is KitchenObservationResult{
 if(!raw||typeof raw!=="object")return false;
 const a=raw as Partial<KitchenObservationResult>;
 return Number.isSafeInteger(a.accepted)&&Number(a.accepted)>=0&&
  Number(a.accepted)<=requested&&a.submitted===requested;
}
