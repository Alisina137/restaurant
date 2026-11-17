import {useEffect,useState} from "react";
import {AppState,Vibration} from "react-native";
import {router} from "expo-router";
import * as SecureStore from "expo-secure-store";
import {fetchIdentity} from "./api";
import {FloorRequestError,floorRequest} from "./floor-api";
import {alertIsNew,canVibrate,inboxIsValid,noticeScope,vibrationKeyFor,type ReadyInbox} from "./mobile26-data";

/**
 * In-app polling, not OS push: the authenticated waiter and tenant are verified on
 * every foreground refresh. Vibration is opt-in per account + restaurant + device.
 * Switching accounts resets both the badge and the first-poll vibration baseline.
 */
export function useReadyAlertBadge(){
 const [unread,setUnread]=useState<number|null>(null);
 useEffect(()=>{
  let mounted=true,running=false,scope:string|null=null,initialized=false,lastVibrate=0;
  const seen=new Map<string,string>();
  async function refresh(){
   if(!mounted||running||AppState.currentState!=="active")return;
   running=true;
   try{
    const identity=await fetchIdentity();
    if(!mounted)return;
    const nextScope=identity.role==="waiter"?noticeScope(identity.user.id,identity.tenantId):null;
    if(nextScope!==scope){
     scope=nextScope;initialized=false;seen.clear();lastVibrate=0;setUnread(null);
    }
    if(!nextScope){setUnread(null);return;}
    const result=await floorRequest<ReadyInbox>("/api/orders/notifications?unread=1&page=1");
    if(!mounted||!inboxIsValid(result))return;
    const now=Date.now();
    const newAlert=result.items.some(alert=>alertIsNew(seen,alert,initialized,now));
    for(const alert of result.items)seen.set(alert.id,alert.lastNotifiedAt);
    // Retain only a small foreground snapshot; don't cache private notice data on disk.
    if(seen.size>100){
     const activeIds=new Set(result.items.map(a=>a.id));
     for(const id of seen.keys())if(!activeIds.has(id))seen.delete(id);
    }
    setUnread(result.unread);initialized=true;
    if(newAlert&&canVibrate(lastVibrate,now)&&AppState.currentState==="active"){
     const key=vibrationKeyFor(identity.user.id,identity.tenantId);
     const enabled=key?await SecureStore.getItemAsync(key).catch(()=>null):null;
     if(enabled==="1"&&mounted&&AppState.currentState==="active"){
      lastVibrate=Date.now();Vibration.vibrate(220);
     }
    }
   }catch(err){
    if(!mounted)return;
    setUnread(null);
    if(err instanceof FloorRequestError&&err.status===401)router.replace("/sign-in");
   }finally{running=false;}
  }
  void refresh();
  const timer=setInterval(()=>{void refresh();},12000);
  const app=AppState.addEventListener("change",state=>{if(state==="active")void refresh();});
  return()=>{mounted=false;clearInterval(timer);app.remove();};
 },[]);
 return unread;
}
