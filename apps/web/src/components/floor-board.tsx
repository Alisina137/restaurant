"use client";
import {useEffect,useMemo,useState} from "react";
import {CalendarClock,CheckCircle2,Clock3,DoorOpen,Layers3,Search,UsersRound,UtensilsCrossed,Waves} from "lucide-react";
import type {Locale} from "@dineflow/shared";
import {f4} from "@/lib/floor-copy";
import {elapsed,type DiningTable,type FloorBoard,type FloorStatus} from "@/lib/floor-types";
type Props={data:FloorBoard;locale:Locale;onChoose:(table:DiningTable)=>void};
const statusKeys:FloorStatus[]=["available","occupied","cleaning","disabled"];
export function FloorBoardGrid({data,locale,onChoose}:Props){
 const [query,setQuery]=useState(""),[status,setStatus]=useState("all"),[section,setSection]=useState("");
 const [now,setNow]=useState(0);
 useEffect(()=>{const timer=setInterval(()=>setNow(n=>n+1),60000);return()=>clearInterval(timer);},[]);
 const visible=useMemo(()=>data.tables.filter(t=>
  (!section||t.sectionId===section)&&(status==="all"||t.status===status)&&
  (!query||[t.label,t.sectionName,t.assignedWaiterName??""].some(v=>v.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())))),
  [data,query,status,section]);
 const count=(key:FloorStatus)=>data.tables.filter(t=>t.status===key).length;
 return <div className="floor-board-wrap">
  <section className="floor-stats">
    <div className="floor-stat"><span><UtensilsCrossed size={18}/>{f4(locale,"tableCount")}</span><strong>{data.tables.length}</strong></div>
    <div className="floor-stat"><span><CheckCircle2 size={18}/>{f4(locale,"availableCount")}</span><strong>{count("available")}</strong></div>
    <div className="floor-stat"><span><UsersRound size={18}/>{f4(locale,"occupiedCount")}</span><strong>{count("occupied")}</strong></div>
    <div className="floor-stat"><span><Waves size={18}/>{f4(locale,"cleaningCount")}</span><strong>{count("cleaning")}</strong></div>
  </section>
  <section className="settings-card floor-board-panel">
    <div className="section-heading"><div><h2>{f4(locale,"board")}</h2><p className="muted">{f4(locale,"floorHelp")}</p></div>
      <span className="data-badge active">{f4(locale,"live")}</span></div>
    <div className="floor-filters">
      <label className="menu-search"><Search size={18}/><input aria-label={f4(locale,"search")}
        placeholder={f4(locale,"search")} value={query} onChange={e=>setQuery(e.target.value)}/></label>
      <select value={section} aria-label={f4(locale,"section")} onChange={e=>setSection(e.target.value)}>
        <option value="">{f4(locale,"filterSection")}</option>
        {data.sections.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select>
    </div>
    <div className="floor-status-filters" role="group" aria-label={f4(locale,"status")}>
      <button className={status==="all"?"floor-chip selected":"floor-chip"} onClick={()=>setStatus("all")} type="button">
        {f4(locale,"all")} <b>{data.tables.length}</b></button>
      {statusKeys.map(key=><button key={key} type="button" onClick={()=>setStatus(key)}
        className={"floor-chip "+key+(status===key?" selected":"")}>{f4(locale,key)} <b>{count(key)}</b></button>)}
    </div>
    {data.sections.length===0?<div className="empty-panel"><Layers3 size={32}/><h3>{f4(locale,"noSections")}</h3></div>:
      visible.length===0?<div className="empty-panel"><UtensilsCrossed size={30}/><h3>{f4(locale,"noMatches")}</h3></div>:
      <div className="floor-groups">{data.sections.filter(s=>visible.some(t=>t.sectionId===s.id)).map(s=>
        <section className="floor-section" key={s.id}>
          <div className="floor-section-head"><h3><Layers3 size={18}/>{s.name}</h3>
            <span className="muted">{visible.filter(t=>t.sectionId===s.id).length} {f4(locale,"tables")}</span></div>
          <div className="floor-grid">{visible.filter(t=>t.sectionId===s.id).map(t=>
            <button key={t.id} type="button" className={"floor-table-card "+t.status} onClick={()=>onChoose(t)}>
              <div className="floor-card-top"><span className="floor-table-icon"><UtensilsCrossed size={20}/></span>
                <span className={"floor-state-tag "+t.status}>{f4(locale,t.status)}</span></div>
              <strong>{t.label}</strong>
              <div className="floor-card-capacity"><UsersRound size={15}/> {t.visitPartySize??t.seats} {f4(locale,t.visitId?"partySize":"seats")}</div>
              <div className="floor-card-bottom"><span>{t.assignedWaiterName??f4(locale,"unassigned")}</span>
                {t.visitId?<small title={t.visitOpenedAt??undefined}><Clock3 size={13}/>{elapsed(t.visitOpenedAt,locale)}</small>:
                 <small><DoorOpen size={13}/>{f4(locale,t.status)}</small>}</div>
            </button>)}</div>
        </section>)}</div>}
    <div className="floor-footnote">{f4(locale,"statusHelp")}</div>
  </section></div>;
}
export function FloorDetails({table,locale,role,actorId,busy,onSeat,onFinish,onReady,onEdit,onClose}:{
 table:DiningTable;locale:Locale;role:"owner"|"manager"|"waiter";actorId:string;busy:boolean;
 onSeat:()=>void;onFinish:()=>void;onReady:()=>void;onEdit:()=>void;onClose:()=>void;
}){
 const manager=role!=="waiter",assigned=table.assignedWaiterId===actorId;
 const mayAct=manager||assigned;
 return <div className="dialog-backdrop floor-modal-backdrop" role="presentation" onMouseDown={e=>{if(e.target===e.currentTarget)onClose();}}>
  <section className="floor-detail-dialog" role="dialog" aria-modal="true" aria-labelledby="floor-detail-title">
    <div className="floor-dialog-head"><div><div className="eyebrow">{f4(locale,"table")}</div><h2 id="floor-detail-title">{table.label}</h2></div>
      <button type="button" className="icon-action" aria-label={f4(locale,"close")} onClick={onClose}>✕</button></div>
    <span className={"floor-state-tag "+table.status}>{f4(locale,table.status)}</span>
    <dl className="floor-detail-list">
      <div><dt>{f4(locale,"section")}</dt><dd>{table.sectionName}</dd></div>
      <div><dt>{f4(locale,"seats")}</dt><dd>{table.seats}</dd></div>
      <div><dt>{f4(locale,"assigned")}</dt><dd>{table.assignedWaiterName??f4(locale,"unassigned")}</dd></div>
      {table.visitId&&<><div><dt>{f4(locale,"visit")}</dt><dd>{table.visitId.slice(0,8)}</dd></div>
        <div><dt>{f4(locale,"partySize")}</dt><dd>{table.visitPartySize}</dd></div>
        <div><dt>{f4(locale,"startTime")}</dt><dd>{table.visitOpenedAt?new Date(table.visitOpenedAt).toLocaleString(locale):"—"}</dd></div></>}
    </dl>
    <div className="floor-action-stack">
      {manager&&<button type="button" className="button" onClick={onEdit}>{f4(locale,"editTable")}</button>}
      {table.status==="available"&&mayAct&&<button type="button" className="button button-primary" disabled={busy||!table.assignedWaiterId}
        onClick={onSeat}><DoorOpen size={18}/>{f4(locale,"openVisit")}</button>}
      {table.status==="occupied"&&manager&&<button className="button button-primary" disabled={busy} onClick={onFinish}>
        <CalendarClock size={18}/>{f4(locale,"finish")}</button>}
      {table.status==="cleaning"&&mayAct&&<button className="button button-primary" disabled={busy} onClick={onReady}>
        <CheckCircle2 size={18}/>{f4(locale,"markReady")}</button>}
      {table.status==="available"&&!table.assignedWaiterId&&<p className="floor-hint">{f4(locale,"waiterRequired")}</p>}
      {!mayAct&&<p className="floor-hint">{f4(locale,"assignedOnly")}</p>}
      {table.status==="disabled"&&<p className="floor-hint">{f4(locale,"disabledHint")}</p>}
      {table.status==="occupied"&&!manager&&<p className="floor-hint">{f4(locale,"endOwnerOnly")}</p>}
    </div>
    <button type="button" className="button floor-close" onClick={onClose}>{f4(locale,"close")}</button>
  </section></div>;
}
