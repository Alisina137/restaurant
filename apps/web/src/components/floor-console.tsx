"use client";
import {useCallback,useEffect,useRef,useState} from "react";
import Link from "next/link";
import {DoorOpen,Layers3,RefreshCw,UtensilsCrossed,QrCode,Clock3,WifiOff,CheckCircle2} from "lucide-react";
import {useWorkspace} from "@/components/workspace-provider";
import {API_URL} from "@/lib/auth-client";
import {jsonRequest,Phase2Error} from "@/lib/phase2-api";
import {f4} from "@/lib/floor-copy";
import {f21} from "@/lib/floor21-copy";
import type {DiningTable,FloorBoard,Page,Section,Waiter} from "@/lib/floor-types";
import {FloorBoardGrid,FloorDetails} from "./floor-board";
import {FloorManage,type TableDirectoryFilters} from "./floor-manage";
import {SectionForm,TableForm,VisitForm,FinishForm} from "./floor-forms";
import {useInteraction} from "./ui/interaction-provider";
import {useDialogFocus} from "./ui/use-dialog-focus";
import {InlineFeedback} from "./ui/interaction-controls";
import {LoadingSkeleton} from "./ui/design-system";
export type FloorTab="board"|"manage";
type Popup={type:"new-section"}|{type:"edit-section";section:Section}|{type:"new-table"}|
 {type:"edit-table";table:DiningTable}|{type:"open";table:DiningTable}|{type:"finish";table:DiningTable};
function errMessage(error:unknown,locale:"fa-AF"|"ps-AF"|"en"){
 if(error instanceof Phase2Error&&error.code==="VERSION_CONFLICT")return f21(locale,"versionConflict");
 if(error instanceof Phase2Error&&error.code==="VISIT_ACTIVE")return f21(locale,"visitActive");
 if(error instanceof Phase2Error&&error.code==="SECTION_IN_USE")return f21(locale,"sectionBlocked");
 if(error instanceof Phase2Error&&error.code==="INVALID_WAITER")return f21(locale,"waiterInvalid");
 if(error instanceof Phase2Error&&error.code==="INVALID_SECTION")return f21(locale,"sectionInvalid");
 if(error instanceof Phase2Error&&error.code==="DUPLICATE_TABLE")return f21(locale,"nameCollision");
 if(error instanceof Phase2Error&&error.code==="DUPLICATE_SECTION")return f21(locale,"nameCollision");
 return error instanceof Error?error.message:f4(locale,"error");
}
export function FloorConsole({tab}:{tab:FloorTab}){
 const {workspace}=useWorkspace(),locale=workspace.locale;
 const {confirm,notify}=useInteraction();
 const mutationLock=useRef(false);
 const [board,setBoard]=useState<FloorBoard|null>(null);
 const [sections,setSections]=useState<Page<Section>|null>(null),[tables,setTables]=useState<Page<DiningTable>|null>(null);
 const [waiters,setWaiters]=useState<Waiter[]>([]);
 const [sectionPage,setSectionPage]=useState(1),[tablePage,setTablePage]=useState(1);
 const [sectionQuery,setSectionQuery]=useState("");
 const [tableFilters,setTableFilters]=useState<TableDirectoryFilters>({query:"",section:"",status:"all",waiter:""});
 const [archived,setArchived]=useState(false),[selectedId,setSelectedId]=useState<string|null>(null);
 const [popup,setPopup]=useState<Popup|null>(null);
 const [loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState(""),[notice,setNotice]=useState("");
 const [lastSync,setLastSync]=useState<number|null>(null),[online,setOnline]=useState(true);
 const requestId=useRef(0);
 const versionRef=useRef(-1);
 const popupDialogRef=useDialogFocus<HTMLElement>(!!popup,()=>{if(!busy){setPopup(null);setSelectedId(null);}});
 useEffect(()=>{if(notice){notify(notice,"success");setNotice("");}},[notice,notify]);
 const load=useCallback(async(silent=false)=>{
  const seq=++requestId.current;
  if(!silent)setLoading(true);
  try{
   const tableParams=new URLSearchParams({page:String(tablePage),...(archived?{archive:"1"}:{}),
    ...(tableFilters.query?{q:tableFilters.query}:{}),
    ...(tableFilters.section?{section:tableFilters.section}:{}),
    ...(!archived&&tableFilters.status!=="all"?{status:tableFilters.status}:{}),
    ...(tableFilters.waiter?{waiter:tableFilters.waiter}:{})});
   const sectionParams=new URLSearchParams({page:String(sectionPage),...(archived?{archive:"1"}:{}),
    ...(sectionQuery?{q:sectionQuery}:{})});
   const [data,staff,categoryList,tableList]=await Promise.all([
     jsonRequest<FloorBoard>("/api/floor/tables/board"),
     jsonRequest<{items:Waiter[]}>("/api/floor/tables/staff"),
     tab==="manage"?jsonRequest<Page<Section>>("/api/floor/sections?"+sectionParams):Promise.resolve(null),
     tab==="manage"?jsonRequest<Page<DiningTable>>("/api/floor/tables?"+tableParams):Promise.resolve(null)
   ]);
   if(seq!==requestId.current)return;
   setBoard(data);setWaiters(staff.items);
   if(categoryList)setSections(categoryList);
   if(tableList)setTables(tableList);
   setLastSync(Date.now());setError("");
  }catch(e){if(seq===requestId.current)setError(errMessage(e,locale));}
  finally{if(seq===requestId.current)setLoading(false);}
 },[tab,sectionPage,tablePage,archived,locale,sectionQuery,tableFilters]);
 useEffect(()=>{void load();return()=>{requestId.current++;};},[load]);
 useEffect(()=>{
  const change=()=>{setOnline(navigator.onLine);
    if(navigator.onLine)void load(true);};
  const visibility=()=>{if(document.visibilityState==="visible"&&navigator.onLine)void load(true);};
  setOnline(navigator.onLine);
  window.addEventListener("online",change);window.addEventListener("offline",change);
  document.addEventListener("visibilitychange",visibility);
  return()=>{window.removeEventListener("online",change);window.removeEventListener("offline",change);
    document.removeEventListener("visibilitychange",visibility);};
 },[load]);
 useEffect(()=>{
  if(typeof EventSource==="undefined")return;
  const stream=new EventSource(API_URL+"/api/floor/events",{withCredentials:true});
  const onFloor=(event:MessageEvent<string>)=>{
    try{const data=JSON.parse(event.data) as {version:number};
      if(versionRef.current>=0&&data.version!==versionRef.current&&
        document.visibilityState==="visible"&&navigator.onLine)void load(true);
      versionRef.current=data.version;
    }catch{/* Invalid notifications are recovered by polling. */}
  };
  stream.addEventListener("floor",onFloor as EventListener);
  const poll=setInterval(()=>{if(document.visibilityState==="visible"&&navigator.onLine)void load(true);},30000);
  return()=>{stream.removeEventListener("floor",onFloor as EventListener);stream.close();clearInterval(poll);};
 },[load]);
 useEffect(()=>{setSelectedId(null);setPopup(null);setError("");},[tab]);
 const current=board?.tables.find(t=>t.id===selectedId)??null;
 async function submit(endpoint:string,method:"POST"|"PATCH",payload:Record<string,unknown>,success:string,after?:()=>void){
  if(mutationLock.current)return;mutationLock.current=true;setBusy(true);setError("");setNotice("");
  try{
   const result=await jsonRequest<{created?:boolean}>(endpoint,{method,body:JSON.stringify(payload)});
   setPopup(null);setSelectedId(null);
   setNotice(result.created===false?f4(locale,"openExisting"):success);
   after?.();await load(true);
  }catch(e){setError(errMessage(e,locale));}
  finally{mutationLock.current=false;setBusy(false);}
 }
 function savePopup(payload:Record<string,unknown>){
  if(!popup)return Promise.resolve();
  if(popup.type==="new-section")return submit("/api/floor/sections","POST",payload,f4(locale,"created"));
  if(popup.type==="edit-section")return submit("/api/floor/sections/"+popup.section.id,"PATCH",payload,f4(locale,"saved"));
  if(popup.type==="new-table")return submit("/api/floor/tables","POST",payload,f4(locale,"created"));
  if(popup.type==="edit-table")return submit("/api/floor/tables/"+popup.table.id,"PATCH",payload,f4(locale,"saved"));
  if(popup.type==="open")return submit("/api/floor/visits/tables/"+popup.table.id+"/open","POST",payload,f4(locale,"created"));
  return submit("/api/floor/visits/"+popup.table.visitId+"/finish","POST",payload,f4(locale,"finishedMessage"));
 }
 async function archive(kind:"sections"|"tables",id:string,version:number){
  if(busy||!(await confirm({title:f4(locale,"archive"),description:f4(locale,"confirmArchive"),
    confirmLabel:f4(locale,"archive"),cancelLabel:f4(locale,"cancel"),danger:true})))return;
  await submit("/api/floor/"+kind+"/"+id+"/archive","POST",{version},f4(locale,"archivedMessage"));
 }
 async function markReady(table:DiningTable){
  if(busy||!(await confirm({title:f4(locale,"markReady"),description:f4(locale,"markReadyConfirm"),
    confirmLabel:f4(locale,"markReady"),cancelLabel:f4(locale,"cancel")})))return;
  await submit("/api/floor/tables/"+table.id+"/ready","POST",{version:table.version},f4(locale,"readyMessage"));
 }
 const allSections=board?.sections??[],activeSections=allSections.filter(s=>s.active);
 const knownWaiters=waiters;
 return <div className="content-stack floor-console">
  <div className="page-heading"><div><div className="eyebrow">DINEFLOW / {f4(locale,"tables")}</div>
    <h1>{f4(locale,"title")}</h1><p>{f4(locale,"subtitle")}</p></div>
    <div className="floor21-top-actions"><span className={"floor21-sync"+(!online?" offline":"")}>
      {online?<CheckCircle2 size={16}/>:<WifiOff size={16}/>}
      {online?lastSync?f21(locale,"lastUpdated")+" · "+new Date(lastSync).toLocaleTimeString(locale,{hour:"2-digit",minute:"2-digit"}):
         f4(locale,"loading"):f21(locale,"offline")}</span>
     <button type="button" className="button" onClick={()=>void load()} disabled={loading}>
       <RefreshCw size={18}/>{loading?f21(locale,"refreshing"):f21(locale,"refresh")}</button></div></div>
  <nav className="context-tabs" aria-label={f4(locale,"tables")}>
   <Link href="/app/tables/board" className={"context-tab"+(tab==="board"?" current":"")}
    aria-current={tab==="board"?"page":undefined}><DoorOpen size={18}/>{f4(locale,"board")}</Link>
   {board?.role!=="waiter"&&<Link href="/app/tables/manage" className={"context-tab"+(tab==="manage"?" current":"")}
    aria-current={tab==="manage"?"page":undefined}><Layers3 size={18}/>{f4(locale,"manage")}</Link>}
   {board?.role!=="waiter"&&<Link href="/app/tables/qr" className="context-tab"><QrCode size={18}/>QR</Link>}
  </nav>
  {error&&<InlineFeedback message={error} retry={()=>void load()} onRetryLabel={f4(locale,"retry")}/>}
  {!board&&loading?<LoadingSkeleton rows={3} label={f4(locale,"loading")} className="settings-card"/>:board&&<>
   {tab==="board"?<FloorBoardGrid data={board} locale={locale} onChoose={t=>setSelectedId(t.id)}/>:
    <FloorManage locale={locale} sections={sections} tables={tables} waiters={knownWaiters} allSections={allSections}
      sectionQuery={sectionQuery} setSectionQuery={setSectionQuery}
      tableFilters={tableFilters} setTableFilters={setTableFilters} archived={archived}
      busy={busy} loading={loading} sectionPage={sectionPage} tablePage={tablePage}
      setSectionPage={setSectionPage} setTablePage={setTablePage} setArchived={setArchived}
      addSection={()=>setPopup({type:"new-section"})} addTable={()=>{if(activeSections.length)setPopup({type:"new-table"});
        else setError(f4(locale,"noSections"));}}
      editSection={s=>setPopup({type:"edit-section",section:s})}
      editTable={t=>setPopup({type:"edit-table",table:t})}
      archiveSection={s=>{void archive("sections",s.id,s.version);}}
      archiveTable={t=>{void archive("tables",t.id,t.version);}}/>}

  </>}
  {current&&!popup&&board&&<FloorDetails table={current} locale={locale} role={board.role} actorId={board.actorId}
    busy={busy} onSeat={()=>setPopup({type:"open",table:current})}
    onFinish={()=>setPopup({type:"finish",table:current})}
    onReady={()=>{void markReady(current);}} onEdit={()=>setPopup({type:"edit-table",table:current})}
    onClose={()=>setSelectedId(null)}/>}
  {popup&&<div role="presentation" className="dialog-backdrop floor-modal-backdrop"
    onMouseDown={e=>{if(e.target===e.currentTarget&&!busy){setPopup(null);setSelectedId(null);}}}>
   <section ref={popupDialogRef} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="floor-modal-title" className="floor-modal">
    {(popup.type==="new-section"||popup.type==="edit-section")?
     <SectionForm locale={locale} busy={busy} close={()=>{setPopup(null);setSelectedId(null);}} save={savePopup}
       initial={popup.type==="edit-section"?popup.section:undefined}/>:
     (popup.type==="new-table"||popup.type==="edit-table")?
     <TableForm locale={locale} busy={busy} close={()=>{setPopup(null);setSelectedId(null);}} save={savePopup}
       initial={popup.type==="edit-table"?popup.table:undefined} sections={allSections} waiters={knownWaiters}/>:
     popup.type==="open"?<VisitForm locale={locale} busy={busy} manager={board?.role!=="waiter"} close={()=>{setPopup(null);setSelectedId(null);}}
       save={savePopup} table={popup.table}/>:
     <FinishForm locale={locale} busy={busy} close={()=>{setPopup(null);setSelectedId(null);}}
       save={savePopup} table={popup.table}/>}
    {error&&<p role="alert" className="form-error floor-modal-error">{error}</p>}
   </section></div>}
 </div>;
}
