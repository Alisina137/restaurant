
"use client";
import {useCallback,useEffect,useState,type FormEvent} from "react";
import Link from "next/link";
import {ArrowDownToLine,ArrowUpRight,BadgeCheck,CalendarClock,CheckCircle2,CreditCard,FileText,LockKeyhole,RefreshCw,ShieldAlert} from "lucide-react";
import {useWorkspace} from "./workspace-provider";
import {jsonRequest} from "@/lib/phase2-api";
import {s12} from "@/lib/saas-copy";
import {money} from "@/lib/finance-types";
type Sub={status:string;planName:string;planCode:string;planVersion:number;priceMinor:number;
 periodDays:number;staffLimit:number;tableLimit:number;locationLimit:number;
 trialEndsAt:string|null;paidUntil:string|null;graceEndsAt:string|null};
type Overview={subscription:Sub;effectiveStatus:string;graceDays:number;supportContact:string;
 canChange:boolean;paymentInstructions:string};
type Invoice={id:string;number:string;status:string;amountMinor:number;periodStart:string;periodEnd:string;
 issuedAt:string|null;dueAt:string;paidAt:string|null;createdAt:string};
type Claim={id:string;invoiceId:string;reference:string;amountMinor:number;
 method:string;status:string;createdAt:string;reviewReason:string|null};
const printDay=(value:string|null,locale:string)=>value?new Date(value).toLocaleDateString(locale,
 {year:"numeric",month:"short",day:"numeric"}):"—";
export function SaasRestaurantConsole({tab}:{tab:"plan"|"invoices"}){
 const {workspace}=useWorkspace(),locale=workspace.locale;
 const [overview,setOverview]=useState<Overview|null>(null),[invoices,setInvoices]=useState<Invoice[]>([]),
  [claims,setClaims]=useState<Claim[]>([]);
 const [busy,setBusy]=useState(false),[loading,setLoading]=useState(true),[error,setError]=useState(""),
  [notice,setNotice]=useState("");
 const [upgrade,setUpgrade]=useState(""),[invoiceId,setInvoiceId]=useState(""),
  [reference,setReference]=useState(""),[method,setMethod]=useState("bank_transfer"),[proof,setProof]=useState("");
 const load=useCallback(async()=>{
  setLoading(true);setError("");
  try{
   const [o,i,p]=await Promise.all([
    jsonRequest<Overview>("/api/saas/subscription"),
    jsonRequest<{items:Invoice[]}>("/api/saas/invoices"),
    jsonRequest<{items:Claim[]}>("/api/saas/payments")]);
   setOverview(o);setInvoices(i.items);setClaims(p.items);
  }catch(e){setError(e instanceof Error?e.message:s12(locale,"error"));}
  finally{setLoading(false);}
 },[locale]);
 useEffect(()=>{void load();},[load]);
 async function mutate(path:string,data:object,success:string){
  setBusy(true);setError("");setNotice("");
  try{
   await jsonRequest(path,{method:"POST",body:JSON.stringify(data)});
   setNotice(success);await load();
  }catch(e){setError(e instanceof Error?e.message:s12(locale,"error"));}
  finally{setBusy(false);}
 }
 async function sendUpgrade(e:FormEvent){e.preventDefault();
  await mutate("/api/saas/upgrade-request",{message:upgrade},s12(locale,"payPending"));setUpgrade("");
 }
 async function sendProof(e:FormEvent){e.preventDefault();
  if(!invoiceId)return;
  await mutate("/api/saas/invoices/"+encodeURIComponent(invoiceId)+"/proof",
   {method,reference,proofNote:proof},s12(locale,"pendingNote"));
  setReference("");setProof("");
 }
 const canChange=overview?.canChange??false;
 return <div className="content-stack p12-console">
  <div className="page-heading"><div><span className="eyebrow">DINEFLOW / SAAS</span>
   <h1>{s12(locale,"subscription")}</h1>
   <p>{s12(locale,"manual")}</p></div>
   <button className="button" type="button" disabled={loading} onClick={()=>void load()}>
    <RefreshCw size={17}/>{s12(locale,"refresh")}</button></div>
  <div className="p12-tabs">
   <Link className={"p12-tab"+(tab==="plan"?" active":"")} href="/app/subscription/plan">
    <BadgeCheck size={17}/>{s12(locale,"plan")}</Link>
   <Link className={"p12-tab"+(tab==="invoices"?" active":"")} href="/app/subscription/invoices">
    <FileText size={17}/>{s12(locale,"invoices")}</Link>
  </div>
  {error&&<div className="form-error" role="alert">{error}</div>}
  {notice&&<div className="success-banner" role="status">{notice}</div>}
  {loading&&!overview?<div className="settings-card list-skeleton"><span/><span/><span/></div>:null}
  {overview&&tab==="plan"&&<div className="p12-grid">
    <section className="settings-card p12-card">
     <div className="section-heading"><div><span className="eyebrow">{s12(locale,"current")}</span>
      <h2>{overview.subscription.planName}</h2></div>
      <span className={"data-badge "+overview.effectiveStatus}>{overview.effectiveStatus}</span></div>
     <strong className="p12-price">{money(overview.subscription.priceMinor,locale)}
      <small> / {overview.subscription.periodDays}d</small></strong>
     <div className="p12-metrics">
      <div><span>{s12(locale,"staff")}</span><strong>{overview.subscription.staffLimit}</strong></div>
      <div><span>{s12(locale,"tables")}</span><strong>{overview.subscription.tableLimit}</strong></div>
      <div><span>{s12(locale,"locations")}</span><strong>{overview.subscription.locationLimit}</strong></div>
      <div><span>{s12(locale,"version")}</span><strong>v{overview.subscription.planVersion}</strong></div>
     </div>
     <div className="p12-info"><CalendarClock size={19}/><div>
      <strong>{s12(locale,"renewal")}</strong>
      <span>{printDay(overview.subscription.paidUntil??overview.subscription.trialEndsAt,locale)}</span>
      </div></div>
     {overview.effectiveStatus==="suspended"||overview.effectiveStatus==="grace"?
      <p className="p12-warning"><ShieldAlert size={18}/>
       {overview.effectiveStatus==="suspended"?
       "New visits are blocked; existing checks may still be settled.":"Subscription is in its grace period. Renew to avoid disruption."}
       </p>:null}
    </section>
    <section className="settings-card p12-card">
     <div className="section-heading"><div><h2>{s12(locale,"upgrade")}</h2>
      <p className="muted">{s12(locale,"supportNote")}</p></div><CreditCard size={25}/></div>
     {canChange?<form className="p12-form" onSubmit={e=>void sendUpgrade(e)}>
       <label>{s12(locale,"message")}<textarea required minLength={10} maxLength={1000}
        placeholder="Describe the plan and limits you need." value={upgrade}
        onChange={e=>setUpgrade(e.target.value)}/></label>
       <button disabled={busy} className="button button-primary" type="submit">
        {s12(locale,"request")}</button>
      </form>:<p className="muted"><LockKeyhole size={18}/>{s12(locale,"noAccess")}</p>}
     {overview.supportContact&&<p className="muted">{s12(locale,"contact")}: {overview.supportContact}</p>}
     <Link className="text-link" href="/app/support/tickets">{s12(locale,"tickets")} <ArrowUpRight size={16}/></Link>
    </section>
  </div>}
  {overview&&tab==="invoices"&&<>
    <section className="settings-card p12-card">
     <div className="section-heading"><div><h2>{s12(locale,"invoices")}</h2>
      <p className="muted">{s12(locale,"pendingNote")}</p></div><FileText size={23}/></div>
     {!invoices.length?<div className="empty-panel">{s12(locale,"empty")}</div>:
      <div className="table-scroll"><table className="data-table">
       <thead><tr><th>{s12(locale,"reference")}</th><th>{s12(locale,"amount")}</th>
        <th>{s12(locale,"due")}</th><th>{s12(locale,"status")}</th>
        <th>{s12(locale,"details")}</th></tr></thead><tbody>
       {invoices.map(x=><tr key={x.id}><td><strong dir="ltr">{x.number}</strong></td>
        <td>{money(x.amountMinor,locale)}</td><td>{printDay(x.dueAt,locale)}</td>
        <td><span className={"data-badge "+x.status}>{x.status}</span></td>
        <td><Link href={"/app/subscription/invoices/"+x.id} className="button button-small">
         <FileText size={15}/>{s12(locale,"print")}</Link></td></tr>)}
       </tbody></table></div>}
    </section>
    {canChange&&invoices.some(x=>x.status==="issued"&&x.amountMinor>0)&&<section className="settings-card p12-card">
     <h2>{s12(locale,"submitProof")}</h2><p className="muted">{overview.paymentInstructions}</p>
     <form className="p12-form" onSubmit={e=>void sendProof(e)}>
      <label>{s12(locale,"invoices")}
       <select required value={invoiceId} onChange={e=>setInvoiceId(e.target.value)}>
        <option value="">{s12(locale,"choose")}</option>
        {invoices.filter(x=>x.status==="issued"&&x.amountMinor>0)
         .map(x=><option key={x.id} value={x.id}>{x.number} — {money(x.amountMinor,locale)}</option>)}
       </select></label>
      <label>{s12(locale,"method")}<select value={method} onChange={e=>setMethod(e.target.value)}>
       <option value="bank_transfer">Bank transfer</option><option value="cash">Cash</option>
       <option value="mobile_money">Mobile money</option></select></label>
      <label>{s12(locale,"reference")}<input required minLength={5} maxLength={120}
       value={reference} onChange={e=>setReference(e.target.value)}/></label>
      <label>{s12(locale,"proof")}<textarea required minLength={10} maxLength={900}
       value={proof} onChange={e=>setProof(e.target.value)}/></label>
      <button type="submit" disabled={busy||!invoiceId} className="button button-primary">
       <ArrowDownToLine size={18}/>{s12(locale,"submitProof")}</button>
     </form>
    </section>}
    <section className="settings-card p12-card"><h2>{s12(locale,"payments")}</h2>
     {claims.length?<div className="p12-cards">{claims.map(x=><div className="p12-record" key={x.id}>
      <strong dir="ltr">{x.reference}</strong><span className={"data-badge "+x.status}>{x.status}</span>
      <span>{money(x.amountMinor,locale)}</span>{x.reviewReason&&<small>{x.reviewReason}</small>}
     </div>)}</div>:<p className="muted">{s12(locale,"empty")}</p>}
    </section>
   </>}
 </div>;
}
type Printable={id:string;number:string;status:string;amountMinor:number;periodStart:string;
 periodEnd:string;dueAt:string;issuedAt:string|null;paidAt:string|null;planName:string;planVersion:number};
export function SaasInvoicePrint({id}:{id:string}){
 const {workspace}=useWorkspace(),locale=workspace.locale;
 const [invoice,setInvoice]=useState<Printable|null>(null),[error,setError]=useState("");
 useEffect(()=>{void jsonRequest<{invoice:Printable}>("/api/saas/invoices/"+encodeURIComponent(id))
  .then(x=>setInvoice(x.invoice)).catch(e=>setError(e instanceof Error?e.message:s12(locale,"error")));},[id,locale]);
 return <div className="content-stack p12-console">
  <div className="page-heading p12-no-print"><div><h1>{s12(locale,"invoices")}</h1>
   <Link className="text-link" href="/app/subscription/invoices">{s12(locale,"back")}</Link></div>
   <button className="button button-primary" disabled={!invoice} onClick={()=>window.print()}>
    <FileText size={18}/>{s12(locale,"print")}</button></div>
  {error&&<div className="form-error">{error}</div>}
  {!invoice&&!error?<div className="list-skeleton"><span/><span/><span/></div>:null}
  {invoice&&<article className="settings-card p12-invoice-print">
   <span className="eyebrow">DINEFLOW / SUBSCRIPTION INVOICE</span>
   <h1>{invoice.number}</h1><div className="p12-print-rule"/>
   <dl className="profile-list">
    <div><dt>{s12(locale,"tenant")}</dt><dd>{workspace.tenantName}</dd></div>
    <div><dt>{s12(locale,"plan")}</dt><dd>{invoice.planName} (v{invoice.planVersion})</dd></div>
    <div><dt>{s12(locale,"period")}</dt><dd>{printDay(invoice.periodStart,locale)} – {printDay(invoice.periodEnd,locale)}</dd></div>
    <div><dt>{s12(locale,"due")}</dt><dd>{printDay(invoice.dueAt,locale)}</dd></div>
    <div><dt>{s12(locale,"status")}</dt><dd>{invoice.status}</dd></div>
    <div><dt>{s12(locale,"amount")}</dt><dd><strong>{money(invoice.amountMinor,locale)}</strong></dd></div>
   </dl><div className="p12-print-rule"/>
   <p className="muted">{s12(locale,"pendingNote")}</p>
  </article>}
 </div>;
}
