/** P26: account-scoped native-ready notifications. No push provider is configured. */
export type ReadyNotice = {
 id:string; type:string; roundId:string; ticketId:string; visitId:string;
 readAt:string|null; createdAt:string; lastNotifiedAt:string;
 tableLabel:string; tableId:string; status:string;
};
export type ReadyInbox = {items:ReadyNotice[];total:number;unread:number;page:number;perPage:number};
export function noticeScope(userId:string,tenantId:string|null):string|null {
 return userId&&tenantId?userId+"|"+tenantId:null;
}
/** Store only a consent flag, not notification data or another user's private context. */
export function vibrationKeyFor(userId:string,tenantId:string|null):string|null {
 if(!userId||!tenantId)return null;
 const safe=(value:string)=>value.replace(/[^A-Za-z0-9._-]/g,"_");
 return "dineflow.ready.v1."+safe(userId)+"."+safe(tenantId);
}
/** Vibration is a foreground-only convenience, never a claim of device push delivery. */
export function alertIsNew(previous:ReadonlyMap<string,string>,alert:Pick<ReadyNotice,"id"|"lastNotifiedAt">,
 initialized:boolean,now:number):boolean {
 if(!initialized)return false;
 const stamp=Date.parse(alert.lastNotifiedAt);
 if(!Number.isFinite(stamp))return false;
 const old=previous.get(alert.id);
 if(old===alert.lastNotifiedAt)return false;
 return old!==undefined||(stamp<=now&&stamp>=now-120_000);
}
export function canVibrate(lastAt:number,now:number):boolean{
 return now-lastAt>=20_000&&now>=lastAt;
}
export function inboxIsValid(value:unknown):value is ReadyInbox{
 if(!value||typeof value!=="object")return false;
 const data=value as Partial<ReadyInbox>;
 return Array.isArray(data.items)&&data.items.length<=20&&
  Number.isSafeInteger(data.total)&&Number(data.total)>=0&&
  Number.isSafeInteger(data.unread)&&Number(data.unread)>=0&&
  Number.isSafeInteger(data.page)&&Number(data.page)>=1&&
  data.perPage===20&&data.items.every(item=>
   item&&typeof item.id==="string"&&typeof item.roundId==="string"&&
   typeof item.tableLabel==="string"&&
   (item.readAt===null||typeof item.readAt==="string"));
}
