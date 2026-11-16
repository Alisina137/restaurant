import {useEffect,useState} from "react";
import {AppState,Vibration} from "react-native";
import * as SecureStore from "expo-secure-store";
import {floorRequest} from "./floor-api";
import {vibrationKey} from "./ready-settings";
type Alert={id:string;lastNotifiedAt:string};
const seen=new Map<string,string>();
let initialized=false;
let lastVibrate=0;
/** Reconciles real unread alerts while any waiter tab is open. Never vibrates on initial hydration. */
export function useReadyAlertBadge(){
 const [unread,setUnread]=useState<number|null>(null);
 useEffect(()=>{
  let active=true,running=false;
  async function refresh(){
   if(!active||running||AppState.currentState!=="active")return;
   running=true;
   try{
    const result=await floorRequest<{items:Alert[];unread:number}>("/api/orders/notifications?unread=1&page=1");
    if(!active)return;
    setUnread(result.unread);
    let newAlert=false;
    for(const item of result.items){
      const prev=seen.get(item.id);
      if(initialized&&(prev!==item.lastNotifiedAt)&&
        (prev!==undefined||Date.now()-new Date(item.lastNotifiedAt).getTime()<120_000))
        newAlert=true;
      seen.set(item.id,item.lastNotifiedAt);
    }
    if(initialized&&newAlert&&Date.now()-lastVibrate>20_000){
      const enabled=await SecureStore.getItemAsync(vibrationKey);
      if(enabled==="1"&&active&&AppState.currentState==="active"){
        lastVibrate=Date.now();Vibration.vibrate(220);
      }
    }
    initialized=true;
   }catch{if(active)setUnread(null);}
   finally{running=false;}
  }
  void refresh();
  const timer=setInterval(()=>{void refresh();},12000);
  const app=AppState.addEventListener("change",state=>{if(state==="active")void refresh();});
  return()=>{active=false;clearInterval(timer);app.remove();};
 },[]);
 return unread;
}
