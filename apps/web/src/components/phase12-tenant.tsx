"use client";
import {useState,type FormEvent} from "react";
import Link from "next/link";
import {ArrowUpRight,BadgeCheck,CalendarDays,Clock3,FileText,Headphones,
 LockKeyhole,MessageSquareText,Plus,RefreshCw,ShieldCheck,TicketCheck,Wallet} from "lucide-react";
import {useWorkspace} from "./workspace-provider";
import {money} from "@/lib/finance-types";
import {useSaasData,postSaas} from "@/lib/phase12-api";
import {p12} from "@/lib/phase12-copy";
import type {Locale} from "@dineflow/shared";
type Plan={id:string;planKey:string;version:number;name:string;priceMinor:number;
 maxTables:number;maxStaff:number;maxLocations:number;periodDays:number};
type Subscription={planId:string|null;status:string;trialEndsAt:string|null;
 periodEnd:string|null;graceEndsAt:string|null;suspensionReason:string|null};
type Summary={restaurant:{name:string;status:string}|null;subscription:Subscription|null;
 plan:Plan|null;trialEndsAt:string|null;renewalAt:string|null;
 canOpenNewVisits:boolean;invoiceCount:number;supportEmail:string;instructions:string};
type Invoice={id:string;number:string;status:string;amountMinor:number;currency:string;
 periodStart:string;periodEnd:string;dueAt:string;paidAt:string|null;issuedAt:string;
 planSnapshot:{name:string;version:number;priceMinor:number;maxTables:number;maxStaff:number}};
type Page<T>={items:T[];total:number;page:number;perPage:number};
type Ticket={id:string;subject:string;kind:string;priority:string;status:string;createdAt:string};
type Grant={id:string;scope:string;reason:string;expiresAt:string;revokedAt:string|null;createdAt:string};
function date(value:string|null|undefined,locale:Locale){return value?
 new Date(value).toLocaleDateString(locale,{year:"numeric",month:"short",day:"numeric"}):"—";}
function StateTag({value,locale}:{value:string;locale:Locale}){
 const key=(["trial","active","grace","suspended","issued","paid","voided",
  "open","closed","resolved","in_progress","pending","verified","rejected"].includes(value)?
   value:"status") as Parameters<typeof p12>[1];
 return <span className={"data-badge "+value}>{p12(locale,key)}</span>;
}
function Pulse({children}:{children:React.ReactNode}){return <span className="p12-pill">{children}</span>;}
function Busy({loading}:{loading:boolean}){return loading?
 <div className="settings-card list-skeleton"><span/><span/><span/></div>:null;}
function Feedback({error,notice}:{error:string;notice:string}){
 return <>{error&&<div className="form-error" role="alert">{error}</div>}
 {notice&&<div className="success-banner" role="status">{notice}</div>}</>;
}
export function RestaurantSubscription(){
 const {workspace}=useWorkspace(),locale=workspace.locale,owner=workspace.role==="owner";
 const [page,setPage]=useState(1),[selected,setSelected]=useState<string|null>(null);
 const summary=useSaasData<Summary>("/api/subscription");
 const invoices=useSaasData<Page<Invoice>>("/api/subscription/invoices?page="+page);
 const [busy,setBusy]=useState(false),[error,setError]=useState(""),[notice,setNotice]=useState("");
 const [reference,setReference]=useState(""),[method,setMethod]=useState("bank_transfer"),[note,setNote]=useState("");
 const [planKey,setPlanKey]=useState("growth"),[upgradeNote,setUpgradeNote]=useState("");
 async function act(path:string,data:Record<string,unknown>){
  setBusy(true);setError("");setNotice("");
  try{await postSaas(path,data);setNotice(p12(locale,"success"));setSelected(null);
   await Promise.all([summary.load(),invoices.load()]);}
  catch(e){setError(e instanceof Error?e.message:p12(locale,"error"));}
  finally{setBusy(false);}
 }
 async function proof(e:FormEvent){
  e.preventDefault();const row=invoices.data?.items.find(x=>x.id===selected);if(!row)return;
  await act("/api/subscription/invoices/"+encodeURIComponent(row.id)+"/proofs",
   {reference,method,note,amountMinor:row.amountMinor});
  setReference("");setNote("");
 }
 return <div className="content-stack p12-console">
  <div className="page-heading"><div><span className="eyebrow">DINEFLOW / SAAS</span>
   <h1>{p12(locale,"title")}</h1><p>{p12(locale,"subscriptionHelp")}</p></div>
   <button className="button" onClick={()=>{void summary.load();void invoices.load();}} type="button">
    <RefreshCw size={17}/>{p12(locale,"refresh")}</button></div>
  <Feedback error={error||summary.error||invoices.error} notice={notice}/>
  <Busy loading={summary.loading&&!summary.data}/>
  {summary.data&&<><div className="p12-hero">
   <div><span className="p12-eyebrow"><ShieldCheck size={17}/>{p12(locale,"currentPlan")}</span>
    <h2>{summary.data.plan?.name??p12(locale,"trial")}</h2>
    <p>{summary.data.plan?money(summary.data.plan.priceMinor,locale)+" / "+summary.data.plan.periodDays+" "+p12(locale,"periodDays"):p12(locale,"insufficient")}</p>
   </div><StateTag value={summary.data.subscription?.status??summary.data.restaurant?.status??"trial"} locale={locale}/>
   </div>
   <div className="p12-stat-grid">
    <div className="p12-stat"><CalendarDays/><span>{p12(locale,"trialEnds")}</span><strong>{date(summary.data.trialEndsAt,locale)}</strong></div>
    <div className="p12-stat"><CalendarDays/><span>{p12(locale,"renews")}</span><strong>{date(summary.data.renewalAt,locale)}</strong></div>
    <div className="p12-stat"><Wallet/><span>{p12(locale,"invoices")}</span><strong>{summary.data.invoiceCount}</strong></div>
    <div className="p12-stat"><BadgeCheck/><span>{p12(locale,"status")}</span>
     <strong>{summary.data.canOpenNewVisits?p12(locale,"active"):p12(locale,"suspended")}</strong></div>
   </div>
   {summary.data.plan&&<section className="settings-card p12-panel"><div className="section-heading">
    <h2>{p12(locale,"currentPlan")}</h2><Pulse>{summary.data.plan.planKey} v{summary.data.plan.version}</Pulse></div>
    <div className="p12-limits">{(["tables","staff","locations"] as const).map((key)=>
     <div key={key}><span>{p12(locale,key)}</span><strong>{key==="tables"?summary.data?.plan?.maxTables:
     key==="staff"?summary.data?.plan?.maxStaff:summary.data?.plan?.maxLocations}</strong></div>)}</div>
   </section>}
   {owner&&<section className="settings-card p12-panel"><div className="section-heading">
    <div><h2>{p12(locale,"requestUpgrade")}</h2><p>{p12(locale,"manuallyVerified")}</p></div>
    <TicketCheck size={23}/></div>
    <form className="p12-form-row" onSubmit={e=>{e.preventDefault();void act("/api/subscription/upgrade-request",
     {planKey,message:upgradeNote});}}>
      <label>{p12(locale,"requestedPlan")}<select value={planKey} onChange={e=>setPlanKey(e.target.value)}>
       <option value="growth">Growth</option><option value="starter">Starter</option></select></label>
      <label className="p12-grow">{p12(locale,"note")}<input value={upgradeNote} maxLength={300}
       onChange={e=>setUpgradeNote(e.target.value)}/></label>
      <button className="button button-primary" disabled={busy} type="submit"><MessageSquareText size={16}/>{p12(locale,"request")}</button>
    </form></section>}
   </>}
  <section className="settings-card p12-panel"><div className="section-heading">
   <div><h2>{p12(locale,"history")}</h2><p>{p12(locale,"proofWarning")}</p></div><FileText size={23}/></div>
   {invoices.loading&&!invoices.data?<Busy loading/>:
    !invoices.data?.items.length?<div className="empty-panel">{p12(locale,"noInvoices")}</div>:
    <div className="p12-invoices">{invoices.data.items.map(row=><article className="p12-invoice" key={row.id}>
     <div className="p12-invoice-main"><FileText size={21}/><div>
      <strong>{row.number}</strong><small>{row.planSnapshot.name} · {date(row.periodStart,locale)}–{date(row.periodEnd,locale)}</small></div></div>
     <div className="p12-invoice-meta"><strong>{money(row.amountMinor,locale)}</strong>
      <StateTag value={row.status} locale={locale}/><small>{p12(locale,"due")}: {date(row.dueAt,locale)}</small></div>
     <div className="p12-actions">
      <Link className="button button-small" href={"/app/subscription/invoices/"+encodeURIComponent(row.id)}>
       <FileText size={15}/>{p12(locale,"printInvoice")}</Link>
      {owner&&row.status==="issued"&&<button className="button button-primary button-small"
       type="button" onClick={()=>setSelected(row.id===selected?null:row.id)}>{p12(locale,"submitProof")}</button>}
     </div>
     {row.id===selected&&<form className="p12-proof-form" onSubmit={e=>void proof(e)}>
      <div className="p12-form-row"><label>{p12(locale,"method")}
       <select value={method} onChange={e=>setMethod(e.target.value)}>
        {(["bank_transfer","cash","mobile_money"] as const).map(k=><option key={k} value={k}>{p12(locale,k)}</option>)}</select></label>
       <label className="p12-grow">{p12(locale,"proofRef")}<input required minLength={4} maxLength={100}
        value={reference} onChange={e=>setReference(e.target.value)}/></label>
       <label className="p12-grow">{p12(locale,"note")}<input value={note} maxLength={500}
        onChange={e=>setNote(e.target.value)}/></label></div>
      <div className="p12-actions"><button className="button button-primary" disabled={busy} type="submit">
       {busy?p12(locale,"saving"):p12(locale,"send")}</button>
       <button className="button" type="button" onClick={()=>setSelected(null)}>{p12(locale,"cancel")}</button></div>
     </form>}
    </article>)}</div>}
   {invoices.data&&invoices.data.total>20&&<div className="pager">
    <button className="button" disabled={page===1} onClick={()=>setPage(page-1)}>{p12(locale,"previous")}</button>
    <span>{page}/{Math.ceil(invoices.data.total/20)}</span>
    <button className="button" disabled={page*20>=invoices.data.total} onClick={()=>setPage(page+1)}>{p12(locale,"next")}</button>
   </div>}
  </section>
  <div className="p12-note"><LockKeyhole size={19}/>{p12(locale,"proofWarning")}</div>
 </div>;
}

function Conversation({id,tenant=false}:{id:string;tenant?:boolean}){
 const {workspace}=useWorkspace(),locale=workspace.locale;
 const path=tenant?"/api/subscription/tickets/":"/api/platform/support/tickets/";
 const {data,loading,error,load}=useSaasData<{ticket:Ticket;messages:{id:string;actorId:string;body:string;createdAt:string}[]}>(path+encodeURIComponent(id));
 const [reply,setReply]=useState(""),[status,setStatus]=useState("in_progress"),[busy,setBusy]=useState(false),[error2,setError]=useState("");
 async function submit(e:FormEvent){
  e.preventDefault();setBusy(true);setError("");
  try{if(tenant)await postSaas(path+encodeURIComponent(id)+"/messages",{body:reply});
   else await postSaas(path+encodeURIComponent(id),{status,message:reply});
   setReply("");await load();}
  catch(e){setError(e instanceof Error?e.message:p12(locale,"error"));}
  finally{setBusy(false);}
 }
 return <section className="settings-card p12-panel">
   <div className="section-heading"><div><h2>{data?.ticket.subject??p12(locale,"messages")}</h2>
    {data&&<StateTag value={data.ticket.status} locale={locale}/>}</div>
    <button className="button button-small" onClick={()=>void load()}><RefreshCw size={16}/></button></div>
   <Busy loading={loading&&!data}/><Feedback error={error||error2} notice=""/>
   {data&&<><div className="p12-thread">{data.messages.map(m=><div key={m.id} className="p12-message">
     <small>{date(m.createdAt,locale)} · {m.actorId.slice(0,8)}</small><p>{m.body}</p></div>)}</div>
    {(tenant?workspace.role==="owner":true)&&data.ticket.status!=="closed"&&<form className="p12-thread-form" onSubmit={e=>void submit(e)}>
     {!tenant&&<select aria-label={p12(locale,"status")} value={status} onChange={e=>setStatus(e.target.value)}>
      {(["open","in_progress","resolved","closed"] as const).map(k=><option key={k} value={k}>{p12(locale,k)}</option>)}</select>}
     <textarea maxLength={2000} value={reply} placeholder={p12(locale,"reply")}
      onChange={e=>setReply(e.target.value)}/>
     <button className="button button-primary" disabled={busy||(tenant&&!reply.trim())} type="submit">
      <MessageSquareText size={16}/>{p12(locale,"send")}</button>
    </form>}</>}
 </section>;
}
export {Conversation as SaasConversation};

export function RestaurantSupport(){
 const {workspace}=useWorkspace(),locale=workspace.locale,owner=workspace.role==="owner";
 const [page,setPage]=useState(1),[selected,setSelected]=useState("");
 const tickets=useSaasData<Page<Ticket>>("/api/subscription/tickets?page="+page);
 const grants=useSaasData<{items:Grant[]}>("/api/subscription/grants");
 const [subject,setSubject]=useState(""),[message,setMessage]=useState("");
 const [kind,setKind]=useState("technical"),[priority,setPriority]=useState("normal");
 const [scope,setScope]=useState("configuration_metadata"),[minutes,setMinutes]=useState(30),[reason,setReason]=useState("");
 const [busy,setBusy]=useState(false),[error,setError]=useState(""),[notice,setNotice]=useState("");
 async function run(path:string,data:Record<string,unknown>){
  setBusy(true);setError("");setNotice("");
  try{await postSaas(path,data);setNotice(p12(locale,"success"));await Promise.all([tickets.load(),grants.load()]);return true;}
  catch(e){setError(e instanceof Error?e.message:p12(locale,"error"));return false;}
  finally{setBusy(false);}
 }
 return <div className="content-stack p12-console">
  <div className="page-heading"><div><div className="eyebrow">DINEFLOW / HELP CENTER</div>
   <h1>{p12(locale,"support")}</h1><p>{p12(locale,"supportHelp")}</p></div>
   <Headphones size={30}/></div>
  <Feedback error={error||tickets.error||grants.error} notice={notice}/>
  {owner&&<section className="settings-card p12-panel"><div className="section-heading">
   <h2>{p12(locale,"openTicket")}</h2><Plus size={21}/></div>
   <form onSubmit={e=>{e.preventDefault();void run("/api/subscription/tickets",
    {subject,kind,priority,message}).then(ok=>{if(ok){setSubject("");setMessage("");}});}}
    className="p12-form-stack">
    <div className="p12-form-row"><label className="p12-grow">{p12(locale,"ticketSubject")}
     <input required minLength={5} maxLength={140} value={subject} onChange={e=>setSubject(e.target.value)}/></label>
     <label>{p12(locale,"ticketType")}<select value={kind} onChange={e=>setKind(e.target.value)}>
      {(["billing","technical","account"] as const).map(k=><option key={k} value={k}>{p12(locale,k)}</option>)}</select></label>
     <label>{p12(locale,"priority")}<select value={priority} onChange={e=>setPriority(e.target.value)}>
      <option value="normal">{p12(locale,"normal")}</option><option value="high">{p12(locale,"high")}</option></select></label></div>
    <textarea required minLength={5} maxLength={2000} value={message} onChange={e=>setMessage(e.target.value)}
     placeholder={p12(locale,"ticketMessage")}/>
    <button className="button button-primary" type="submit" disabled={busy}>{p12(locale,"createTicket")}</button>
   </form></section>}
  <section className="settings-card p12-panel"><div className="section-heading"><h2>{p12(locale,"tickets")}</h2>
   <Pulse>{tickets.data?.total??"—"}</Pulse></div>
   <Busy loading={tickets.loading&&!tickets.data}/>
   {!tickets.data?.items.length&&!tickets.loading?<div className="empty-panel">{p12(locale,"noData")}</div>:
    <div className="p12-list">{tickets.data?.items.map(t=><button type="button" key={t.id}
     className={"p12-list-row"+(selected===t.id?" selected":"")} onClick={()=>setSelected(t.id)}>
     <TicketCheck size={21}/><span><strong>{t.subject}</strong><small>{date(t.createdAt,locale)} · {t.kind}</small></span>
     <StateTag value={t.status} locale={locale}/><ArrowUpRight size={17}/></button>)}</div>}
   {tickets.data&&tickets.data.total>20&&<div className="pager">
    <button className="button" disabled={page===1} onClick={()=>{setSelected("");setPage(page-1);}}>{p12(locale,"previous")}</button>
    <span>{page}/{Math.ceil(tickets.data.total/20)}</span>
    <button className="button" disabled={page*20>=tickets.data.total} onClick={()=>{setSelected("");setPage(page+1);}}>{p12(locale,"next")}</button></div>}
  </section>
  {selected&&<Conversation key={selected} id={selected} tenant/>}
  <section className="settings-card p12-panel"><div className="section-heading">
   <div><h2>{p12(locale,"grants")}</h2><p>{p12(locale,"grantHelp")}</p></div><ShieldCheck size={24}/></div>
   {owner&&<form className="p12-form-row" onSubmit={e=>{e.preventDefault();void run("/api/subscription/grants",
    {scope,minutes,reason}).then(ok=>{if(ok)setReason("");});}}>
    <label>{p12(locale,"grantScope")}<select value={scope} onChange={e=>setScope(e.target.value)}>
     <option value="billing_metadata">{p12(locale,"billing_metadata")}</option>
     <option value="configuration_metadata">{p12(locale,"configuration_metadata")}</option></select></label>
    <label>{p12(locale,"minutes")}<input type="number" min={1} max={60} value={minutes}
     onChange={e=>setMinutes(Number(e.target.value))}/></label>
    <label className="p12-grow">{p12(locale,"reason")}<input required minLength={10} maxLength={280}
     value={reason} onChange={e=>setReason(e.target.value)}/></label>
    <button className="button button-primary" disabled={busy} type="submit">{p12(locale,"grant")}</button>
   </form>}
   <Busy loading={grants.loading&&!grants.data}/>
   {!grants.data?.items.length&&!grants.loading?<div className="empty-panel">{p12(locale,"notGranted")}</div>:
    <div className="p12-list">{grants.data?.items.map(g=><div className="p12-list-row" key={g.id}>
     <Clock3 size={19}/><span><strong>{p12(locale,g.scope as "billing_metadata"|"configuration_metadata")}</strong>
      <small>{g.reason} · {p12(locale,"expires")}: {date(g.expiresAt,locale)}</small></span>
     <Pulse>{g.revokedAt?"Revoked":new Date(g.expiresAt)>new Date()?p12(locale,"active"):p12(locale,"expires")}</Pulse>
     {owner&&!g.revokedAt&&new Date(g.expiresAt)>new Date()&&<button className="button button-small"
      disabled={busy} onClick={()=>void run("/api/subscription/grants/"+encodeURIComponent(g.id)+"/revoke",{})}>
      {p12(locale,"revoke")}</button>}</div>)}</div>}
  </section>
 </div>;
}
