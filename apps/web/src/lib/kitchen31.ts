/** P31: honest first-render-gap diagnostics. Never imply a missing report means no human saw food. */
export type VisibilityGapRow={
 ticketId:string;roundId:string;tableLabel:string;roundNumber:number;
 status:"new"|"preparing"|"ready"|"picked_up";createdAt:string;version:number;
};
export type VisibilityGapPage={
 items:VisibilityGapRow[];page:number;perPage:10;total:number;
 minAgeSeconds:0|30|60|180|300;table:string;oldestAt:string|null;checkedAt:string;
 evidence:"missing_foreground_render_report";
};
export const AGE_FILTERS=[0,30,60,180,300] as const;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function validGapPage(raw:unknown,requestedAge:number,requestedTable=""):raw is VisibilityGapPage{
 if(!raw||typeof raw!=="object")return false;
 const p=raw as Partial<VisibilityGapPage>;
 return Array.isArray(p.items)&&p.items.length<=10&&
  Number.isSafeInteger(p.page)&&Number(p.page)>=1&&Number(p.page)<=1000&&
  p.perPage===10&&Number.isSafeInteger(p.total)&&Number(p.total)>=p.items.length&&
  p.minAgeSeconds===requestedAge&&p.table===requestedTable&&AGE_FILTERS.includes(p.minAgeSeconds)&&
  (p.oldestAt===null||typeof p.oldestAt==="string"&&Number.isFinite(Date.parse(p.oldestAt)))&&
  typeof p.checkedAt==="string"&&Number.isFinite(Date.parse(p.checkedAt))&&
  p.evidence==="missing_foreground_render_report"&&
  p.items.every(row=>!!row&&UUID.test(row.ticketId)&&UUID.test(row.roundId)&&
   typeof row.tableLabel==="string"&&row.tableLabel.length<=100&&
   Number.isSafeInteger(row.roundNumber)&&row.roundNumber>0&&
   Number.isSafeInteger(row.version)&&row.version>0&&
   ["new","preparing","ready","picked_up"].includes(row.status)&&
   typeof row.createdAt==="string"&&Number.isFinite(Date.parse(row.createdAt)));
}
/** Freshness matters: stale results never authorize workflow changes. */
export function gapStatus(ageSeconds:number):"recent"|"investigate"{
 return ageSeconds>=60?"investigate":"recent";
}
export function elapsedGap(createdAt:string,now:number):number{
 const date=Date.parse(createdAt);
 return Number.isFinite(date)?Math.max(0,Math.floor((now-date)/1000)):0;
}
