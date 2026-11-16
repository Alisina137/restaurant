import type {Locale} from "@dineflow/shared";
import {API_URL} from "./auth-client";

export class GuestError extends Error{
 constructor(public readonly status:number,public readonly code:string,message:string){super(message);}
}
export async function guestPublic<T>(path:string,body?:unknown):Promise<T>{
 const response=await fetch(API_URL+"/api/guest"+path,{
   method:body===undefined?"GET":"POST",credentials:"omit",cache:"no-store",
   headers:{"Content-Type":"application/json"},
   ...(body===undefined?{}:{body:JSON.stringify(body)})});
 const json=await response.json().catch(()=>({})) as {code?:string;message?:string};
 if(!response.ok)throw new GuestError(response.status,json.code??"ERROR",json.message??"Request failed.");
 return json as T;
}
export type GuestSession={token:string;visitId:string;restaurant:string;slug:string;tableLabel:string;
 policy:"waiter_approval"|"direct_to_kitchen";expiresAt:string};
export const sessionKey=(visit:string)=>"df:guest:"+visit;
export const entryKey=(visit:string)=>"df:guest:entry:"+visit;
export function readSession(visit:string):GuestSession|null{
 if(typeof window==="undefined")return null;
 try{const raw=sessionStorage.getItem(sessionKey(visit));if(!raw)return null;
   const value=JSON.parse(raw) as GuestSession;
   if(!value||value.visitId!==visit||typeof value.token!=="string"||
     !value.expiresAt||new Date(value.expiresAt)<=new Date())return null;
   return value;
 }catch{return null;}
}
export function storeSession(data:GuestSession,entry:string){
 sessionStorage.setItem(sessionKey(data.visitId),JSON.stringify(data));
 sessionStorage.setItem(entryKey(data.visitId),entry);
}
export const cartKey=(data:GuestSession)=>"df:guest:cart:"+data.visitId+":"+data.token.slice(0,12);
export const orderKey=()=>"g"+crypto.randomUUID().replaceAll("-","");
export async function guestRequest<T>(token:string,path:string,init?:RequestInit):Promise<T>{
 const response=await fetch(API_URL+"/api/guest"+path,{credentials:"omit",cache:"no-store",
   ...init,headers:{"Content-Type":"application/json","Authorization":"Bearer "+token,...(init?.headers??{})}});
 const json=await response.json().catch(()=>({})) as {code?:string;message?:string};
 if(!response.ok)throw new GuestError(response.status,json.code??"ERROR",json.message??"Request failed.");
 return json as T;
}
export type GuestName={nameFa:string;namePs:string;nameEn:string};
export type GuestOption=GuestName&{id:string;deltaMinor:number};
export type GuestGroup=GuestName&{id:string;version:number;selectionMode:"single"|"multiple";
 minSelections:number;maxSelections:number;options:GuestOption[]};
export type GuestItem=GuestName&{id:string;categoryId:string;description:string;allergens:string[];
 priceMinor:number;imageId:string|null;version:number;preparationMinutes:number|null;groupIds:string[]};
export type GuestCategory=GuestName&{id:string;sortOrder:number};
export type GuestCatalog={currency:"AFN";categories:GuestCategory[];items:GuestItem[];groups:GuestGroup[]};
export type GuestSelection={groupId:string;version:number;optionIds:string[]};
export type GuestLine={itemId:string;itemVersion:number;quantity:number;note:string;selections:GuestSelection[]};
export type GuestCart={lines:GuestLine[];note:string;idempotencyKey:string};
export type GuestSubmission={id:string;status:"pending"|"approved"|"rejected";roundId:string|null;
 estimatedMinor:number;rejectionReason:string|null;createdAt:string;preview:PreviewLine[];decidedAt:string|null};
export type PreviewLine=GuestName&{quantity:number;unitPriceMinor:number;lineTotalMinor:number;
 note:string;modifierSummary:string[]};
export type GuestRound={id:string;roundNumber:number;createdAt:string;source:"waiter"|"guest_qr";
 totalMinor:number;status:"new"|"preparing"|"ready"|"picked_up"|"served";
 lines:(GuestName&{roundId:string;quantity:number;lineTotalMinor:number;kitchenStatus:string})[]};
export type GuestOrderFeed={pending:GuestSubmission[];rounds:GuestRound[];currency:"AFN"};
export type SubmitAck={created:boolean;id:string;status:"pending"|"approved"|"rejected";version:number;
 roundId:string|null;estimatedMinor:number;policy:"waiter_approval"|"direct_to_kitchen";message:string};
export function nameOf(value:GuestName,locale:Locale){return (locale==="en"?value.nameEn:locale==="ps-AF"?value.namePs:value.nameFa)||value.nameFa;}
export function money(minor:number,locale:Locale){return new Intl.NumberFormat(locale,{
 minimumFractionDigits:2,maximumFractionDigits:2}).format(minor/100)+" AFN";}
export function cost(line:GuestLine,catalog:GuestCatalog):number|null{
 const item=catalog.items.find(x=>x.id===line.itemId);
 if(!item||item.version!==line.itemVersion)return null;
 let value=item.priceMinor;
 for(const selection of line.selections){
  const group=catalog.groups.find(g=>g.id===selection.groupId);
  if(!group||group.version!==selection.version)return null;
  for(const opt of selection.optionIds){
   const option=group.options.find(x=>x.id===opt);
   if(!option)return null;value+=option.deltaMinor;
  }
 }
 return value*line.quantity;
}
export function validLine(line:GuestLine,catalog:GuestCatalog):boolean{
 const item=catalog.items.find(x=>x.id===line.itemId);
 if(!item||item.version!==line.itemVersion||line.quantity<1||line.quantity>99||line.note.length>250)return false;
 if(item.groupIds.length!==line.selections.length)return false;
 return item.groupIds.every(id=>{
   const group=catalog.groups.find(x=>x.id===id),choice=line.selections.find(x=>x.groupId===id);
   if(!group||!choice||choice.version!==group.version)return false;
   const opts=choice.optionIds;
   return opts.length>=group.minSelections&&opts.length<=group.maxSelections&&
     (group.selectionMode!=="single"||opts.length<=1)&&new Set(opts).size===opts.length&&
     opts.every(x=>group.options.some(y=>y.id===x));
 });
}
