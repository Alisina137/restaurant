"use client";
import {useCallback,useEffect,useRef,useState,type FormEvent} from "react";
import Link from "next/link";
import {BellRing,Check,ChefHat,Clock3,History,RefreshCw,Speaker,SpeakerOff,Truck,UtensilsCrossed,X} from "lucide-react";
import {useWorkspace} from "./workspace-provider";
import {jsonRequest,Phase2Error} from "@/lib/phase2-api";
import {API_URL} from "@/lib/auth-client";
import {name,amount,type WebDetail,type WebPage,type WebRow} from "@/lib/order-web-types";
import {k6} from "@/lib/kitchen-copy";
import type {Locale} from "@dineflow/shared";
type Status="new"|"preparing"|"ready"|"picked_up"|"served";
type Tab="new"|"preparing"|"ready"|"history";
type HistoryRow={id:string;roundId:string;visitId:string;tableId:string;tableLabel:string;
 status:Status;version:number;createdAt:string;startedAt:string|null;readyAt:string|null;
 pickedUpAt:string|null;servedAt:string|null;totalMinor:number;roundNumber:number;source:string};
type Page<T>={items:T[];total:number;page:number;perPage:number};
type TicketRow={id:string;roundId:string;ticketId:string;ticketVersion:number;tableId:string;tableLabel:string;
 roundNumber:number;status:Status;createdAt:string;totalMinor:number;startedAt:string|null;readyAt:string|null;
 pickedUpAt:string|null;servedAt:string|null};
const tabs:Tab[]=["new","preparing","ready","history"];
function formatDate(x:string|null,locale:Locale){return x?new Date(x).toLocaleString(locale,{month:"short",day:"numeric",hour:"2-digit",minute:"2-digit"}):"—";}
function duration(a:string|null,b:number){if(!a)return "—";const mins=Math.max(0,Math.floor((b-new Date(a).getTime())/60000));
 return mins<60?mins+"m":Math.floor(mins/60)+"h "+mins%60+"m";}
function statusClass(status:Status){return "order-pill "+status;}
function Label({status,locale}:{status:Status;locale:Locale}){return <span className={statusClass(status)}>{k6(locale,status)}</span>;}
function Details({detail,locale}:{detail:WebDetail;locale:Locale}){
 return <div className="kitchen-lines">
   {detail.lines.map(line=><div className="kitchen-line" key={line.id}>
    <div className="kitchen-line-head"><strong>{line.quantity} × {name({nameFa:line.itemNameFa,nameEn:line.itemNameEn,namePs:line.itemNamePs},locale)}</strong>
      <span className={"kitchen-line-pill "+line.kitchenStatus}>{k6(locale,(line.kitchenStatus==="picked_up"||line.kitchenStatus==="served")?line.kitchenStatus:
        line.kitchenStatus==="new"||line.kitchenStatus==="preparing"||line.kitchenStatus==="ready"?line.kitchenStatus:"new")}</span></div>
    {!!line.modifierSnapshot.length&&<div className="kitchen-mods">{line.modifierSnapshot.flatMap(g=>
      g.options.map(o=><span key={g.groupId+o.id}>{name(g,locale)}: {name(o,locale)}</span>))}</div>}
    {!!line.note&&<div className="kitchen-item-note">{line.note}</div>}
   </div>)}
   {!!detail.round.orderNote&&<div className="kitchen-item-note">{detail.round.orderNote}</div>}
   <div className="kitchen-ticket-total"><span>{k6(locale,"totalTickets")}</span><strong>{amount(detail.round.totalMinor,locale)}</strong></div>
  </div>;
}
function DetailModal({id,locale,onClose}:{id:string;locale:Locale;onClose:()=>void}){
 const [detail,setDetail]=useState<WebDetail|null>(null),[error,setError]=useState("");
 useEffect(()=>{let active=true;
  void jsonRequest<WebDetail>("/api/orders/rounds/"+id).then(d=>{if(active)setDetail(d);})
   .catch(e=>{if(active)setError(e instanceof Error?e.message:k6(locale,"error"));});
  return()=>{active=false;};
 },[id,locale]);
 return <div className="dialog-backdrop kitchen-backdrop" role="presentation" onMouseDown={e=>{if(e.target===e.currentTarget)onClose();}}>
  <section className="kitchen-dialog" role="dialog" aria-modal="true" aria-labelledby="kitchen-ticket-modal-title">
   <div className="kitchen-dialog-head"><div><div className="eyebrow">DINEFLOW / {k6(locale,"ticket")}</div>
     <h2 id="kitchen-ticket-modal-title">{k6(locale,"orderView")}</h2></div>
    <button type="button" className="icon-action" aria-label="Close" onClick={onClose}><X size={22}/></button></div>
   {!!error&&<p role="alert" className="form-error">{error}</p>}
   {detail?<><div className="kitchen-meta-row"><span>{k6(locale,"table")} {detail.ticket?.tableLabel}</span>
       <Label locale={locale} status={detail.ticket?.status as Status??"new"}/></div>
     <Details detail={detail} locale={locale}/>
     <div className="kitchen-activity"><h3>{k6(locale,"history")}</h3>
       {detail.activity.map(a=><div key={a.id}><span>{a.action.replaceAll("."," · ")}</span>
         <time>{formatDate(a.createdAt,locale)}</time></div>)}</div>
    </>:<div className="list-skeleton"><span/><span/></div>}
  </section>
 </div>;
}
function TicketCard({row,locale,now,busy,onAction,onLine,onView}:{
 row:TicketRow;locale:Locale;now:number;busy:boolean;
 onAction:(row:TicketRow,action:"start"|"ready"|"handoff"|"notify")=>void;
 onLine:(row:TicketRow,lineId:string)=>void;onView:(id:string)=>void;
}){
 const [detail,setDetail]=useState<WebDetail|null>(null),[error,setError]=useState("");
 useEffect(()=>{let active=true;setError("");
  void jsonRequest<WebDetail>("/api/orders/rounds/"+row.roundId).then(d=>{if(active)setDetail(d);})
  .catch(e=>{if(active)setError(e instanceof Error?e.message:"Could not open ticket.");});
  return()=>{active=false;};
 },[row.roundId,row.ticketVersion]);
 const durationStart=row.status==="ready"||row.status==="picked_up"?(row.readyAt??row.createdAt):row.createdAt;
 return <article className={"kitchen-ticket "+row.status}>
   <div className="kitchen-ticket-top"><div><span className="eyebrow">{k6(locale,"ticketNumber")}{row.roundNumber}</span>
     <h2>{k6(locale,"table")} {row.tableLabel}</h2></div><Label locale={locale} status={row.status}/></div>
   <div className="kitchen-ticket-meta"><span><Clock3 size={17}/>{duration(durationStart,now)}</span>
     <time>{formatDate(row.createdAt,locale)}</time></div>
   {!!error&&<p className="form-error" role="alert">{error}</p>}
   {detail?<><Details detail={detail} locale={locale}/>
    {row.status==="preparing"&&detail.lines.some(l=>l.kitchenStatus!=="ready")&&<div className="kitchen-line-controls">
     {detail.lines.filter(l=>["new","preparing"].includes(l.kitchenStatus)).map(l=><button
       key={l.id} type="button" className="button button-small" disabled={busy}
       onClick={()=>onLine(row,l.id)}><Check size={16}/>{k6(locale,"markLineReady")} · {name({
         nameFa:l.itemNameFa,nameEn:l.itemNameEn,namePs:l.itemNamePs},locale)}</button>)}
    </div>}
   </>:<div className="list-skeleton"><span/><span/></div>}
   <footer className="kitchen-ticket-actions">
     <button type="button" className="button button-small" onClick={()=>onView(row.roundId)}>{k6(locale,"details")}</button>
     {row.status==="new"&&<button type="button" className="button button-primary" disabled={busy}
       onClick={()=>onAction(row,"start")}><ChefHat size={18}/>{k6(locale,"start")}</button>}
     {row.status==="preparing"&&<button type="button" className="button button-primary" disabled={busy||!detail}
       onClick={()=>onAction(row,"ready")}><Check size={18}/>{k6(locale,"markReady")}</button>}
     {row.status==="ready"&&<button type="button" className="button button-primary" disabled={busy}
       onClick={()=>onAction(row,"handoff")}><Truck size={18}/>{k6(locale,"markHandoff")}</button>}
     {(row.status==="ready"||row.status==="picked_up")&&<button type="button"
       className="button button-small" disabled={busy} onClick={()=>onAction(row,"notify")}>
       <BellRing size={17}/>{k6(locale,"notifyAgain")}</button>}
   </footer>
 </article>;
}
export function KitchenOperations({tab}:{tab:Tab}){
 const {workspace}=useWorkspace(),locale=workspace.locale;
 const [page,setPage]=useState(1),[data,setData]=useState<Page<TicketRow>|null>(null);
 const [loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState(""),[notice,setNotice]=useState("");
 const [selected,setSelected]=useState<string|null>(null),[status,setStatus]=useState("all"),
  [table,setTable]=useState(""),[from,setFrom]=useState(""),[to,setTo]=useState(""),
  [applied,setApplied]=useState({status:"all",table:"",from:"",to:""});
 const [now,setNow]=useState(0),[connected,setConnected]=useState(false),[lastSync,setLastSync]=useState<number|null>(null);
 const [sound,setSound]=useState(false);const soundRef=useRef<AudioContext|null>(null),known=useRef<Set<string>>(new Set());
 const first=useRef(true),lastBeep=useRef(0),revision=useRef(-1);
 useEffect(()=>{setNow(Date.now());const timer=setInterval(()=>setNow(Date.now()),10000);
   return()=>clearInterval(timer);},[]);
 useEffect(()=>{setSound(localStorage.getItem("dineflow-kitchen-sound")==="1");return()=>{
   void soundRef.current?.close();soundRef.current=null;
 };},[]);
 const path=tab==="history"?"/api/orders/kitchen/history?page="+page+"&status="+encodeURIComponent(applied.status)+
   (applied.table?"&table="+encodeURIComponent(applied.table):"")+(applied.from?"&from="+applied.from:"")+
   (applied.to?"&to="+applied.to:""):
   "/api/orders/kitchen?status="+tab+"&page="+page;
 const load=useCallback(async(silent=false)=>{
   if(!silent)setLoading(true);
   setError("");
   try{
     if(tab==="history"){
       const result=await jsonRequest<Page<HistoryRow>>(path);
       setData({items:result.items.map(x=>({...x,id:x.roundId,ticketId:x.id,ticketVersion:x.version,
         submittedBy:"",orderNote:""})),total:result.total,page:result.page,perPage:result.perPage});
     }else{
       const result=await jsonRequest<WebPage>(path);
       setData({items:result.items.map(x=>({...x,roundId:x.id,pickedUpAt:null,servedAt:null})),
         total:result.total,page:result.page,perPage:result.perPage});
     }
     setLastSync(Date.now());
   }catch(e){setError(e instanceof Error?e.message:k6(locale,"error"));}
   finally{setLoading(false);}
 },[path,tab,locale]);
 useEffect(()=>{setData(null);setPage(1);known.current.clear();first.current=true;},[tab]);
 useEffect(()=>{void load();},[load]);
 useEffect(()=>{
   const source=new EventSource(API_URL+"/api/orders/events",{withCredentials:true});
   source.onopen=()=>setConnected(true);
   source.onerror=()=>setConnected(false);
   const cb=(evt:MessageEvent<string>)=>{
     try{const ver=(JSON.parse(evt.data) as {version:number}).version;
       if(revision.current>=0&&ver!==revision.current)void load(true);
       revision.current=ver;
     }catch{/* Polling remains authoritative. */}
   };
   source.addEventListener("orders",cb as EventListener);
   const poll=setInterval(()=>{void load(true);},12000);
   return()=>{source.removeEventListener("orders",cb as EventListener);source.close();clearInterval(poll);};
 },[load]);
 useEffect(()=>{
   if(tab!=="new"||!data||loading)return;
   const current=new Set(data.items.map(x=>x.ticketId));
   const fresh=[...current].some(x=>!known.current.has(x));
   known.current=current;
   if(first.current){first.current=false;return;}
   if(fresh&&sound&&Date.now()-lastBeep.current>20000){
     lastBeep.current=Date.now();
     try{
       const ctx=soundRef.current;
       if(ctx){
         const oscillator=ctx.createOscillator(),gain=ctx.createGain();
         oscillator.type="sine";oscillator.frequency.value=700;
         gain.gain.setValueAtTime(0.1,ctx.currentTime);
         gain.gain.exponentialRampToValueAtTime(0.001,ctx.currentTime+0.22);
         oscillator.connect(gain);gain.connect(ctx.destination);
         oscillator.start();oscillator.stop(ctx.currentTime+0.23);
       }
     }catch{/* Optional audio must never block operations. */}
   }
 },[data,tab,loading,sound]);
 async function toggleSound(){
   const next=!sound;setSound(next);localStorage.setItem("dineflow-kitchen-sound",next?"1":"0");
   if(next){
     try{soundRef.current??=new AudioContext();await soundRef.current.resume();}
     catch{/* Sound disabled if browser denies audio playback. */}
   }
 }
 async function action(row:TicketRow,kind:"start"|"ready"|"handoff"|"notify",lineId?:string){
   const question=kind==="handoff"?"confirmHandoff":kind==="notify"?"confirmNotify":
     kind==="start"?"confirmStart":"confirmLineReady";
   if(!window.confirm(k6(locale,question)))return;
   setBusy(true);setNotice("");setError("");
   let endpoint="",body:Record<string,unknown>={version:row.ticketVersion};
   if(kind==="start"||kind==="ready"){
     endpoint="/api/orders/tickets/"+row.ticketId+"/transition";
     body={...body,nextStatus:kind==="start"?"preparing":"ready"};
   }else if(kind==="handoff")endpoint="/api/orders/tickets/"+row.ticketId+"/handoff";
   else endpoint="/api/orders/tickets/"+row.ticketId+"/notify";
   if(lineId){endpoint="/api/orders/tickets/"+row.ticketId+"/lines/"+lineId+"/ready";}
   try{await jsonRequest(endpoint,{method:"POST",body:JSON.stringify(body)});
     setNotice(k6(locale,"lineReady"));await load(true);
   }catch(e){setError(e instanceof Phase2Error&&e.code==="VERSION_CONFLICT"?
     "Ticket changed on another device; refresh.":e instanceof Error?e.message:k6(locale,"error"));
     await load(true);}
   finally{setBusy(false);}
 }
 function applyFilters(event:FormEvent<HTMLFormElement>){event.preventDefault();
   setApplied({status,table:table.trim(),from,to});setPage(1);}
 const rows=data?.items??[];
 return <div className="content-stack kitchen-console">
   <div className="page-heading"><div><div className="eyebrow">DINEFLOW / {k6(locale,"newTitle")}</div>
     <h1>{k6(locale,tab==="history"?"history":tab==="new"?"newTitle":tab==="preparing"?"preparingTitle":"readyTitle")}</h1>
     <p>{k6(locale,"soundHint")}</p></div>
     <button className="button" type="button" onClick={()=>void load()}><RefreshCw size={18}/>{k6(locale,"refresh")}</button></div>
   <nav className="context-tabs" aria-label={k6(locale,"history")}>
     {tabs.map(k=><Link key={k} href={k==="new"?"/kitchen/live":"/kitchen/"+k}
       className={"context-tab"+(k===tab?" current":"")} aria-current={k===tab?"page":undefined}>
        {k==="history"?<History size={18}/>:<ChefHat size={18}/>}
        {k6(locale,k)}</Link>)}</nav>
   <div className="kitchen-live-bar"><div className={"kitchen-connection "+(connected?"online":"offline")}>
     <span className="kitchen-live-dot"/>{k6(locale,connected?"connected":"reconnecting")}</div>
     <span>{k6(locale,"lastSync")}: {lastSync?formatDate(new Date(lastSync).toISOString(),locale):"—"}</span>
     <button className="button button-small" type="button" aria-pressed={sound}
       onClick={()=>void toggleSound()} title={k6(locale,"soundLabel")}>
       {sound?<Speaker size={17}/>:<SpeakerOff size={17}/>}
       {k6(locale,sound?"soundOn":"soundOff")}</button></div>
   {notice&&<p className="success-banner" role="status">{notice}</p>}
   {error&&<div role="alert" className="form-error">{error}
     <button type="button" className="text-link" onClick={()=>void load()}>{k6(locale,"refresh")}</button></div>}
   {tab==="new"&&<div className="kitchen-info"><BellRing size={19}/>
     <div><strong>{k6(locale,"waitingApproval")}</strong><p>{k6(locale,"waitingApprovalHint")}</p></div></div>}
   {tab==="history"&&<form className="kitchen-history-filters settings-card" onSubmit={applyFilters}>
     <label className="field"><span>{k6(locale,"statusFilter")}</span>
       <select value={status} onChange={e=>setStatus(e.target.value)}>
        {(["all","new","preparing","ready","picked_up","served"] as const).map(x=>
         <option key={x} value={x}>{x==="all"?k6(locale,"allStatus"):k6(locale,x)}</option>)}</select></label>
     <label className="field"><span>{k6(locale,"tableFilter")}</span>
       <input value={table} onChange={e=>setTable(e.target.value)} maxLength={100}/></label>
     <label className="field"><span>{k6(locale,"fromDate")}</span>
       <input type="date" value={from} onChange={e=>setFrom(e.target.value)}/></label>
     <label className="field"><span>{k6(locale,"toDate")}</span>
       <input type="date" value={to} onChange={e=>setTo(e.target.value)}/></label>
     <button className="button button-primary" type="submit">{k6(locale,"query")}</button>
     <p className="muted">{k6(locale,"filterHint")}</p>
   </form>}
   {loading&&!data?<div className="list-skeleton"><span/><span/><span/></div>:
     rows.length?tab==="history"?<div className="settings-card kitchen-history-list">
       <div className="section-heading"><h2>{k6(locale,"history")}</h2>
          <span className="data-badge active">{data?.total}</span></div>
       <div className="table-scroll"><table className="data-table">
        <thead><tr><th>{k6(locale,"ticket")}</th><th>{k6(locale,"table")}</th>
          <th>{k6(locale,"status")}</th><th>{k6(locale,"received")}</th>
          <th>{k6(locale,"duration")}</th><th>{k6(locale,"actions")}</th></tr></thead>
        <tbody>{rows.map(x=><tr key={x.ticketId}>
          <td>#{x.roundNumber}</td><td><b>{x.tableLabel}</b></td>
          <td><Label status={x.status} locale={locale}/></td>
          <td>{formatDate(x.createdAt,locale)}</td>
          <td>{duration(x.createdAt,x.readyAt?new Date(x.readyAt).getTime():now)}</td>
          <td><button className="button button-small" type="button" onClick={()=>setSelected(x.roundId)}>{k6(locale,"details")}</button></td>
         </tr>)}</tbody></table></div></div>:
       <div className="kitchen-ticket-grid">{rows.map(row=><TicketCard key={row.ticketId}
         row={row} locale={locale} now={now} busy={busy}
         onAction={(r,kind)=>void action(r,kind)}
         onLine={(r,lineId)=>void action(r,"ready",lineId)} onView={setSelected}/>)}</div>:
       <div className="settings-card empty-panel"><UtensilsCrossed size={33}/>
         <h3>{k6(locale,tab==="history"?"noHistory":"empty")}</h3></div>}
   {!!data&&data.total>data.perPage&&<div className="pager">
     <button type="button" className="button button-small" disabled={page<=1}
       onClick={()=>setPage(p=>p-1)}>{k6(locale,"newer")}</button>
     <span>{page} / {Math.ceil(data.total/data.perPage)}</span>
     <button type="button" className="button button-small" disabled={page>=Math.ceil(data.total/data.perPage)}
       onClick={()=>setPage(p=>p+1)}>{k6(locale,"older")}</button></div>}
   {tab==="ready"&&<p className="muted">{k6(locale,"handoffNote")} {k6(locale,"servedNote")}</p>}
   {selected&&<DetailModal locale={locale} id={selected} onClose={()=>setSelected(null)}/>}
 </div>;
}
