"use client";
import {useCallback,useEffect,useMemo,useRef,useState} from "react";
import Link from "next/link";
import {QRCodeSVG} from "qrcode.react";
import {Check,Copy,Download,Printer,QrCode,RefreshCw,RotateCcw,ShieldCheck,Info,Search,Layers3,X} from "lucide-react";
import {useWorkspace} from "./workspace-provider";
import {jsonRequest} from "@/lib/phase2-api";
import {sg7} from "@/lib/guest-staff-copy";
import {f4} from "@/lib/floor-copy";
import {f21} from "@/lib/floor21-copy";
import {useInteraction} from "./ui/interaction-provider";
import {PageControls,InlineFeedback} from "./ui/interaction-controls";
import {LoadingSkeleton} from "./ui/design-system";
type TableQR={id:string;label:string;active:boolean;qr:string|null;qrVersion:number|null;
 qrUpdated:string|null;visitId:string|null;waiterId:string|null;url:string|null};
type Data={restaurant:string;slug:string;items:TableQR[]};
export function TableQRConsole(){
 const {workspace}=useWorkspace(),locale=workspace.locale;
 const {confirm,notify}=useInteraction();
 const lock=useRef(false),requestId=useRef(0);
 const [data,setData]=useState<Data|null>(null),[busy,setBusy]=useState<string|null>(null),
 [loading,setLoading]=useState(true),[error,setError]=useState(""),[notice,setNotice]=useState("");
 const [search,setSearch]=useState(""),[page,setPage]=useState(1),[cols,setCols]=useState(2);
 const [qrFilter,setQrFilter]=useState<"all"|"issued"|"unissued"|"inactive">("all");
 const [selected,setSelected]=useState<string[]>([]);
 const load=useCallback(async(silent=false)=>{
   const seq=++requestId.current;
   if(!silent)setLoading(true);
   try{const result=await jsonRequest<Data>("/api/guest/staff/qrs");
    if(seq===requestId.current){setData(result);setError("");}}
   catch(e){if(seq===requestId.current)setError(e instanceof Error?e.message:sg7(locale,"error"));}
   finally{if(seq===requestId.current)setLoading(false);}
 },[locale]);
 useEffect(()=>{void load();return()=>{requestId.current++;};},[load]);
 useEffect(()=>{
   const refresh=()=>{if(document.visibilityState==="visible"&&navigator.onLine)void load(true);};
   document.addEventListener("visibilitychange",refresh);
   window.addEventListener("online",refresh);
   return()=>{document.removeEventListener("visibilitychange",refresh);window.removeEventListener("online",refresh);};
 },[load]);
 async function issue(row:TableQR,rotate:boolean){
   if(lock.current||!row.active)return;
   if(rotate&&!(await confirm({title:sg7(locale,"rotate"),
     description:f21(locale,"qrRotateWarn"),confirmLabel:sg7(locale,"rotate"),
     cancelLabel:sg7(locale,"cancel"),danger:true})))return;
   if(lock.current)return;
   lock.current=true;setBusy(row.id);setError("");setNotice("");
   try{
     await jsonRequest("/api/guest/staff/qrs/"+row.id+(rotate?"/rotate":""),{
       method:"POST",body:JSON.stringify(rotate?{version:row.qrVersion}:{})});
     notify(f21(locale,rotate?"qrRotated":"qrIssued"),"success");
     setSelected(ids=>ids.filter(id=>id!==row.id));await load(true);
   }catch(e){await load(true);setError(e instanceof Error?e.message:sg7(locale,"error"));}
   finally{lock.current=false;setBusy(null);}
 }
 async function copy(url:string){try{await navigator.clipboard.writeText(url);notify(sg7(locale,"copied"),"success");}
   catch{setNotice(url);}}
 function download(row:TableQR){
   if(!row.url)return;
   const element=document.getElementById("df-qr-"+row.id)?.querySelector("svg");
   if(!element){setError(sg7(locale,"error"));return;}
   const source='<?xml version="1.0" encoding="utf-8"?>'+new XMLSerializer().serializeToString(element);
   const blob=new Blob([source],{type:"image/svg+xml;charset=utf-8"});
   const link=document.createElement("a"),uri=URL.createObjectURL(blob);
   link.href=uri;link.download="dineflow-qr-"+row.label.replace(/[^a-zA-Z0-9_-]/g,"_")+".svg";
   link.click();URL.revokeObjectURL(uri);
 }
 const counts=useMemo(()=>({total:data?.items.length??0,
   issued:data?.items.filter(x=>x.url&&x.active).length??0,
   unissued:data?.items.filter(x=>!x.url&&x.active).length??0}),[data]);
 const filtered=(data?.items??[]).filter(x=>x.label.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase())&&
   (qrFilter==="all"||qrFilter==="issued"&&!!x.url&&x.active||
    qrFilter==="unissued"&&!x.url&&x.active||qrFilter==="inactive"&&!x.active));
 const pages=Math.max(1,Math.ceil(filtered.length/10));
 const visiblePage=Math.min(page,pages);
 const paged=filtered.slice((visiblePage-1)*10,visiblePage*10);
 const printable=(data?.items??[]).filter(x=>x.url&&x.active&&selected.includes(x.id));
 const allCurrent=paged.filter(x=>x.url&&x.active).map(x=>x.id);
 return <div className="content-stack guest-qr-console">
  <div className="page-heading">
   <div><div className="eyebrow">DINEFLOW / {sg7(locale,"overview")}</div>
    <h1>{sg7(locale,"qrTitle")}</h1><p>{sg7(locale,"qrSubtitle")}</p></div>
   <button type="button" className="button" disabled={loading} onClick={()=>void load()}><RefreshCw size={17}/>{sg7(locale,"refresh")}</button>
  </div>
  <nav className="context-tabs" aria-label={f4(locale,"tables")}>
   <Link href="/app/tables/board" className="context-tab">{f4(locale,"board")}</Link>
   <Link href="/app/tables/manage" className="context-tab">{f4(locale,"manage")}</Link>
   <Link href="/app/tables/qr" className="context-tab current" aria-current="page"><QrCode size={17}/>{sg7(locale,"qr")}</Link>
  </nav>
  <div className="guest-admin-info floor21-qr-warning"><ShieldCheck size={21}/><div><b>{sg7(locale,"qrWarning")}</b>
    <p>{f21(locale,"qrHelp")}</p></div></div>
  <div className="floor21-qr-summary" aria-label={f21(locale,"overview")}>
    <div><Layers3 size={20}/><span>{f21(locale,"tableCount")}</span><strong>{counts.total}</strong></div>
    <div><QrCode size={20}/><span>{f21(locale,"qrIssuedCount")}</span><strong>{counts.issued}</strong></div>
    <div><Info size={20}/><span>{f21(locale,"qrUnissuedCount")}</span><strong>{counts.unissued}</strong></div>
  </div>
  {error&&<InlineFeedback message={error} retry={()=>void load()} onRetryLabel={sg7(locale,"retry")}/>}
  {notice&&<p role="status" className="success-banner"><Check size={16}/>{notice}</p>}
  <div className="settings-card guest-qr-toolbar">
    <label className="field"><span>{sg7(locale,"search")}</span>
     <input type="search" value={search} onChange={e=>{setSearch(e.target.value);setPage(1);}}
       placeholder={f21(locale,"qrSearch")}/></label>
    <label className="field"><span>{f21(locale,"filters")}</span><select value={qrFilter}
       onChange={e=>{setQrFilter(e.target.value as typeof qrFilter);setPage(1);}}>
        <option value="all">{f4(locale,"all")}</option>
        <option value="issued">{f21(locale,"qrIssuedCount")}</option>
        <option value="unissued">{f21(locale,"qrUnissuedCount")}</option>
        <option value="inactive">{f4(locale,"disabled")}</option>
       </select></label>
    <label className="field"><span>{sg7(locale,"sort")}</span>
     <select value={cols} onChange={e=>setCols(Number(e.target.value))}>
       <option value="1">{sg7(locale,"one")}</option><option value="2">{sg7(locale,"two")}</option>
       <option value="4">{sg7(locale,"four")}</option></select></label>
    <button type="button" className="button" disabled={!printable.length||!!busy} onClick={()=>window.print()}>
     <Printer size={18}/>{f21(locale,"qrPrint")} ({printable.length})</button>
    <button type="button" className="button button-small" disabled={!allCurrent.length||!!busy}
     onClick={()=>setSelected(old=>allCurrent.every(x=>old.includes(x))?old.filter(x=>!allCurrent.includes(x)):
       [...new Set([...old,...allCurrent])])}>{f21(locale,"qrSelectPage")}</button>
    <button type="button" className="button button-small" disabled={!selected.length||!!busy}
     onClick={()=>setSelected([])}><X size={14}/>{f21(locale,"qrClearSelection")}</button>
  </div>
  {loading&&!data?<LoadingSkeleton className="settings-card" rows={3} label={sg7(locale,"refresh")}/>:
    paged.length?<div className="guest-qr-grid">{paged.map(row=>
      <article className="guest-qr-card" key={row.id}>
       <div className="guest-qr-card-header"><div><h2>{sg7(locale,"table")} {row.label}</h2>
         <span className="muted">{row.visitId?sg7(locale,"active"):sg7(locale,"closed")}</span></div>
         {row.url&&row.active&&<label className="guest-qr-check" title={sg7(locale,"select")}><input type="checkbox"
           aria-label={f21(locale,"qrSelectPage")+" "+row.label}
           disabled={!!busy} checked={selected.includes(row.id)}
           onChange={e=>setSelected(old=>e.target.checked?[...new Set([...old,row.id])]:
              old.filter(x=>x!==row.id))}/></label>}</div>
       {row.url?<div className="guest-qr-svg" id={"df-qr-"+row.id}>
          <QRCodeSVG value={row.url} size={205} marginSize={3} level="H"/>
         </div>:<div className="guest-qr-placeholder"><QrCode size={49}/><span>{sg7(locale,"noQr")}</span></div>}
       {row.url&&<><div className="guest-qr-codeinfo">{sg7(locale,"version")}: {row.qrVersion}</div>
        <p className="guest-qr-url" dir="ltr">{row.url}</p></>}
       <div className="guest-qr-actions">
        <button type="button" className="button button-primary" disabled={!!busy||!row.active}
          onClick={()=>void issue(row,!!row.qr)}>{row.qr?<RotateCcw size={16}/>:<QrCode size={17}/>}
            {sg7(locale,row.qr?"rotate":"create")}</button>
        {row.url&&row.active&&<><button type="button" className="button button-small" onClick={()=>void copy(row.url!)}
           aria-label={sg7(locale,"copy")}><Copy size={17}/></button>
         <button type="button" className="button button-small" onClick={()=>download(row)}
           aria-label={sg7(locale,"download")}><Download size={18}/></button></>}
       </div>
      </article>)}</div>:
    <div className="settings-card empty-panel"><QrCode size={32}/><h3>{sg7(locale,data?.items.length?"searchEmpty":"noTables")}</h3></div>}
  {filtered.length>10&&<PageControls page={visiblePage} total={filtered.length} perPage={10}
    onPageChange={setPage} previousLabel={f4(locale,"previous")} nextLabel={f4(locale,"next")}
    pageLabel={f4(locale,"page")} ofLabel={f4(locale,"of")} busy={loading}/>}
  <div className="floor21-qr-selected" role="status">{f21(locale,"qrSelectionCount")}: {printable.length}</div>
  <div className={"guest-qr-print-only guest-qr-print-cols-"+cols}>
    {printable.map(row=><article key={row.id} className="guest-qr-print-card">
       <h2>DineFlow · {data?.restaurant}</h2><h3>{sg7(locale,"table")} {row.label}</h3>
       <QRCodeSVG value={row.url!} size={270} marginSize={3} level="H"/>
       <p>{sg7(locale,"guestHint")}</p>
       <div className="guest-qr-url" dir="ltr">{row.url}</div>
     </article>)}
  </div>
 </div>;
}
