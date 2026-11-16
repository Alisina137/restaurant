
"use client";
import {useCallback,useEffect,useState,type FormEvent} from "react";
import Link from "next/link";
import {ArrowUpRight,Bell,LockKeyhole,MessageCircle,RefreshCw,ShieldCheck,Ticket} from "lucide-react";
import {useWorkspace} from "./workspace-provider";
import {jsonRequest} from "@/lib/phase2-api";
import {s12} from "@/lib/saas-copy";
type TicketRow={id:string;tenantId:string|null;category:string;priority:string;subject:string;
 status:string;createdAt:string};
type Thread={ticket:TicketRow;messages:{id:string;body:string;senderName:string;createdAt:string}[]};
type Grant={id:string;tenantId:string;requestedBy:string;scope:string;reason:string;status:string;
 expiresAt:string|null;createdAt:string};
const when=(x:string|null,locale:string)=>x?new Date(x).toLocaleString(locale):"—";
export function SaasSupportConsole({tab,area}:{tab:"tickets"|"grants";area:"app"|"platform"}){
 const {workspace}=useWorkspace(),locale=workspace.locale;
 const [rows,setRows]=useState<TicketRow[]>([]),[grants,setGrants]=useState<Grant[]>([]),
  [selected,setSelected]=useState<Thread|null>(null),[selectedId,setSelectedId]=useState(""),
  [loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState(""),
  [notice,setNotice]=useState(""),[subject,setSubject]=useState(""),[message,setMessage]=useState(""),
  [category,setCategory]=useState("technical"),[priority,setPriority]=useState("normal"),
  [tenantId,setTenantId]=useState(""),[grantReason,setGrantReason]=useState(""),[answer,setAnswer]=useState("");
 const load=useCallback(async()=>{
  setLoading(true);setError("");
  try{
   if(tab==="tickets"){
    const d=await jsonRequest<{items:TicketRow[]}>("/api/support/tickets");setRows(d.items);
    if(selectedId)setSelected(await jsonRequest<Thread>("/api/support/tickets/"+encodeURIComponent(selectedId)));
   }else{const d=await jsonRequest<{items:Grant[]}>("/api/support/grants");setGrants(d.items);}
  }catch(e){setError(e instanceof Error?e.message:s12(locale,"error"));}
  finally{setLoading(false);}
 },[tab,selectedId,locale]);
 useEffect(()=>{void load();},[load]);
 async function run(path:string,payload:object,method="POST",onSuccess?:()=>void){
  setBusy(true);setError("");setNotice("");
  try{
   await jsonRequest(path,{method,body:JSON.stringify(payload)});
   setNotice("Saved successfully.");onSuccess?.();await load();
  }catch(e){setError(e instanceof Error?e.message:s12(locale,"error"));}
  finally{setBusy(false);}
 }
 const root=area==="platform"?"/platform":"/app";
 return <div className="content-stack p12-console">
  <div className="page-heading"><div><span className="eyebrow">DINEFLOW / SUPPORT</span>
   <h1>{s12(locale,tab)}</h1>
   <p>{tab==="grants"?s12(locale,"supportNote"):s12(locale,"safeNote")}</p></div>
   <button type="button" className="button" onClick={()=>void load()} disabled={loading}>
    <RefreshCw size={18}/>{s12(locale,"refresh")}</button></div>
  <div className="p12-tabs">
   <Link href={root+"/support/tickets"} className={"p12-tab"+(tab==="tickets"?" active":"")}>
    <MessageCircle size={17}/>{s12(locale,"tickets")}</Link>
   <Link href={root+"/support/grants"} className={"p12-tab"+(tab==="grants"?" active":"")}>
    <ShieldCheck size={17}/>{s12(locale,"grants")}</Link>
  </div>
  {error&&<div className="form-error" role="alert">{error}</div>}
  {notice&&<div className="success-banner" role="status">{notice}</div>}
  {loading&&!rows.length&&!grants.length&&<div className="settings-card list-skeleton"><span/><span/><span/></div>}
  {tab==="tickets"&&<div className="p12-grid">
   <section className="settings-card p12-card">
    <div className="section-heading"><h2>{s12(locale,"tickets")}</h2><Ticket size={22}/></div>
    {!rows.length?<div className="empty-panel">{s12(locale,"empty")}</div>:
     <div className="p12-cards">{rows.map(x=><button className={"p12-record p12-record-button"+(x.id===selectedId?" active":"")}
      key={x.id} onClick={()=>setSelectedId(x.id)}>
      <div className="p12-row"><strong>{x.subject}</strong>
       <span className={"data-badge "+x.status}>{x.status}</span></div>
      <small>{x.category} · {x.priority} · {when(x.createdAt,locale)}</small>
      {area==="platform"&&<small>{x.tenantId??"Platform"}</small>}
     </button>)}</div>}
   </section>
   <section className="settings-card p12-card">
    {selected?<><div className="section-heading"><div><h2>{selected.ticket.subject}</h2>
     <p className="muted">{selected.ticket.status}</p></div><Bell size={23}/></div>
     <div className="p12-messages">{selected.messages.map(x=><article className="p12-message" key={x.id}>
      <strong>{x.senderName}</strong><small>{when(x.createdAt,locale)}</small>
      <p>{x.body}</p></article>)}</div>
     {selected.ticket.status!=="closed"&&<form className="p12-form" onSubmit={e=>{e.preventDefault();
      void run("/api/support/tickets/"+selectedId+"/messages",{body:answer},"POST",()=>setAnswer(""));}}>
      <label>{s12(locale,"reply")}<textarea minLength={1} maxLength={1800} required value={answer}
       onChange={e=>setAnswer(e.target.value)}/></label>
      <button className="button button-primary" disabled={busy}>{s12(locale,"send")}</button>
     </form>}
     {area==="platform"&&<div className="p12-row">{(["open","in_progress","resolved","closed"] as const).map(x=>
      <button className="button button-small" key={x} disabled={busy||selected.ticket.status===x}
       onClick={()=>void run("/api/support/tickets/"+selectedId+"/status",{status:x})}>{x}</button>)}</div>}
    </>:<p className="muted">{s12(locale,"choose")} {s12(locale,"tickets")}</p>}
   </section>
   <section className="settings-card p12-card"><h2>{s12(locale,"newTicket")}</h2>
    <form className="p12-form" onSubmit={e=>{e.preventDefault();
     void run("/api/support/tickets",{tenantId:area==="platform"?tenantId||null:undefined,
      category,priority,subject,message},"POST",()=>{setSubject("");setMessage("");});}}>
     {area==="platform"&&<label>{s12(locale,"tenant")} ID<input maxLength={100}
      value={tenantId} onChange={e=>setTenantId(e.target.value)} placeholder="Optional"/></label>}
     <label>{s12(locale,"subject")}<input minLength={5} maxLength={160} required value={subject}
      onChange={e=>setSubject(e.target.value)}/></label>
     <div className="p12-form-grid">
      <label>{s12(locale,"category")}<select value={category} onChange={e=>setCategory(e.target.value)}>
       {["billing","technical","account"].map(x=><option value={x} key={x}>{x}</option>)}</select></label>
      <label>{s12(locale,"priority")}<select value={priority} onChange={e=>setPriority(e.target.value)}>
       {["low","normal","urgent"].map(x=><option value={x} key={x}>{x}</option>)}</select></label>
     </div>
     <label>{s12(locale,"message")}<textarea minLength={5} maxLength={1800} required
      value={message} onChange={e=>setMessage(e.target.value)}/></label>
     <button disabled={busy} className="button button-primary">{s12(locale,"create")}</button>
    </form>
   </section>
  </div>}
  {tab==="grants"&&<div className="p12-grid">
   <section className="settings-card p12-card"><h2>{s12(locale,"grants")}</h2>
    {!grants.length?<div className="empty-panel">{s12(locale,"empty")}</div>:
    <div className="p12-cards">{grants.map(x=><div key={x.id} className="p12-record">
     <div className="p12-row"><strong>{x.scope}</strong>
      <span className={"data-badge "+x.status}>{x.status}</span></div>
     <small>{s12(locale,"tenant")}: {x.tenantId}</small>
     <p>{x.reason}</p><small>{s12(locale,"duration")}: {when(x.expiresAt,locale)}</small>
     {area==="app"&&workspace.role==="owner"&&x.status==="pending"&&
      <div className="p12-row">{(["approve","reject"] as const).map(decision=><button key={decision}
       className="button button-small" disabled={busy}
       onClick={()=>void run("/api/support/grants/"+x.id+"/review",{decision})}>
       {s12(locale,decision)}</button>)}</div>}
     {area==="app"&&workspace.role==="owner"&&x.status==="approved"&&
      <button className="button button-small" disabled={busy}
       onClick={()=>void run("/api/support/grants/"+x.id+"/review",{decision:"revoke"})}>
       {s12(locale,"revoke")}</button>}
     {area==="platform"&&x.status==="approved"&&
      <button className="button button-small" disabled={busy} onClick={async()=>{
       try{const d=await jsonRequest<{restaurant:{name:string;status:string};locations:number}>(
        "/api/support/grants/"+x.id+"/metadata");
        setNotice(d.restaurant.name+" — "+d.restaurant.status+" · "+d.locations+" locations");}
       catch(e){setError(e instanceof Error?e.message:s12(locale,"error"));}}}>
       <LockKeyhole size={15}/>{s12(locale,"details")}</button>}
    </div>)}</div>}
   </section>
   {area==="platform"&&<section className="settings-card p12-card"><h2>{s12(locale,"newGrant")}</h2>
    <p className="muted">{s12(locale,"supportNote")}</p>
    <form className="p12-form" onSubmit={e=>{e.preventDefault();void run("/api/support/grants",
     {tenantId,reason:grantReason},"POST",()=>setGrantReason(""));}}>
     <label>{s12(locale,"tenant")} ID<input maxLength={100} minLength={1}
      value={tenantId} onChange={e=>setTenantId(e.target.value)} required/></label>
     <label>{s12(locale,"reason")}<textarea value={grantReason} minLength={10} maxLength={300}
      onChange={e=>setGrantReason(e.target.value)} required/></label>
     <button className="button button-primary" disabled={busy} type="submit">{s12(locale,"request")}</button>
    </form>
   </section>}
  </div>}
 </div>;
}
