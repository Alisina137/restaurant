import * as SecureStore from "expo-secure-store";
import {newKey,type OrderDraft,type CartLine} from "./order-types";
import {MAX_LINES,validateStoredDraft} from "./mobile25-cart";

/**
 * Two-slot encrypted journal. We never overwrite the committed slot before
 * writing the other one, and update the head pointer only after all lines exist.
 * The old P05 layout is read-only migration fallback.
 */
function prefix(userId:string,tenantId:string,visitId:string){
 return "df:p05:"+userId+":"+tenantId+":"+visitId+":";
}
type Head={slot:0|1;count:number;note:string;idempotencyKey:string};
const queue=new Map<string,Promise<void>>();
function serial<T>(p:string,task:()=>Promise<T>):Promise<T>{
 const prev=queue.get(p)??Promise.resolve();
 const next=prev.catch(()=>{}).then(task);
 queue.set(p,next.then(()=>{},()=>{}));
 void next.finally(()=>{if(queue.get(p)===next)queue.delete(p);}).catch(()=>{});
 return next;
}
async function readCommitted(p:string):Promise<OrderDraft|null>{
 const headRaw=await SecureStore.getItemAsync(p+"head25");
 if(!headRaw)return null;
 const head=JSON.parse(headRaw) as Head;
 if((head.slot!==0&&head.slot!==1)||!Number.isSafeInteger(head.count)||
  head.count<0||head.count>MAX_LINES)return null;
 const lines:CartLine[]=[];
 for(let i=0;i<head.count;i++){
  const value=await SecureStore.getItemAsync(p+"v25:"+head.slot+":"+i);
  if(!value)return null;
  lines.push(JSON.parse(value) as CartLine);
 }
 const draft={lines,note:head.note,idempotencyKey:head.idempotencyKey};
 return validateStoredDraft(draft)?draft:null;
}
async function readLegacy(p:string):Promise<OrderDraft|null>{
 const raw=await SecureStore.getItemAsync(p+"head");
 if(!raw)return null;
 const head=JSON.parse(raw) as {count:number;note:string;idempotencyKey:string};
 if(!Number.isSafeInteger(head.count)||head.count<0||head.count>MAX_LINES)return null;
 const lines:CartLine[]=[];
 for(let i=0;i<head.count;i++){
  const value=await SecureStore.getItemAsync(p+"line:"+i);
  if(!value)return null;
  lines.push(JSON.parse(value) as CartLine);
 }
 const draft={lines,note:head.note,idempotencyKey:head.idempotencyKey};
 return validateStoredDraft(draft)?draft:null;
}
export async function readDraft(userId:string,tenantId:string,visitId:string):Promise<OrderDraft|null>{
 const p=prefix(userId,tenantId,visitId);
 return serial(p,async()=>{
  try{
   const saved=await readCommitted(p);
   if(saved)return saved;
   // Never resurrect a legacy draft if new-format journaling has already begun.
   if(await SecureStore.getItemAsync(p+"head25"))return null;
   return await readLegacy(p);
  }catch{return null;}
 });
}
export async function saveDraft(userId:string,tenantId:string,visitId:string,draft:OrderDraft){
 if(!validateStoredDraft(draft))throw new Error("Invalid cart draft; choose valid quantities and notes.");
 const p=prefix(userId,tenantId,visitId);
 return serial(p,async()=>{
  const previous=await SecureStore.getItemAsync(p+"head25");
  let active:0|1=1;
  if(previous){try{const head=JSON.parse(previous) as Head;
   if(head.slot===0||head.slot===1)active=head.slot;}catch{}}
  const slot:0|1=active===1?0:1;
  for(let i=0;i<draft.lines.length;i++){
   await SecureStore.setItemAsync(p+"v25:"+slot+":"+i,JSON.stringify(draft.lines[i]));
  }
  // The pointer write commits the snapshot. A partial slot write is invisible.
  await SecureStore.setItemAsync(p+"head25",JSON.stringify({
   slot,count:draft.lines.length,note:draft.note,idempotencyKey:draft.idempotencyKey
  } satisfies Head));
 });
}
export async function clearDraft(userId:string,tenantId:string,visitId:string){
 const p=prefix(userId,tenantId,visitId);
 return serial(p,async()=>{
  // Remove committed heads first so a partially interrupted cleanup cannot revive a sent cart.
  const legacy=await SecureStore.getItemAsync(p+"head");
  await SecureStore.deleteItemAsync(p+"head25");
  await SecureStore.deleteItemAsync(p+"head");
  for(let i=0;i<MAX_LINES;i++){
   await SecureStore.deleteItemAsync(p+"v25:0:"+i);
   await SecureStore.deleteItemAsync(p+"v25:1:"+i);
  }
  let count=0;try{count=legacy?Number((JSON.parse(legacy) as {count:number}).count):0;}catch{}
  for(let i=0;i<Math.min(MAX_LINES,Math.max(count,0));i++){
   await SecureStore.deleteItemAsync(p+"line:"+i);
  }
 });
}
export function freshDraft():OrderDraft{return {lines:[],note:"",idempotencyKey:newKey()};}
