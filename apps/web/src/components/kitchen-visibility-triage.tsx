"use client";
import {useEffect,useState,type FormEvent} from "react";
import type {Locale} from "@dineflow/shared";
import {AlertTriangle,ChevronDown,ChevronUp,Clock3,RefreshCw,Search,ShieldAlert} from "lucide-react";
import {jsonRequest,Phase2Error} from "@/lib/phase2-api";
import {elapsedGap,gapStatus,AGE_FILTERS,validGapPage,type VisibilityGapPage} from "@/lib/kitchen31";
import {k31} from "@/lib/kitchen31-copy";
import {k6} from "@/lib/kitchen-copy";

type Props={locale:Locale;scopeKey:string;now:number;count:number|null;onInspect:(id:string)=>void};
export function KitchenVisibilityTriage({locale,scopeKey,now,count,onInspect}:Props){
 const [open,setOpen]=useState(false),[page,setPage]=useState(1);
 const [age,setAge]=useState<(typeof AGE_FILTERS)[number]>(30);
 const [draftTable,setDraftTable]=useState(""),[table,setTable]=useState("");
 const [data,setData]=useState<VisibilityGapPage|null>(null),[error,setError]=useState(false);
 const [loading,setLoading]=useState(false),[retry,setRetry]=useState(0);
 useEffect(()=>{
  if(!open)return;
  let live=true,sequence=0;
  const refresh=async()=>{
   if(document.hidden)return;
   const current=++sequence;
   setLoading(true);
   try{
    const result=await jsonRequest<VisibilityGapPage>(
     "/api/orders/kitchen/unobserved?page="+page+"&minAgeSeconds="+age+
      "&table="+encodeURIComponent(table));
    if(!validGapPage(result,age,table)||result.page!==page)
     throw new Error("INVALID_VISIBILITY_GAP_PAGE");
    if(live&&current===sequence){setData(result);setError(false);}
   }catch(err){
    if(!live||current!==sequence)return;
    setData(null);setError(true);
    if(err instanceof Phase2Error&&err.status===401)
     window.location.assign("/login?expired=1");
   }finally{if(live&&current===sequence)setLoading(false);}
  };
  setData(null);setError(false);setLoading(true);
  void refresh();
  const interval=setInterval(()=>void refresh(),30000);
  const onVisible=()=>{if(!document.hidden)void refresh();};
  document.addEventListener("visibilitychange",onVisible);
  return()=>{live=false;clearInterval(interval);document.removeEventListener("visibilitychange",onVisible);};
 },[open,scopeKey,page,age,table,retry]);
 function applyTable(event:FormEvent<HTMLFormElement>){
  event.preventDefault();
  if(draftTable.trim().length>60)return;
  setPage(1);setTable(draftTable.trim());
 }
 const ageLabel=(value:number)=>value<60?value+"s":
  Math.ceil(value/60)+"m "+(value%60)+"s";
 return <section className="k31-triage" aria-label={k31(locale,"title")}>
  <div className="k31-heading">
   <div>
    <h3>{k31(locale,"title")}{count!==null&&<span className="k27-heading-count"> {count}</span>}</h3>
    <p>{k31(locale,"subtitle")}</p>
   </div>
   <button type="button" aria-expanded={open} aria-controls="k31-triage-details"
    onClick={()=>setOpen(value=>!value)}>
    {open?<ChevronUp size={17}/>:<ChevronDown size={17}/>}
    {k31(locale,open?"close":"toggle")}
   </button>
  </div>
  {open&&<div id="k31-triage-details" className="k31-list">
   <div className="k31-tools">
    <label className="k31-filter" htmlFor="k31-age">{k31(locale,"minimumAge")}
     <select id="k31-age" value={age} onChange={event=>{
      setPage(1);setAge(Number(event.target.value) as typeof age);
     }}>
      {AGE_FILTERS.map(value=><option key={value} value={value}>
       {k31(locale,value===0?"immediate":value===30?"age30":value===60?
        "age60":value===180?"age180":"age300")}</option>)}
     </select>
    </label>
    <form className="k31-table-search" role="search" onSubmit={applyTable}>
     <label htmlFor="k31-table-search">{k31(locale,"tableSearch")}</label>
     <div><input id="k31-table-search" value={draftTable} maxLength={60}
      onChange={event=>setDraftTable(event.target.value)}
      placeholder={k31(locale,"tableSearch")}/>
      <button type="submit" disabled={loading}>{k31(locale,"searchTable")}</button>
      {(draftTable||table)&&<button type="button" onClick={()=>{
       setDraftTable("");setTable("");setPage(1);}}>{k31(locale,"clear")}</button>}
     </div>
    </form>
    <button type="button" className="k31-refresh" disabled={loading}
     onClick={()=>setRetry(value=>value+1)}>
     <RefreshCw size={16}/>{k31(locale,"refresh")}
    </button>
    <span className="k31-stat" role="status">
     {k31(locale,"total")}: <strong>{data&&!error?data.total:"—"}</strong>
    </span>
    <span className="k31-stat">{k31(locale,"oldest")}: <strong>
     {data&&!error&&data.oldestAt?ageLabel(elapsedGap(data.oldestAt,now)):"—"}
    </strong></span>
   </div>
   <div className="k31-note">
    <ShieldAlert size={17}/><span>{k31(locale,"diagnosis")} {k31(locale,"disclaimer")}</span>
   </div>
   {error&&<div role="alert" className="k31-error">
    <AlertTriangle size={17}/>{k31(locale,"failed")}
    <button type="button" className="k31-refresh" onClick={()=>setRetry(value=>value+1)}>
     {k31(locale,"retry")}</button>
   </div>}
   {loading&&<div className="k31-stat" role="status">
    <RefreshCw size={16}/>{k31(locale,"refresh")}</div>}
   {data&&!error&&!loading&&data.items.length===0&&
    <div className="k31-empty">{k31(locale,"noResults")}</div>}
   {data&&!error&&data.items.map(row=>{
    const seconds=elapsedGap(row.createdAt,now);
    return <article className="k31-row" key={row.ticketId}>
     <div><span>{k31(locale,"table")}</span><strong>{row.tableLabel}</strong>
      <small>{k31(locale,"ticket")} #{row.roundNumber}</small></div>
     <div><span>{k31(locale,"state")}</span>
      <strong>{k6(locale,row.status)}</strong>
      <time>{new Date(row.createdAt).toLocaleString(locale)}</time></div>
     <div><span>{k31(locale,"age")}</span>
      <strong className={"k31-age"+(gapStatus(seconds)==="investigate"?" urgent":"")}>
       <Clock3 size={16}/>{ageLabel(seconds)}</strong>
      <small>{k31(locale,seconds>=60?"aging":"early")}</small></div>
     <button type="button" onClick={()=>onInspect(row.roundId)}>
      <Search size={17}/>{k31(locale,"details")}</button>
    </article>;
   })}
   {data&&!error&&data.total>data.perPage&&<nav className="k31-page" aria-label={k31(locale,"page")}>
    <button type="button" disabled={loading||page<=1} onClick={()=>setPage(n=>n-1)}>
     {k31(locale,"previous")}</button>
    <span>{k31(locale,"page")} {page} {k31(locale,"of")} {Math.ceil(data.total/10)}</span>
    <button type="button" disabled={loading||page*10>=data.total}
     onClick={()=>setPage(n=>n+1)}>{k31(locale,"next")}</button>
   </nav>}
   {data&&!error&&<small>{k31(locale,"measured")}: {
    new Date(data.checkedAt).toLocaleString(locale)}</small>}
  </div>}
 </section>;
}
