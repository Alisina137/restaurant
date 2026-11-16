"use client";
import {useCallback,useEffect,useState} from "react";
import Link from "next/link";
import {Bell,CheckCircle2,Clock3,Droplets,FileText,MessageCircle,RefreshCw} from "lucide-react";
import {jsonRequest} from "@/lib/phase2-api";
import {useWorkspace} from "./workspace-provider";
import {sr8,type ServiceList,type ServiceRequest} from "@/lib/staff-service-copy";
const icons={call_waiter:Bell,water:Droplets,bill:FileText,other:MessageCircle};
export function ServiceRequestsConsole(){
 const {workspace}=useWorkspace(),locale=workspace.locale;
 const [status,setStatus]=useState<"active"|"resolved">("active"),[page,setPage]=useState(1);
 const [list,setList]=useState<ServiceList|null>(null),[loading,setLoading]=useState(true);
 const [busy,setBusy]=useState(""),[error,setError]=useState(""),[note,setNote]=useState<Record<string,string>>({});
 const load=useCallback(async(silent=false)=>{
  if(!silent)setLoading(true);
  try{
   const result=await jsonRequest<ServiceList>("/api/service/requests?status="+status+"&page="+page);
   setList(result);setError("");
  }catch(e){setError(e instanceof Error?e.message:sr8(locale,"error"));}
  finally{setLoading(false);}
 },[status,page,locale]);
 useEffect(()=>{void load();const timer=setInterval(()=>{if(document.visibilityState==="visible")void load(true);},12000);
   return()=>clearInterval(timer);},[load]);
 async function change(request:ServiceRequest,action:"acknowledge"|"resolve"){
  if(busy)return;setBusy(request.id);setError("");
  try{await jsonRequest("/api/service/requests/"+request.id+"/transition",{
   method:"POST",body:JSON.stringify({version:request.version,action,note:note[request.id]??""})});
   await load(true);
  }catch(e){setError(e instanceof Error?e.message:sr8(locale,"error"));await load(true);}
  finally{setBusy("");}
 }
 return <div className="content-stack finance-console">
   <div className="page-heading"><div><span className="eyebrow">DINEFLOW / SERVICE</span>
      <h1>{sr8(locale,"title")}</h1><p>{sr8(locale,"subtitle")}</p></div>
      <button className="button" onClick={()=>void load()}><RefreshCw size={17}/>{sr8(locale,"refresh")}</button></div>
   <div className="finance-stats"><div className="finance-stat"><span>{sr8(locale,"attention")}</span>
     <strong>{status==="active"?list?.total??"—":"—"}</strong></div></div>
   <div className="finance-segments">
    {(["active","resolved"] as const).map(key=><button type="button" key={key}
      className={status===key?"selected":""} onClick={()=>{setStatus(key);setPage(1);}}>
      {sr8(locale,key)}</button>)}</div>
   {error&&<div role="alert" className="form-error">{error}
      <button className="text-link" onClick={()=>void load()}>{sr8(locale,"retry")}</button></div>}
   {loading&&!list?<div className="settings-card list-skeleton"><span/><span/></div>:
    list?.items.length?<div className="service-console-grid">
     {list.items.map(request=>{const Icon=icons[request.type];return <article key={request.id}
       className="settings-card service-console-card">
       <div className="service-console-top"><div className="service-console-icon"><Icon size={23}/></div>
         <span className={"finance-badge "+(request.status==="pending"?"partial":"open")}>
           {sr8(locale,request.status==="pending"?"pending":request.status==="acknowledged"?"acknowledged":"resolved")}</span></div>
       <div><span className="eyebrow">{sr8(locale,"table")} {request.tableLabel}</span>
         <h2>{sr8(locale,request.type)}</h2></div>
       {request.note&&<p className="service-console-note">{request.note}</p>}
       <div className="finance-muted"><Clock3 size={16}/>
        {new Date(request.createdAt).toLocaleString(locale,{dateStyle:"short",timeStyle:"short"})}</div>
       {request.status!=="resolved"&&<div className="service-console-actions">
         <input maxLength={200} value={note[request.id]??""} placeholder={sr8(locale,"note")}
           aria-label={sr8(locale,"note")}
           onChange={e=>setNote(x=>({...x,[request.id]:e.target.value}))}/>
         {request.status==="pending"&&<button type="button" className="button"
           disabled={busy===request.id} onClick={()=>void change(request,"acknowledge")}>
           <Bell size={16}/>{sr8(locale,"ack")}</button>}
         <button type="button" className="button button-primary" disabled={busy===request.id}
           onClick={()=>void change(request,"resolve")}><CheckCircle2 size={16}/>
           {busy===request.id?sr8(locale,"busy"):sr8(locale,"resolve")}</button>
       </div>}
       <Link href={"/app/tables/board"} className="text-link">{sr8(locale,"open")}</Link>
      </article>;})}</div>:
    <div className="settings-card empty-panel"><CheckCircle2 size={32}/>
      <h3>{sr8(locale,"empty")}</h3></div>}
   {!!list&&list.total>list.perPage&&<div className="pager">
     <button className="button button-small" disabled={page===1} onClick={()=>setPage(v=>v-1)}>‹</button>
     <span>{page} / {Math.ceil(list.total/list.perPage)}</span>
     <button className="button button-small" disabled={page>=Math.ceil(list.total/list.perPage)}
       onClick={()=>setPage(v=>v+1)}>›</button></div>}
 </div>;
}
