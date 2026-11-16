"use client";
import {useCallback,useEffect,useState} from "react";
import {jsonRequest} from "./phase2-api";
export function useSaasData<T>(path:string){
 const [data,setData]=useState<T|null>(null),[loading,setLoading]=useState(true),[error,setError]=useState("");
 const load=useCallback(async()=>{
  setLoading(true);setError("");
  try{setData(await jsonRequest<T>(path));}catch(e){setError(e instanceof Error?e.message:"Request failed.");}
  finally{setLoading(false);}
 },[path]);
 useEffect(()=>{void load();},[load]);
 return {data,loading,error,load};
}
export async function postSaas<T>(path:string,payload:Record<string,unknown>,method="POST"){
 return jsonRequest<T>(path,{method,body:JSON.stringify(payload)});
}
