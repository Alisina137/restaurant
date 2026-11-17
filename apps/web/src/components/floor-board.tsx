"use client";
import {useEffect,useMemo,useState} from "react";
import Link from "next/link";
import {AlertCircle,ArrowRight,CheckCircle2,ClipboardList,Clock3,DoorOpen,Layers3,
 ListFilter,RefreshCcw,Search,ShieldCheck,UsersRound,UtensilsCrossed,Waves,X,ReceiptText,
 QrCode,UserRoundX} from "lucide-react";
import type {Locale} from "@dineflow/shared";
import {f4} from "@/lib/floor-copy";
import {f21} from "@/lib/floor21-copy";
import {elapsed,type DiningTable,type FloorBoard,type FloorStatus} from "@/lib/floor-types";
import {useDialogFocus} from "./ui/use-dialog-focus";

type Props={data:FloorBoard;locale:Locale;onChoose:(table:DiningTable)=>void};
const statuses:FloorStatus[]=["available","occupied","cleaning","disabled"];
const label=(locale:Locale,t:DiningTable)=>f4(locale,t.status);
export function FloorBoardGrid({data,locale,onChoose}:Props){
 const [query,setQuery]=useState(""),[status,setStatus]=useState("all"),[section,setSection]=useState("");
 const [waiter,setWaiter]=useState(""),[quick,setQuick]=useState<"all"|"mine"|"attention">("all");
 const [,setTick]=useState(0);
 useEffect(()=>{const timer=setInterval(()=>setTick(n=>n+1),60000);return()=>clearInterval(timer);},[]);
 const canManage=data.role!=="waiter";
 const tableCount=data.tables.length;
 const counters=useMemo(()=>({
  available:data.tables.filter(t=>t.status==="available").length,
  occupied:data.tables.filter(t=>t.status==="occupied").length,
  cleaning:data.tables.filter(t=>t.status==="cleaning").length,
  disabled:data.tables.filter(t=>t.status==="disabled").length,
  unassigned:data.tables.filter(t=>!t.assignedWaiterId&&t.active).length,
  attention:data.tables.filter(t=>t.status==="cleaning"||(!t.assignedWaiterId&&t.active)).length,
  guests:data.tables.reduce((n,t)=>n+(t.visitPartySize??0),0),
  freeSeats:data.tables.reduce((n,t)=>n+(t.status==="available"?t.seats:0),0),
  sections:data.sections.filter(s=>s.active).length
 }),[data]);
 const availableWaiters=useMemo(()=>Array.from(new Map(data.tables.filter(t=>t.assignedWaiterId)
  .map(t=>[t.assignedWaiterId!,t.assignedWaiterName??t.assignedWaiterId!])).entries())
  .sort((a,b)=>a[1].localeCompare(b[1])),[data.tables]);
 const visible=useMemo(()=>data.tables.filter(t=>{
  const q=query.trim().toLocaleLowerCase();
  return (!section||t.sectionId===section)&&(!waiter||(
    waiter==="unassigned"?!t.assignedWaiterId:t.assignedWaiterId===waiter))&&
    (status==="all"||t.status===status)&&
    (quick==="all"||quick==="mine"?quick!=="mine"||t.assignedWaiterId===data.actorId:
      t.status==="cleaning"||(!t.assignedWaiterId&&t.active))&&
    (!q||[t.label,t.sectionName,t.assignedWaiterName??"",t.notes].some(v=>v.toLocaleLowerCase().includes(q)));
 }),[data,query,status,section,waiter,quick]);
 const hasFilters=!!query||!!section||!!waiter||status!=="all"||quick!=="all";
 function reset(){setQuery("");setSection("");setStatus("all");setWaiter("");setQuick("all");}
 const quickOptions=[{key:"all" as const,text:f4(locale,"all")},
  {key:"mine" as const,text:f21(locale,"mine")},
  {key:"attention" as const,text:f21(locale,"attention")}];
 const metrics=[
  {key:"tableCount" as const,n:tableCount,icon:UtensilsCrossed,kind:"all"},
  {key:"availableCount" as const,n:counters.available,icon:CheckCircle2,kind:"available"},
  {key:"occupiedCount" as const,n:counters.occupied,icon:UsersRound,kind:"occupied"},
  {key:"cleaningCount" as const,n:counters.cleaning,icon:Waves,kind:"cleaning"}
 ];
 return <div className="floor-board-wrap floor21-board">
  <section className="floor-stats floor21-stats" aria-label={f21(locale,"overview")}>
    {metrics.map(({key,n,icon:Icon,kind})=><button key={key} type="button"
      className={"floor-stat floor21-stat"+(status===kind?" is-selected":"")}
      aria-pressed={status===kind} onClick={()=>{setQuick("all");setStatus(kind);}}>
      <span><Icon size={18}/>{f4(locale,key)}</span>
      <strong>{new Intl.NumberFormat(locale).format(n)}</strong></button>)}
    <button type="button" className="floor-stat floor21-stat" onClick={()=>{
      setStatus("all");setQuick("attention");setWaiter("");}}>
     <span><AlertCircle size={18}/>{f21(locale,"attention")}</span>
     <strong>{new Intl.NumberFormat(locale).format(counters.attention)}</strong>
    </button>
    <div className="floor-stat floor21-stat floor21-stat-muted"><span><UsersRound size={18}/>{f21(locale,"seatedGuests")}</span>
     <strong>{new Intl.NumberFormat(locale).format(counters.guests)}</strong></div>
  </section>
  <div className="floor21-capacity-strip">
   <div><strong>{counters.freeSeats}</strong><span>{f21(locale,"freeSeats")}</span></div>
   <div><strong>{counters.unassigned}</strong><span>{f21(locale,"unassigned")}</span></div>
   <div><strong>{counters.sections}</strong><span>{f21(locale,"activeSections")}</span></div>
   <p><ShieldCheck size={16}/>{f21(locale,"liveHelp")}</p>
  </div>
  {canManage&&counters.unassigned>0&&<div className="floor21-attention-note">
   <UserRoundX size={20}/><div><strong>{f21(locale,"unassignedWarning")}</strong>
    <p>{counters.unassigned} {f21(locale,"unassigned")}</p></div>
   <Link className="button button-small" href="/app/tables/manage">{f21(locale,"manageFloor")}<ArrowRight size={15}/></Link>
  </div>}
  <section className="settings-card floor-board-panel">
    <div className="section-heading"><div><h2>{f21(locale,"liveFloor")}</h2>
      <p className="muted">{f4(locale,"floorHelp")}</p></div>
      <span className="data-badge active"><span className="floor21-live-dot"/>{f21(locale,"statusLive")}</span></div>
    <div className="floor21-quick" role="group" aria-label={f21(locale,"quickActions")}>
     {quickOptions.map(({key,text})=><button type="button" key={key}
       aria-pressed={quick===key} className={"floor21-quick-chip"+(quick===key?" selected":"")}
       onClick={()=>setQuick(key)}>{text}</button>)}
    </div>
    <div className="floor-filters floor21-filters">
      <label className="menu-search"><Search size={18} aria-hidden="true"/>
       <input type="search" aria-label={f21(locale,"searchPlaceholder")}
         placeholder={f21(locale,"searchPlaceholder")} value={query} onChange={e=>setQuery(e.target.value)}/></label>
      <select value={section} aria-label={f21(locale,"sectionFilter")} onChange={e=>setSection(e.target.value)}>
       <option value="">{f21(locale,"allSections")}</option>
       {data.sections.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select>
      <select value={waiter} aria-label={f21(locale,"waiterFilter")} onChange={e=>setWaiter(e.target.value)}>
       <option value="">{f21(locale,"allWaiters")}</option>
       <option value="unassigned">{f21(locale,"onlyUnassigned")}</option>
       {availableWaiters.map(([id,name])=><option key={id} value={id}>{name}</option>)}</select>
      <button type="button" className="button button-small floor21-reset" disabled={!hasFilters}
       onClick={reset}><RefreshCcw size={15}/>{f21(locale,"clearFilters")}</button>
    </div>
    <div className="floor-status-filters" role="group" aria-label={f4(locale,"status")}>
      <button className={status==="all"?"floor-chip selected":"floor-chip"} aria-pressed={status==="all"}
       onClick={()=>setStatus("all")} type="button">{f4(locale,"all")} <b>{tableCount}</b></button>
      {statuses.map(key=><button key={key} type="button" onClick={()=>setStatus(key)}
        aria-pressed={status===key} className={"floor-chip "+key+(status===key?" selected":"")}>
        {f4(locale,key)} <b>{counters[key]}</b></button>)}
    </div>
    <div className="floor21-results" aria-live="polite">
     <span>{f21(locale,"matching")}: <strong>{new Intl.NumberFormat(locale).format(visible.length)}</strong>
      {" / "}{new Intl.NumberFormat(locale).format(tableCount)}</span>
     {hasFilters&&<button type="button" className="text-link" onClick={reset}>{f21(locale,"clearFilters")}</button>}
    </div>
    {!data.sections.length?<div className="empty-panel floor21-empty"><Layers3 size={32}/>
      <h3>{f21(locale,"noSections")}</h3>
      {canManage&&<Link className="button button-primary" href="/app/tables/manage">{f21(locale,"setupFloor")}</Link>}
     </div>:!tableCount?<div className="empty-panel floor21-empty"><UtensilsCrossed size={32}/><h3>{f21(locale,"noTables")}</h3>
      {canManage&&<Link className="button button-primary" href="/app/tables/manage">{f21(locale,"manageFloor")}</Link>}
     </div>:visible.length===0?<div className="empty-panel floor21-empty"><ListFilter size={30}/>
       <h3>{f21(locale,"noMatches")}</h3><button type="button" className="button" onClick={reset}>{f21(locale,"clearFilters")}</button>
     </div>:<div className="floor-groups">{data.sections.filter(s=>visible.some(t=>t.sectionId===s.id)).map(s=>{
      const inside=visible.filter(t=>t.sectionId===s.id);
      return <section className="floor-section" key={s.id}>
       <div className="floor-section-head"><h3><Layers3 size={18}/>{s.name}
        {!s.active&&<span className="floor21-inactive">{f4(locale,"disabled")}</span>}</h3>
        <span className="muted">{inside.length} {f4(locale,"tables")}</span></div>
       <div className="floor-grid">{inside.map(t=><button key={t.id} type="button"
         aria-label={f21(locale,"tableSelected")+" "+t.label+" · "+label(locale,t)}
         className={"floor-table-card floor21-table-card "+t.status} onClick={()=>onChoose(t)}>
         <div className="floor-card-top"><span className="floor-table-icon"><UtensilsCrossed size={20}/></span>
          <span className={"floor-state-tag "+t.status}>{f4(locale,t.status)}</span></div>
         <strong>{t.label}</strong>
         <div className="floor-card-capacity"><UsersRound size={15}/>
          {t.visitPartySize??t.seats} {f4(locale,t.visitId?"partySize":"seats")}</div>
         <div className="floor-card-bottom"><span title={t.assignedWaiterName??f4(locale,"unassigned")}>
          {t.assignedWaiterName??f4(locale,"unassigned")}</span>
          {t.visitId?<small title={t.visitOpenedAt??undefined}><Clock3 size={13}/>{elapsed(t.visitOpenedAt,locale)}</small>:
           <small><DoorOpen size={13}/>{f4(locale,t.status)}</small>}</div>
         {!t.assignedWaiterId&&t.status==="available"&&<span className="floor21-card-warning">
          <AlertCircle size={13}/>{f21(locale,"statusUnassigned")}</span>}
       </button>)}</div>
      </section>})}</div>}
    <div className="floor-footnote">{f21(locale,"noReservations")}</div>
  </section>
  <div className="floor21-quick-links" aria-label={f21(locale,"quickActions")}>
   <Link href="/app/orders/live"><ClipboardList size={17}/>{f21(locale,"floorOrders")}<ArrowRight size={16}/></Link>
   <Link href="/app/service/requests"><AlertCircle size={17}/>{f21(locale,"floorRequests")}<ArrowRight size={16}/></Link>
   {canManage&&<><Link href="/app/billing/checks"><ReceiptText size={17}/>{f21(locale,"floorBilling")}<ArrowRight size={16}/></Link>
    <Link href="/app/tables/qr"><QrCode size={17}/>{f21(locale,"printQR")}<ArrowRight size={16}/></Link></>}
  </div>
 </div>;
}
export function FloorDetails({table,locale,role,actorId,busy,onSeat,onFinish,onReady,onEdit,onClose}:{
 table:DiningTable;locale:Locale;role:"owner"|"manager"|"waiter";actorId:string;busy:boolean;
 onSeat:()=>void;onFinish:()=>void;onReady:()=>void;onEdit:()=>void;onClose:()=>void;
}){
 const manager=role!=="waiter",assigned=table.assignedWaiterId===actorId;
 const mayAct=manager||assigned;
 const dialogRef=useDialogFocus<HTMLElement>(true,()=>{if(!busy)onClose();});
 return <div className="dialog-backdrop floor-modal-backdrop" role="presentation"
   onMouseDown={e=>{if(e.target===e.currentTarget&&!busy)onClose();}}>
  <section ref={dialogRef} tabIndex={-1} className="floor-detail-dialog floor21-detail"
    role="dialog" aria-modal="true" aria-labelledby="floor-detail-title">
    <div className="floor-dialog-head"><div><div className="eyebrow">{f4(locale,"table")}</div>
     <h2 id="floor-detail-title">{table.label}</h2><p className="muted">{table.sectionName}</p></div>
      <button type="button" className="icon-action" aria-label={f4(locale,"close")} disabled={busy}
       onClick={onClose}><X size={21}/></button></div>
    <span className={"floor-state-tag "+table.status}>{f4(locale,table.status)}</span>
    <dl className="floor-detail-list">
      <div><dt>{f4(locale,"section")}</dt><dd>{table.sectionName}</dd></div>
      <div><dt>{f21(locale,"tableCapacity")}</dt><dd>{table.seats}</dd></div>
      <div><dt>{f21(locale,"onDuty")}</dt><dd>{table.assignedWaiterName??f4(locale,"unassigned")}</dd></div>
      {table.visitId&&<><div><dt>{f21(locale,"activeVisit")}</dt><dd>{table.visitId.slice(0,8)}</dd></div>
        <div><dt>{f21(locale,"currentParty")}</dt><dd>{table.visitPartySize}</dd></div>
        <div><dt>{f4(locale,"startTime")}</dt><dd>{table.visitOpenedAt?new Date(table.visitOpenedAt).toLocaleString(locale):"—"}</dd></div>
        <div><dt>{f21(locale,"visitDuration")}</dt><dd>{elapsed(table.visitOpenedAt,locale)}</dd></div></>}
      {table.notes&&<div><dt>{f4(locale,"notes")}</dt><dd>{table.notes}</dd></div>}
    </dl>
    <div className="floor-action-stack">
      {manager&&<button type="button" className="button" disabled={busy} onClick={onEdit}>
       <UsersRound size={17}/>{f21(locale,"editDetails")}</button>}
      {table.status==="available"&&mayAct&&<button type="button" className="button button-primary"
        disabled={busy||!table.assignedWaiterId} onClick={onSeat}>
        <DoorOpen size={18}/>{f4(locale,"openVisit")}</button>}
      {table.status==="occupied"&&manager&&<button type="button" className="button button-primary"
        disabled={busy} onClick={onFinish}><Clock3 size={18}/>{f4(locale,"finish")}</button>}
      {table.status==="cleaning"&&mayAct&&<button type="button" className="button button-primary"
        disabled={busy} onClick={onReady}><CheckCircle2 size={18}/>{f4(locale,"markReady")}</button>}
      {table.status==="available"&&!table.assignedWaiterId&&<p className="floor-hint">{f21(locale,"cannotSeat")}</p>}
      {!mayAct&&<p className="floor-hint">{f4(locale,"assignedOnly")}</p>}
      {table.status==="disabled"&&<p className="floor-hint">{f4(locale,"disabledHint")}</p>}
      {table.status==="occupied"&&!manager&&<p className="floor-hint">{f4(locale,"endOwnerOnly")}</p>}
      {table.status==="occupied"&&manager&&<p className="floor-hint">{f21(locale,"finishWarn")}</p>}
      {table.status==="cleaning"&&<p className="p21-cleaning-tip">{f21(locale,"cleaningTip")}</p>}
    </div>
    <div className="floor21-detail-links">
      <Link className="button button-small" href="/app/orders/live"><ClipboardList size={17}/>{f21(locale,"floorOrders")}</Link>
      {manager&&<Link className="button button-small" href="/app/billing/checks">
       <ReceiptText size={17}/>{f21(locale,"floorBilling")}</Link>}
    </div>
    <button type="button" className="button floor-close" disabled={busy} onClick={onClose}>{f4(locale,"close")}</button>
  </section></div>;
}
