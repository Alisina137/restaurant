import {useSyncExternalStore} from "react";
import {API_URL} from "./auth-client";
export type ConnectionStatus="unknown"|"connected"|"offline"|"server";
let status:ConnectionStatus="unknown";
const listeners=new Set<()=>void>();
function setStatus(value:ConnectionStatus){
 if(value!==status){status=value;listeners.forEach(listener=>listener());}
}
const subscribe=(listener:()=>void)=>{listeners.add(listener);return()=>{listeners.delete(listener);};};
const snapshot=()=>status;
export function useConnectionStatus():ConnectionStatus{return useSyncExternalStore(subscribe,snapshot,snapshot);}
/** A transport error is not a failed order: mutations must NEVER be auto-replayed here. */
export async function observedFetch(url:string,options?:RequestInit):Promise<Response>{
 const controller=new AbortController();
 const timeout=setTimeout(()=>controller.abort(),15000);
 // Respect caller cancellation without sending another request.
 const onAbort=()=>controller.abort();
 options?.signal?.addEventListener("abort",onAbort,{once:true});
 try{
  const response=await fetch(url,{...options,signal:controller.signal});
  setStatus(response.status>=500?"server":"connected");
  return response;
 }catch(err){setStatus("offline");throw err;}
 finally{clearTimeout(timeout);options?.signal?.removeEventListener("abort",onAbort);}
}
/** Explicit GET probe only; no queued financial/order/account mutations. */
export async function probeConnection():Promise<boolean>{
 try{const response=await observedFetch(API_URL+"/api/health/ready",{method:"GET"});
  return response.ok;
 }catch{return false;}
}
