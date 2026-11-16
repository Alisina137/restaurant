"use client";
import {useCallback,useEffect,useMemo,useState,type FormEvent} from "react";
import Link from "next/link";
import {Activity,ArrowDownToLine,ArrowUpRight,BarChart3,CalendarDays,
 ClipboardList,Clock3,RefreshCw,ShieldCheck,UtensilsCrossed,Wallet} from "lucide-react";
import {useWorkspace} from "./workspace-provider";
import {jsonRequest} from "@/lib/phase2-api";
import {downloadReport} from "@/lib/report-export";
import {r11} from "@/lib/report-copy";
import {money,isoTime} from "@/lib/finance-types";
import type {AuditReport,ItemRow,ItemsReport,ReportTab,
 SalesReport,ServiceReport,SalesDay} from "@/lib/report-types";
import type {Locale} from "@dineflow/shared";

type ReportResult=SalesReport|ItemsReport|ServiceReport|AuditReport;
type Category={id:string;nameFa:string;namePs:string;nameEn:string};
const tabs:ReportTab[]=["sales","items","service","audit"];
const symbol={sales:BarChart3,items:UtensilsCrossed,service:Activity,audit:ShieldCheck};
function readable(day:string,locale:Locale){
 return new Date(day+"T12:00:00.000Z").toLocaleDateString(locale,{month:"short",day:"numeric",timeZone:"UTC"});
}
function ItemLabel({row,locale}:{row:ItemRow;locale:Locale}){
 return <span>{(locale==="en"?row.nameEn:locale==="ps-AF"?row.namePs:row.nameFa)||row.nameFa}</span>;
}
function Chip({children}:{children:React.ReactNode}){return <span className="p11-chip">{children}</span>;}
function Datum({title,value,description,negative=false}:{
 title:string;value:string|number;description?:string;negative?:boolean}){
 return <article className="p11-kpi"><span className="p11-kpi-label">{title}</span>
  <strong className={negative?"p11-negative":""}>{value}</strong>{description&&<small>{description}</small>}</article>;
}
function Chart({values,locale}:{values:SalesDay[];locale:Locale}){
 const max=Math.max(1,...values.map(day=>Math.abs(day.netCollectedMinor)));
 // A fixed-width scroll grid avoids shrinking labels below legible size on phones.
 return <div className="p11-chart-scroll"><div className="p11-bars" role="img"
  aria-label={values.map(x=>x.day+": "+money(x.netCollectedMinor,locale)).join("; ")}>
  {values.map(d=><div key={d.day} className="p11-bar-column"
    title={d.day+" · "+money(d.netCollectedMinor,locale)}>
     <div className="p11-bar-track"><div className={"p11-bar"+(d.netCollectedMinor<0?" negative":"")}
       style={{height:Math.max(Math.abs(d.netCollectedMinor)?6:2,
       Math.round(100*Math.abs(d.netCollectedMinor)/max))+"%"}}/></div>
     <span>{readable(d.day,locale)}</span>
    </div>)}
 </div></div>;
}
function Sales({report,locale}:{report:SalesReport;locale:Locale}){
 const t=report.totals;
 return <div className="p11-section-stack">
  <div className="p11-kpi-grid">
   <Datum title={r11(locale,"gross")} value={money(t.grossMinor,locale)}/>
   <Datum title={r11(locale,"discount")} value={money(t.discountsMinor,locale)}/>
   <Datum title={r11(locale,"netSales")} value={money(t.soldMinor,locale)}
     description={r11(locale,"settled")+": "+t.settledChecks}/>
   <Datum title={r11(locale,"collected")} value={money(t.netCollectedMinor,locale)}
     negative={t.netCollectedMinor<0}/>
  </div>
  <div className="p11-kpi-grid p11-kpi-secondary">
   <Datum title={r11(locale,"tax")} value={money(t.taxMinor,locale)}/>
   <Datum title={r11(locale,"serviceFees")} value={money(t.serviceMinor,locale)}/>
   <Datum title={r11(locale,"paid")} value={money(t.paidMinor,locale)}
     description={r11(locale,"transactions")+": "+t.tenders}/>
   <Datum title={r11(locale,"refunds")} value={money(t.refundedMinor,locale)}
     description={r11(locale,"refunds")+": "+t.refunds}/>
  </div>
  <section className="settings-card p11-panel">
   <div className="section-heading"><div><h2>{r11(locale,"daily")}</h2>
    <p>{r11(locale,"periodHint")}</p></div><BarChart3 size={23}/></div>
   {report.daily.every(x=>x.paidMinor===0&&x.refundedMinor===0)?
    <div className="empty-panel">{r11(locale,"noData")}</div>:<Chart values={report.daily} locale={locale}/>}
  </section>
  <section className="settings-card p11-panel"><div className="section-heading">
   <h2>{r11(locale,"selectedPeriod")}</h2><Chip>{r11(locale,"unit")}</Chip></div>
   <div className="table-scroll"><table className="data-table p11-table">
    <thead><tr><th>{r11(locale,"time")}</th><th>{r11(locale,"settled")}</th>
     <th>{r11(locale,"netSales")}</th><th>{r11(locale,"paid")}</th>
     <th>{r11(locale,"refunds")}</th><th>{r11(locale,"collected")}</th></tr></thead>
    <tbody>{report.daily.map(d=><tr key={d.day}>
     <td><time dateTime={d.day}>{readable(d.day,locale)}</time></td>
     <td>{d.settledChecks}</td><td>{money(d.soldMinor,locale)}</td>
     <td>{money(d.paidMinor,locale)}</td><td>{money(d.refundedMinor,locale)}</td>
     <td><strong>{money(d.netCollectedMinor,locale)}</strong></td>
    </tr>)}</tbody></table></div>
  </section>
  <div className="p11-explain"><ShieldCheck size={20}/>{r11(locale,"financeNote")}</div>
 </div>;
}
function Items({report,locale}:{report:ItemsReport;locale:Locale}){
 const rows=report.items,top=rows[0]?.quantity??1;
 return <section className="settings-card p11-panel">
  <div className="section-heading"><div><h2>{r11(locale,"rankings")}</h2>
   <p>{r11(locale,"categoryHint")}</p></div><Chip>{r11(locale,"showing")}: {rows.length}</Chip></div>
  {!rows.length?<div className="empty-panel"><UtensilsCrossed size={29}/>{r11(locale,"noData")}</div>:<>
   <div className="p11-ranking-list">
    {rows.slice(0,8).map((x,i)=><div className="p11-ranking-item" key={x.itemId+x.nameFa}>
     <span className="p11-rank">{i+1}</span><div className="p11-ranking-copy">
      <strong><ItemLabel row={x} locale={locale}/></strong>
      <div className="p11-progress"><div style={{width:Math.round(100*x.quantity/top)+"%"}}/></div>
     </div><span className="p11-count">{x.quantity} ×</span>
     <b>{money(x.netMinor,locale)}</b></div>)}
   </div>
   <div className="table-scroll"><table className="data-table p11-table">
    <thead><tr><th>{r11(locale,"itemName")}</th><th>{r11(locale,"quantity")}</th>
     <th>{r11(locale,"grossItems")}</th><th>{r11(locale,"discount")}</th>
     <th>{r11(locale,"netItems")}</th></tr></thead>
    <tbody>{rows.map(row=><tr key={row.itemId+row.nameFa}>
     <td><ItemLabel row={row} locale={locale}/></td><td>{row.quantity}</td>
     <td>{money(row.grossMinor,locale)}</td><td>{money(row.discountMinor,locale)}</td>
     <td><strong>{money(row.netMinor,locale)}</strong></td></tr>)}</tbody>
   </table></div>
  </>}
 </section>;
}
function Duration({title,value,locale}:{title:string;value:number|null;locale:Locale}){
 return <Datum title={title} value={value===null?r11(locale,"missing"):
  new Intl.NumberFormat(locale).format(value)+" "+r11(locale,"sec")}
  description={value===null?r11(locale,"insufficientHint"):undefined}/>;
}
function Service({report,locale}:{report:ServiceReport;locale:Locale}){
 const v=report.metrics;
 return <div className="p11-section-stack">
   <div className="p11-kpi-grid">
    <Datum title={r11(locale,"tickets")} value={v.tickets}/>
    <Datum title={r11(locale,"prepared")} value={v.prepared}/>
    <Datum title={r11(locale,"served")} value={v.served}/>
    <Datum title={r11(locale,"cancelRate")} value={v.cancelRatePercent===null?
      r11(locale,"missing"):v.cancelRatePercent+" %"} description={v.cancelledItems+" / "+v.items}/>
   </div>
   <section className="settings-card p11-panel">
    <div className="section-heading"><div><h2>{r11(locale,"service")}</h2>
     <p>{r11(locale,"insufficientHint")}</p></div><Clock3 size={24}/></div>
    <div className="p11-kpi-grid">
      <Duration title={r11(locale,"prepMedian")} value={v.prepMedianSeconds} locale={locale}/>
      <Duration title={r11(locale,"prepP95")} value={v.prepP95Seconds} locale={locale}/>
      <Duration title={r11(locale,"handoff")} value={v.handoffMedianSeconds} locale={locale}/>
      <Duration title={r11(locale,"approval")} value={v.approvalMedianSeconds} locale={locale}/>
    </div>
    <div className="p11-explain">{r11(locale,"approvalP95")}: {v.approvalP95Seconds===null?
      r11(locale,"missing"):v.approvalP95Seconds+" "+r11(locale,"sec")} ·
      {r11(locale,"count")}: {v.reviewed}</div>
   </section>
 </div>;
}
function Audit({report,locale,page,onPage}:{report:AuditReport;locale:Locale;
 page:number;onPage:(n:number)=>void}){
 return <section className="settings-card p11-panel"><div className="section-heading">
  <div><h2>{r11(locale,"events")}</h2><p>{r11(locale,"auditNote")}</p></div>
  <Chip>{report.total}</Chip></div>
  {!report.items.length?<div className="empty-panel">{r11(locale,"noData")}</div>:
   <div className="table-scroll"><table className="data-table p11-table">
    <thead><tr><th>{r11(locale,"time")}</th><th>{r11(locale,"action")}</th>
     <th>{r11(locale,"actor")}</th><th>{r11(locale,"reference")}</th></tr></thead>
    <tbody>{report.items.map(row=><tr key={row.id}>
     <td>{isoTime(String(row.createdAt),locale)}</td><td><code>{row.action}</code></td>
     <td>{row.actorId?.slice(0,8)??"—"}</td>
     <td>{row.checkId?<Link href={"/app/billing/checks/"+encodeURIComponent(row.checkId)}>
      {row.checkId.slice(0,8)} <ArrowUpRight size={13}/></Link>:"—"}</td>
    </tr>)}</tbody></table></div>}
   {report.total>report.perPage&&<div className="pager">
    <button className="button button-small" type="button" disabled={page<=1}
     onClick={()=>onPage(page-1)}>{r11(locale,"previous")}</button>
    <span>{page} / {Math.ceil(report.total/report.perPage)}</span>
    <button className="button button-small" type="button"
     disabled={page>=Math.ceil(report.total/report.perPage)}
     onClick={()=>onPage(page+1)}>{r11(locale,"next")}</button>
   </div>}
 </section>;
}
function relativeDay(last:string,days:number){
 const d=new Date(last+"T12:00:00.000Z");
 d.setUTCDate(d.getUTCDate()-days+1);
 return d.toISOString().slice(0,10);
}
export function ReportsConsole({initialTab="sales"}:{initialTab?:ReportTab}){
 const {workspace}=useWorkspace(),locale=workspace.locale;
 const [tab,setTab]=useState<ReportTab>(initialTab);
 const [from,setFrom]=useState(""),[to,setTo]=useState(""),[applied,setApplied]=useState({from:"",to:""});
 const [data,setData]=useState<ReportResult|null>(null),[loading,setLoading]=useState(true);
 const [error,setError]=useState(""),[notice,setNotice]=useState(""),[exporting,setExporting]=useState(false);
 const [page,setPage]=useState(1),[action,setAction]=useState(""),[actionFilter,setActionFilter]=useState("");
 const [category,setCategory]=useState(""),[categories,setCategories]=useState<Category[]>([]);
 const query=useMemo(()=>{const u=new URLSearchParams();
  if(applied.from)u.set("from",applied.from);if(applied.to)u.set("to",applied.to);
  if(tab==="audit"){u.set("page",String(page));if(actionFilter)u.set("action",actionFilter);}
  if(tab==="items"&&category)u.set("category",category);
  return u.toString()?"&"+u.toString():"";
 },[applied,tab,page,actionFilter,category]);
 useEffect(()=>{void jsonRequest<{items:Category[]}>("/api/reports/categories").then(r=>setCategories(r.items)).catch(()=>{});},[]);
 const load=useCallback(async(silent=false)=>{
  if(!silent)setLoading(true);setError("");
  try{
   const path="/api/reports/"+tab+"?"+query.replace(/^&/,"");
   const result=await jsonRequest<ReportResult>(path);
   setData(result);
  }catch(e){setError(e instanceof Error?e.message:r11(locale,"failure"));}
  finally{setLoading(false);}
 },[tab,query,locale]);
 useEffect(()=>{void load();},[load]);
 function apply(e:FormEvent){e.preventDefault();setData(null);setPage(1);setApplied({from,to});}
 function preset(days:number){
  const last=data?.to??new Date().toISOString().slice(0,10);
  const values={from:relativeDay(last,days),to:last};
  setFrom(values.from);setTo(values.to);setApplied(values);setPage(1);
 }
 async function exportNow(kind=tab){
  if(exporting)return;
  setExporting(true);setError("");setNotice("");
  try{await downloadReport(kind,query.replace(/&page=\d+/g,""));
   setNotice(r11(locale,"exportSuccess"));}
  catch(e){setError(e instanceof Error?e.message:r11(locale,"exportError"));}
  finally{setExporting(false);}
 }
 const active=data&&((tab==="sales"&&"daily" in data)||(tab==="items"&&"items" in data)||
  (tab==="service"&&"metrics" in data)||(tab==="audit"&&"total" in data))?data:null;
 return <div className="content-stack finance-console p11-console">
  <div className="page-heading">
   <div><span className="eyebrow">DINEFLOW / MANAGEMENT INTELLIGENCE</span>
    <h1>{r11(locale,"title")}</h1><p>{r11(locale,"subtitle")}</p></div>
   <div className="p11-top-actions">
    <button type="button" className="button" onClick={()=>void load()} disabled={loading}>
     <RefreshCw size={17}/>{r11(locale,"refresh")}</button>
    <button type="button" className="button button-primary" onClick={()=>void exportNow()}
     disabled={exporting||loading||!active}>
     <ArrowDownToLine size={17}/>{exporting?"…":r11(locale,"export")}</button>
   </div>
  </div>
  <div className="p11-tabs" role="tablist" aria-label={r11(locale,"title")}>
   {tabs.map(key=>{const Icon=symbol[key];return <button key={key} type="button"
    role="tab" aria-selected={tab===key} className={"p11-tab"+(tab===key?" selected":"")}
    onClick={()=>{if(key!==tab){setTab(key);setPage(1);setData(null);}}}>
    <Icon size={18}/>{r11(locale,key)}</button>;})}
  </div>
  <form onSubmit={apply} className="settings-card p11-toolbar">
   <div className="p11-presets"><button type="button" className="button button-small"
    onClick={()=>preset(1)}>{r11(locale,"today")}</button>
    <button type="button" className="button button-small" onClick={()=>preset(7)}>{r11(locale,"week")}</button>
    <button type="button" className="button button-small" onClick={()=>preset(30)}>{r11(locale,"month")}</button>
   </div>
   {tab==="items"&&<label className="finance-field"><span>{r11(locale,"category")}</span>
    <select value={category} onChange={e=>setCategory(e.target.value)}>
     <option value="">{r11(locale,"allCategories")}</option>
     {categories.map(c=><option key={c.id} value={c.id}>
      {(locale==="en"?c.nameEn:locale==="ps-AF"?c.namePs:c.nameFa)||c.nameFa}
     </option>)}
    </select></label>}
   <label className="finance-field"><span>{r11(locale,"from")}</span><input type="date" value={from}
    onChange={e=>setFrom(e.target.value)}/></label>
   <label className="finance-field"><span>{r11(locale,"to")}</span><input type="date" value={to}
    onChange={e=>setTo(e.target.value)}/></label>
   <button type="submit" className="button button-primary"><CalendarDays size={17}/>{r11(locale,"apply")}</button>
   <button type="button" className="button" onClick={()=>{setFrom("");setTo("");
    setApplied({from:"",to:""});setPage(1);}}>{r11(locale,"reset")}</button>
  </form>
  {tab==="audit"&&<form className="settings-card p11-audit-filter"
    onSubmit={e=>{e.preventDefault();setPage(1);setActionFilter(action.trim());}}>
   <label className="finance-field"><span>{r11(locale,"search")}</span>
    <input value={action} maxLength={70} placeholder="finance." onChange={e=>setAction(e.target.value)}/></label>
   <button className="button" type="submit">{r11(locale,"apply")}</button>
  </form>}
  {active&&<div className="p11-range">
   <Chip>{r11(locale,"selectedPeriod")}: {active.from} → {active.to}</Chip>
   <Chip>{r11(locale,"timeZone")}: {active.timezone}</Chip>
   <Chip>{r11(locale,"unit")}</Chip></div>}
  {!!error&&<div className="form-error" role="alert">{error}
   <button type="button" className="text-link" onClick={()=>void load()}>{r11(locale,"refresh")}</button></div>}
  {!!notice&&<div className="success-banner" role="status">{notice}</div>}
  {loading&&!active?<div className="settings-card list-skeleton"><span/><span/><span/></div>:
  active&&("daily" in active)?<Sales report={active} locale={locale}/>:
  active&&("items" in active)&&("note" in active)?<Items report={active} locale={locale}/>:
  active&&("metrics" in active)?<Service report={active} locale={locale}/>:
  active&&("total" in active)?<Audit report={active} locale={locale} page={page} onPage={setPage}/>:
  !loading?<div className="settings-card empty-panel">{r11(locale,"dataPending")}</div>:null}
  <div className="p11-footer"><ShieldCheck size={18}/>{r11(locale,"timezoneNote")} ·
   <Link href="/app/billing/transactions">{r11(locale,"linkBilling")} <ArrowUpRight size={15}/></Link></div>
 </div>;
}
