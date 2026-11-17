"use client";
import {type FormEvent,useEffect,useState} from "react";
import {Archive,ArrowRight,Layers3,Plus,RotateCcw,Search,UsersRound,UtensilsCrossed,AlertCircle} from "lucide-react";
import type {Locale} from "@dineflow/shared";
import {f4} from "@/lib/floor-copy";
import {f21} from "@/lib/floor21-copy";
import {PageControls} from "./ui/interaction-controls";
import {EmptyState,LoadingSkeleton} from "./ui/design-system";
import type {DiningTable,Page,Section,Waiter} from "@/lib/floor-types";
export type TableDirectoryFilters={query:string;section:string;status:string;waiter:string};
type Props={locale:Locale;sections:Page<Section>|null;tables:Page<DiningTable>|null;waiters:Waiter[];
 allSections:Section[];archived:boolean;busy:boolean;loading:boolean;
 sectionPage:number;tablePage:number;setSectionPage:(n:number)=>void;setTablePage:(n:number)=>void;
 sectionQuery:string;setSectionQuery:(s:string)=>void;
 tableFilters:TableDirectoryFilters;setTableFilters:(v:TableDirectoryFilters)=>void;
 setArchived:(v:boolean)=>void;addSection:()=>void;editSection:(v:Section)=>void;archiveSection:(v:Section)=>void;
 addTable:()=>void;editTable:(v:DiningTable)=>void;archiveTable:(v:DiningTable)=>void;};
export function FloorManage(props:Props){
 const {locale,sections,tables,waiters,allSections,archived,busy,loading,sectionPage,tablePage}=props;
 const [sectionText,setSectionText]=useState(props.sectionQuery);
 const [tableText,setTableText]=useState(props.tableFilters.query);
 useEffect(()=>setSectionText(props.sectionQuery),[props.sectionQuery]);
 useEffect(()=>setTableText(props.tableFilters.query),[props.tableFilters.query]);
 const hasActiveSection=allSections.some(s=>s.active);
 function applySection(e:FormEvent){e.preventDefault();props.setSectionPage(1);props.setSectionQuery(sectionText.trim());}
 function applyTable(e:FormEvent){e.preventDefault();props.setTablePage(1);
  props.setTableFilters({...props.tableFilters,query:tableText.trim()});}
 function updateTable(key:keyof TableDirectoryFilters,value:string){
  props.setTablePage(1);props.setTableFilters({...props.tableFilters,[key]:value});
 }
 function resetTable(){setTableText("");props.setTablePage(1);
  props.setTableFilters({query:"",section:"",status:"all",waiter:""});}
 const tableFiltered=!!tableText||!!props.tableFilters.query||!!props.tableFilters.section||
  props.tableFilters.status!=="all"||!!props.tableFilters.waiter;
 return <div className="floor-manage-grid floor21-manage">
  <div className="floor21-manage-intro">
   <div><h2>{f21(locale,"manageFloor")}</h2><p>{f21(locale,"managerOnly")}</p></div>
   <div className="floor21-manage-stats">
    <span><Layers3 size={16}/>{allSections.length} {f21(locale,"sectionCount")}</span>
    <span><UsersRound size={16}/>{waiters.length} {f21(locale,"waiterCount")}</span>
   </div>
  </div>
  {archived&&<div className="floor21-archive-info"><Archive size={19}/>{f21(locale,"archivedExplain")}</div>}
  <section className="settings-card floor-manage-panel">
    <header className="section-heading"><div><h2>{f4(locale,"sections")}</h2>
      <p className="muted">{f21(locale,"sectionHelp")}</p></div>
      {!archived&&<button type="button" className="button button-primary button-small"
         disabled={busy} onClick={props.addSection}><Plus size={17}/>{f4(locale,"addSection")}</button>}</header>
    <form className="floor21-dir-toolbar" onSubmit={applySection}>
      <label className="menu-search"><Search size={17}/><input type="search"
       aria-label={f21(locale,"sectionSearch")} placeholder={f21(locale,"sectionSearch")}
       value={sectionText} onChange={e=>setSectionText(e.target.value)}/></label>
      <button type="submit" className="button button-small"><Search size={15}/>{f21(locale,"searchApply")}</button>
      <button type="button" className="button button-small" disabled={!sectionText&&!props.sectionQuery}
       onClick={()=>{setSectionText("");props.setSectionQuery("");props.setSectionPage(1);}}>
       <RotateCcw size={15}/>{f21(locale,"clearFilters")}</button>
    </form>
    <div className="floor21-dir-count">{sections?.total??"—"} {f21(locale,"sectionCount")}</div>
    <div className="floor-manage-list">
      {loading?<LoadingSkeleton rows={3} label={f4(locale,"loading")}/>:sections?.items.length?sections.items.map(s=>
        <article className="floor-manage-row floor21-dir-row" key={s.id}>
          <span className="floor-manage-icon"><Layers3 size={19}/></span>
          <div className="floor-manage-summary"><strong>{s.name}</strong>
            <small>{f21(locale,"sortOrder")}: {s.sortOrder}</small></div>
          <span className={"data-badge "+(s.active?"active":"disabled")}>{f4(locale,s.active?"active":"disabled")}</span>
          {!archived&&<div className="floor-manage-actions">
            <button type="button" className="button button-small" disabled={busy}
             onClick={()=>props.editSection(s)}>{f4(locale,"edit")}</button>
            <button type="button" className="icon-action danger-button" title={f4(locale,"archive")}
             aria-label={f4(locale,"archive")+" "+s.name} disabled={busy}
             onClick={()=>props.archiveSection(s)}><Archive size={17}/></button></div>}
        </article>):<Empty icon={Layers3} title={props.sectionQuery?f21(locale,"noFilterResults"):f21(locale,"noSections")}/>}
    </div>
    <Pager locale={locale} total={sections?.total??0} page={sectionPage} setPage={props.setSectionPage} busy={loading}/>
  </section>
  <section className="settings-card floor-manage-panel floor21-manage-tables">
    <header className="section-heading"><div><h2>{f4(locale,"tables")}</h2>
      <p className="muted">{f21(locale,"tableHelp")}</p></div>
      {!archived&&<button type="button" className="button button-primary button-small" onClick={props.addTable}
        disabled={!hasActiveSection||busy}><Plus size={17}/>{f4(locale,"addTable")}</button>}</header>
    {!archived&&!hasActiveSection&&<div className="floor21-inline-warning"><AlertCircle size={17}/>
      {f21(locale,"createFirstSection")}</div>}
    <form className="floor21-dir-toolbar floor21-table-filters" onSubmit={applyTable}>
      <label className="menu-search"><Search size={17}/><input type="search"
       aria-label={f21(locale,"tableSearch")} placeholder={f21(locale,"tableSearch")}
       value={tableText} onChange={e=>setTableText(e.target.value)}/></label>
      <select value={props.tableFilters.section} aria-label={f21(locale,"sectionFilter")}
       onChange={e=>updateTable("section",e.target.value)}>
       <option value="">{f21(locale,"allSections")}</option>
       {allSections.map(s=><option value={s.id} key={s.id}>{s.name}</option>)}</select>
      {!archived&&<select value={props.tableFilters.status} aria-label={f21(locale,"statusFilter")}
       onChange={e=>updateTable("status",e.target.value)}>
       <option value="all">{f4(locale,"all")}</option>
       {(["available","occupied","cleaning","disabled"] as const).map(status=>
         <option value={status} key={status}>{f4(locale,status)}</option>)}</select>}
      <select value={props.tableFilters.waiter} aria-label={f21(locale,"waiterFilterManage")}
       onChange={e=>updateTable("waiter",e.target.value)}>
       <option value="">{f21(locale,"allWaiters")}</option>
       <option value="unassigned">{f21(locale,"onlyUnassigned")}</option>
       {waiters.map(w=><option value={w.id} key={w.id}>{w.name}</option>)}</select>
      <button type="submit" className="button button-small"><Search size={15}/>{f21(locale,"searchApply")}</button>
      <button type="button" className="button button-small" disabled={!tableFiltered}
       onClick={resetTable}><RotateCcw size={15}/>{f21(locale,"clearFilters")}</button>
    </form>
    <div className="floor21-dir-count">{tables?.total??"—"} {f21(locale,"tableCount")}</div>
    <div className="floor-manage-list">
      {loading?<LoadingSkeleton rows={3} label={f4(locale,"loading")}/>:tables?.items.length?tables.items.map(t=>
        <article className="floor-manage-row floor21-dir-row" key={t.id}>
          <span className="floor-manage-icon"><UtensilsCrossed size={19}/></span>
          <div className="floor-manage-summary"><strong>{t.label}</strong>
            <small>{t.sectionName} · {t.seats} {f4(locale,"seats")}</small>
            <small>{t.assignedWaiterName??f4(locale,"unassigned")}</small></div>
          <span className={"floor-state-tag "+t.status}>{f4(locale,t.status)}</span>
          {!archived&&<div className="floor-manage-actions">
            <button type="button" className="button button-small" disabled={busy}
             onClick={()=>props.editTable(t)}>{f4(locale,"edit")}</button>
            <button type="button" className="icon-action danger-button" title={f4(locale,"archive")}
             aria-label={f4(locale,"archive")+" "+t.label} disabled={busy||t.status==="occupied"}
             onClick={()=>props.archiveTable(t)}><Archive size={17}/></button></div>}
        </article>):<Empty icon={UtensilsCrossed}
          title={tableFiltered?f21(locale,"noFilterResults"):f4(locale,"empty")}/>}
    </div>
    <Pager locale={locale} total={tables?.total??0} page={tablePage} setPage={props.setTablePage} busy={loading}/>
  </section>
  <div className="floor-manage-footer floor21-manage-footer">
    <button type="button" className="button" disabled={busy} onClick={()=>{
      props.setArchived(!archived);props.setSectionPage(1);props.setTablePage(1);
      props.setSectionQuery("");props.setTableFilters({query:"",section:"",status:"all",waiter:""});
      setSectionText("");setTableText("");
    }}><Archive size={18}/>{f21(locale,archived?"currentView":"archiveView")}</button>
    <span className="muted"><UsersRound size={15}/>{waiters.length} {f4(locale,"waiter")}</span>
    <span className="muted">{f21(locale,"managerOnly")}</span>
  </div>
 </div>;
}
function Empty({icon:Icon,title}:{icon:typeof Layers3;title:string}){
 return <EmptyState icon={<Icon size={26}/>} title={title} className="floor-empty"/>;
}
function Pager({locale,page,total,setPage,busy}:{locale:Locale;page:number;total:number;setPage:(n:number)=>void;busy:boolean}){
 return <PageControls page={page} total={total} perPage={10} onPageChange={setPage}
  previousLabel={f4(locale,"previous")} nextLabel={f4(locale,"next")}
  pageLabel={f4(locale,"page")} ofLabel={f4(locale,"of")} busy={busy}/>;
}
