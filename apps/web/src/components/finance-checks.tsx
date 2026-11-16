"use client";
import {useCallback,useEffect,useState} from "react";
import Link from "next/link";
import {ArrowRight,Banknote,Clock3,RefreshCw,ReceiptText,Search,ShieldCheck,Wallet} from "lucide-react";
import {useRouter} from "next/navigation";
import {useWorkspace} from "./workspace-provider";
import {jsonRequest,Phase2Error} from "@/lib/phase2-api";
import {f9} from "@/lib/finance-copy";
import {isoTime,money,type CheckPage,type CheckRow} from "@/lib/finance-types";
type Tab="all"|"requested"|"partial";
export function CashierChecks({area="cashier"}:{area?:"cashier"|"app"}){
 const {workspace}=useWorkspace(),locale=workspace.locale,router=useRouter();
 const [data,setData]=useState<CheckPage|null>(null),[tab,setTab]=useState<Tab>("all"),
  [query,setQuery]=useState(""),[page,setPage]=useState(1),[busy,setBusy]=useState(""),
  [loading,setLoading]=useState(true),[error,setError]=useState("");
 const load=useCallback(async(silent=false)=>{
   if(!silent)setLoading(true);setError("");
   try{
     const response=await jsonRequest<CheckPage>("/api/finance/checks?tab="+tab+"&page="+page+
       "&search="+encodeURIComponent(query));
     setData(response);
   }catch(e){setError(e instanceof Error?e.message:f9(locale,"actionFailed"));}
   finally{setLoading(false);}
 },[tab,page,query,locale]);
 useEffect(()=>{void load();const timer=setInterval(()=>{if(document.visibilityState==="visible")void load(true);},12000);
   return()=>clearInterval(timer);},[load]);
 async function open(row:CheckRow){
   if(busy)return;setBusy(row.visitId);setError("");
   try{
     const result=await jsonRequest<{id:string}>("/api/finance/visits/"+row.visitId+"/check",{
       method:"POST",body:JSON.stringify({})});
     router.push(area==="cashier"?"/cashier/checks/"+result.id:"/app/billing/checks/"+result.id);
   }catch(e){setError(e instanceof Error?e.message:f9(locale,"actionFailed"));}
   finally{setBusy("");}
 }
 const prefix=area==="cashier"?"/cashier":"/app/billing";
 return <div className="content-stack finance-console">
   <div className="page-heading"><div><div className="eyebrow">DINEFLOW / {f9(locale,"checkout")}</div>
     <h1>{f9(locale,"checks")}</h1><p>{f9(locale,"financialGuard")}</p></div>
     <button type="button" className="button" onClick={()=>void load()}><RefreshCw size={17}/>{f9(locale,"refresh")}</button></div>
   <nav className="finance-area-tabs" aria-label={f9(locale,"checkout")}>
     <Link href={prefix+(area==="cashier"?"/checks":"/checks")} className="selected"><ReceiptText size={17}/>{f9(locale,"checks")}</Link>
     <Link href={prefix+"/transactions"}><Wallet size={17}/>{f9(locale,"transactions")}</Link>
     {area==="cashier"&&<Link href="/cashier/shifts"><Clock3 size={17}/>{f9(locale,"shifts")}</Link>}
     <Link href={prefix+"/receipts"}><ShieldCheck size={17}/>{f9(locale,"receipts")}</Link>
   </nav>
   <div className="finance-stats">
     <div className="finance-stat"><div><span>{f9(locale,"openVisits")}</span><ReceiptText size={19}/></div>
       <strong>{tab==="all"?data?.total??"—":"—"}</strong></div>
     <div className="finance-stat"><div><span>{f9(locale,"due")}</span><Banknote size={19}/></div>
       <strong>{data?money(data.items.reduce((s,x)=>s+x.dueMinor,0),locale):"—"}</strong>
       <small>{f9(locale,"current")} · {data?.items.length??"—"}</small></div>
   </div>
   <div className="finance-toolbar settings-card">
     <div className="finance-segments" role="tablist" aria-label={f9(locale,"checks")}>
       {(["all","requested","partial"] as const).map(t=><button key={t} type="button" role="tab"
         aria-selected={tab===t} className={tab===t?"selected":""}
         onClick={()=>{setTab(t);setPage(1);}}>{f9(locale,t)}</button>)}</div>
     <label className="finance-search"><Search size={19}/><input type="search" value={query}
       onChange={e=>{setQuery(e.target.value);setPage(1);}} placeholder={f9(locale,"search")}
       aria-label={f9(locale,"search")}/></label>
   </div>
   {tab==="requested"&&<div className="finance-info"><ShieldCheck size={20}/>
     <span>{f9(locale,"requestedComing")}</span></div>}
   {error&&<div className="form-error" role="alert">{error}
     <button className="text-link" onClick={()=>void load()}>{f9(locale,"retry")}</button></div>}
   {loading&&!data?<div className="list-skeleton settings-card"><span/><span/><span/></div>:
    data?.items.length?<div className="finance-check-grid">
      {data.items.map(row=><article className="finance-check-card" key={row.visitId}>
        <div className="finance-check-head"><div><span className="eyebrow">{f9(locale,"table")}</span>
          <h2>{row.tableLabel}</h2></div><span className={"finance-badge "+(row.partial?"partial":"open")}>
           {row.partial?f9(locale,"partial"):f9(locale,"open")}</span></div>
        <div className="finance-check-time"><Clock3 size={16}/><span>{isoTime(row.openedAt,locale)}</span></div>
        <div className="finance-check-numbers">
          <div><span>{f9(locale,"total")}</span><strong>{money(row.amountMinor,locale)}</strong></div>
          <div><span>{f9(locale,"paid")}</span><strong>{money(row.paidMinor,locale)}</strong></div>
          <div className="due"><span>{f9(locale,"due")}</span><strong>{money(row.dueMinor,locale)}</strong></div>
        </div>
        <button className="button button-primary" type="button" disabled={busy===row.visitId}
         onClick={()=>void open(row)}>
          {busy===row.visitId?f9(locale,"processing"):f9(locale,"openCheck")}<ArrowRight size={18}/></button>
      </article>)}</div>:
     <div className="settings-card empty-panel"><ReceiptText size={36}/>
       <h3>{f9(locale,"noChecks")}</h3></div>}
   {!!data&&data.total>data.perPage&&<div className="pager">
     <button className="button button-small" disabled={page===1}
       onClick={()=>setPage(p=>p-1)}>‹</button><span>{page} / {Math.ceil(data.total/data.perPage)}</span>
     <button className="button button-small" disabled={page>=Math.ceil(data.total/data.perPage)}
       onClick={()=>setPage(p=>p+1)}>›</button></div>}
 </div>;
}
