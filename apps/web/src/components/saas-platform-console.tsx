
"use client";
import {useCallback,useEffect,useState,type FormEvent} from "react";
import Link from "next/link";
import {Activity,ArrowUpRight,BadgeCheck,Banknote,Building2,ClipboardList,
 CreditCard,FilePlus2,RefreshCw,Settings2,ShieldCheck,Ticket,Wallet} from "lucide-react";
import {useWorkspace} from "./workspace-provider";
import {jsonRequest} from "@/lib/phase2-api";
import {s12} from "@/lib/saas-copy";
import {money} from "@/lib/finance-types";
type Plan={id:string;code:string;name:string;version:number;priceMinor:number;periodDays:number;
 staffLimit:number;tableLimit:number;locationLimit:number;active:boolean};
type Invoice={id:string;number:string;tenantId:string;tenantName:string;amountMinor:number;
 status:string;periodStart:string;periodEnd:string;dueAt:string;createdAt:string};
type Payment={id:string;tenantId:string;invoiceId:string;invoiceNumber:string;reference:string;
 method:string;amountMinor:number;proofNote:string;status:string;createdAt:string};
type Audit={id:string;tenantId:string|null;userId:string|null;action:string;createdAt:string;
 details:Record<string,unknown>};
type Settings={trialDays:number;graceDays:number;supportContact:string;incidentBanner:string};
type Overview={tenants:number;trial:number;active:number;grace:number;suspended:number;
 pending:number;overdueInvoices:number;paymentClaims:number;openTickets:number};
const when=(date:string,locale:string)=>new Date(date).toLocaleDateString(locale,
 {year:"numeric",month:"short",day:"numeric"});
function useEndpoint<T>(path:string){
 const [data,setData]=useState<T|null>(null),[loading,setLoading]=useState(true),
  [error,setError]=useState("");
 const reload=useCallback(async()=>{
  setLoading(true);setError("");
  try{setData(await jsonRequest<T>(path));}
  catch(e){setError(e instanceof Error?e.message:"Unable to load records.");}
  finally{setLoading(false);}
 },[path]);
 useEffect(()=>{void reload();},[reload]);
 return {data,loading,error,reload};
}
function Alert({error,notice}:{error:string;notice:string}){
 return <>{error&&<div className="form-error" role="alert">{error}</div>}
 {notice&&<div className="success-banner" role="status">{notice}</div>}</>;
}
export function SaasPlatformOverview(){
 const {workspace}=useWorkspace(),locale=workspace.locale;
 const x=useEndpoint<Overview>("/api/platform/overview");
 const rows:[keyof Overview,string,string][]=[
  ["tenants",s12(locale,"restaurants"),"/platform/restaurants"],
  ["active",s12(locale,"active"),"/platform/restaurants"],
  ["trial",s12(locale,"trial"),"/platform/restaurants"],
  ["grace",s12(locale,"grace"),"/platform/restaurants"],
  ["suspended",s12(locale,"suspended"),"/platform/restaurants/suspended"],
  ["pending",s12(locale,"pending"),"/platform/restaurants/pending"],
  ["overdueInvoices",s12(locale,"invoices"),"/platform/subscriptions/invoices"],
  ["paymentClaims",s12(locale,"payments"),"/platform/subscriptions/payments"],
  ["openTickets",s12(locale,"tickets"),"/platform/support/tickets"]];
 return <div className="content-stack p12-console">
  <div className="page-heading"><div><span className="eyebrow">DINEFLOW PLATFORM / OPERATIONS</span>
   <h1>{s12(locale,"overview")}</h1><p>{s12(locale,"safeNote")}</p></div>
   <button className="button" onClick={()=>void x.reload()}><RefreshCw size={18}/>{s12(locale,"refresh")}</button></div>
  {x.error&&<div className="form-error">{x.error}</div>}
  <div className="p12-kpis">{rows.map(([key,label,url])=><Link href={url} className="p12-kpi" key={key}>
   <small>{label}</small><strong>{x.data?x.data[key]:"—"}</strong><ArrowUpRight size={17}/></Link>)}</div>
  <div className="p12-grid">
   <Link className="settings-card p12-link-card" href="/platform/subscriptions/plans"><CreditCard size={28}/>
    <h2>{s12(locale,"plans")}</h2><span>{s12(locale,"details")} ↗</span></Link>
   <Link className="settings-card p12-link-card" href="/platform/support/grants"><ShieldCheck size={28}/>
    <h2>{s12(locale,"grants")}</h2><span>{s12(locale,"supportNote")} ↗</span></Link>
  </div></div>;
}
export function SaasPlatformConsole({tab}:{tab:"plans"|"invoices"|"payments"|"audit"|"settings"}){
 const {workspace}=useWorkspace(),locale=workspace.locale;
 const [page,setPage]=useState(1),[filter,setFilter]=useState(""),[notice,setNotice]=useState(""),
  [error,setError]=useState(""),[busy,setBusy]=useState(false);
 const [plan,setPlan]=useState({code:"",name:"",priceMinor:0,periodDays:30,
  staffLimit:20,tableLimit:100,locationLimit:1});
 const [targetTenant,setTargetTenant]=useState(""),[reason,setReason]=useState(""),
  [auditAction,setAuditAction]=useState("");
 const [policy,setPolicy]=useState<Settings>({trialDays:14,graceDays:7,
  supportContact:"",incidentBanner:""});
 const path=tab==="plans"?"/api/platform/plans":tab==="settings"?"/api/platform/settings":
  "/api/platform/"+tab+"?page="+page+(filter?"&status="+encodeURIComponent(filter):"")+
  (tab==="audit"&&auditAction?"&action="+encodeURIComponent(auditAction):"");
 const results=useEndpoint<{items:unknown[];total?:number;perPage?:number;settings?:Settings}>(path);
 useEffect(()=>{if(tab==="settings"&&results.data?.settings)setPolicy(results.data.settings);},
  [tab,results.data]);
 async function submit(path:string,body:object,method:"POST"|"PATCH"="POST"){
  setBusy(true);setError("");setNotice("");
  try{
   await jsonRequest(path,{method,body:JSON.stringify(body)});
   setNotice("Updated successfully.");await results.reload();
  }catch(e){setError(e instanceof Error?e.message:s12(locale,"error"));}
  finally{setBusy(false);}
 }
 function validateReason(){if(reason.trim().length<5){setError("Enter a reason of at least five characters.");return false;}return true;}
 const plans=(results.data?.items??[]) as Plan[],
  invoices=(results.data?.items??[]) as Invoice[],
  payments=(results.data?.items??[]) as Payment[],
  audit=(results.data?.items??[]) as Audit[];
 return <div className="content-stack p12-console">
  <div className="page-heading"><div><span className="eyebrow">DINEFLOW / PLATFORM CONTROL</span>
   <h1>{s12(locale,tab)}</h1><p>{s12(locale,"safeNote")}</p></div>
   <button className="button" disabled={results.loading} onClick={()=>void results.reload()}>
    <RefreshCw size={17}/>{s12(locale,"refresh")}</button></div>
  <div className="p12-tabs">
   {(["plans","invoices","payments"] as const).map(key=>
    <Link className={"p12-tab"+(tab===key?" active":"")} key={key}
     href={"/platform/subscriptions/"+key}>{s12(locale,key)}</Link>)}
   <Link className={"p12-tab"+(tab==="audit"?" active":"")} href="/platform/audit">{s12(locale,"audit")}</Link>
   <Link className={"p12-tab"+(tab==="settings"?" active":"")} href="/platform/settings">{s12(locale,"settings")}</Link>
  </div>
  <Alert error={error||results.error} notice={notice}/>
  {results.loading&&!results.data&&<div className="settings-card list-skeleton"><span/><span/><span/></div>}
  {tab==="plans"&&<>
   <section className="settings-card p12-card">
    <div className="section-heading"><h2>{s12(locale,"plans")}</h2><BadgeCheck size={24}/></div>
    {!plans.length?<div className="empty-panel">{s12(locale,"empty")}</div>:
     <div className="p12-cards">{plans.map(x=><article className="p12-record" key={x.id}>
      <div className="p12-row"><strong>{x.name}</strong><span className="data-badge active">v{x.version}</span></div>
      <small dir="ltr">{x.code} · {x.id}</small>
      <strong>{money(x.priceMinor,locale)} / {x.periodDays} d</strong>
      <div className="p12-row"><span>{s12(locale,"staff")}: {x.staffLimit}</span>
       <span>{s12(locale,"tables")}: {x.tableLimit}</span><span>{s12(locale,"locations")}: {x.locationLimit}</span></div>
     </article>)}</div>}
   </section>
   <section className="settings-card p12-card"><h2>{s12(locale,"createPlan")}</h2>
    <p className="muted">Each save creates an immutable new version. Existing invoices retain the old plan.</p>
    <form className="p12-form p12-form-grid" onSubmit={e=>{e.preventDefault();void submit("/api/platform/plans",plan);}}>
     <label>{s12(locale,"code")}<input required minLength={2} maxLength={40} value={plan.code}
       onChange={e=>setPlan({...plan,code:e.target.value})}/></label>
     <label>{s12(locale,"name")}<input required minLength={2} maxLength={90} value={plan.name}
       onChange={e=>setPlan({...plan,name:e.target.value})}/></label>
     {(["priceMinor","periodDays","staffLimit","tableLimit","locationLimit"] as const).map(key=>
      <label key={key}>{s12(locale,({priceMinor:"price",periodDays:"period",staffLimit:"staff",
       tableLimit:"tables",locationLimit:"locations"} as const)[key])}
       <input type="number" min={key==="priceMinor"?0:1} required value={plan[key]}
        onChange={e=>setPlan({...plan,[key]:Number(e.target.value)})}/></label>)}
     <button className="button button-primary" disabled={busy} type="submit"><FilePlus2 size={18}/>{s12(locale,"createPlan")}</button>
    </form>
   </section>
  </>}
  {tab==="invoices"&&<>
   <section className="settings-card p12-card"><h2>{s12(locale,"createInvoice")}</h2>
    <form className="p12-inline" onSubmit={e=>{e.preventDefault();void submit("/api/platform/invoices",{tenantId:targetTenant});}}>
     <label>{s12(locale,"tenant")} ID<input required maxLength={100} value={targetTenant}
      onChange={e=>setTargetTenant(e.target.value)} placeholder="Restaurant ID"/></label>
     <button className="button button-primary" disabled={busy} type="submit">{s12(locale,"createInvoice")}</button>
     <Link className="text-link" href="/platform/restaurants">{s12(locale,"restaurants")}</Link>
    </form></section>
   <section className="settings-card p12-card">
    <div className="section-heading"><h2>{s12(locale,"invoices")}</h2><FilePlus2 size={23}/></div>
    <label className="p12-filter">{s12(locale,"status")}<select value={filter}
     onChange={e=>{setFilter(e.target.value);setPage(1);}}>
      {["","draft","issued","paid","voided"].map(x=><option key={x} value={x}>{x||"All"}</option>)}
     </select></label>
    {!invoices.length?<div className="empty-panel">{s12(locale,"empty")}</div>:
     <div className="table-scroll"><table className="data-table"><thead><tr>
      <th>{s12(locale,"reference")}</th><th>{s12(locale,"tenant")}</th><th>{s12(locale,"amount")}</th>
      <th>{s12(locale,"due")}</th><th>{s12(locale,"status")}</th><th>{s12(locale,"action")}</th></tr></thead><tbody>
      {invoices.map(x=><tr key={x.id}><td dir="ltr">{x.number}</td>
       <td><Link href={"/platform/restaurants/"+x.tenantId}>{x.tenantName}</Link></td>
       <td>{money(x.amountMinor,locale)}</td><td>{when(x.dueAt,locale)}</td>
       <td><span className={"data-badge "+x.status}>{x.status}</span></td><td className="p12-row">
       {x.status==="draft"&&<button className="button button-small" disabled={busy}
        onClick={()=>void submit("/api/platform/invoices/"+x.id+"/issue",{})}>{s12(locale,"issue")}</button>}
       {["draft","issued"].includes(x.status)&&<button className="button button-small"
        disabled={busy} onClick={()=>{if(validateReason())void submit("/api/platform/invoices/"+x.id+"/void",{reason});}}>
        {s12(locale,"void")}</button>}
       </td></tr>)}</tbody></table></div>}
    <label className="p12-filter">{s12(locale,"reason")} ({s12(locale,"void")})
     <input maxLength={200} value={reason} onChange={e=>setReason(e.target.value)}/></label>
   </section>
  </>}
  {tab==="payments"&&<section className="settings-card p12-card">
   <div className="section-heading"><div><h2>{s12(locale,"payments")}</h2>
    <p className="muted">{s12(locale,"pendingNote")}</p></div><Banknote size={24}/></div>
   <label className="p12-filter">{s12(locale,"status")}
    <select value={filter} onChange={e=>{setFilter(e.target.value);setPage(1);}}>
     {["","pending","verified","rejected"].map(x=><option key={x} value={x}>{x||"All"}</option>)}
    </select></label>
   <label className="p12-filter">{s12(locale,"reason")}<input maxLength={300} value={reason}
    onChange={e=>setReason(e.target.value)} placeholder="Required for rejection"/></label>
   {!payments.length?<div className="empty-panel">{s12(locale,"empty")}</div>:
    <div className="p12-cards">{payments.map(x=><article key={x.id} className="p12-record">
     <div className="p12-row"><strong>{x.invoiceNumber}</strong><span className={"data-badge "+x.status}>{x.status}</span></div>
     <small>{s12(locale,"tenant")}: {x.tenantId}</small>
     <strong>{money(x.amountMinor,locale)}</strong>
     <p>{x.method} · <bdi>{x.reference}</bdi></p><p>{x.proofNote}</p>
     {x.status==="pending"&&<div className="p12-row">
      <button disabled={busy} className="button button-primary button-small"
       onClick={()=>{if(window.confirm("Verify this evidence and settle the invoice?"))
        void submit("/api/platform/payments/"+x.id+"/review",{decision:"verify",reason});}}>
        <ShieldCheck size={16}/>{s12(locale,"verify")}</button>
      <button disabled={busy} className="button button-small"
       onClick={()=>{if(validateReason())void submit("/api/platform/payments/"+x.id+"/review",{decision:"reject",reason});}}>
        {s12(locale,"reject")}</button>
     </div>}
    </article>)}</div>}
  </section>}
  {tab==="audit"&&<section className="settings-card p12-card">
   <div className="section-heading"><h2>{s12(locale,"audit")}</h2><Activity size={23}/></div>
   <form className="p12-inline" onSubmit={e=>{e.preventDefault();setPage(1);setAuditAction(reason);}}>
    <label>{s12(locale,"action")}<input value={reason} onChange={e=>setReason(e.target.value)}
     maxLength={80} placeholder="saas."/></label>
    <button className="button" type="submit">{s12(locale,"search")}</button>
   </form>
   {!audit.length?<div className="empty-panel">{s12(locale,"empty")}</div>:
    <div className="table-scroll"><table className="data-table"><thead><tr>
     <th>{s12(locale,"date")}</th><th>{s12(locale,"action")}</th><th>{s12(locale,"tenant")}</th>
     <th>{s12(locale,"actor")}</th><th>{s12(locale,"details")}</th></tr></thead><tbody>
    {audit.map(x=><tr key={x.id}><td>{when(x.createdAt,locale)}</td><td>{x.action}</td>
     <td>{x.tenantId??"—"}</td><td>{x.userId?.slice(0,9)??"—"}</td>
     <td><details><summary>{s12(locale,"details")}</summary>
       <pre className="p12-pre">{JSON.stringify(x.details,null,2)}</pre></details></td></tr>)}</tbody></table></div>}
  </section>}
  {tab==="settings"&&<section className="settings-card p12-card">
   <div className="section-heading"><h2>{s12(locale,"settings")}</h2><Settings2 size={23}/></div>
   <form className="p12-form" onSubmit={e=>{e.preventDefault();void submit("/api/platform/settings",
    {...policy,reason},"PATCH");}}>
    <div className="p12-form-grid">
     <label>{s12(locale,"trialDays")}<input type="number" min={1} max={90}
      value={policy.trialDays} onChange={e=>setPolicy({...policy,trialDays:Number(e.target.value)})}/></label>
     <label>{s12(locale,"graceDays")}<input type="number" min={0} max={30}
      value={policy.graceDays} onChange={e=>setPolicy({...policy,graceDays:Number(e.target.value)})}/></label>
    </div>
    <label>{s12(locale,"contact")}<input maxLength={150} value={policy.supportContact}
     onChange={e=>setPolicy({...policy,supportContact:e.target.value})}/></label>
    <label>{s12(locale,"incident")}<textarea maxLength={250} value={policy.incidentBanner}
     onChange={e=>setPolicy({...policy,incidentBanner:e.target.value})}/></label>
    <label>{s12(locale,"reason")}<input required minLength={5} maxLength={250} value={reason}
     onChange={e=>setReason(e.target.value)}/></label>
    <button type="submit" className="button button-primary" disabled={busy}>{s12(locale,"save")}</button>
   </form>
  </section>}
  {tab!=="plans"&&tab!=="settings"&&!!results.data?.total&&(results.data.total>results.data.perPage!)&&
   <div className="pager"><button className="button button-small" disabled={page<=1}
    onClick={()=>setPage(page-1)}>{s12(locale,"previous")}</button>
   <span>{page} / {Math.ceil(results.data.total/results.data.perPage!)}</span>
   <button className="button button-small" disabled={page>=Math.ceil(results.data.total/results.data.perPage!)}
    onClick={()=>setPage(page+1)}>{s12(locale,"next")}</button></div>}
 </div>;
}
