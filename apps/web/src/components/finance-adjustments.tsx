"use client";
import {useCallback,useEffect,useRef,useState,type FormEvent} from "react";
import Link from "next/link";
import {AlertCircle,CheckCircle2,ClipboardCheck,History,RefreshCw,RotateCcw,ShieldCheck} from "lucide-react";
import {useWorkspace} from "./workspace-provider";
import {jsonRequest} from "@/lib/phase2-api";
import {money,parseAFN,isoTime,type CheckDetails} from "@/lib/finance-types";
import {p10} from "@/lib/phase10-copy";
import {useInteraction} from "./ui/interaction-provider";
import {ux} from "@/lib/interaction-copy";
type Kind="discount"|"void"|"refund";
type Status="pending"|"approved"|"rejected"|"applied";
type Adjustment={id:string;checkId:string;kind:Kind;targetRoundId:string|null;
 amountMinor:number;reason:string;status:Status;version:number;requestKey:string;requestedBy:string;
 approvedBy:string|null;createdAt:string;decisionNote:string;appliedAt:string|null};
type Queue={items:Adjustment[];page:number;perPage:number};
const newKey=()=>("p10-"+crypto.randomUUID()).replaceAll("-","");
export function AdjustmentConsole({area="cashier",initialCheckId=""}:{area?:"cashier"|"app";initialCheckId?:string}){
 const {workspace}=useWorkspace(),locale=workspace.locale,role=workspace.role;
 const {confirm,notify}=useInteraction();
 const mutationLock=useRef(false);
 const base=area==="cashier"?"/cashier":"/app/billing",canApprove=role==="owner"||role==="manager";
 const [checkId,setCheckId]=useState(initialCheckId),[check,setCheck]=useState<CheckDetails|null>(null);
 const [kind,setKind]=useState<Kind>("discount"),[amount,setAmount]=useState("");
 const [reason,setReason]=useState(""),[roundId,setRoundId]=useState(""),[requestKey,setRequestKey]=useState(newKey);
 const [queue,setQueue]=useState<Adjustment[]>([]),[filter,setFilter]=useState("all");
 const [method,setMethod]=useState<"cash"|"manual_transfer">("cash"),[reference,setReference]=useState("");
 const [verified,setVerified]=useState(false),[payNote,setPayNote]=useState("");
 const [reviewNote,setReviewNote]=useState(""),[busy,setBusy]=useState(""),[error,setError]=useState("");
 const [notice,setNotice]=useState("");
 useEffect(()=>{if(notice){notify(notice,"success");setNotice("");}},[notice,notify]);
 const load=useCallback(async()=>{
  try{
   const [records,detail]=await Promise.all([
    jsonRequest<Queue>("/api/finance/adjustments?status="+filter),
    checkId.trim()?jsonRequest<CheckDetails>("/api/finance/checks/"+encodeURIComponent(checkId.trim())):
     Promise.resolve(null)]);
   setQueue(records.items);setCheck(detail);setError("");
  }catch(e){setError(e instanceof Error?e.message:p10(locale,"error"));}
 },[checkId,filter,locale]);
 useEffect(()=>{void load();const refresh=setInterval(()=>{if(document.visibilityState==="visible")void load();},18000);
  return()=>clearInterval(refresh);},[load]);
 const activeRounds=check?.rounds.filter(x=>(x as {status?:string}).status!=="voided")??[];
 const eligible=(check?.check.status==="open"&&!check.check.lockedAt&&check.check.paidMinor===0&&
  check.check.splitMode==="single");
 const canRequest=!!check&&reason.trim().length>=8&&(kind==="refund"?
  check.check.status==="settled"&&!!amount&&parseAFN(amount)!==null&&parseAFN(amount)!>0:
  !!eligible&&(kind==="void"?!!roundId:parseAFN(amount)!==null&&parseAFN(amount)!>0));
 const apply=async(path:string,payload:Record<string,unknown>,name:string)=>{
  if(mutationLock.current)return;
  mutationLock.current=true;setBusy(name);setError("");setNotice("");
  try{
   await jsonRequest(path,{method:"POST",body:JSON.stringify(payload)});
   setNotice(p10(locale,name==="request"?"submitSuccess":name==="decision"?"decisionSuccess":"refundSuccess"));
   if(name==="request"){setRequestKey(newKey());setReason("");setAmount("");}
   if(name==="decision")setReviewNote("");
   if(name==="refund"){setReference("");setVerified(false);setPayNote("");}
   await load();
  }catch(e){setError(e instanceof Error?e.message:p10(locale,"error"));await load();}
  finally{mutationLock.current=false;setBusy("");}
 };
 function send(e:FormEvent){e.preventDefault();if(!check||!canRequest||busy)return;
  const minor=parseAFN(amount);
  void apply("/api/finance/checks/"+check.check.id+"/adjustments",{
   kind,amountMinor:kind==="void"?undefined:minor,roundId:kind==="void"?roundId:undefined,
   reason:reason.trim(),version:check.check.version,requestKey},"request");
 }
 async function decide(a:Adjustment,decision:"approve"|"reject"){
  if(busy||mutationLock.current||!(await confirm({title:p10(locale,decision==="approve"?"approve":"reject"),
    description:p10(locale,"confirm"),confirmLabel:p10(locale,decision==="approve"?"approve":"reject"),
    cancelLabel:ux(locale,"cancel"),danger:true})))return;
  await apply("/api/finance/adjustments/"+a.id+"/decision",
   {version:a.version,decision,note:reviewNote.trim()},"decision");
 }
 async function refund(a:Adjustment){
  if(busy||mutationLock.current||!(await confirm({title:p10(locale,"refund"),description:p10(locale,"confirm"),
    confirmLabel:p10(locale,"execute"),cancelLabel:ux(locale,"cancel"),danger:true})))return;
  await apply("/api/finance/adjustments/"+a.id+"/refund",{
   version:a.version,method,externalReference:method==="manual_transfer"?reference.trim():"",
   verifiedExternally:method==="manual_transfer"&&verified,note:payNote.trim()},"refund");
 }
 return <div className="content-stack finance-console p10-console">
  <div className="page-heading"><div>
   <span className="eyebrow">DINEFLOW / FINANCE CONTROLS</span><h1><RotateCcw size={27}/>{p10(locale,"title")}</h1>
   <p>{p10(locale,"subtitle")}</p></div>
   <button type="button" className="button" onClick={()=>void load()}><RefreshCw size={17}/>{p10(locale,"refresh")}</button>
  </div>
  <nav className="finance-area-tabs"><Link href={base+"/checks"}>{p10(locale,"back")}</Link>
   <Link className="selected" href={base+"/adjustments"}>{p10(locale,"title")}</Link></nav>
  {error&&<div role="alert" className="form-error"><AlertCircle size={16}/>{error}</div>}

  <div className="p10-grid">
   <section className="settings-card">
    <div className="section-heading"><h2>{p10(locale,"request")}</h2><ClipboardCheck size={23}/></div>
    <p className="finance-muted">{p10(locale,"noCheck")}</p>
    <form className="finance-form" onSubmit={e=>{e.preventDefault();void load();}}>
     <label className="finance-field"><span>{p10(locale,"checkId")}</span>
      <input value={checkId} maxLength={100} onChange={e=>setCheckId(e.target.value)}/></label>
     <button type="submit" className="button">{p10(locale,"load")}</button>
    </form>
    {check&&<><div className="finance-info"><ShieldCheck size={19}/><span>
     #{check.check.number} · {check.tableLabel} · {p10(locale,"amountDue")}: {money(check.check.totalMinor,locale)} / {money(check.check.paidMinor,locale)}
     {check.refundedMinor>0?<> · {p10(locale,"alreadyRefunded")}: {money(check.refundedMinor,locale)}</>:null}</span></div>
     <form onSubmit={send} className="finance-form">
      <label className="finance-field"><span>{p10(locale,"kind")}</span>
       <select value={kind} onChange={e=>setKind(e.target.value as Kind)}>
        <option value="discount">{p10(locale,"discount")}</option>
        <option value="void">{p10(locale,"void")}</option>
        <option value="refund">{p10(locale,"refund")}</option>
       </select></label>
      <p className="finance-muted">{p10(locale,kind==="void"?"voidHint":kind==="discount"?"discountHint":"refundHint")}</p>
      {kind==="void"?<label className="finance-field"><span>{p10(locale,"round")}</span>
       <select required value={roundId} onChange={e=>setRoundId(e.target.value)}>
        <option value="">—</option>
        {activeRounds.map(r=><option value={r.id} key={r.id}>#{r.roundNumber} · {money(r.totalMinor,locale)}</option>)}
       </select></label>:
       <label className="finance-field"><span>{p10(locale,"amount")}</span>
        <input inputMode="decimal" required value={amount} onChange={e=>setAmount(e.target.value)}
         placeholder="0.00"/></label>}
      <label className="finance-field"><span>{p10(locale,"reason")}</span>
       <textarea rows={3} maxLength={500} minLength={8} required value={reason}
        onChange={e=>setReason(e.target.value)}/></label>
      <button className="button button-primary" type="submit" disabled={!canRequest||!!busy}>
       {p10(locale,"submit")}</button>
     </form></>}
   </section>
   <section className="settings-card">
    <div className="section-heading"><div><h2>{p10(locale,"queue")}</h2>
     <p>{p10(locale,"reviewHint")}</p></div><History size={23}/></div>
    <div className="p10-filter" role="group" aria-label={p10(locale,"status")}>
     {(["all","pending","approved","applied","rejected"] as const).map(k=>
      <button key={k} type="button" className={"button button-small"+(filter===k?" button-primary":"")}
       onClick={()=>setFilter(k)}>{p10(locale,k)}</button>)}
    </div>
    {queue.length?queue.map(a=><article key={a.id} className="p10-request-card">
     <div className="p10-row"><strong>{p10(locale,a.kind)} · {money(a.amountMinor,locale)}</strong>
      <span className={"data-badge "+(a.status==="applied"?"active":"")}>{p10(locale,a.status)}</span></div>
     <p>{a.reason}</p>
     <small>#{a.checkId.slice(0,9)} · {isoTime(a.createdAt,locale)} · {p10(locale,"requestedBy")}: {a.requestedBy.slice(0,8)}</small>
     {a.decisionNote&&<p>{a.decisionNote}</p>}
     {a.status==="pending"&&canApprove&&<>
      <label className="finance-field"><span>{p10(locale,"reviewNote")}</span>
       <input value={reviewNote} maxLength={250} onChange={e=>setReviewNote(e.target.value)}/></label>
      <div className="p10-row"><button className="button button-primary" type="button"
       disabled={!!busy||a.requestedBy===workspace.user.id}
       onClick={()=>decide(a,"approve")}>{p10(locale,"approve")}</button>
       <button className="button" type="button" disabled={!!busy||a.requestedBy===workspace.user.id}
        onClick={()=>decide(a,"reject")}>{p10(locale,"reject")}</button></div></>}
     {a.kind==="refund"&&a.status==="approved"&&<>
      <div className="finance-info">{p10(locale,"noShift")}</div>
      <label className="finance-field"><span>{p10(locale,"method")}</span>
       <select value={method} onChange={e=>setMethod(e.target.value as typeof method)}>
        <option value="cash">{p10(locale,"cash")}</option>
        <option value="manual_transfer">{p10(locale,"manual_transfer")}</option>
       </select></label>
      {method==="manual_transfer"&&<><label className="finance-field"><span>{p10(locale,"externalReference")}</span>
       <input value={reference} maxLength={100} onChange={e=>setReference(e.target.value)}/></label>
       <label className="finance-checkbox"><input type="checkbox" checked={verified}
         onChange={e=>setVerified(e.target.checked)}/>{p10(locale,"verified")}</label></>}
      <label className="finance-field"><span>{p10(locale,"note")}</span>
       <input value={payNote} maxLength={250} onChange={e=>setPayNote(e.target.value)}/></label>
      <button className="button button-primary" type="button" disabled={!!busy||
       a.approvedBy===workspace.user.id||(method==="manual_transfer"&&(!reference.trim()||!verified))}
       onClick={()=>refund(a)}>{p10(locale,"execute")}</button></>}
    </article>):<div className="empty-panel">{p10(locale,"noRequests")}</div>}
   </section>
  </div>
 </div>;
}
