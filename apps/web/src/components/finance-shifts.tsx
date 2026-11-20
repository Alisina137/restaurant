"use client";
import {useCallback,useEffect,useState,type FormEvent} from "react";
import Link from "next/link";
import {Banknote,Check,Clock3,RefreshCw,ShieldCheck,Wallet,CalendarDays} from "lucide-react";
import {useWorkspace} from "./workspace-provider";
import {jsonRequest} from "@/lib/phase2-api";
import {f9} from "@/lib/finance-copy";
import {p10} from "@/lib/phase10-copy";
import {parseAFN,isoTime,money,type Shift,type ShiftCurrent} from "@/lib/finance-types";
import {FinanceShiftReconciliation} from "./finance42-reconciliation";
type History={items:Shift[];total:number;page:number;perPage:number};
export function FinanceShifts(){
 const {workspace}=useWorkspace(),locale=workspace.locale;
 const [tab,setTab]=useState<"current"|"previous">("current"),[page,setPage]=useState(1);
 const [reviewShiftId,setReviewShiftId]=useState<string|null>(null);
 const [current,setCurrent]=useState<ShiftCurrent|null>(null),[history,setHistory]=useState<History|null>(null);
 const [counted,setCounted]=useState(""),[float,setFloat]=useState("0"),
   [busy,setBusy]=useState(false),[loading,setLoading]=useState(true),[error,setError]=useState(""),[notice,setNotice]=useState("");
 const load=useCallback(async(silent=false)=>{
  if(!silent)setLoading(true);
  try{
    const [active,past]=await Promise.all([
      jsonRequest<ShiftCurrent>("/api/finance/shifts/current"),
      jsonRequest<History>("/api/finance/shifts/history?page="+page)]);
    setCurrent(active);setHistory(past);setError("");
  }catch(e){setError(e instanceof Error?e.message:f9(locale,"actionFailed"));}
  finally{setLoading(false);}
 },[page,locale]);
 useEffect(()=>{void load();const timer=setInterval(()=>{if(document.visibilityState==="visible")void load(true);},18000);
   return()=>clearInterval(timer);},[load]);
 async function open(e:FormEvent){
  e.preventDefault();const openingFloatMinor=parseAFN(float);
  if(openingFloatMinor===null){setError(f9(locale,"invalid"));return;}
  setBusy(true);setError("");setNotice("");
  try{await jsonRequest("/api/finance/shifts/open",{method:"POST",
     body:JSON.stringify({openingFloatMinor})});
    setNotice(f9(locale,"shiftOpen"));await load(true);
  }catch(e){setError(e instanceof Error?e.message:f9(locale,"actionFailed"));}
  finally{setBusy(false);}
 }
 async function close(e:FormEvent){
  e.preventDefault();if(!current?.shift)return;
  const countMinor=parseAFN(counted);
  if(countMinor===null){setError(f9(locale,"invalid"));return;}
  if(!window.confirm(f9(locale,"closeShift")+"?"))return;
  setBusy(true);setError("");setNotice("");
  try{await jsonRequest("/api/finance/shifts/"+current.shift.id+"/close",{
    method:"POST",body:JSON.stringify({countMinor})});
    setNotice(f9(locale,"shiftClosed"));setCounted("");await load(true);
  }catch(e){setError(e instanceof Error?e.message:f9(locale,"actionFailed"));}
  finally{setBusy(false);}
 }
 return <div className="content-stack finance-console">
   <div className="page-heading"><div><div className="eyebrow">DINEFLOW / {f9(locale,"session")}</div>
     <h1>{f9(locale,"shifts")}</h1><p>{f9(locale,"security")}</p></div>
     <button type="button" className="button" onClick={()=>void load()}>
       <RefreshCw size={17}/>{f9(locale,"refresh")}</button></div>
   <nav className="finance-area-tabs">
     <Link href="/cashier/checks">{f9(locale,"checks")}</Link>
     <Link href="/cashier/transactions">{f9(locale,"transactions")}</Link>
     <Link className="selected" href="/cashier/shifts">{f9(locale,"shifts")}</Link>
     <Link href="/cashier/receipts">{f9(locale,"receipts")}</Link>
   </nav>
   <div className="finance-segments finance-shift-tabs">
    <button type="button" className={tab==="current"?"selected":""}
      onClick={()=>setTab("current")}>{f9(locale,"current")}</button>
    <button type="button" className={tab==="previous"?"selected":""}
      onClick={()=>setTab("previous")}>{f9(locale,"previous")}</button>
   </div>
   {notice&&<p role="status" className="success-banner"><Check size={18}/>{notice}</p>}
   {error&&<p role="alert" className="form-error">{error}</p>}
   {loading&&!current?<div className="settings-card list-skeleton"><span/><span/><span/></div>:
    tab==="current"?current?.shift?<div className="finance-shift-layout">
     <section className="settings-card finance-shift-summary">
      <div className="section-heading"><h2>{f9(locale,"currentShift")}</h2>
       <span className="finance-badge open">{f9(locale,"open")}</span></div>
      <div className="finance-due-bar"><div><span>{f9(locale,"expectedDrawer")}</span>
         <strong>{money(current.expectedMinor,locale)}</strong></div>
        <Banknote size={32}/></div>
      <div className="finance-stats">
       <div className="finance-stat"><span>{f9(locale,"float")}</span>
         <strong>{money(current.shift.openingFloatMinor,locale)}</strong></div>
       <div className="finance-stat"><span>{f9(locale,"cashSales")}</span>
         <strong>{money(current.cashMinor,locale)}</strong></div>
       <div className="finance-stat"><span>{p10(locale,"refund")} · {f9(locale,"cash")}</span>
         <strong>−{money(current.refundedCashMinor,locale)}</strong></div>
       <div className="finance-stat"><span>{f9(locale,"transfers")}</span>
         <strong>{money(current.transferMinor,locale)}</strong></div>
       <div className="finance-stat"><span>{f9(locale,"transactions")}</span>
         <strong>{current.transactions}</strong></div>
      </div>
      <p className="finance-muted"><Clock3 size={15}/>{f9(locale,"shiftStart")}: {isoTime(current.shift.openedAt,locale)}</p>
      <FinanceShiftReconciliation key={current.shift.id} shiftId={current.shift.id} locale={locale}/>
     </section>
     <form onSubmit={e=>void close(e)} className="settings-card finance-shift-close">
       <div className="section-heading"><h2>{f9(locale,"closeShift")}</h2><ShieldCheck size={22}/></div>
       <p>{f9(locale,"shiftWarning")}</p>
       <label className="finance-field"><span>{f9(locale,"counted")} (AFN)</span>
         <input required inputMode="decimal" value={counted}
           placeholder={String(current.expectedMinor/100)}
           onChange={e=>setCounted(e.target.value)}/></label>
       {parseAFN(counted)!==null&&<div className="finance-change">
         <span>{f9(locale,"variance")}</span>
         <b>{money(parseAFN(counted)!-current.expectedMinor,locale)}</b></div>}
       <button type="submit" className="button button-primary" disabled={busy||parseAFN(counted)===null}>
         {busy?f9(locale,"processing"):f9(locale,"closeShift")}</button>
     </form>
    </div>:<form onSubmit={e=>void open(e)} className="settings-card finance-shift-close">
      <div className="section-heading"><h2>{f9(locale,"startShift")}</h2><Clock3 size={23}/></div>
      <p>{f9(locale,"noShift")}</p>
      <label className="finance-field"><span>{f9(locale,"float")} (AFN)</span>
       <input inputMode="decimal" required value={float} onChange={e=>setFloat(e.target.value)}/></label>
      <button className="button button-primary" type="submit" disabled={busy||parseAFN(float)===null}>
        {busy?f9(locale,"processing"):f9(locale,"startShift")}</button>
     </form>:
     <div className="settings-card finance-shift-history">
       {history?.items.length?<div className="table-scroll"><table className="data-table"><thead><tr>
         <th>{f9(locale,"shiftStart")}</th><th>{f9(locale,"shiftEnd")}</th><th>{f9(locale,"expectedDrawer")}</th>
         <th>{f9(locale,"counted")}</th><th>{f9(locale,"variance")}</th>
         <th>{f9(locale,"reconcile")}</th>
       </tr></thead><tbody>{history.items.map(x=><tr key={x.id}>
          <td>{isoTime(x.openedAt,locale)}</td><td>{isoTime(x.closedAt,locale)}</td>
          <td>{money(x.expectedMinor??0,locale)}</td><td>{money(x.closingCountMinor??0,locale)}</td>
          <td>{money(x.varianceMinor??0,locale)}</td>
          <td><button type="button" className="button button-small" onClick={()=>setReviewShiftId(x.id)}>
           {f9(locale,"reconcile")}</button></td>
        </tr>)}</tbody></table></div>:<div className="empty-panel">
         <CalendarDays size={31}/>{f9(locale,"emptyShift")}</div>}
       {reviewShiftId&&history?.items.some(x=>x.id===reviewShiftId)&&
        <FinanceShiftReconciliation key={reviewShiftId} shiftId={reviewShiftId} locale={locale}/>} 
       {!!history&&history.total>10&&<div className="pager">
         <button className="button button-small" disabled={page<=1} onClick={()=>setPage(x=>x-1)}>‹</button>
         <span>{page} / {Math.ceil(history.total/10)}</span>
         <button className="button button-small" disabled={page>=Math.ceil(history.total/10)}
           onClick={()=>setPage(x=>x+1)}>›</button>
       </div>}
     </div>}
 </div>;
}
