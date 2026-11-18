import type {KitchenCardDetail,KitchenCardPage,KitchenPulse} from "./order-web-types";
/** Untrusted HTTP data must be validated before enabling mutation buttons. */
export function validCardDetail(raw:unknown,version:number):raw is KitchenCardDetail{
 if(!raw||typeof raw!=="object")return false;
 const data=raw as Partial<KitchenCardDetail>;
 return !!data.ticket&&Number.isSafeInteger(data.ticket.version)&&
  data.ticket.version===version&&
  (data.ticket.pickupAcknowledgedAt===null||typeof data.ticket.pickupAcknowledgedAt==="string")&&
  !!data.round&&typeof data.round.orderNote==="string"&&
  Number.isSafeInteger(data.round.totalMinor)&&
  Array.isArray(data.lines)&&data.lines.length>0&&data.lines.length<=100&&
  data.lines.every(item=>!!item&&typeof item.id==="string"&&
   item.id.length>0&&typeof item.quantity==="number"&&item.quantity>=1&&
   typeof item.itemNameFa==="string"&&Array.isArray(item.modifierSnapshot)&&
   typeof item.kitchenStatus==="string"&&typeof item.note==="string");
}
export function validKitchenCardPage(raw:unknown):raw is KitchenCardPage{
 if(!raw||typeof raw!=="object")return false;
 const q=raw as Partial<KitchenCardPage>;
 if(!Array.isArray(q.items)||q.items.length>10||
  !Number.isSafeInteger(q.page)||Number(q.page)<1||
  !Number.isSafeInteger(q.total)||Number(q.total)<0||
  q.perPage!==10||typeof q.serverMs!=="number"||
  !Number.isFinite(q.serverMs)||q.serverMs<0||
  !q.detailsByRound||typeof q.detailsByRound!=="object")return false;
 return q.items.every(row=>!!row&&typeof row.id==="string"&&
  typeof row.ticketId==="string"&&typeof row.ticketVersion==="number"&&
  typeof row.status==="string"&&!!q.detailsByRound?.[row.id]);
}
export function validKitchenPulse(raw:unknown):raw is KitchenPulse{
 if(!raw||typeof raw!=="object")return false;
 const p=raw as Partial<KitchenPulse>;
 return [60,180,360].includes(p.minutes??0)&&
  typeof p.from==="string"&&Number.isFinite(Date.parse(p.from))&&
  typeof p.checkedAt==="string"&&Number.isFinite(Date.parse(p.checkedAt))&&
  Number.isSafeInteger(p.completed)&&Number(p.completed)>=0&&
  Number.isSafeInteger(p.pendingReceipt)&&Number(p.pendingReceipt)>=0&&
  ["prepMedianMinutes","prepP95Minutes"].every(key=>{
   const n=p[key as "prepMedianMinutes"];
   return n===null||typeof n==="number"&&Number.isFinite(n)&&n>=0;
  })&&
  (p.oldestPendingReceiptAt===null||typeof p.oldestPendingReceiptAt==="string");
}
export function displayTime(value:number|null):string{
 return value===null||!Number.isFinite(value)?"—":value.toFixed(1);
}
export function currentDisplayMode(value:string|null):"standard"|"large"{
 return value==="large"?"large":"standard";
}
