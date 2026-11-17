import {useCallback,useRef,useState} from "react";
import {AppState} from "react-native";
import {useFocusEffect,router} from "expo-router";
import {FloorRequestError} from "./floor-api";

type Snapshot<T>={data:T|null;key:string};
export type LiveScreen<T>={
 data:T|null;loading:boolean;refreshing:boolean;error:string;lastUpdated:number|null;
 refresh:(manual?:boolean)=>Promise<void>;
};
/**
 * Waiter screens retain verified server data on a transient network failure.
 * A generation key isolates tabs/filters, and request IDs reject out-of-order responses.
 * No React state update is committed after the screen loses focus.
 */
export function useLiveScreen<T>(key:string,loader:()=>Promise<T>,intervalMs=15000):LiveScreen<T>{
 const [snapshot,setSnapshot]=useState<Snapshot<T>|null>(null);
 const [loading,setLoading]=useState(true),[refreshing,setRefreshing]=useState(false);
 const [error,setError]=useState(""),[lastUpdated,setLastUpdated]=useState<number|null>(null);
 const sequence=useRef(0),focused=useRef(false),running=useRef(false);
 const snapshotRef=useRef<Snapshot<T>|null>(null);
 const current=snapshot?.key===key?snapshot.data:null;
 const refresh=useCallback(async(manual=false)=>{
  if(!focused.current||AppState.currentState==="background")return;
  if(running.current&&!manual)return;
  const n=++sequence.current;
  running.current=true;
  if(snapshotRef.current?.key!==key)setLoading(true);else if(manual)setRefreshing(true);
  try{
   const value=await loader();
   if(n!==sequence.current||!focused.current)return;
   snapshotRef.current={data:value,key};setSnapshot(snapshotRef.current);
   setError("");setLastUpdated(Date.now());
  }catch(err){
   if(n!==sequence.current||!focused.current)return;
   if(err instanceof FloorRequestError&&err.status===401){
    snapshotRef.current=null;setSnapshot(null);router.replace("/sign-in");return;
   }
   setError(err instanceof Error?err.message:"REQUEST_FAILED");
  }finally{
   if(n===sequence.current){running.current=false;
    if(focused.current){setLoading(false);setRefreshing(false);}}
  }
 },[key,loader]);
 useFocusEffect(useCallback(()=>{
  focused.current=true;
  void refresh();
  const interval=setInterval(()=>{
   if(AppState.currentState==="active")void refresh();
  },intervalMs);
  const app=AppState.addEventListener("change",state=>{
   if(state==="active")void refresh();
  });
  return()=>{focused.current=false;sequence.current+=1;running.current=false;
   clearInterval(interval);app.remove();};
 },[refresh,intervalMs]));
 return {data:current,loading:!current&&loading,refreshing,error,lastUpdated,refresh};
}
