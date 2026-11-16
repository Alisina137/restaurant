
"use client";
import {useCallback,useEffect,useState,type FormEvent} from "react";
import Link from "next/link";
import {ArrowUpRight,Building2,CalendarClock,RefreshCw,ShieldCheck,UsersRound} from "lucide-react";
import {useWorkspace} from "./workspace-provider";
import {jsonRequest,type PageResult} from "@/lib/phase2-api";
import {s12} from "@/lib/saas-copy";
import {money} from "@/lib/finance-types";
type Row={id:string;name:string;slug:string;status:string;createdAt:string;ownerEmail:string|null;
 planName:string;subscriptionStatus:string|null;nextRenewal:string|null;locationCount:number};
type Detail={restaurant:{id:string;name:string;slug:string;status:string;createdAt:string};
 subscription:{planId:string;status:string;trialEndsAt:string|null;paidUntil:string|null}|null;
 staffCount:number;locations:{name:string;city:string}[];ownerEmail:string|null;
 invoices:{id:string;number:string;amountMinor:number;status:string;dueAt:string}[];
 history:{id:string;action:string;createdAt:string}[]};
type Plan={id:string;code:string;name:string;version:number;active:boolean};
const when=(x:string|null,locale:string)=>x?new Date(x).toLocaleDateString(locale):"—";
export function SaasTenants({id,filter=""}:{id?:string;filter?:""|"pending"|"suspended"}){
 const {workspace}=useWorkspace(),locale=workspace.locale;
 const [rows,setRows]=useState<PageResult<Row>|null>(null),[detail,setDetail]=useState<Detail|null>(null),
  [plans,setPlans]=useState<Plan[]>([]),[page,setPage]=useState(1),[search,setSearch]=useState(""),
  [applied,setApplied]=useState(""),[reason,setReason]=useState(""),[planId,setPlanId]=useState(""),
  [busy,setBusy]=useState(false),[loading,setLoading]=useState(true),[error,setError]=useState(""),
  [notice,setNotice]=useState("");
 const load=useCallback(async()=>{
  setLoading(true);setError("");
  try{
   const p=await jsonRequest<{items:Plan[]}>("/api/platform/plans");
   setPlans(p.items.filter(x=>x.active));
   if(id){const d=await jsonRequest<Detail>("/api/platform/tenants/"+encodeURIComponent(id));
    setDetail(d);setPlanId(d.subscription?.planId??"");}
   else{setRows(await jsonRequest<PageResult<Row>>("/api/platform/tenants?page="+page+
    (filter?"&status="+filter:"")+(applied?"&q="+encodeURIComponent(applied):"")));}
  }catch(e){setError(e instanceof Error?e.message:s12(locale,"error"));}
  finally{setLoading(false);}
 },[id,page,filter,applied,locale]);
 useEffect(()=>{void load();},[load]);
 async function action(key:"approve"|"reject"|"suspend"|"restore"|"plan"){
  if(!id)return;
  if(key!=="plan"&&reason.trim().length<5){setError("Provide a reason of at least 5 characters.");return;}
  if(!window.confirm("Confirm this restaurant administration action?"))return;
  setBusy(true);setError("");setNotice("");
  try{
   await jsonRequest("/api/platform/tenants/"+encodeURIComponent(id)+"/"+key,
    {method:"POST",body:JSON.stringify(key==="plan"?{planId}:{reason})});
   setNotice("Restaurant policy saved.");await load();
  }catch(e){setError(e instanceof Error?e.message:s12(locale,"error"));}
  finally{setBusy(false);}
 }
 return <div className="content-stack p12-console">
  <div className="page-heading"><div><span className="eyebrow">DINEFLOW / PLATFORM TENANTS</span>
   <h1>{id?detail?.restaurant.name??s12(locale,"details"):s12(locale,"restaurants")}</h1>
   <p>{s12(locale,"safeNote")}</p></div>
   <button className="button" disabled={loading} onClick={()=>void load()}>
    <RefreshCw size={18}/>{s12(locale,"refresh")}</button></div>
  <div className="p12-tabs">
   <Link className={"p12-tab"+(!filter&&!id?" active":"")} href="/platform/restaurants">
    {s12(locale,"restaurants")}</Link>
   <Link className={"p12-tab"+(filter==="pending"?" active":"")} href="/platform/restaurants/pending">
    {s12(locale,"pending")}</Link>
   <Link className={"p12-tab"+(filter==="suspended"?" active":"")} href="/platform/restaurants/suspended">
    {s12(locale,"suspended")}</Link></div>
  {id&&<Link className="text-link" href="/platform/restaurants">{s12(locale,"back")}</Link>}
  {error&&<div className="form-error" role="alert">{error}</div>}
  {notice&&<div className="success-banner" role="status">{notice}</div>}
  {loading&&!detail&&!rows&&<div className="settings-card list-skeleton"><span/><span/><span/></div>}
  {!id&&<section className="settings-card p12-card">
   <form className="p12-inline" onSubmit={(e:FormEvent)=>{e.preventDefault();setApplied(search);setPage(1);}}>
    <label>{s12(locale,"search")}<input maxLength={80} value={search}
     onChange={e=>setSearch(e.target.value)} placeholder="Name or slug"/></label>
    <button className="button button-primary" type="submit">{s12(locale,"search")}</button></form>
   {rows&&<><div className="section-heading"><h2>{s12(locale,"restaurants")}</h2><span>{rows.total}</span></div>
    {!rows.items.length?<div className="empty-panel">{s12(locale,"empty")}</div>:
     <div className="table-scroll"><table className="data-table"><thead><tr>
      <th>{s12(locale,"name")}</th><th>{s12(locale,"owner")}</th><th>{s12(locale,"plan")}</th>
      <th>{s12(locale,"status")}</th><th>{s12(locale,"renewal")}</th><th>{s12(locale,"details")}</th>
      </tr></thead><tbody>{rows.items.map(x=><tr key={x.id}>
       <td><strong>{x.name}</strong><small className="p12-small">{x.slug}</small></td>
       <td>{x.ownerEmail??"—"}</td><td>{x.planName}</td>
       <td><span className={"data-badge "+x.status}>{x.status}</span></td>
       <td>{when(x.nextRenewal,locale)}</td>
       <td><Link className="button button-small" href={"/platform/restaurants/"+x.id}>
        <ArrowUpRight size={15}/>{s12(locale,"details")}</Link></td></tr>)}</tbody></table></div>}
    <div className="pager"><button className="button button-small" disabled={page<=1}
     onClick={()=>setPage(page-1)}>{s12(locale,"previous")}</button>
     <span>{page} / {Math.max(1,Math.ceil(rows.total/20))}</span>
     <button className="button button-small" disabled={page>=Math.ceil(rows.total/20)}
      onClick={()=>setPage(page+1)}>{s12(locale,"next")}</button></div></>}
  </section>}
  {id&&detail&&<div className="p12-grid">
   <section className="settings-card p12-card">
    <div className="section-heading"><div><h2>{detail.restaurant.name}</h2>
     <p className="muted">{detail.restaurant.slug}</p></div><Building2 size={25}/></div>
    <div className="p12-metrics">
     <div><span>{s12(locale,"status")}</span><strong>{detail.restaurant.status}</strong></div>
     <div><span>{s12(locale,"staff")}</span><strong>{detail.staffCount}</strong></div>
     <div><span>{s12(locale,"locations")}</span><strong>{detail.locations.length}</strong></div>
     <div><span>{s12(locale,"owner")}</span><strong className="p12-small">{detail.ownerEmail??"—"}</strong></div>
    </div><p>{detail.locations.map(x=>x.name+", "+x.city).join("; ")}</p>
    <p className="muted">{s12(locale,"trial")}: {when(detail.subscription?.trialEndsAt??null,locale)}</p>
    <p className="muted">{s12(locale,"renewal")}: {when(detail.subscription?.paidUntil??null,locale)}</p>
   </section>
   <section className="settings-card p12-card"><h2>{s12(locale,"assign")}</h2>
    <label className="p12-form">{s12(locale,"plan")}
     <select value={planId} onChange={e=>setPlanId(e.target.value)}>
      <option value="">{s12(locale,"choose")}</option>
      {plans.map(x=><option value={x.id} key={x.id}>{x.name} v{x.version}</option>)}
     </select></label>
    <button className="button button-primary" disabled={busy||!planId||planId===detail.subscription?.planId}
     onClick={()=>void action("plan")}>{s12(locale,"assign")}</button>
    <div className="p12-print-rule"/><h2>{s12(locale,"status")}</h2>
    <label className="p12-form">{s12(locale,"reason")}
     <textarea required minLength={5} maxLength={300} value={reason}
      onChange={e=>setReason(e.target.value)}/></label>
    <div className="p12-row">
     {detail.restaurant.status==="pending"&&<>
      <button className="button button-primary" disabled={busy}
       onClick={()=>void action("approve")}>{s12(locale,"approve")}</button>
      <button className="button" disabled={busy}
       onClick={()=>void action("reject")}>{s12(locale,"reject")}</button></>}
     {detail.restaurant.status!=="suspended"&&detail.restaurant.status!=="rejected"&&
      <button className="button" disabled={busy} onClick={()=>void action("suspend")}>
       {s12(locale,"suspend")}</button>}
     {detail.restaurant.status==="suspended"&&<button className="button button-primary" disabled={busy}
      onClick={()=>void action("restore")}>{s12(locale,"restore")}</button>}
    </div>
   </section>
   <section className="settings-card p12-card">
    <h2>{s12(locale,"invoices")}</h2>
    {detail.invoices.map(x=><div className="p12-record" key={x.id}>
     <strong>{x.number}</strong><span className={"data-badge "+x.status}>{x.status}</span>
     <span>{money(x.amountMinor,locale)}</span></div>)}
    {!detail.invoices.length&&<p className="muted">{s12(locale,"empty")}</p>}
    <Link className="text-link" href="/platform/subscriptions/invoices">{s12(locale,"navigate")}</Link>
   </section>
   <section className="settings-card p12-card"><h2>{s12(locale,"history")}</h2>
    {detail.history.length?detail.history.map(x=><div className="p12-record" key={x.id}>
     <small>{when(x.createdAt,locale)}</small><strong>{x.action}</strong></div>):
     <p className="muted">{s12(locale,"empty")}</p>}
   </section>
  </div>}
 </div>;
}
