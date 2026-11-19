"use client";
import {useEffect,useState} from "react";
import type {Locale} from "@dineflow/shared";
import {AlertTriangle,BarChart3,Clock3,RefreshCw,ShieldAlert} from "lucide-react";
import {jsonRequest,Phase2Error} from "@/lib/phase2-api";
import {p32,type Pilot32Key} from "@/lib/pilot32-copy";
import {pilot32Signals,validPilotOperations,type PilotOperations} from "@/lib/pilot32";

export function PilotOperationsSnapshot({locale,scopeKey}:{locale:Locale;scopeKey:string}){
 const [minutes,setMinutes]=useState<60|180|360>(60);
 const [data,setData]=useState<PilotOperations|null>(null);
 const [loading,setLoading]=useState(true),[error,setError]=useState(false),[retry,setRetry]=useState(0);
 useEffect(()=>{
  let active=true,requestId=0;
  const load=async()=>{
   if(document.hidden)return;
   const current=++requestId;
   setLoading(true);
   try{
    const next=await jsonRequest<PilotOperations>("/api/pilot/operations?minutes="+minutes);
    if(!validPilotOperations(next,minutes))throw Error("INVALID_PILOT_OPERATIONS");
    if(active&&current===requestId){
     setData(next);setError(false);
    }
   }catch(err){
    if(!active||current!==requestId)return;
    setData(null);setError(true);
    if(err instanceof Phase2Error&&err.status===401)window.location.assign("/login?expired=1");
   }finally{
    if(active&&current===requestId)setLoading(false);
   }
  };
  setData(null);setError(false);setLoading(true);
  void load();
  const timer=setInterval(()=>void load(),30000);
  const onVisible=()=>{if(!document.hidden)void load();};
  document.addEventListener("visibilitychange",onVisible);
  return()=>{
   active=false;clearInterval(timer);
   document.removeEventListener("visibilitychange",onVisible);
  };
 },[scopeKey,minutes,retry]);
 const metrics:Array<[Pilot32Key,keyof PilotOperations]>=[
  ["accepted","acceptedWindow"],["observed","observedWindow"],
  ["active","activeTickets"],["missing","activeWithoutReport"],
  ["pickups","pickupPending"],["visits","openVisits"],
  ["checks","openChecks"],["shifts","openCashierShifts"],
  ["tables","activeTables"],["menu","publishedItems"],
  ["outbox","pendingOutbox"]
 ];
 const signals=data&&!error?pilot32Signals(data):[];
 const age=data?.oldestPendingOutboxAgeSeconds;
 const checked=data?.checkedAt&&Number.isFinite(Date.parse(data.checkedAt))?
  new Date(data.checkedAt).toLocaleString(locale):"—";
 return <section className="p32-panel" aria-label={p32(locale,"title")}>
  <div className="p32-head">
   <div>
    <span className="eyebrow">DINEFLOW / PILOT SERVICE READINESS</span>
    <h2><BarChart3 size={22} aria-hidden="true"/> {p32(locale,"title")}</h2>
    <p>{p32(locale,"subtitle")}</p>
   </div>
   <div className="p32-controls">
    <label htmlFor="p32-window">{p32(locale,"window")}
     <select id="p32-window" value={minutes} onChange={event=>
      setMinutes(Number(event.target.value) as 60|180|360)}>
      <option value={60}>{p32(locale,"hour")}</option>
      <option value={180}>{p32(locale,"three")}</option>
      <option value={360}>{p32(locale,"six")}</option>
     </select>
    </label>
    <button type="button" disabled={loading} onClick={()=>setRetry(value=>value+1)}>
     <RefreshCw size={16} aria-hidden="true"/>{p32(locale,"refresh")}
    </button>
   </div>
  </div>
  {error&&<div className="p32-error" role="alert"><ShieldAlert size={19}/>
   {p32(locale,"failed")}
   <button type="button" className="p32-retry" onClick={()=>setRetry(value=>value+1)}>
    {p32(locale,"retry")}</button>
  </div>}
  {!data&&!error&&<div role="status" className="p32-empty">
   <RefreshCw size={19} aria-hidden="true"/>{p32(locale,"refresh")}</div>}
  {data&&!error&&<>
   <div className="p32-metrics">
    {metrics.map(([label,key])=>{
     const value=data[key];
     return <div key={key} className={"p32-card"+(
      (key==="activeWithoutReport"||key==="pickupPending"||key==="pendingOutbox")&&
       typeof value==="number"&&value>0?" p32-attention":"")}>
      <span>{p32(locale,label)}</span>
      <strong>{typeof value==="number"?value:"—"}</strong>
     </div>;
    })}
    <div className={"p32-card"+(age!==null&&age!==undefined&&age>60?" p32-attention":"")}>
     <span>{p32(locale,"outboxOldest")}</span>
     <strong>{age===null||age===undefined?"—":
      age<60?age+" s":Math.floor(age/60)+" "+p32(locale,"minute")}</strong>
    </div>
   </div>
   <p className="p32-footnote">{p32(locale,"windowNote")}</p>
   <div className="p32-divider"/>
   <div className="p32-signals">
    <h3>{p32(locale,"warning")}</h3>
    {signals.length===0?<p className="p32-signal p32-neutral">
     <BarChart3 size={17}/>{p32(locale,"normal")}</p>:
     signals.map(signal=><div key={signal} className="p32-signal" role="status">
      <AlertTriangle size={17}/>{p32(locale,
       signal==="unreported"?"unreported":signal==="outbox"?"outboxWarn":"receipt")}
     </div>)}
   </div>
   <div className="p32-status">
    <span><Clock3 size={15}/> {p32(locale,"checked")}: {checked}</span>
    <span>{p32(locale,"outboxOldest")}: {data.oldestPendingOutboxAt?
     new Date(data.oldestPendingOutboxAt).toLocaleString(locale):p32(locale,"noOutbox")}</span>
   </div>
  </>}
  <div className="p32-divider"/>
  <div className="p32-footnote">
   <strong>{p32(locale,"limits")}</strong>
   <p>{p32(locale,"methodology")}</p>
  </div>
 </section>;
}
