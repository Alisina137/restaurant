"use client";
import {useEffect,useState,type FormEvent} from "react";
import {AlertTriangle,CheckCircle2,Clock3,FileClock,Plus,RefreshCw,ShieldAlert} from "lucide-react";
import type {Locale} from "@dineflow/shared";
import {jsonRequest,Phase2Error} from "@/lib/phase2-api";
import {postSaas} from "@/lib/phase12-api";
import {PILOT_GATES,validIncidentList,validIncidentHistory,type IncidentList,
 type IncidentHistory,type PilotGate,type IncidentStatus,type IncidentSeverity} from "@/lib/pilot33";
import {p33,type Pilot33Key} from "@/lib/pilot33-copy";

const gateLabel:Record<PilotGate,Pilot33Key>={
 roles:"gateRoles",qr:"gateQr",orders:"gateOrders",cash:"gateCash",
 billing:"gateBilling",languages:"gateLanguages",devices:"gateDevices",
 accessibility:"gateAccessibility",reliability:"gateReliability",
 backups:"gateBackups",rollback:"gateRollback",shift:"gateShift"
};
export function PilotIncidentRegister({locale,scopeKey,isOwner,onChanged}:{
 locale:Locale;scopeKey:string;isOwner:boolean;onChanged:()=>void
}){
 const [status,setStatus]=useState<IncidentStatus|"all">("open");
 const [severityFilter,setSeverityFilter]=useState<IncidentSeverity|"all">("all");
 const [page,setPage]=useState(1),[refresh,setRefresh]=useState(0);
 const [data,setData]=useState<IncidentList|null>(null);
 const [loading,setLoading]=useState(true),[error,setError]=useState(false);
 const [saving,setSaving]=useState(false),[notice,setNotice]=useState(""),[problem,setProblem]=useState("");
 const [gateKey,setGateKey]=useState<PilotGate>("orders");
 const [severity,setSeverity]=useState<IncidentSeverity>("p1");
 const [title,setTitle]=useState(""),[details,setDetails]=useState("");
 const [editing,setEditing]=useState<{id:string;action:"resolve"|"reopen";version:number}|null>(null);
 const [actionNote,setActionNote]=useState("");
 const [historyId,setHistoryId]=useState<string|null>(null);
 const [history,setHistory]=useState<IncidentHistory|null>(null),[historyError,setHistoryError]=useState(false);
 useEffect(()=>{
  let active=true,sequence=0;
  const load=async()=>{
   if(document.hidden)return;
   const seq=++sequence;setLoading(true);
   try{
    const result=await jsonRequest<IncidentList>("/api/pilot/incidents?status="+status+
     "&severity="+severityFilter+"&page="+page);
    if(!validIncidentList(result,status,severityFilter,page))throw Error("INVALID_INCIDENT_LIST");
    if(active&&seq===sequence){setData(result);setError(false);}
   }catch(err){
    if(!active||seq!==sequence)return;
    setError(true);setData(null);
    if(err instanceof Phase2Error&&err.status===401)
     window.location.assign("/login?expired=1");
   }finally{if(active&&seq===sequence)setLoading(false);}
  };
  setData(null);setError(false);setLoading(true);
  void load();
  const timer=setInterval(()=>void load(),30000);
  const onVisible=()=>{if(!document.hidden)void load();};
  document.addEventListener("visibilitychange",onVisible);
  return()=>{active=false;clearInterval(timer);
   document.removeEventListener("visibilitychange",onVisible);};
 },[scopeKey,status,severityFilter,page,refresh]);
 useEffect(()=>{
  if(!historyId)return;
  let active=true;
  setHistory(null);setHistoryError(false);
  void jsonRequest<IncidentHistory>("/api/pilot/incidents/"+historyId+"/events")
   .then(result=>{
    if(!validIncidentHistory(result,historyId))throw Error("INVALID_INCIDENT_HISTORY");
    if(active)setHistory(result);
   }).catch(()=>{
    if(active){setHistoryError(true);setHistory(null);}
   });
  return()=>{active=false;};
 },[scopeKey,historyId,refresh]);
 async function submitNew(e:FormEvent<HTMLFormElement>){
  e.preventDefault();if(saving)return;
  setSaving(true);setProblem("");setNotice("");
  try{
   await postSaas("/api/pilot/incidents",{gateKey,severity,title:title.trim(),details:details.trim()});
   setTitle("");setDetails("");setPage(1);setStatus("open");
   setSeverityFilter("all");setRefresh(n=>n+1);
   setNotice(p33(locale,"added"));onChanged();
  }catch(err){setProblem(err instanceof Error?err.message:p33(locale,"submitFailed"));}
  finally{setSaving(false);}
 }
 async function submitAction(e:FormEvent<HTMLFormElement>){
  e.preventDefault();if(saving||!editing)return;
  const current=editing;
  setSaving(true);setProblem("");setNotice("");
  try{
   await postSaas("/api/pilot/incidents/"+current.id+"/"+current.action,
    {expectedVersion:current.version,note:actionNote.trim()});
   setActionNote("");setEditing(null);setHistoryId(null);
   setRefresh(n=>n+1);onChanged();
  }catch(err){setProblem(err instanceof Error?err.message:p33(locale,"versionConflict"));}
  finally{setSaving(false);}
 }
 function updateStatus(next:IncidentStatus|"all"){setStatus(next);setPage(1);setEditing(null);setHistoryId(null);}
 function updateSeverity(next:IncidentSeverity|"all"){setSeverityFilter(next);setPage(1);setEditing(null);setHistoryId(null);}
 return <section id="p33-incident-register" className="p33-panel" aria-label={p33(locale,"title")}>
  <div className="p33-header">
   <div className="p33-header-title">
    <div className="p33-icon"><ShieldAlert size={24} aria-hidden="true"/></div>
    <div><div className="eyebrow">DINEFLOW / PILOT INCIDENT CONTROL</div>
     <h2>{p33(locale,"title")}</h2>
     <p>{p33(locale,"subtitle")}</p></div>
   </div>
   <button type="button" className="p33-button" disabled={loading}
    onClick={()=>setRefresh(n=>n+1)}><RefreshCw size={17}/>{p33(locale,"refresh")}</button>
  </div>
  <div className="p33-policy" role="note"><AlertTriangle size={18}/>
   <span>{p33(locale,"safety")} {p33(locale,"caution")}</span>
  </div>
  {error&&<div role="alert" className="p33-error">{p33(locale,"error")}
   <button type="button" onClick={()=>setRefresh(n=>n+1)}>{p33(locale,"refresh")}</button>
  </div>}
  {problem&&<div role="alert" className="p33-error">{problem}</div>}
  {notice&&<div role="status" className="p33-success">{notice}</div>}
  <div className="p33-dual">
   <section className="p33-subpanel">
    <div className="p33-subheading"><Plus size={19}/><h3>{p33(locale,"new")}</h3></div>
    <form className="p33-form" onSubmit={e=>void submitNew(e)}>
     <div className="p33-form-row">
      <label>{p33(locale,"gate")}
       <select value={gateKey} onChange={e=>setGateKey(e.target.value as PilotGate)}>
        {PILOT_GATES.map(key=><option key={key} value={key}>{p33(locale,gateLabel[key])}</option>)}
       </select>
      </label>
      <label>{p33(locale,"severity")}
       <select value={severity} onChange={e=>setSeverity(e.target.value as IncidentSeverity)}>
        {(["p0","p1","p2"] as const).map(level=>
         <option key={level} value={level}>{p33(locale,level)}</option>)}
       </select>
      </label>
     </div>
     <label>{p33(locale,"incidentTitle")}
      <input required minLength={8} maxLength={120} value={title}
       onChange={e=>setTitle(e.target.value)}/></label>
     <label>{p33(locale,"details")}
      <textarea required rows={4} minLength={25} maxLength={1500} value={details}
       onChange={e=>setDetails(e.target.value)}/></label>
     <button type="submit" className="p33-button p33-primary"
      disabled={saving||title.trim().length<8||details.trim().length<25}>
      <Plus size={17}/>{p33(locale,"create")}</button>
    </form>
   </section>
   <section className="p33-subpanel">
    <div className="p33-subheading"><FileClock size={19}/><h3>{p33(locale,"filter")}</h3></div>
    <div className="p33-form-row">
     <label>{p33(locale,"status")}
      <select value={status} onChange={e=>updateStatus(e.target.value as IncidentStatus|"all")}>
       {(["open","resolved","all"] as const).map(value=>
        <option key={value} value={value}>{p33(locale,value)}</option>)}
      </select>
     </label>
     <label>{p33(locale,"severity")}
      <select value={severityFilter}
       onChange={e=>updateSeverity(e.target.value as IncidentSeverity|"all")}>
       <option value="all">{p33(locale,"allSeverities")}</option>
       {(["p0","p1","p2"] as const).map(level=>
        <option key={level} value={level}>{p33(locale,level)}</option>)}
      </select>
     </label>
    </div>
    <div className="p33-verified">
     <span>{p33(locale,"total")}: <strong>{data&&!error?data.total:"—"}</strong></span>
     <span><Clock3 size={16} aria-hidden="true"/> {data&&!error?
      new Date(data.checkedAt).toLocaleString(locale):p33(locale,"loading")}</span>
    </div>
    <p className="p33-operator-note">{p33(locale,"ownerOnly")}</p>
   </section>
  </div>
  {loading&&<div role="status" className="p33-loading">{p33(locale,"loading")}</div>}
  {data&&!error&&!loading&&data.items.length===0&&<div className="p33-empty">{p33(locale,"none")}</div>}
  {data&&!error&&<div className="p33-list">
   {data.items.map(item=>{
    const thisEdit=editing?.id===item.id;
    return <article key={item.id} className={"p33-incident"+(item.severity!=="p2"&&item.status==="open"?" p33-blocking":"")}>
     <div className="p33-incident-top">
      <span className={"p33-tag p33-"+item.severity}>{p33(locale,item.severity)}</span>
      <span className={"p33-tag p33-"+item.status}>{p33(locale,item.status)}</span>
      <span className="p33-tag">{p33(locale,gateLabel[item.gateKey])}</span>
     </div>
     <h3>{item.title}</h3><p className="p33-description">{item.details}</p>
     <div className="p33-footline">
      <time dateTime={item.createdAt}>{new Date(item.createdAt).toLocaleString(locale)}</time>
      <span>{p33(locale,"version")}: {item.version}</span>
     </div>
     <div className="p33-actions">
      <button type="button" className="p33-button"
       onClick={()=>{setEditing(null);setHistoryId(historyId===item.id?null:item.id);}}>
       <FileClock size={16}/>{p33(locale,historyId===item.id?"hideHistory":"showHistory")}
      </button>
      {((item.status==="open"&&isOwner)||item.status==="resolved")&&
       <button type="button" className="p33-button p33-primary" onClick={()=>{
        setEditing({id:item.id,action:item.status==="open"?"resolve":"reopen",version:item.version});
        setActionNote("");setProblem("");
       }}>
        {item.status==="open"?<CheckCircle2 size={16}/>:<AlertTriangle size={16}/>}
        {p33(locale,item.status==="open"?"resolve":"reopen")}
       </button>}
     </div>
     {thisEdit&&<form onSubmit={e=>void submitAction(e)} className="p33-action-form">
      <label>{p33(locale,"actionNote")}
       <textarea required rows={4} minLength={editing.action==="resolve"?35:25}
        maxLength={1500} value={actionNote}
        onChange={e=>setActionNote(e.target.value)}/></label>
      <p>{p33(locale,editing.action==="resolve"?"resolveHelp":"reopenHelp")}</p>
      <button type="submit" className="p33-button p33-primary"
       disabled={saving||actionNote.trim().length<(editing.action==="resolve"?35:25)}>
       {p33(locale,editing.action==="resolve"?"resolve":"reopen")}
      </button>
      <button type="button" className="p33-button" onClick={()=>setEditing(null)}>
       {p33(locale,"hideHistory")}</button>
     </form>}
     {historyId===item.id&&<div className="p33-history">
      <h4>{p33(locale,"history")}</h4>
      {historyError&&<p role="alert">{p33(locale,"noHistory")}</p>}
      {!history&&!historyError&&<p>{p33(locale,"loading")}</p>}
      {history&&<ol>{history.events.map(event=><li key={event.id}>
       <strong>{p33(locale,event.action==="opened"?"eventOpened":
        event.action==="resolved"?"eventResolved":"eventReopened")}</strong>
       <span>#{event.version} · {new Date(event.createdAt).toLocaleString(locale)}</span>
       <p>{event.note}</p>
      </li>)}</ol>}
     </div>}
    </article>;
   })}
  </div>}
  {data&&!error&&data.total>10&&<nav aria-label={p33(locale,"page")} className="p33-pagination">
   <button type="button" className="p33-button" disabled={loading||page<=1}
    onClick={()=>setPage(n=>n-1)}>{p33(locale,"previous")}</button>
   <span>{p33(locale,"page")} {page} / {Math.ceil(data.total/10)}</span>
   <button type="button" className="p33-button" disabled={loading||page*10>=data.total}
    onClick={()=>setPage(n=>n+1)}>{p33(locale,"next")}</button>
  </nav>}
 </section>;
}
