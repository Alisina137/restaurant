"use client";
import {useCallback,useEffect,useState} from "react";
import Link from "next/link";
import {ArrowRight,Banknote,Check,Clock3,RefreshCw,ShieldCheck,UserRoundCheck} from "lucide-react";
import {useWorkspace} from "./workspace-provider";
import {jsonRequest} from "@/lib/phase2-api";
import {f9} from "@/lib/finance-copy";
import {isoTime,money,parseAFN,type Shift} from "@/lib/finance-types";
type StaffShift={shift:Shift;cashierName:string;cashMinor:number;transferMinor:number;
 transactions:number;expectedMinor:number};
type Overview={varianceThresholdMinor:number;items:StaffShift[]};
type History={items:Array<Shift&{cashierName:string}>;total:number;page:number;perPage:number};
export function FinanceShiftOversight(){
 const {workspace}=useWorkspace(),locale=workspace.locale;
 const [current,setCurrent]=useState<Overview|null>(null),[history,setHistory]=useState<History|null>(null),
  [page,setPage]=useState(1),[busy,setBusy]=useState(""),[loading,setLoading]=useState(true),
  [error,setError]=useState(""),[notice,setNotice]=useState("");
 const [counts,setCounts]=useState<Record<string,string>>({}),[ack,setAck]=useState<Record<string,boolean>>({});
 const load=useCallback(async(silent=false)=>{
   if(!silent)setLoading(true);
   try{
     const [open,past]=await Promise.all([
       jsonRequest<Overview>("/api/finance/shifts/oversight"),
       jsonRequest<History>("/api/finance/shifts/history?page="+page)]);
     setCurrent(open);setHistory(past);setError("");
   }catch(e){setError(e instanceof Error?e.message:f9(locale,"actionFailed"));}
   finally{setLoading(false);}
 },[locale,page]);
 useEffect(()=>{void load();const t=setInterval(()=>{if(document.visibilityState==="visible")void load(true);},18000);
   return()=>clearInterval(t);},[load]);
 async function closeShift(row:StaffShift){
   if(busy)return;
   const countMinor=parseAFN(counts[row.shift.id]??"");
   if(countMinor===null){setError(f9(locale,"invalid"));return;}
   const difference=countMinor-row.expectedMinor,needsReview=Math.abs(difference)>(current?.varianceThresholdMinor??5000);
   if(needsReview&&!ack[row.shift.id]){setError(f9(locale,"ackVariance"));return;}
   if(!window.confirm(f9(locale,"confirmShiftClose")))return;
   setBusy(row.shift.id);setError("");setNotice("");
   try{
     await jsonRequest("/api/finance/shifts/"+row.shift.id+"/close",{
       method:"POST",body:JSON.stringify({countMinor,acknowledgeVariance:!!ack[row.shift.id]})});
     setNotice(f9(locale,"shiftClosed"));setCounts(prev=>{const next={...prev};delete next[row.shift.id];return next;});
     setAck(prev=>{const next={...prev};delete next[row.shift.id];return next;});
     await load(true);
   }catch(e){setError(e instanceof Error?e.message:f9(locale,"actionFailed"));await load(true);}
   finally{setBusy("");}
 }
 return <div className="content-stack finance-console">
    <div className="page-heading"><div><div className="eyebrow">DINEFLOW / {f9(locale,"billing")}</div>
      <h1>{f9(locale,"oversight")}</h1><p>{f9(locale,"varianceExplain")}</p></div>
     <button className="button" type="button" onClick={()=>void load()}><RefreshCw size={17}/>{f9(locale,"refresh")}</button></div>
    <nav className="finance-area-tabs" aria-label={f9(locale,"billing")}>
     <Link href="/app/billing/checks">{f9(locale,"checks")}</Link>
     <Link href="/app/billing/transactions">{f9(locale,"transactions")}</Link>
     <Link className="selected" href="/app/billing/shifts">{f9(locale,"oversight")}</Link>
     <Link href="/app/billing/receipts">{f9(locale,"receipts")}</Link>
    </nav>
    <div className="finance-info"><UserRoundCheck size={19}/>{f9(locale,"managerOnly")}</div>
    {notice&&<div className="success-banner" role="status"><Check size={18}/>{notice}</div>}
    {error&&<div className="form-error" role="alert">{error}
       <button className="text-link" onClick={()=>void load()}>{f9(locale,"refresh")}</button></div>}
    {loading&&!current?<section className="settings-card list-skeleton"><span/><span/></section>:
     <>
      <div className="finance-stats">
       <div className="finance-stat"><span>{f9(locale,"staffShifts")}</span><strong>{current?.items.length??"—"}</strong></div>
       <div className="finance-stat"><span>{f9(locale,"varianceThreshold")}</span>
         <strong>{money(current?.varianceThresholdMinor??5000,locale)}</strong></div>
      </div>
      {current?.items.length?<div className="finance-shift-manager-grid">
         {current.items.map(row=>{
           const v=counts[row.shift.id]??"",countMinor=parseAFN(v);
           const diff=countMinor===null?null:countMinor-row.expectedMinor;
           const requiresAck=diff!==null&&Math.abs(diff)>current.varianceThresholdMinor;
           return <article key={row.shift.id} className="settings-card finance-shift-manager-card">
             <header className="section-heading"><div><span className="eyebrow">{f9(locale,"cashierName")}</span>
                <h2>{row.cashierName}</h2></div><span className="finance-badge open">{f9(locale,"open")}</span></header>
             <p className="finance-muted"><Clock3 size={15}/>{isoTime(row.shift.openedAt,locale)}</p>
             <div className="finance-shift-totals">
               <div><span>{f9(locale,"float")}</span><strong>{money(row.shift.openingFloatMinor,locale)}</strong></div>
               <div><span>{f9(locale,"cashSales")}</span><strong>{money(row.cashMinor,locale)}</strong></div>
               <div><span>{f9(locale,"transfers")}</span><strong>{money(row.transferMinor,locale)}</strong></div>
               <div className="finance-manager-expected"><span>{f9(locale,"expectedDrawer")}</span>
                 <strong>{money(row.expectedMinor,locale)}</strong></div>
             </div>
             <label className="finance-field"><span>{f9(locale,"counted")} (AFN)</span>
               <input inputMode="decimal" required value={v}
                onChange={e=>setCounts(s=>({...s,[row.shift.id]:e.target.value}))}
                placeholder={String(row.expectedMinor/100)} /></label>
             {diff!==null&&<div className="finance-change"><span>{f9(locale,"variance")}</span>
                <b>{money(diff,locale)}</b></div>}
             {requiresAck&&<label className="finance-checkbox finance-manager-ack">
                <input type="checkbox" checked={!!ack[row.shift.id]}
                  onChange={e=>setAck(s=>({...s,[row.shift.id]:e.target.checked}))}/>
                <span>{f9(locale,"ackVariance")}</span></label>}
             <button type="button" className="button button-primary" disabled={!!busy||countMinor===null||
                (requiresAck&&!ack[row.shift.id])} onClick={()=>void closeShift(row)}>
                <ShieldCheck size={18}/>{busy===row.shift.id?f9(locale,"processing"):
                  f9(locale,"closeSupervisor")}</button>
           </article>;
         })}</div>:
       <section className="settings-card empty-panel"><Banknote size={33}/>
         <h3>{f9(locale,"noStaffShifts")}</h3></section>}
      <section className="settings-card finance-shift-history">
       <div className="section-heading"><h2>{f9(locale,"pastShifts")}</h2>
         <span className="data-badge active">{history?.total??0}</span></div>
       {!!history?.items.length?<div className="table-scroll"><table className="data-table"><thead><tr>
         <th>{f9(locale,"cashierName")}</th><th>{f9(locale,"shiftStart")}</th>
         <th>{f9(locale,"shiftEnd")}</th><th>{f9(locale,"expected")}</th>
         <th>{f9(locale,"counted")}</th><th>{f9(locale,"variance")}</th>
       </tr></thead><tbody>
       {history.items.map(x=><tr key={x.id}>
          <td>{x.cashierName}</td><td>{isoTime(x.openedAt,locale)}</td>
          <td>{isoTime(x.closedAt,locale)}</td><td>{money(x.expectedMinor??0,locale)}</td>
          <td>{money(x.closingCountMinor??0,locale)}</td><td>{money(x.varianceMinor??0,locale)}</td>
       </tr>)}</tbody></table></div>:<p className="finance-muted">{f9(locale,"emptyShift")}</p>}
       {!!history&&history.total>history.perPage&&<div className="pager">
        <button className="button button-small" disabled={page===1} onClick={()=>setPage(x=>x-1)}>‹</button>
        <span>{page} / {Math.ceil(history.total/history.perPage)}</span>
        <button className="button button-small" disabled={page>=Math.ceil(history.total/history.perPage)}
           onClick={()=>setPage(x=>x+1)}>›</button></div>}
      </section>
     </>}
 </div>;
}
