"use client";
import {useCallback,useEffect,useRef,useState} from "react";
import {AlertCircle,Check,ChefHat,Clock3,RefreshCw,ShieldCheck,UserRoundCheck,X,Slash} from "lucide-react";
import {useWorkspace} from "./workspace-provider";
import {API_URL} from "@/lib/auth-client";
import {jsonRequest,Phase2Error} from "@/lib/phase2-api";
import {sg7} from "@/lib/guest-staff-copy";
import {amount,name} from "@/lib/order-web-types";
import type {Locale} from "@dineflow/shared";

type Preview={nameFa:string;namePs:string;nameEn:string;quantity:number;unitPriceMinor:number;
 lineTotalMinor:number;note:string;modifierSummary:string[]};
type Approval={id:string;status:"pending"|"approved"|"rejected";version:number;
 policy:string;orderNote:string;preview:Preview[];estimatedMinor:number;rejectionReason:string|null;
 roundId:string|null;tableId:string;tableLabel:string;visitId:string;createdAt:string;decidedAt:string|null};
type Page={items:Approval[];total:number;page:number;perPage:number};
function ReviewDialog({order,locale,onClose,onDecide,busy,error}:{order:Approval;locale:Locale;onClose:()=>void;
 onDecide:(choice:"approve"|"reject",reason:string)=>void;busy:boolean;error:string}){
 const [reason,setReason]=useState("");
 return <div className="dialog-backdrop guest-review-backdrop" role="presentation"
  onMouseDown={e=>{if(e.target===e.currentTarget&&!busy)onClose();}}>
   <section role="dialog" aria-modal="true" aria-labelledby="guest-review-title" className="guest-review-dialog">
    <div className="guest-review-head"><div><span className="eyebrow">{sg7(locale,"pending")} · {order.id.slice(0,8)}</span>
      <h2 id="guest-review-title">{sg7(locale,"table")} {order.tableLabel}</h2></div>
     <button type="button" className="icon-action" onClick={onClose} disabled={busy}
       aria-label={sg7(locale,"close")}><X size={22}/></button></div>
    <div className="guest-review-alert"><AlertCircle size={20}/>{sg7(locale,"notKitchen")}</div>
    <div className="guest-review-lines">{order.preview.map((line,i)=><div key={i}>
      <div><strong>{line.quantity} × {name(line,locale)}</strong>
        <span>{amount(line.lineTotalMinor,locale)}</span></div>
      {!!line.modifierSummary.length&&<small>{line.modifierSummary.join(" · ")}</small>}
      {!!line.note&&<p>{line.note}</p>}
    </div>)}</div>
    {!!order.orderNote&&<div className="guest-kitchen-note">{sg7(locale,"note")}: {order.orderNote}</div>}
    <div className="guest-review-total"><span>{sg7(locale,"amount")}</span><strong>{amount(order.estimatedMinor,locale)}</strong></div>
    <label className="field"><span>{sg7(locale,"rejectReason")}</span>
      <textarea rows={2} maxLength={200} minLength={5} placeholder={sg7(locale,"reasonPlaceholder")}
       value={reason} onChange={e=>setReason(e.target.value)} disabled={busy}/></label>
    {!!error&&<p role="alert" className="form-error">{error}</p>}
    <div className="guest-review-buttons"><button type="button" className="button" disabled={busy||reason.trim().length<5}
      onClick={()=>{if(window.confirm(sg7(locale,"confirmReject")))onDecide("reject",reason);}}>
       <Slash size={18}/>{sg7(locale,"reject")}</button>
     <button type="button" className="button button-primary" disabled={busy}
       onClick={()=>{if(window.confirm(sg7(locale,"confirmApprove")))onDecide("approve","");}}>
       <Check size={18}/>{sg7(locale,"approve")}</button></div>
   </section></div>;
}
export function GuestApprovalPanel({tableId}:{tableId?:string}){
 const {workspace}=useWorkspace(),locale=workspace.locale;
 const [data,setData]=useState<Page|null>(null),[page,setPage]=useState(1);
 const [loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState(""),
   [notice,setNotice]=useState(""),[selected,setSelected]=useState<Approval|null>(null);
 const revision=useRef(-1);
 const load=useCallback(async(silent=false)=>{
  if(!silent)setLoading(true);
  try{
   const response=await jsonRequest<Page>("/api/guest/staff/approvals?status=pending&page="+page+
     (tableId?"&tableId="+encodeURIComponent(tableId):""));
   setData(response);setError("");
  }catch(e){setError(e instanceof Error?e.message:sg7(locale,"error"));}
  finally{setLoading(false);}
 },[page,tableId,locale]);
 useEffect(()=>{void load();},[load]);
 useEffect(()=>{
   const source=new EventSource(API_URL+"/api/guest/staff/events",{withCredentials:true});
   const cb=(e:MessageEvent)=>{
     try{const n=(JSON.parse(e.data) as {version:number}).version;
       if(revision.current!==-1&&revision.current!==n)void load(true);
       revision.current=n;
     }catch{/* Polling remains authoritative. */}
   };
   source.addEventListener("approvals",cb as EventListener);
   const poll=setInterval(()=>{void load(true);},10000);
   return()=>{source.removeEventListener("approvals",cb as EventListener);source.close();clearInterval(poll);};
 },[load]);
 async function decide(decision:"approve"|"reject",reason:string){
  if(!selected)return;setBusy(true);setError("");setNotice("");
  try{
   await jsonRequest("/api/guest/staff/approvals/"+selected.id+"/decision",{
     method:"POST",body:JSON.stringify({version:selected.version,decision,
       ...(decision==="reject"?{reason}:{})})});
   setSelected(null);setNotice(sg7(locale,"reviewed"));await load(true);
  }catch(e){setError(e instanceof Phase2Error&&e.code==="VERSION_CONFLICT"?sg7(locale,"stale"):
     e instanceof Phase2Error&&e.code==="PRICE_CHANGED"?sg7(locale,"menuChanged"):
     e instanceof Error?e.message:sg7(locale,"error"));
   await load(true);
  }finally{setBusy(false);}
 }
 return <section className="settings-card guest-approval-panel">
   <div className="section-heading"><div><h2>{sg7(locale,"approvals")}</h2>
     <p className="muted">{sg7(locale,"guestHint")}</p></div>
    <div className="guest-approval-count"><UserRoundCheck size={20}/>{data?.total??"—"}</div></div>
   {notice&&<div className="success-banner" role="status"><Check size={18}/>{notice}</div>}
   {error&&<div className="form-error" role="alert">{error}
     <button type="button" className="text-link" onClick={()=>void load()}>{sg7(locale,"retry")}</button></div>}
   {loading&&!data?<div className="list-skeleton"><span/><span/></div>:
     data?.items.length?<div className="guest-approvals-grid">{data.items.map(row=>
       <article key={row.id} className="guest-approval-card">
        <div className="guest-approval-top"><div><div className="eyebrow">{sg7(locale,"orderDetails")}</div>
          <h3>{sg7(locale,"table")} {row.tableLabel}</h3></div>
          <span className="order-pill new">{sg7(locale,"pending")}</span></div>
        <div className="guest-review-preview">{row.preview.slice(0,3).map((x,i)=>
          <div key={i}><span>{x.quantity} × {name(x,locale)}</span></div>)}
         {row.preview.length>3&&<small>+{row.preview.length-3}</small>}</div>
        <div className="guest-approval-foot"><strong>{amount(row.estimatedMinor,locale)}</strong>
          <button type="button" className="button button-primary" onClick={()=>{setError("");setSelected(row);}}>
            {sg7(locale,"review")}</button></div>
        <time>{new Date(row.createdAt).toLocaleString(locale)}</time>
       </article>)}</div>:
      <div className="empty-panel guest-empty-approvals"><ShieldCheck size={28}/>
        <h3>{sg7(locale,"noPending")}</h3></div>}
   {!!data&&data.total>10&&<div className="pager"><button className="button button-small" type="button"
       disabled={page<=1} onClick={()=>setPage(p=>p-1)}>‹</button><span>{page} / {Math.ceil(data.total/10)}</span>
     <button className="button button-small" type="button" disabled={page>=Math.ceil(data.total/10)}
       onClick={()=>setPage(p=>p+1)}>›</button></div>}
   {selected&&<ReviewDialog key={selected.id} order={selected} locale={locale} onClose={()=>setSelected(null)}
     onDecide={(decision,reason)=>void decide(decision,reason)} busy={busy} error={error}/>}
 </section>;
}
