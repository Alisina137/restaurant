"use client";
import { type FormEvent, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Archive, ArrowUpRight, Check, ChefHat, CirclePlus, ClipboardList, Copy,
  ImageOff, Layers3, ListFilter, PackageCheck, RefreshCcw, Search, SlidersHorizontal, Tag, Eye, EyeOff, RotateCcw,
  UtensilsCrossed, X } from "lucide-react";
import { type Locale } from "@dineflow/shared";
import { useWorkspace } from "@/components/workspace-provider";
import { API_URL } from "@/lib/auth-client";
import { jsonRequest, Phase2Error } from "@/lib/phase2-api";
import { m3 } from "@/lib/menu-copy";
import { m20 } from "@/lib/menu20-copy";
import {menuRuntimeError} from "@/lib/menu-runtime-copy";
import {MenuHealth,type MenuSummary} from "./menu-health";
import { money, nameFor, type Category, type Catalog, type EditorData, type Group, type ItemDetail,
  type ItemRow, type Page } from "@/lib/menu-types";
import { CategoryEditor, GroupEditor, ItemEditor } from "./menu-editors";
import {useInteraction} from "./ui/interaction-provider";
import {InlineFeedback,SearchInput,PageControls,FilterSelect} from "./ui/interaction-controls";
import {LoadingSkeleton} from "./ui/design-system";
import {ux} from "@/lib/interaction-copy";
import {useDialogFocus} from "./ui/use-dialog-focus";

export type MenuTab="items"|"categories"|"modifiers"|"availability";
const tabs=[{key:"items",icon:UtensilsCrossed},{key:"categories",icon:Layers3},
  {key:"modifiers",icon:SlidersHorizontal},{key:"availability",icon:PackageCheck}] as const;
type Popup={kind:"item";value?:ItemDetail}|{kind:"category";value?:Category}|{kind:"group";value?:Group};
const noData:EditorData={categories:[],groups:[],revision:{version:0}};
function apiError(e:unknown,locale:Locale){
  if(e instanceof Phase2Error){
    const helpful=menuRuntimeError(locale,e.code);
    if(helpful)return helpful;
  }
  if(e instanceof Phase2Error&&e.code==="VERSION_CONFLICT")return m3(locale,"versionConflict");
  if(e instanceof Phase2Error&&e.code==="DUPLICATE_SKU")return m3(locale,"duplicateSku");
  if(e instanceof Phase2Error&&e.code==="CATEGORY_UNPUBLISHED")return m20(locale,"missingCategory");
  if(e instanceof Phase2Error&&e.code==="CATEGORY_IN_USE")return m20(locale,"categoryInUse");
  if(e instanceof Phase2Error&&e.code==="INVALID_MODIFIER")return m20(locale,"modifierInvalid");
  return e instanceof Error?e.message:m3(locale,"error");
}
export function MenuConsole({tab}: {tab:MenuTab}){
  const {workspace}=useWorkspace(),locale=workspace.locale;
  const {confirm,notify}=useInteraction();
  const [editor,setEditor]=useState<EditorData>(noData);
  const [summary,setSummary]=useState<MenuSummary|null>(null);
  const [rows,setRows]=useState<Page<ItemRow>|null>(null),
    [cats,setCats]=useState<Page<Category>|null>(null),[groups,setGroups]=useState<Page<Group>|null>(null);
  const [page,setPage]=useState(1),[queryInput,setQueryInput]=useState(""),[query,setQuery]=useState(""),
    [status,setStatus]=useState("all"),[category,setCategory]=useState(""),[archived,setArchived]=useState(false);
  const [loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[loadingEditor,setLoadingEditor]=useState(false);
  const [error,setError]=useState(""),[notice,setNotice]=useState("");
  const [popup,setPopup]=useState<Popup|null>(null),[preview,setPreview]=useState<Catalog|null>(null),[previewOpen,setPreviewOpen]=useState(false),[previewError,setPreviewError]=useState("");
  const [selected,setSelected]=useState<string[]>([]),[reason,setReason]=useState("");
  const revision=useRef<number>(0);
  const requestId=useRef(0);
  const mutationLock=useRef(false);
  const popupDialogRef=useDialogFocus<HTMLElement>(!!popup,()=>{if(!busy)setPopup(null);});
  const previewDialogRef=useDialogFocus<HTMLElement>(previewOpen,()=>setPreviewOpen(false));
  useEffect(()=>{if(notice){notify(notice,"success");setNotice("");}},[notice,notify]);
  const load=useCallback(async(silent=false)=>{
    const request=++requestId.current;
    if(!silent)setLoading(true);
    try{
      const path=tab==="categories"?"/api/menu/categories?page="+page+(archived?"&archive=1":""):
        tab==="modifiers"?"/api/menu/groups?page="+page+(archived?"&archive=1":""):
        "/api/menu/items?"+new URLSearchParams({page:String(page),
          status:tab==="availability"?"all":status,category,q:query,
          ...(archived&&tab==="items"?{archive:"1"}:{})}).toString();
      const [edit,counts,list]=await Promise.all([
        jsonRequest<EditorData>("/api/menu/editor"),
        jsonRequest<MenuSummary>("/api/menu/summary"),
        jsonRequest<Page<Category>|Page<Group>|Page<ItemRow>>(path)
      ]);
      if(request!==requestId.current)return;
      setEditor(edit);setSummary(counts);revision.current=edit.revision.version;
      if(tab==="categories")setCats(list as Page<Category>);
      else if(tab==="modifiers")setGroups(list as Page<Group>);
      else setRows(list as Page<ItemRow>);
      setError("");
    }catch(e){if(request===requestId.current)setError(apiError(e,locale));}
    finally{if(request===requestId.current)setLoading(false);}
  },[tab,page,query,status,category,archived,locale]);
  useEffect(()=>{void load();return()=>{requestId.current++;};},[load]);
  useEffect(()=>{
    if(typeof EventSource==="undefined")return;
    const sse=new EventSource(API_URL+"/api/menu/events",{withCredentials:true});
    const onChange=(event:MessageEvent<string>)=>{
      try{
        const eventData=JSON.parse(event.data) as {version:number};
        if(revision.current>0&&eventData.version>revision.current){revision.current=eventData.version;void load(true);}
        else revision.current=eventData.version;
      }catch{/* Ignore malformed notification; query has authoritative fallback. */}
    };
    sse.addEventListener("catalog",onChange as EventListener);
    const timer=setInterval(()=>{void load(true);},45000);
    return ()=>{sse.removeEventListener("catalog",onChange as EventListener);sse.close();clearInterval(timer);};
  },[load]);
  useEffect(()=>{setPage(1);setSelected([]);setPopup(null);setArchived(false);},[tab]);
  useEffect(()=>{setSelected([]);setReason("");},[page,query,status,category,archived,tab]);
  async function savePopup(payload:Record<string,unknown>){
    if(!popup||mutationLock.current)return;
    mutationLock.current=true;
    const kind=popup.kind;
    const plural=kind==="item"?"items":kind==="category"?"categories":"groups";
    const current=popup.value;
    const target=current?"/api/menu/"+plural+"/"+current.id:"/api/menu/"+plural;
    setBusy(true);setError("");setNotice("");
    try{
      await jsonRequest(target,{method:current?"PATCH":"POST",body:JSON.stringify(payload)});
      setPopup(null);setNotice(m3(locale,kind==="item"?"itemUpdated":kind==="category"?"categoryUpdated":"groupUpdated"));
      await load(true);
    }catch(e){setError(apiError(e,locale));}
    finally{mutationLock.current=false;setBusy(false);}
  }
  async function editItem(row:ItemRow){
    setLoadingEditor(true);setError("");
    try{
      const response=await jsonRequest<{item:ItemDetail}>("/api/menu/items/"+row.id);
      setPopup({kind:"item",value:response.item});
    }catch(e){setError(apiError(e,locale));}
    finally{setLoadingEditor(false);}
  }
  async function setItemPublished(row:ItemRow,published:boolean){
    if(mutationLock.current||busy)return;
    if(!(await confirm({title:m20(locale,published?"publishNow":"unpublishNow"),
      description:m20(locale,published?"itemPublishConfirm":"itemUnpublishConfirm"),
      confirmLabel:m20(locale,published?"publishNow":"unpublishNow"),
      cancelLabel:m3(locale,"cancel"),danger:!published})))return;
    if(mutationLock.current)return;
    mutationLock.current=true;setBusy(true);setError("");
    try{
      await jsonRequest("/api/menu/items/"+row.id+"/publication",{
        method:"PATCH",body:JSON.stringify({version:row.version,published})});
      setNotice(m20(locale,"publishedSuccess"));await load(true);
    }catch(e){await load(true);setError(apiError(e,locale));}
    finally{mutationLock.current=false;setBusy(false);}
  }
  async function setCategoryPublished(row:Category,published:boolean){
    if(mutationLock.current||busy)return;
    if(!(await confirm({title:m20(locale,published?"publishCategory":"unpublishCategory"),
      description:m20(locale,published?"categoryPublishConfirm":"categoryUnpublishConfirm"),
      confirmLabel:m20(locale,published?"publishCategory":"unpublishCategory"),
      cancelLabel:m3(locale,"cancel"),danger:!published})))return;
    if(mutationLock.current)return;
    mutationLock.current=true;setBusy(true);setError("");
    try{
      await jsonRequest("/api/menu/categories/"+row.id,{
        method:"PATCH",body:JSON.stringify({nameFa:row.nameFa,namePs:row.namePs,nameEn:row.nameEn,
        description:row.description,sortOrder:row.sortOrder,published,version:row.version})});
      setNotice(m20(locale,"publishedSuccess"));await load(true);
    }catch(e){await load(true);setError(apiError(e,locale));}
    finally{mutationLock.current=false;setBusy(false);}
  }
  async function archive(kind:"item"|"category"|"group",row:{id:string;version:number}){
    if(busy||mutationLock.current||!(await confirm({title:m3(locale,"archive"),description:m3(locale,"archiveConfirm"),
      confirmLabel:m3(locale,"archive"),cancelLabel:m3(locale,"cancel"),danger:true})))return;
    if(mutationLock.current)return;
    mutationLock.current=true;
    const plural=kind==="item"?"items":kind==="category"?"categories":"groups";
    setBusy(true);setError("");setNotice("");
    try{
      await jsonRequest("/api/menu/"+plural+"/"+row.id+"/archive",{method:"POST",body:JSON.stringify({version:row.version})});
      setNotice(m3(locale,kind==="item"?"itemArchived":kind==="category"?"categoryArchived":"groupArchived"));
      await load(true);
    }catch(e){setError(apiError(e,locale));}
    finally{mutationLock.current=false;setBusy(false);}
  }
  async function duplicate(row:ItemRow){
    if(mutationLock.current)return;
    mutationLock.current=true;setBusy(true);setError("");setNotice("");
    try{await jsonRequest("/api/menu/items/"+row.id+"/duplicate",{method:"POST",body:"{}"});
      setNotice(m3(locale,"duplicateDone"));setPage(1);await load(true);
    }catch(e){setError(apiError(e,locale));}finally{mutationLock.current=false;setBusy(false);}
  }
  async function availability(entries:ItemRow[],soldOut:boolean){
    if(!entries.length||mutationLock.current)return;
    if(!(await confirm({title:m20(locale,soldOut?"applySoldOut":"restoreStock"),
      description:m20(locale,soldOut?"confirmSoldOut":"confirmAvailable"),
      confirmLabel:m20(locale,soldOut?"applySoldOut":"restoreStock"),
      cancelLabel:m3(locale,"cancel"),danger:soldOut})))return;
    if(mutationLock.current)return;
    mutationLock.current=true;setBusy(true);setError("");setNotice("");
    try{
      await jsonRequest("/api/menu/items/availability/bulk",{method:"POST",
        body:JSON.stringify({changes:entries.map(x=>({id:x.id,version:x.version,soldOut,reason:soldOut?reason:""}))})});
      setSelected([]);setReason("");setNotice(m3(locale,"saved"));await load(true);
    }catch(e){setError(apiError(e,locale));await load(true);}finally{mutationLock.current=false;setBusy(false);}
  }
  async function openPreview(){
    if(previewOpen)return;
    setPreviewOpen(true);setPreview(null);setPreviewError("");
    try{setPreview(await jsonRequest<Catalog>("/api/menu/catalog"));}catch(e){setPreviewError(apiError(e,locale));}
  }
  const menuItems=rows?.items??[],availableRows=menuItems.filter(r=>!archived);
  const allChecked=availableRows.length>0&&availableRows.every(r=>selected.includes(r.id));
  const currentTitle=m3(locale,tab);
  const total=tab==="categories"?cats?.total??0:tab==="modifiers"?groups?.total??0:rows?.total??0;
  const tabsLabel=(name:string)=>name;
  return <div className="content-stack menu-shell">
    <div className="page-heading"><div><div className="eyebrow">DINEFLOW / {m3(locale,"menu")}</div>
      <h1>{m3(locale,"catalogue")}</h1><p>{m3(locale,"subtitle")}</p></div>
      <div className="menu-heading-actions"><button className="button" onClick={()=>void openPreview()}><ClipboardList size={18}/>{m3(locale,"menuPreview")}</button>
        <button className="button" type="button" onClick={()=>void load()} disabled={loading} aria-label={m3(locale,"refresh")}><RefreshCcw size={18}/></button></div>
    </div>
    <MenuHealth locale={locale} summary={summary} loading={loading} refresh={()=>void load()}/>
    <nav className="context-tabs menu-tabs" aria-label={m3(locale,"menu")}>{tabs.map(({key,icon:Icon})=>
      <Link key={key} className={"context-tab"+(tab===key?" current":"")} aria-current={tab===key?"page":undefined}
        href={"/app/menu/"+key}><Icon size={18}/>{m3(locale,key)}</Link>)}</nav>
    {error&&<InlineFeedback message={error} retry={()=>void load()} onRetryLabel={m3(locale,"retry")}/>}
    {tab==="items"&&<section className="settings-card menu-panel">
      <header className="section-heading"><div><h2>{m3(locale,"items")}</h2><p className="muted">{total} {m3(locale,"cardCount")}</p></div>
        <button className="button button-primary" disabled={loading||editor.categories.length===0}
          onClick={()=>setPopup({kind:"item"})}><CirclePlus size={18}/>{m3(locale,"newItem")}</button></header>
      <p className="p20-tab-help">{m20(locale,"filterHelp")}</p>
      {!editor.categories.length&&!loading&&<p className="menu-callout">{m3(locale,"categoryRequired")} <Link className="text-link"
        href="/app/menu/categories">{m3(locale,"newCategory")} <ArrowUpRight size={15}/></Link></p>}
      <form className="menu-filters" onSubmit={(e:FormEvent)=>{e.preventDefault();setPage(1);setQuery(queryInput);}}>
        <SearchInput className="menu-search" value={queryInput}
          onChange={value=>{setQueryInput(value);if(!value){setQuery("");setPage(1);}}}
          label={m3(locale,"search")} clearLabel={ux(locale,"clearSearch")}/>
        <FilterSelect value={status} label={m3(locale,"filter")}
          onChange={value=>{setPage(1);setStatus(value);}}
          options={["all","published","draft","soldout"].map(value=>({value,label:m3(locale,value as "all"|"published"|"draft"|"soldout")}))}/>
        <FilterSelect value={category} label={m3(locale,"category")}
          onChange={value=>{setPage(1);setCategory(value);}}
          options={[{value:"",label:m3(locale,"byCategory")},...editor.categories.map(c=>({value:c.id,label:nameFor(c,locale)}))]}/>
        <button className="button button-small" type="submit"><Search size={16}/>{m3(locale,"apply")}</button>
        <button className="button button-small p20-reset-filter" type="button"
          disabled={!queryInput&&!query&&status==="all"&&!category}
          onClick={()=>{setQueryInput("");setQuery("");setStatus("all");setCategory("");setPage(1);}}>
          <RotateCcw size={15}/>{m20(locale,"resetFilters")}</button>
      </form>
      <ArchiveToggle locale={locale} archived={archived} setArchived={v=>{setArchived(v);setPage(1);}}/>
      {loading?<Skeleton locale={locale}/>:menuItems.length?<div className="table-scroll"><table className="data-table menu-table">
        <thead><tr><th>{m3(locale,"items")}</th><th>{m3(locale,"category")}</th><th>{m3(locale,"price")}</th>
          <th>{m3(locale,"status")}</th><th>{m3(locale,"actions")}</th></tr></thead>
        <tbody>{menuItems.map(item=><tr key={item.id}>
          <td><div className="menu-item-identity"><Photo id={item.imageId} alt={nameFor(item,locale)} locale={locale}/>
            <div><strong>{nameFor(item,locale)}</strong><small className="muted" dir="ltr">{item.sku??"—"}</small></div></div></td>
          <td>{item.categoryName}</td><td dir="ltr" className="menu-price">{money(item.priceMinor,locale)}</td>
          <td><StateBadge published={item.published} soldOut={item.soldOut} locale={locale} archived={archived}/></td>
          <td><div className="menu-actions p20-menu-actions">{!archived&&<>
            <button className={"button button-small p20-publish-button"+(item.published?" is-live":"")}
              type="button" disabled={busy} title={m20(locale,item.published?"unpublishNow":"publishNow")}
              onClick={()=>void setItemPublished(item,!item.published)}>
              {item.published?<EyeOff size={16}/>:<Eye size={16}/>}
              <span>{m20(locale,item.published?"unpublishNow":"publishNow")}</span></button>
            <button className="icon-action" disabled={busy||loadingEditor} aria-label={m3(locale,"edit")} title={m3(locale,"edit")}
              onClick={()=>void editItem(item)}><SlidersHorizontal size={17}/></button>
            <button className="icon-action" disabled={busy} aria-label={m3(locale,"duplicate")} title={m3(locale,"duplicate")}
              onClick={()=>void duplicate(item)}><Copy size={17}/></button>
            <button className="icon-action danger-button" disabled={busy} aria-label={m3(locale,"archive")} title={m3(locale,"archive")}
              onClick={()=>void archive("item",item)}><Archive size={17}/></button></>}</div></td>
        </tr>)}</tbody></table></div>:<Empty icon={UtensilsCrossed} text={m3(locale,"emptyItems")}/>}
      <Pager locale={locale} page={page} total={total} setPage={setPage}/>
    </section>}
    {tab==="categories"&&<section className="settings-card menu-panel">
      <header className="section-heading"><div><h2>{m3(locale,"categories")}</h2><p className="muted">{m20(locale,"categoryInfo")}</p></div>
        <button className="button button-primary" disabled={busy} onClick={()=>setPopup({kind:"category"})}><CirclePlus size={18}/>{m3(locale,"newCategory")}</button></header>
      <ArchiveToggle locale={locale} archived={archived} setArchived={v=>{setArchived(v);setPage(1);}}/>
      {loading?<Skeleton locale={locale}/>:cats?.items.length?<div className="menu-category-grid">
        {cats.items.map(cat=><article key={cat.id} className="menu-entity-card">
          <div className="menu-entity-icon"><Layers3 size={23}/></div>
          <div className="menu-entity-body"><div className="menu-entity-head"><h3>{nameFor(cat,locale)}</h3>
            <span className={"data-badge "+(cat.published?"active":"disabled")}>{m3(locale,cat.published?"published":"draft")}</span></div>
            <p className="muted">{cat.description||"—"}</p>
            <small className="muted">{m3(locale,"sort")}: {cat.sortOrder}</small></div>
          {!archived&&<div className="menu-card-actions">
            <button type="button" className={"button button-small p20-publish-button"+(cat.published?" is-live":"")}
              disabled={busy} onClick={()=>void setCategoryPublished(cat,!cat.published)}>
              {cat.published?<EyeOff size={16}/>:<Eye size={16}/>}
              {m20(locale,cat.published?"unpublishCategory":"publishCategory")}</button>
            <button type="button" className="button button-small"
              onClick={()=>setPopup({kind:"category",value:cat})}>{m3(locale,"edit")}</button>
            <button type="button" className="button button-small danger-button"
              disabled={busy} onClick={()=>void archive("category",cat)}>{m3(locale,"archive")}</button></div>}
        </article>)}</div>:<Empty icon={Layers3} text={m3(locale,"emptyCategories")}/>}
      <Pager locale={locale} page={page} total={total} setPage={setPage}/>
    </section>}
    {tab==="modifiers"&&<section className="settings-card menu-panel">
      <header className="section-heading"><div><h2>{m3(locale,"modifiers")}</h2><p className="muted">{m20(locale,"modifierInfo")}</p></div>
        <button className="button button-primary" onClick={()=>setPopup({kind:"group"})}><CirclePlus size={18}/>{m3(locale,"newGroup")}</button></header>
      <ArchiveToggle locale={locale} archived={archived} setArchived={v=>{setArchived(v);setPage(1);}}/>
      {loading?<Skeleton locale={locale}/>:groups?.items.length?<div className="menu-category-grid">
        {groups.items.map(group=><article key={group.id} className="menu-entity-card menu-group-card">
          <div className="menu-entity-icon"><SlidersHorizontal size={23}/></div>
          <div className="menu-entity-body"><div className="menu-entity-head"><h3>{nameFor(group,locale)}</h3>
            <span className="data-badge">{m3(locale,group.selectionMode)}</span></div>
            <p className="muted">{m3(locale,"minimum")}: {group.minSelections} · {m3(locale,"maximum")}: {group.maxSelections}</p>
            <div className="menu-option-chips">{group.options.map(o=><span key={o.id} className={"menu-option-chip"+(o.active?"":" faded")}>
              {nameFor(o,locale)} {o.deltaMinor?"+ "+money(o.deltaMinor,locale):"· 0"}</span>)}</div></div>
          {!archived&&<div className="menu-card-actions"><button className="button button-small" type="button"
            onClick={()=>setPopup({kind:"group",value:group})}>{m3(locale,"edit")}</button>
            <button className="button button-small danger-button" disabled={busy} type="button"
              onClick={()=>void archive("group",group)}>{m3(locale,"archive")}</button></div>}
        </article>)}</div>:<Empty icon={SlidersHorizontal} text={m3(locale,"emptyGroups")}/>}
      <Pager locale={locale} page={page} total={total} setPage={setPage}/>
    </section>}
    {tab==="availability"&&<section className="settings-card menu-panel">
      <header className="section-heading"><div><h2>{m3(locale,"availability")}</h2>
        <p className="muted">{m3(locale,"availabilityHelp")}</p></div><PackageCheck size={24} color="var(--brand)"/></header>
      <form className="menu-filters" onSubmit={e=>{e.preventDefault();setPage(1);setQuery(queryInput);}}>
        <SearchInput className="menu-search" value={queryInput} label={m3(locale,"search")}
          onChange={value=>{setQueryInput(value);if(!value){setQuery("");setPage(1);}}}
          clearLabel={ux(locale,"clearSearch")}/>
        <FilterSelect label={m3(locale,"category")} value={category}
          onChange={value=>{setCategory(value);setPage(1);}}
          options={[{value:"",label:m3(locale,"byCategory")},...editor.categories.map(c=>
            ({value:c.id,label:nameFor(c,locale)}))]}/>
        <button className="button button-small" type="submit"><Search size={16}/>{m3(locale,"apply")}</button>
        <button type="button" className="button button-small"
          disabled={!query&&!queryInput&&!category}
          onClick={()=>{setQuery("");setQueryInput("");setCategory("");setPage(1);}}>
          <RotateCcw size={15}/>{m20(locale,"resetFilters")}</button>
      </form>
      <div className="p20-availability-tip">{m20(locale,"unpublishedAvailability")}</div>
      <div className="menu-bulk"><label className="menu-check"><input type="checkbox" checked={allChecked}
        disabled={busy||loading||availableRows.length===0}
        onChange={e=>setSelected(e.target.checked?availableRows.map(r=>r.id):[])}/>{m3(locale,"selectAll")}</label>
        <span className="muted">{m3(locale,"selected")}: {selected.length} · {m20(locale,"currentPage")}</span>
        <button className="button button-small" type="button" disabled={!selected.length||busy}
          onClick={()=>setSelected([])}>{m20(locale,"clearSelection")}</button>
        <input type="text" className="menu-reason" maxLength={120} value={reason}
          aria-label={m3(locale,"reason")} title={m20(locale,"reasonHelp")} placeholder={m3(locale,"reason")}
          onChange={e=>setReason(e.target.value)}/>
        <button className="button button-small" disabled={busy||!selected.length}
          onClick={()=>void availability(availableRows.filter(r=>selected.includes(r.id)),true)}>
          {m3(locale,"soldOutBulk")}</button>
        <button className="button button-small button-primary" disabled={busy||!selected.length}
          onClick={()=>void availability(availableRows.filter(r=>selected.includes(r.id)),false)}>
          {m3(locale,"availableBulk")}</button></div>
      {loading?<Skeleton locale={locale}/>:menuItems.length?<div className="menu-availability-grid">
        {menuItems.map(item=><article className="menu-stock-card" key={item.id}>
          <input type="checkbox" aria-label={m3(locale,"selection")+" "+nameFor(item,locale)}
            disabled={busy||loading}
            checked={selected.includes(item.id)} onChange={e=>setSelected(s=>e.target.checked?[...s,item.id]:s.filter(id=>id!==item.id))}/>
          <Photo id={item.imageId} alt={nameFor(item,locale)} locale={locale}/>
          <div className="menu-stock-title"><strong>{nameFor(item,locale)}</strong><small>{money(item.priceMinor,locale)}</small>
            <StateBadge locale={locale} published={item.published} soldOut={item.soldOut}/></div>
          <button className={"button button-small"+(item.soldOut?" button-primary":"")}
            type="button" disabled={busy} onClick={()=>void availability([item],!item.soldOut)}>
            {m3(locale,item.soldOut?"available":"soldout")}</button></article>)}</div>:<Empty icon={PackageCheck} text={m3(locale,"emptyAvailability")}/>}
      <Pager locale={locale} page={page} total={total} setPage={setPage}/>
    </section>}
    {popup&&<div className="dialog-backdrop menu-dialog-backdrop" role="presentation"
      onMouseDown={e=>{if(e.target===e.currentTarget&&!busy)setPopup(null);}}>
      <section ref={popupDialogRef} tabIndex={-1} className="menu-dialog" role="dialog" aria-modal="true" aria-labelledby="menu-dialog-title">
        {popup.kind==="category"?<CategoryEditor key={popup.value?.id??"category-new"} locale={locale} busy={busy}
          initial={popup.value} close={()=>setPopup(null)} submit={savePopup}/>:
         popup.kind==="group"?<GroupEditor key={popup.value?.id??"group-new"} locale={locale} busy={busy}
          initial={popup.value} close={()=>setPopup(null)} submit={savePopup}/>:
         <ItemEditor key={popup.value?.id??"item-new"} locale={locale} busy={busy}
           initial={popup.value} categories={editor.categories} groups={editor.groups}
           close={()=>setPopup(null)} submit={savePopup}/>}
        {error&&<div className="form-error" role="alert">{error}</div>}
      </section></div>}
    {previewOpen&&<div className="dialog-backdrop menu-dialog-backdrop" role="presentation"
      onMouseDown={e=>{if(e.target===e.currentTarget)setPreviewOpen(false);}}>
      <section ref={previewDialogRef} tabIndex={-1} className="menu-dialog menu-preview-dialog" role="dialog" aria-modal="true" aria-labelledby="catalog-preview-title">
        <div className="menu-dialog-head"><div><span className="eyebrow">DINEFLOW</span>
          <h2 id="catalog-preview-title">{m3(locale,"preview")}</h2><p className="muted">{m3(locale,"previewHint")}</p></div>
          <button className="icon-action" aria-label={m3(locale,"cancel")} onClick={()=>setPreviewOpen(false)}><X/></button></div>
        {previewError&&<InlineFeedback message={previewError} retry={()=>void jsonRequest<Catalog>("/api/menu/catalog")
          .then(value=>{setPreview(value);setPreviewError("");})
          .catch(e=>setPreviewError(apiError(e,locale)))}
          onRetryLabel={m20(locale,"reload")}/>}
        {preview?<div className="menu-preview-content">
          <div className="p20-preview-summary">
            <span>{m20(locale,"previewCount")}: <strong>{preview.items.length}</strong></span>
            <span>{m20(locale,"previewCategory")}: <strong>{preview.categories.length}</strong></span>
            <span>{m20(locale,"previewVersion")}: <strong>{preview.version}</strong></span>
          </div>{preview.items.length?preview.categories.map(cat=>
          <section key={cat.id}><h3>{nameFor(cat,locale)}</h3><div className="menu-preview-grid">
            {preview.items.filter(i=>i.categoryId===cat.id).map(item=>
              <div className="menu-preview-card" key={item.id}><Photo id={item.imageId} locale={locale} alt={nameFor(item,locale)}/>
                <div><strong>{nameFor(item,locale)}</strong><p className="muted">{item.description}</p>
                  <b>{money(item.priceMinor,locale)}</b> {item.soldOut&&<span className="data-badge disabled">{m3(locale,"soldout")}</span>}
                </div></div>)}</div></section>):<Empty icon={ImageOff} text={m20(locale,"previewEmpty")}/>}</div>:
          previewError?null:<div className="list-skeleton"><span/><span/><span/></div>}
      </section></div>}
  </div>;
}
function Photo({id,alt,locale}:{id:string|null;alt:string;locale:Locale}){
  const [bad,setBad]=useState(false);
  return <span className="menu-photo" aria-label={id&&!bad?alt:m3(locale,"imageFallback")}>
    {id&&!bad?<img src={API_URL+"/api/menu/images/"+id} alt={alt} onError={()=>setBad(true)} loading="lazy"/>:
      <ImageOff size={24} aria-hidden="true"/>}</span>;
}
function StateBadge({published,soldOut,archived=false,locale}:{published:boolean;soldOut:boolean;archived?:boolean;locale:Locale}){
  const key=archived?"archived":!published?"draft":soldOut?"soldout":"available";
  return <span className={"data-badge menu-state "+(key==="available"?"active":key==="soldout"?"disabled":"pending")}>{m3(locale,key)}</span>;
}
function Empty({icon:Icon,text}:{icon:typeof Layers3;text:string}){
  return <div className="empty-panel menu-empty"><Icon size={30}/><h3>{text}</h3></div>;
}
function ArchiveToggle({locale,archived,setArchived}:{locale:Locale;archived:boolean;setArchived:(x:boolean)=>void}){
  return <button className="menu-archive-toggle" type="button" onClick={()=>setArchived(!archived)}>
    <Archive size={15}/>{m3(locale,archived?"showCurrent":"viewArchive")}</button>;
}
function Skeleton({locale}:{locale:Locale}){return <LoadingSkeleton rows={4} label={m3(locale,"loading")}/>;}
function Pager({locale,page,total,setPage}:{locale:Locale;page:number;total:number;setPage:(x:number)=>void}){
  return <PageControls page={page} total={total} perPage={10} onPageChange={setPage}
    previousLabel={m3(locale,"previous")} nextLabel={m3(locale,"next")}
    pageLabel={m3(locale,"page")} ofLabel={m3(locale,"of")}/>;
}
