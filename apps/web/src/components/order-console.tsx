"use client";
import {useCallback,useEffect,useRef,useState} from "react";
import Link from "next/link";
import {ArrowUpRight,Check,ChefHat,Clock3,RefreshCw,Receipt,RotateCw,UtensilsCrossed,X} from "lucide-react";
import {useWorkspace} from "./workspace-provider";
import {GuestApprovalPanel} from "./guest-approval-panel";
import {API_URL} from "@/lib/auth-client";
import {jsonRequest,Phase2Error} from "@/lib/phase2-api";
import {ow} from "@/lib/order-web-copy";
import {type WebRow,type WebPage,type WebDetail,name,amount} from "@/lib/order-web-types";
import type {Locale} from "@dineflow/shared";

function useOrders(path:string){
 const {workspace}=useWorkspace(),locale=workspace.locale;
 const [data,setData]=useState<WebPage|null>(null),[loading,setLoading]=useState(true),[error,setError]=useState("");
 const revision=useRef(-1);
 const load=useCallback(async(silent=false)=>{
  if(!silent)setLoading(true);
  setError("");
  try{setData(await jsonRequest<WebPage>(path));}
  catch(e){setError(e instanceof Error?e.message:ow(locale,"error"));}
  finally{setLoading(false);}
 },[path,locale]);
 useEffect(()=>{void load();},[load]);
 useEffect(()=>{
  if(typeof EventSource==="undefined")return;
  const source=new EventSource(API_URL+"/api/orders/events",{withCredentials:true});
  const listener=(evt:MessageEvent<string>)=>{
   try{const rev=(JSON.parse(evt.data) as {version:number}).version;
    if(revision.current>=0&&rev!==revision.current)void load(true);
    revision.current=rev;
   }catch{/* Periodic refresh remains authoritative. */}
  };
  source.addEventListener("orders",listener as EventListener);
  const poll=setInterval(()=>{void load(true);},10000);
  return()=>{source.removeEventListener("orders",listener as EventListener);source.close();clearInterval(poll);};
 },[load]);
 return {data,loading,error,setError,load,locale};
}
function time(value:string|null,locale:Locale){
 return value?new Date(value).toLocaleTimeString(locale,{hour:"2-digit",minute:"2-digit"}):"—";
}
function stamp(value:string,locale:Locale){return new Date(value).toLocaleString(locale,{month:"short",day:"numeric",hour:"2-digit",minute:"2-digit"});}
function age(value:string){const mins=Math.max(0,Math.floor((Date.now()-new Date(value).getTime())/60000));
 return mins<60?mins+"m":Math.floor(mins/60)+"h "+(mins%60)+"m";}
function Pill({status,locale}:{status:string;locale:Locale}){
 const key=status==="new"||status==="preparing"||status==="ready"?status:"accepted";
 return <span className={"order-pill "+key}>{ow(locale,key)}</span>;
}
function Pager({locale,total,page,onPage}:{locale:Locale;total:number;page:number;onPage:(p:number)=>void}){
 return <div className="pager">
  <button type="button" className="button button-small" disabled={page<=1} onClick={()=>onPage(page-1)}>{ow(locale,"back")}</button>
  <span>{page} / {Math.max(1,Math.ceil(total/10))}</span>
  <button type="button" className="button button-small" disabled={page>=Math.ceil(total/10)} onClick={()=>onPage(page+1)}>→</button>
 </div>;
}
function DetailLines({detail,locale}:{detail:WebDetail;locale:Locale}){
 return <div className="order-detail-lines">
  {detail.lines.map(line=><section key={line.id} className="order-detail-line">
    <div className="order-line-head"><strong>{line.quantity} × {name({nameFa:line.itemNameFa,namePs:line.itemNamePs,nameEn:line.itemNameEn},locale)}</strong>
      <b>{amount(line.lineTotalMinor,locale)}</b></div>
    {!!line.modifierSnapshot.length&&<div className="order-line-mods">{line.modifierSnapshot.flatMap(group=>
      group.options.map(option=><span key={group.groupId+option.id}>{name(group,locale)}: {name(option,locale)}
        {option.deltaMinor?(" +"+amount(option.deltaMinor,locale)):""}</span>))}</div>}
    {!!line.note&&<p className="order-kitchen-note">{ow(locale,"itemNote")}: {line.note}</p>}
  </section>)}
  {!!detail.round.orderNote&&<p className="order-kitchen-note">{ow(locale,"note")}: {detail.round.orderNote}</p>}
  <div className="order-total"><span>{ow(locale,"total")}</span><strong>{amount(detail.round.totalMinor,locale)}</strong></div>
  <p className="muted order-fees-note">{ow(locale,"noCharge")}</p>
 </div>;
}
function OrderDialog({id,locale,onClose}:{id:string;locale:Locale;onClose:()=>void}){
 const [detail,setDetail]=useState<WebDetail|null>(null),[error,setError]=useState("");
 useEffect(()=>{let active=true;void jsonRequest<WebDetail>("/api/orders/rounds/"+id)
   .then(d=>{if(active)setDetail(d);}).catch(e=>{if(active)setError(e instanceof Error?e.message:ow(locale,"error"));});
   return()=>{active=false;};},[id,locale]);
 return <div className="dialog-backdrop order-dialog-backdrop" role="presentation" onMouseDown={e=>{if(e.target===e.currentTarget)onClose();}}>
  <section className="order-dialog" role="dialog" aria-modal="true" aria-labelledby="order-dialog-title">
    <div className="order-dialog-head"><div><span className="eyebrow">{ow(locale,"orders")} / {id.slice(0,8)}</span>
      <h2 id="order-dialog-title">{ow(locale,"details")}</h2></div>
      <button type="button" className="icon-action" aria-label={ow(locale,"close")} onClick={onClose}><X size={22}/></button></div>
    {!!error&&<p role="alert" className="form-error">{error}</p>}
    {detail?<><div className="order-dialog-meta"><span>{ow(locale,"table")} {detail.ticket?.tableLabel??"—"}</span>
      {detail.ticket&&<Pill status={detail.ticket.status} locale={locale}/>}
      <span>{stamp(detail.round.createdAt,locale)}</span></div>
      <DetailLines detail={detail} locale={locale}/>
      <section className="order-activity"><h3>{ow(locale,"activity")}</h3>
        {detail.activity.map(a=><div key={a.id}><span className="order-timeline-dot"/><span>{a.action.replaceAll("."," · ")}</span>
          <time>{stamp(a.createdAt,locale)}</time></div>)}</section>
      <p className="muted">{ow(locale,"historyHint")}</p>
     </>:<div className="list-skeleton"><span/><span/><span/></div>}
  </section>
 </div>;
}
function TicketCard({row,locale,busy,onTransition,onInspect}:{row:WebRow;locale:Locale;busy:boolean;
 onTransition:(row:WebRow)=>void;onInspect:(id:string)=>void}){
 const [detail,setDetail]=useState<WebDetail|null>(null),[err,setErr]=useState("");
 useEffect(()=>{let live=true;void jsonRequest<WebDetail>("/api/orders/rounds/"+row.id)
   .then(d=>{if(live)setDetail(d);}).catch(e=>{if(live)setErr(e instanceof Error?e.message:ow(locale,"error"));});
   return()=>{live=false;};},[row.id,locale]);
 return <article className={"order-ticket-card "+row.status}>
  <div className="order-ticket-heading"><div><div className="eyebrow">{ow(locale,"ticket")} #{row.roundNumber}</div>
    <h3>{ow(locale,"table")} {row.tableLabel}</h3></div><Pill status={row.status} locale={locale}/></div>
  <div className="order-ticket-meta"><span><Clock3 size={15}/>{age(row.createdAt)}</span><span>{time(row.createdAt,locale)}</span></div>
  {err&&<p className="form-error" role="alert">{err}</p>}
  {detail?<DetailLines detail={detail} locale={locale}/>:
    <div className="list-skeleton order-card-skeleton"><span/><span/></div>}
  <div className="order-ticket-actions">
   <button type="button" className="button button-small" onClick={()=>onInspect(row.id)}>{ow(locale,"inspect")}</button>
   {row.status!=="ready"&&<button type="button" className="button button-primary" disabled={busy}
     onClick={()=>onTransition(row)}><ChefHat size={18}/>{ow(locale,row.status==="new"?"start":"markReady")}</button>}
  </div>
 </article>;
}
export function KitchenConsole({tab}:{tab:"new"|"preparing"|"ready"}){
 const {workspace}=useWorkspace(),locale=workspace.locale;
 const [page,setPage]=useState(1),[busy,setBusy]=useState(false),[notice,setNotice]=useState("");
 const [selected,setSelected]=useState<string|null>(null);
 const {data,loading,error,setError,load}=useOrders("/api/orders/kitchen?status="+tab+"&page="+page);
 const tabs:[typeof tab,string,string][]=[
  ["new","/kitchen/live",ow(locale,"new")],["preparing","/kitchen/preparing",ow(locale,"preparing")],
  ["ready","/kitchen/ready",ow(locale,"ready")]];
 async function transition(row:WebRow){
  if(!window.confirm(ow(locale,row.status==="new"?"confirmStart":"confirmReady")))return;
  setBusy(true);setError("");setNotice("");
  try{
    await jsonRequest("/api/orders/tickets/"+row.ticketId+"/transition",{method:"POST",
      body:JSON.stringify({version:row.ticketVersion,nextStatus:row.status==="new"?"preparing":"ready"})});
    setNotice(ow(locale,"saved"));await load(true);
  }catch(e){setError(e instanceof Phase2Error&&e.code==="VERSION_CONFLICT"?
    ow(locale,"conflict"):e instanceof Error?e.message:ow(locale,"error"));}
  finally{setBusy(false);}
 }
 return <div className="content-stack order-shell">
  <div className="page-heading"><div><div className="eyebrow">DINEFLOW / {ow(locale,"kitchen")}</div>
    <h1>{ow(locale,"kitchen")}</h1><p>{ow(locale,"newHint")}</p></div>
    <button type="button" className="button" onClick={()=>void load()}><RefreshCw size={18}/>{ow(locale,"refresh")}</button></div>
  <nav className="context-tabs" aria-label={ow(locale,"kitchen")}>
    {tabs.map(([key,href,label])=><Link className={"context-tab"+(key===tab?" current":"")}
      aria-current={key===tab?"page":undefined} href={href} key={key}>{label}</Link>)}</nav>
  <div className="order-live-note"><span className="order-signal"/>{ow(locale,"reconnect")}</div>
  {notice&&<p className="success-banner" role="status"><Check size={17}/>{notice}</p>}
  {error&&<div className="form-error" role="alert">{error}
    <button className="text-link" onClick={()=>void load()}>{ow(locale,"retry")}</button></div>}
  {loading&&!data?<div className="list-skeleton"><span/><span/><span/></div>:
    data?.items.length?<div className="order-ticket-grid">{data.items.map(row=>
      <TicketCard key={row.id} row={row} locale={locale} busy={busy} onTransition={r=>void transition(r)}
       onInspect={setSelected}/>)}</div>:
    <div className="settings-card empty-panel"><ChefHat size={36}/><h3>{ow(locale,"empty")}</h3>
      <p>{tab==="ready"?ow(locale,"readyHint"):ow(locale,"newHint")}</p></div>}
  {data&&<Pager locale={locale} page={page} total={data.total} onPage={setPage}/>}
  {selected&&<OrderDialog id={selected} locale={locale} onClose={()=>setSelected(null)}/>}
 </div>;
}
export function ManagementOrders({tab}:{tab:"live"|"history"}){
 const {workspace}=useWorkspace(),locale=workspace.locale;
 const [page,setPage]=useState(1),[selected,setSelected]=useState<string|null>(null);
 const {data,loading,error,load}=useOrders("/api/orders/management?status="+tab+"&page="+page);
 return <div className="content-stack order-shell">
  <div className="page-heading"><div><div className="eyebrow">DINEFLOW / {ow(locale,"orders")}</div>
    <h1>{ow(locale,"orders")}</h1><p>{tab==="live"?ow(locale,"newHint"):ow(locale,"historyHint")}</p></div>
    <button type="button" className="button" onClick={()=>void load()}><RefreshCw size={18}/>{ow(locale,"refresh")}</button></div>
  <nav className="context-tabs" aria-label={ow(locale,"orders")}>
    {(["live","history"] as const).map(k=><Link key={k} href={"/app/orders/"+k}
      className={"context-tab"+(k===tab?" current":"")} aria-current={k===tab?"page":undefined}>
        <Receipt size={17}/>{ow(locale,k)}</Link>)}</nav>
  {error&&<div className="form-error" role="alert">{error}<button type="button" className="text-link" onClick={()=>void load()}>{ow(locale,"retry")}</button></div>}
  {tab==="live"&&<GuestApprovalPanel/>}
  <section className="settings-card">
   <div className="section-heading"><h2>{ow(locale,tab)}</h2>
     <span className="data-badge active">{data?.total??"—"}</span></div>
   {loading&&!data?<div className="list-skeleton"><span/><span/><span/></div>:
     data?.items.length?<div className="table-scroll"><table className="data-table">
       <thead><tr><th>{ow(locale,"table")}</th><th>{ow(locale,"round")}</th>
        <th>{ow(locale,"status")}</th><th>{ow(locale,"total")}</th><th>{ow(locale,"submitted")}</th><th>{ow(locale,"details")}</th></tr></thead>
       <tbody>{data.items.map(row=><tr key={row.id}>
        <td><strong>{row.tableLabel}</strong></td><td>#{row.roundNumber}</td><td><Pill status={row.status} locale={locale}/></td>
        <td className="order-money">{amount(row.totalMinor,locale)}</td>
        <td>{stamp(row.createdAt,locale)}</td>
        <td><button type="button" className="button button-small" onClick={()=>setSelected(row.id)}>
          {ow(locale,"view")} <ArrowUpRight size={16}/></button></td></tr>)}</tbody></table></div>:
        <div className="empty-panel"><Receipt size={30}/><h3>{ow(locale,"emptyHistory")}</h3></div>}
   {data&&<Pager locale={locale} page={page} total={data.total} onPage={setPage}/>}
  </section>
  {selected&&<OrderDialog id={selected} locale={locale} onClose={()=>setSelected(null)}/>}
 </div>;
}
