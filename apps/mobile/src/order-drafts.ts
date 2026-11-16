import * as SecureStore from "expo-secure-store";
import {newKey,type OrderDraft,type CartLine} from "./order-types";

// Split lines into per-key encrypted entries so device Keychain item-size limits
// do not truncate a multi-line cart. Scoped by user + tenant + visit.
function prefix(userId:string,tenantId:string,visitId:string){
 return "df:p05:"+userId+":"+tenantId+":"+visitId+":";
}
export async function readDraft(userId:string,tenantId:string,visitId:string):Promise<OrderDraft|null>{
 const p=prefix(userId,tenantId,visitId),raw=await SecureStore.getItemAsync(p+"head");
 if(!raw)return null;
 try{
  const head=JSON.parse(raw) as {count:number;note:string;idempotencyKey:string};
  if(!Number.isInteger(head.count)||head.count<0||head.count>40)return null;
  const lines:CartLine[]=[];
  for(let i=0;i<head.count;i++){
   const line=await SecureStore.getItemAsync(p+"line:"+i);
   if(!line)return null;
   lines.push(JSON.parse(line) as CartLine);
  }
  return {lines,note:head.note,idempotencyKey:head.idempotencyKey};
 }catch{return null;}
}
export async function saveDraft(userId:string,tenantId:string,visitId:string,draft:OrderDraft){
 const p=prefix(userId,tenantId,visitId);
 if(draft.lines.length>40)throw new Error("Maximum 40 cart lines.");
 const prior=await SecureStore.getItemAsync(p+"head");
 const oldCount=prior?(JSON.parse(prior) as {count:number}).count:0;
 // Head is written last. Interrupted writes cannot produce a partial valid draft.
 for(let i=0;i<draft.lines.length;i++)await SecureStore.setItemAsync(p+"line:"+i,JSON.stringify(draft.lines[i]));
 for(let i=draft.lines.length;i<oldCount;i++)await SecureStore.deleteItemAsync(p+"line:"+i);
 await SecureStore.setItemAsync(p+"head",JSON.stringify({count:draft.lines.length,note:draft.note,
   idempotencyKey:draft.idempotencyKey}));
}
export async function clearDraft(userId:string,tenantId:string,visitId:string){
 const p=prefix(userId,tenantId,visitId);
 const head=await SecureStore.getItemAsync(p+"head");
 const count=head?(JSON.parse(head) as {count:number}).count:0;
 await SecureStore.deleteItemAsync(p+"head");
 for(let i=0;i<count;i++)await SecureStore.deleteItemAsync(p+"line:"+i);
}
export function freshDraft():OrderDraft{return {lines:[],note:"",idempotencyKey:newKey()};}
