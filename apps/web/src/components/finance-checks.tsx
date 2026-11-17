"use client";
import {useCallback,useEffect,useRef,useState} from "react";
import Link from "next/link";
import {ArrowRight,Banknote,Clock3,RefreshCw,ReceiptText,Search,ShieldCheck,Wallet} from "lucide-react";
import {useRouter} from "next/navigation";
import {useWorkspace} from "./workspace-provider";
import {jsonRequest,Phase2Error} from "@/lib/phase2-api";
import {f9} from "@/lib/finance-copy";
import {isoTime,money,type CheckPage,type CheckRow} from "@/lib/finance-types";
import {ActionButton,EmptyState,LoadingSkeleton,Surface} from "./ui/design-system";
import {InlineFeedback,PageControls,SearchInput} from "./ui/interaction-controls";
import {ux} from "@/lib/interaction-copy";
type Tab="all"|"requested"|"partial";
export function CashierChecks({area="cashier"}:{area?:"cashier"|"app"}){
 const {workspace}=useWorkspace(),locale=workspace.locale,router=useRouter();
 const [data,setData]=useState<CheckPage|null>(null),[tab,setTab]=useState<Tab>("all"),
  [query,setQuery]=useState(""),[searchText,setSearchText]=useState(""),[page,setPage]=useState(1),[busy,setBusy]=useState(""),
  [loading,setLoading]=useState(true),[error,setError]=useState("");
 const requestSequence=useRef(0),openingCheck=useRef(false);
 useEffect(()=>{const timer=setTimeout(()=>{setPage(1);setQuery(searchText.trim());},300);
   return()=>clearTimeout(timer);},[searchText]);
 const load=useCallback(async(silent=false)=>{
   const current=++requestSequence.current;
   if(!silent)setLoading(true);setError("");
   try{
     const response=await jsonRequest<CheckPage>("/api/finance/checks?tab="+tab+"&page="+page+
       "&search="+encodeURIComponent(query));
     if(current===requestSequence.current)setData(response);
   }catch(e){if(current===requestSequence.current)setError(e instanceof Error?e.message:f9(locale,"actionFailed"));}
   finally{if(current===requestSequence.current)setLoading(false);}
 },[tab,page,query,locale]);
 useEffect(()=>{void load();const timer=setInterval(()=>{if(document.visibilityState==="visible")void load(true);},12000);
   return()=>clearInterval(timer);},[load]);
 async function open(row:CheckRow){
   if(openingCheck.current)return;openingCheck.current=true;setBusy(row.visitId);setError("");
   try{
     const result=await jsonRequest<{id:string}>("/api/finance/visits/"+row.visitId+"/check",{
       method:"POST",body:JSON.stringify({})});
     router.push(area==="cashier"?"/cashier/checks/"+result.id:"/app/billing/checks/"+result.id);
   }catch(e){setError(e instanceof Error?e.message:f9(locale,"actionFailed"));}
   finally{openingCheck.current=false;setBusy("");}
 }
 const prefix=area==="cashier"?"/cashier":"/app/billing";
 return <div className="content-stack finance-console">
   <div className="page-heading"><div><div className="eyebrow">DINEFLOW / {f9(locale,"checkout")}</div>
     <h1>{f9(locale,"checks")}</h1><p>{f9(locale,"financialGuard")}</p></div>
     <button type="button" className="button" onClick={()=>void load()}><RefreshCw size={17}/>{f9(locale,"refresh")}</button></div>
   <nav className="finance-area-tabs" aria-label={f9(locale,"checkout")}>
     <Link href={prefix+(area==="cashier"?"/checks":"/checks")} className="selected"><ReceiptText size={17}/>{f9(locale,"checks")}</Link>
     <Link href={prefix+"/transactions"}><Wallet size={17}/>{f9(locale,"transactions")}</Link>
     {area==="cashier"?<Link href="/cashier/shifts"><Clock3 size={17}/>{f9(locale,"shifts")}</Link>:
       <Link href="/app/billing/shifts"><Clock3 size={17}/>{f9(locale,"oversight")}</Link>}
     <Link href={prefix+"/receipts"}><ShieldCheck size={17}/>{f9(locale,"receipts")}</Link>
   </nav>
   <div className="finance-stats">
     <div className="finance-stat"><div><span>{f9(locale,"openVisits")}</span><ReceiptText size={19}/></div>
       <strong>{tab==="all"?data?.total??"—":"—"}</strong></div>
     <div className="finance-stat"><div><span>{f9(locale,"due")}</span><Banknote size={19}/></div>
       <strong>{data?money(data.items.reduce((s,x)=>s+x.dueMinor,0),locale):"—"}</strong>
       <small>{f9(locale,"current")} · {data?.items.length??"—"}</small></div>
   </div>
   <Surface className="finance-toolbar">
     <div className="finance-segments" role="tablist" aria-label={f9(locale,"checks")}>
       {(["all","requested","partial"] as const).map(t=><button key={t} type="button" role="tab"
         aria-selected={tab===t} className={tab===t?"selected":""}
         onClick={()=>{setTab(t);setPage(1);}}>{f9(locale,t)}</button>)}</div>
     <SearchInput className="finance-search" value={searchText} onChange={setSearchText}
       label={f9(locale,"search")} clearLabel={ux(locale,"clearSearch")}/>
   </Surface>
   {tab==="requested"&&data?.total===0&&<div className="finance-info"><ShieldCheck size={20}/>
     <span>{f9(locale,"noChecks")}</span></div>}
   {error&&<InlineFeedback message={error} retry={()=>void load()} onRetryLabel={f9(locale,"retry")}/>}
   {loading&&!!data&&<p className="df-inline-updating" role="status">{ux(locale,"loading")}</p>}
   {loading&&!data?<LoadingSkeleton rows={3} label={f9(locale,"checks")} className="settings-card"/>:
    data?.items.length?<div className="finance-check-grid">
      {data.items.map(row=><article className="finance-check-card" key={row.visitId}>
        <div className="finance-check-head"><div><span className="eyebrow">{f9(locale,"table")}</span>
          <h2>{row.tableLabel}</h2></div><span className={"finance-badge "+(row.partial?"partial":"open")}>
           {row.dueMinor===0?f9(locale,"readyToClose"):row.partial?f9(locale,"partial"):f9(locale,"open")}</span></div>
        <div className="finance-check-time"><Clock3 size={16}/><span>{isoTime(row.openedAt,locale)}</span></div>
        <div className="finance-check-numbers">
          <div><span>{f9(locale,"total")}</span><strong>{money(row.amountMinor,locale)}</strong></div>
          <div><span>{f9(locale,"paid")}</span><strong>{money(row.paidMinor,locale)}</strong></div>
          <div className="due"><span>{f9(locale,"due")}</span><strong>{money(row.dueMinor,locale)}</strong></div>
        </div>
        <ActionButton variant="primary" type="button" disabled={loading||!!busy} loading={busy===row.visitId} loadingText={f9(locale,"processing")}
         onClick={()=>void open(row)}>
          {f9(locale,"openCheck")}<ArrowRight size={18}/></ActionButton>
      </article>)}</div>:
     <Surface><EmptyState icon={<ReceiptText size={36}/>} title={f9(locale,"noChecks")}/></Surface>}
   {!!data&&<PageControls page={page} total={data.total} perPage={data.perPage}
     onPageChange={setPage} previousLabel={ux(locale,"previous")} nextLabel={ux(locale,"next")}
     pageLabel={ux(locale,"page")} ofLabel={ux(locale,"of")} busy={loading}/> }
 </div>;
}
