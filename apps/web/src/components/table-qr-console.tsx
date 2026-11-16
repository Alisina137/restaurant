"use client";
import {useCallback,useEffect,useMemo,useState} from "react";
import Link from "next/link";
import {QRCodeSVG} from "qrcode.react";
import {Check,Copy,Download,Printer,QrCode,RefreshCw,RotateCcw,ShieldCheck} from "lucide-react";
import {useWorkspace} from "./workspace-provider";
import {jsonRequest} from "@/lib/phase2-api";
import {sg7} from "@/lib/guest-staff-copy";
import {f4} from "@/lib/floor-copy";
type TableQR={id:string;label:string;active:boolean;qr:string|null;qrVersion:number|null;
 qrUpdated:string|null;visitId:string|null;waiterId:string|null;url:string|null};
type Data={restaurant:string;slug:string;items:TableQR[]};
export function TableQRConsole(){
 const {workspace}=useWorkspace(),locale=workspace.locale;
 const [data,setData]=useState<Data|null>(null),[busy,setBusy]=useState<string|null>(null),
 [loading,setLoading]=useState(true),[error,setError]=useState(""),[notice,setNotice]=useState("");
 const [search,setSearch]=useState(""),[page,setPage]=useState(1),[cols,setCols]=useState(2);
 const [selected,setSelected]=useState<string[]>([]);
 const load=useCallback(async()=>{
   setLoading(true);setError("");
   try{const result=await jsonRequest<Data>("/api/guest/staff/qrs");setData(result);}
   catch(e){setError(e instanceof Error?e.message:sg7(locale,"error"));}
   finally{setLoading(false);}
 },[locale]);
 useEffect(()=>{void load();},[load]);
 async function issue(row:TableQR,rotate:boolean){
   if(rotate&&!window.confirm(sg7(locale,"rotConfirm")))return;
   setBusy(row.id);setError("");setNotice("");
   try{
     await jsonRequest("/api/guest/staff/qrs/"+row.id+(rotate?"/rotate":""),{
       method:"POST",body:JSON.stringify(rotate?{version:row.qrVersion}:{})});
     setNotice(sg7(locale,rotate?"oldQr":"issued"));await load();
   }catch(e){setError(e instanceof Error?e.message:sg7(locale,"error"));}
   finally{setBusy(null);}
 }
 async function copy(url:string){try{await navigator.clipboard.writeText(url);setNotice(sg7(locale,"copied"));}
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
 const filtered=(data?.items??[]).filter(x=>x.label.toLocaleLowerCase().includes(search.toLocaleLowerCase()));
 const paged=filtered.slice((page-1)*10,page*10);
 const printable=(data?.items??[]).filter(x=>x.url&&selected.includes(x.id));
 const allCurrent=paged.filter(x=>x.url).map(x=>x.id);
 return <div className="content-stack guest-qr-console">
  <div className="page-heading">
   <div><div className="eyebrow">DINEFLOW / {sg7(locale,"overview")}</div>
    <h1>{sg7(locale,"qrTitle")}</h1><p>{sg7(locale,"qrSubtitle")}</p></div>
   <button type="button" className="button" onClick={()=>void load()}><RefreshCw size={17}/>{sg7(locale,"refresh")}</button>
  </div>
  <nav className="context-tabs" aria-label={f4(locale,"tables")}>
   <Link href="/app/tables/board" className="context-tab">{f4(locale,"board")}</Link>
   <Link href="/app/tables/manage" className="context-tab">{f4(locale,"manage")}</Link>
   <Link href="/app/tables/qr" className="context-tab current" aria-current="page"><QrCode size={17}/>{sg7(locale,"qr")}</Link>
  </nav>
  <div className="guest-admin-info"><ShieldCheck size={21}/><div><b>{sg7(locale,"qrWarning")}</b>
    <p>{sg7(locale,"phoneHint")}</p></div></div>
  {error&&<p className="form-error" role="alert">{error} <button className="text-link" onClick={()=>void load()}>{sg7(locale,"retry")}</button></p>}
  {notice&&<p role="status" className="success-banner"><Check size={16}/>{notice}</p>}
  <div className="settings-card guest-qr-toolbar">
    <label className="field"><span>{sg7(locale,"search")}</span>
     <input type="search" value={search} onChange={e=>{setSearch(e.target.value);setPage(1);}}
       placeholder={sg7(locale,"search")}/></label>
    <label className="field"><span>{sg7(locale,"sort")}</span>
     <select value={cols} onChange={e=>setCols(Number(e.target.value))}>
       <option value="1">{sg7(locale,"one")}</option><option value="2">{sg7(locale,"two")}</option>
       <option value="4">{sg7(locale,"four")}</option></select></label>
    <button type="button" className="button" disabled={!printable.length} onClick={()=>window.print()}>
     <Printer size={18}/>{sg7(locale,"printSelected")} ({printable.length})</button>
    <button type="button" className="button button-small"
     onClick={()=>setSelected(old=>allCurrent.every(x=>old.includes(x))?old.filter(x=>!allCurrent.includes(x)):
       [...new Set([...old,...allCurrent])])}>{sg7(locale,"select")}</button>
  </div>
  {loading&&!data?<div className="settings-card list-skeleton"><span/><span/><span/></div>:
    paged.length?<div className="guest-qr-grid">{paged.map(row=>
      <article className="guest-qr-card" key={row.id}>
       <div className="guest-qr-card-header"><div><h2>{sg7(locale,"table")} {row.label}</h2>
         <span className="muted">{row.visitId?sg7(locale,"active"):sg7(locale,"closed")}</span></div>
         {row.url&&<label className="guest-qr-check" title={sg7(locale,"select")}><input type="checkbox"
           checked={selected.includes(row.id)} onChange={e=>setSelected(old=>e.target.checked?[...new Set([...old,row.id])]:
              old.filter(x=>x!==row.id))}/></label>}</div>
       {row.url?<div className="guest-qr-svg" id={"df-qr-"+row.id}>
          <QRCodeSVG value={row.url} size={205} marginSize={3} level="H"/>
         </div>:<div className="guest-qr-placeholder"><QrCode size={49}/><span>{sg7(locale,"noQr")}</span></div>}
       {row.url&&<><div className="guest-qr-codeinfo">{sg7(locale,"version")}: {row.qrVersion}</div>
        <p className="guest-qr-url" dir="ltr">{row.url}</p></>}
       <div className="guest-qr-actions">
        <button type="button" className="button button-primary" disabled={busy===row.id||!row.active}
          onClick={()=>void issue(row,!!row.qr)}>{row.qr?<RotateCcw size={16}/>:<QrCode size={17}/>}
            {sg7(locale,row.qr?"rotate":"create")}</button>
        {row.url&&<><button type="button" className="button button-small" onClick={()=>void copy(row.url!)}
           aria-label={sg7(locale,"copy")}><Copy size={17}/></button>
         <button type="button" className="button button-small" onClick={()=>download(row)}
           aria-label={sg7(locale,"download")}><Download size={18}/></button></>}
       </div>
      </article>)}</div>:
    <div className="settings-card empty-panel"><QrCode size={32}/><h3>{sg7(locale,data?.items.length?"searchEmpty":"noTables")}</h3></div>}
  {filtered.length>10&&<div className="pager">
    <button type="button" className="button button-small" disabled={page===1}
      onClick={()=>setPage(p=>p-1)}>‹</button>
    <span>{page} / {Math.ceil(filtered.length/10)}</span>
    <button type="button" className="button button-small" disabled={page>=Math.ceil(filtered.length/10)}
      onClick={()=>setPage(p=>p+1)}>›</button></div>}
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
