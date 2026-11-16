"use client";
import {useCallback,useEffect,useState} from "react";
import Link from "next/link";
import {BellRing,Check,CheckCircle2,Clock3,RefreshCw,ReceiptText,ShieldCheck,Slash,UtensilsCrossed} from "lucide-react";
import {s8,type ServicePage,type ServiceRequest,type ChangePage,type OrderChange} from "@dineflow/shared";
import {useWorkspace} from "./workspace-provider";
import {jsonRequest} from "@/lib/phase2-api";
import {API_URL} from "@/lib/auth-client";
import {money} from "@/lib/finance-types";
type Section="requests"|"changes";
const date=(x:string,locale:string)=>new Date(x).toLocaleString(locale,{month:"short",day:"numeric",hour:"2-digit",minute:"2-digit"});
export function ServiceConsole(){
 const {workspace}=useWorkspace(),locale=workspace.locale;
 const [section,setSection]=useState<Section>("requests"),[status,setStatus]=useState("active"),
  [requestPage,setRequestPage]=useState(1),[changePage,setChangePage]=useState(1),
  [requests,setRequests]=useState<ServicePage|null>(null),[changes,setChanges]=useState<ChangePage|null>(null),
  [busy,setBusy]=useState(""),[loading,setLoading]=useState(true),[error,setError]=useState(""),
  [notice,setNotice]=useState(""),[notes,setNotes]=useState<Record<string,string>>({});
 const load=useCallback(async(silent=false)=>{
   if(!silent)setLoading(true);
   try{
     const [r,c]=await Promise.all([
       jsonRequest<ServicePage>("/api/service/requests?status="+status+"&page="+requestPage),
       jsonRequest<ChangePage>("/api/service/changes?status="+(status==="active"?"pending":status==="acknowledged"?"pending":status==="resolved"?"approved":status)+"&page="+changePage)
     ]);
     setRequests(r);setChanges(c);setError("");
   }catch(e){setError(e instanceof Error?e.message:s8(locale,"error"));}
   finally{setLoading(false);}
 },[status,requestPage,changePage,locale]);
 useEffect(()=>{
  void load();const tick=setInterval(()=>{if(document.visibilityState==="visible")void load(true);},12000);
  const s=typeof EventSource==="undefined"?null:new EventSource(API_URL+"/api/service/events",{withCredentials:true});
  const cb=()=>{if(document.visibilityState==="visible")void load(true);};
  s?.addEventListener("service",cb);
  return()=>{clearInterval(tick);s?.removeEventListener("service",cb);s?.close();};
 },[load]);
 async function act(item:ServiceRequest,action:"ack"|"resolve"){
   if(busy)return;
   if(action==="resolve"&&!window.confirm(s8(locale,"confirmAction")))return;
   setBusy(item.id);setError("");setNotice("");
   try{
     await jsonRequest("/api/service/requests/"+item.id+"/"+action,{
       method:"POST",body:JSON.stringify({version:item.version,resolutionNote:notes[item.id]??""})});
     setNotice(s8(locale,action==="ack"?"ack":"resolved"));await load(true);
   }catch(e){setError(e instanceof Error?e.message:s8(locale,"error"));await load(true);}
   finally{setBusy("");}
 }
 async function decide(item:OrderChange,decision:"approve"|"reject"){
   if(busy)return;
   const reason=(notes[item.id]??"").trim();
   if(decision==="reject"&&reason.length<8){setError(s8(locale,"decisionReason")+" (8+)");return;}
   if(!window.confirm(s8(locale,"confirmAction")))return;
   setBusy(item.id);setError("");setNotice("");
   try{
     await jsonRequest("/api/service/changes/"+item.id+"/decision",{method:"POST",
       body:JSON.stringify({version:item.version,decision,decisionReason:reason})});
     setNotice(s8(locale,decision==="approve"?"approved":"rejected"));await load(true);
   }catch(e){setError(e instanceof Error?e.message:s8(locale,"error"));await load(true);}
   finally{setBusy("");}
 }
 const statuses=["active","pending","acknowledged","resolved","all"] as const;
 const page=section==="requests"?requestPage:changePage,qty=section==="requests"?requests?.total:changes?.total;
 const max=Math.ceil((qty??0)/10);
 return <div className="content-stack service-console">
  <div className="page-heading"><div>
   <span className="eyebrow">DINEFLOW / {s8(locale,"service")}</span>
   <h1>{s8(locale,"requests")}</h1>
   <p>{s8(locale,"live")} · {s8(locale,"managerReview")}</p></div>
   <button className="button" type="button" onClick={()=>void load()}><RefreshCw size={17}/>{s8(locale,"refresh")}</button></div>
  <div className="service-stat-grid">
    <div className="service-stat"><BellRing size={22}/><span>{s8(locale,"openRequests")}</span><strong>{requests?.total??"—"}</strong></div>
    <div className="service-stat"><ShieldCheck size={22}/><span>{s8(locale,"pendingChanges")}</span><strong>{changes?.total??"—"}</strong></div>
  </div>
  <nav className="finance-area-tabs service-switch" aria-label={s8(locale,"service")}>
    <button type="button" className={section==="requests"?"selected":""} onClick={()=>setSection("requests")}>
      <BellRing size={18}/>{s8(locale,"guestRequests")}</button>
    <button type="button" className={section==="changes"?"selected":""} onClick={()=>setSection("changes")}>
      <ShieldCheck size={18}/>{s8(locale,"corrections")}</button>
  </nav>
  <div className="finance-segments service-filter">
    {statuses.map(x=><button key={x} type="button" className={status===x?"selected":""}
     onClick={()=>{setStatus(x);setRequestPage(1);setChangePage(1);}}>
     {s8(locale,x==="resolved"?"resolved":x==="acknowledged"?"acknowledged":x==="pending"?"pending":x==="all"?"all":"active")}</button>)}
  </div>
  {notice&&<div className="success-banner" role="status"><Check size={19}/>{notice}</div>}
  {error&&<div className="form-error" role="alert">{error}
   <button type="button" className="text-link" onClick={()=>void load()}>{s8(locale,"retry")}</button></div>}
  {loading&&!requests?<div className="settings-card list-skeleton"><span/><span/></div>:
   section==="requests"?requests?.items.length?<div className="service-grid">
    {requests.items.map(row=><article className="service-card" key={row.id}>
      <header><div><span className="eyebrow">{s8(locale,"table")}</span>
         <h2>{row.tableLabel}</h2></div>
         <span className={"service-badge "+row.status}>{s8(locale,row.status)}</span></header>
      <div className="service-card-type"><div className="service-icon">
       {row.type==="bill"?<ReceiptText size={21}/>:<BellRing size={21}/>}</div>
       <div><strong>{s8(locale,row.reason)}</strong>
        {row.splitPreference&&<small>{s8(locale,row.splitPreference)}</small>}</div></div>
      {row.note&&<p className="service-note">{row.note}</p>}
      <div className="service-meta"><Clock3 size={15}/>{date(row.createdAt,locale)}</div>
      {row.status!=="resolved"&&<div className="service-card-actions">
       {row.status==="pending"&&<button type="button" className="button" disabled={!!busy}
         onClick={()=>void act(row,"ack")}><Check size={17}/>{s8(locale,"ack")}</button>}
       <label className="finance-field"><span>{s8(locale,"resNote")}</span><input maxLength={200}
         value={notes[row.id]??""} onChange={e=>setNotes(n=>({...n,[row.id]:e.target.value}))}/></label>
       <button type="button" className="button button-primary" disabled={!!busy}
        onClick={()=>void act(row,"resolve")}><CheckCircle2 size={17}/>{s8(locale,"resolve")}</button>
      </div>}
    </article>)}</div>:<div className="settings-card empty-panel"><BellRing size={34}/><h3>{s8(locale,"noRequests")}</h3></div>:
   changes?.items.length?<div className="service-grid">
     {changes.items.map(row=><article className="service-card" key={row.id}>
       <header><div><span className="eyebrow">{s8(locale,"round")}</span>
         <h2>#{row.roundId.slice(0,8)}</h2></div>
         <span className={"service-badge "+row.status}>{s8(locale,row.status)}</span></header>
       <div className="service-card-type"><UtensilsCrossed size={21}/>
         <div><strong>{locale==="en"?row.itemNameEn:locale==="ps-AF"?row.itemNamePs:row.itemNameFa}</strong>
           <small>{row.quantity} × {money(row.originalMinor,locale)} · {row.kitchenStatus}</small></div></div>
       <p className="service-note">{s8(locale,"reason")}: {row.reason}</p>
       <div className="service-meta">{date(row.createdAt,locale)}</div>
       {row.status==="pending"?<div className="service-card-actions">
         <p className="finance-muted">{s8(locale,"immutable")}</p>
         <label className="finance-field"><span>{s8(locale,"decisionReason")}</span>
           <textarea maxLength={250} rows={2} value={notes[row.id]??""}
            onChange={e=>setNotes(n=>({...n,[row.id]:e.target.value}))}/></label>
         <div className="service-decision-buttons">
          <button type="button" className="button service-deny" disabled={!!busy}
             onClick={()=>void decide(row,"reject")}><Slash size={16}/>{s8(locale,"reject")}</button>
          <button type="button" className="button button-primary" disabled={!!busy}
             onClick={()=>void decide(row,"approve")}><Check size={17}/>{s8(locale,"approve")}</button>
         </div>
       </div>:<p className="finance-muted">{row.decisionReason} {row.deltaMinor?money(row.deltaMinor,locale):""}</p>}
     </article>)}</div>:<div className="settings-card empty-panel">
       <ShieldCheck size={34}/><h3>{s8(locale,"noChanges")}</h3></div>}
  {!!qty&&max>1&&<div className="pager">
    <button className="button" type="button" disabled={page<=1}
      onClick={()=>section==="requests"?setRequestPage(x=>x-1):setChangePage(x=>x-1)}>‹</button>
    <span>{page} / {max}</span>
    <button className="button" type="button" disabled={page>=max}
      onClick={()=>section==="requests"?setRequestPage(x=>x+1):setChangePage(x=>x+1)}>›</button>
  </div>}
 </div>;
}
