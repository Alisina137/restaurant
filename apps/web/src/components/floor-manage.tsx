"use client";
import {Archive,Check,Layers3,Plus,UsersRound,UtensilsCrossed} from "lucide-react";
import type {Locale} from "@dineflow/shared";
import {f4} from "@/lib/floor-copy";
import type {DiningTable,Page,Section,Waiter} from "@/lib/floor-types";
type Props={locale:Locale;sections:Page<Section>|null;tables:Page<DiningTable>|null;waiters:Waiter[];archived:boolean;
 busy:boolean;loading:boolean;sectionPage:number;tablePage:number;setSectionPage:(n:number)=>void;setTablePage:(n:number)=>void;
 setArchived:(v:boolean)=>void;addSection:()=>void;editSection:(v:Section)=>void;archiveSection:(v:Section)=>void;
 addTable:()=>void;editTable:(v:DiningTable)=>void;archiveTable:(v:DiningTable)=>void;};
export function FloorManage(props:Props){
 const {locale,sections,tables,waiters,archived,busy,loading,sectionPage,tablePage}=props;
 return <div className="floor-manage-grid">
  <section className="settings-card floor-manage-panel">
    <header className="section-heading"><div><h2>{f4(locale,"sections")}</h2>
      <p className="muted">{sections?.total??"—"}</p></div>
      <button className="button button-primary button-small" onClick={props.addSection}>
        <Plus size={17}/>{f4(locale,"addSection")}</button></header>
    <div className="floor-manage-list">
      {loading?<Skeleton/>:sections?.items.length?sections.items.map(s=>
        <div className="floor-manage-row" key={s.id}>
          <span className="floor-manage-icon"><Layers3 size={19}/></span>
          <div className="floor-manage-summary"><strong>{s.name}</strong>
            <small>{f4(locale,"displayOrder")}: {s.sortOrder}</small></div>
          <span className={"data-badge "+(s.active?"active":"disabled")}>{f4(locale,s.active?"active":"disabled")}</span>
          {!archived&&<div className="floor-manage-actions">
            <button className="button button-small" disabled={busy} onClick={()=>props.editSection(s)}>{f4(locale,"edit")}</button>
            <button className="icon-action danger-button" title={f4(locale,"archive")} aria-label={f4(locale,"archive")}
              disabled={busy} onClick={()=>props.archiveSection(s)}><Archive size={17}/></button></div>}
        </div>):<Empty icon={Layers3} title={f4(locale,"noSections")}/>}
    </div>
    <Pager locale={locale} total={sections?.total??0} page={sectionPage} setPage={props.setSectionPage}/>
  </section>
  <section className="settings-card floor-manage-panel">
    <header className="section-heading"><div><h2>{f4(locale,"tables")}</h2>
      <p className="muted">{tables?.total??"—"}</p></div>
      <button className="button button-primary button-small" onClick={props.addTable}
        disabled={!sections?.total&&!archived}><Plus size={17}/>{f4(locale,"addTable")}</button></header>
    <div className="floor-manage-list">
      {loading?<Skeleton/>:tables?.items.length?tables.items.map(t=>
        <div className="floor-manage-row" key={t.id}>
          <span className="floor-manage-icon"><UtensilsCrossed size={19}/></span>
          <div className="floor-manage-summary"><strong>{t.label}</strong>
            <small>{t.sectionName} · {t.seats} {f4(locale,"seats")}</small>
            <small>{t.assignedWaiterName??f4(locale,"unassigned")}</small></div>
          <span className={"floor-state-tag "+t.status}>{f4(locale,t.status)}</span>
          {!archived&&<div className="floor-manage-actions">
            <button className="button button-small" disabled={busy} onClick={()=>props.editTable(t)}>{f4(locale,"edit")}</button>
            <button className="icon-action danger-button" title={f4(locale,"archive")} aria-label={f4(locale,"archive")}
              disabled={busy} onClick={()=>props.archiveTable(t)}><Archive size={17}/></button></div>}
        </div>):<Empty icon={UtensilsCrossed} title={f4(locale,"empty")}/>}
    </div>
    <Pager locale={locale} total={tables?.total??0} page={tablePage} setPage={props.setTablePage}/>
  </section>
  <div className="floor-manage-footer">
    <button type="button" className="button" onClick={()=>{props.setArchived(!archived);props.setSectionPage(1);props.setTablePage(1);}}>
      <Archive size={18}/>{f4(locale,archived?"current":"archived")}</button>
    <span className="muted"><UsersRound size={15}/> {waiters.length} {f4(locale,"waiter")}</span>
  </div>
 </div>;
}
function Empty({icon:Icon,title}:{icon:typeof Layers3;title:string}){
 return <div className="empty-panel floor-empty"><Icon size={26}/><h3>{title}</h3></div>;
}
function Skeleton(){return <div className="list-skeleton"><span/><span/><span/></div>;}
function Pager({locale,page,total,setPage}:{locale:Locale;page:number;total:number;setPage:(n:number)=>void}){
 const pages=Math.max(1,Math.ceil(total/10));
 return <div className="pager">
  <button type="button" className="button button-small" disabled={page<=1} onClick={()=>setPage(page-1)}>{f4(locale,"previous")}</button>
  <span>{f4(locale,"page")} {page} {f4(locale,"of")} {pages}</span>
  <button type="button" className="button button-small" disabled={page>=pages} onClick={()=>setPage(page+1)}>{f4(locale,"next")}</button>
 </div>;
}
