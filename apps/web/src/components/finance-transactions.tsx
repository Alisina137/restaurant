"use client";
import {useCallback,useEffect,useState,type FormEvent} from "react";
import Link from "next/link";
import {ArrowRight,Banknote,CalendarDays,RefreshCw,Search,Wallet} from "lucide-react";
import {useWorkspace} from "./workspace-provider";
import {jsonRequest} from "@/lib/phase2-api";
import {f9} from "@/lib/finance-copy";
import {isoTime,money,type TransactionPage} from "@/lib/finance-types";
export function FinanceTransactions({area="cashier"}:{area?:"cashier"|"app"}){
 const {workspace}=useWorkspace(),locale=workspace.locale;
 const base=area==="cashier"?"/cashier":"/app/billing";
 const [page,setPage]=useState(1),[method,setMethod]=useState("all"),[from,setFrom]=useState(""),
   [to,setTo]=useState(""),[filter,setFilter]=useState({method:"all",from:"",to:""});
 const [data,setData]=useState<TransactionPage|null>(null),[loading,setLoading]=useState(true),[error,setError]=useState("");
 const load=useCallback(async(silent=false)=>{
  if(!silent)setLoading(true);setError("");
  try{
    const response=await jsonRequest<TransactionPage>("/api/finance/transactions?page="+page+
     "&method="+encodeURIComponent(filter.method)+(filter.from?"&from="+filter.from:"")+
     (filter.to?"&to="+filter.to:""));
    setData(response);
  }catch(e){setError(e instanceof Error?e.message:f9(locale,"actionFailed"));}
  finally{setLoading(false);}
 },[filter,page,locale]);
 useEffect(()=>{void load();const t=setInterval(()=>void load(true),18000);return()=>clearInterval(t);},[load]);
 function apply(e:FormEvent){e.preventDefault();setPage(1);setFilter({method,from,to});}
 return <div className="content-stack finance-console">
   <div className="page-heading"><div><div className="eyebrow">DINEFLOW / {f9(locale,"checkout")}</div>
     <h1>{f9(locale,"transactions")}</h1><p>{f9(locale,"receiptSnapshot")}</p></div>
    <button type="button" className="button" onClick={()=>void load()}>
      <RefreshCw size={17}/>{f9(locale,"refresh")}</button></div>
   <nav className="finance-area-tabs">
     <Link href={base+"/checks"}>{f9(locale,"checks")}</Link>
     <Link className="selected" href={base+"/transactions"}>{f9(locale,"transactions")}</Link>
     {area==="cashier"?<Link href="/cashier/shifts">{f9(locale,"shifts")}</Link>:
       <Link href="/app/billing/shifts">{f9(locale,"oversight")}</Link>}
     <Link href={base+"/receipts"}>{f9(locale,"receipts")}</Link>
   </nav>
   <form onSubmit={apply} className="settings-card finance-toolbar">
    <label className="finance-field"><span>{f9(locale,"method")}</span><select value={method}
      onChange={e=>setMethod(e.target.value)}>
       <option value="all">{f9(locale,"all")}</option><option value="cash">{f9(locale,"cash")}</option>
       <option value="manual_transfer">{f9(locale,"manual_transfer")}</option></select></label>
    <label className="finance-field"><span>{f9(locale,"from")}</span><input type="date"
      value={from} onChange={e=>setFrom(e.target.value)}/></label>
    <label className="finance-field"><span>{f9(locale,"to")}</span><input type="date"
      value={to} onChange={e=>setTo(e.target.value)}/></label>
    <button type="submit" className="button button-primary"><Search size={17}/>{f9(locale,"filter")}</button>
   </form>
   {!!data&&<div className="finance-info"><CalendarDays size={17}/>
     {f9(locale,"businessDate")}: {data.timezone} · {f9(locale,"transactions")}: {data.total}</div>}
   {!!error&&<p className="form-error" role="alert">{error}</p>}
   {loading&&!data?<div className="settings-card list-skeleton"><span/><span/></div>:
    data?.items.length?<div className="settings-card finance-table-wrap"><div className="table-scroll">
      <table className="data-table"><thead><tr>
       <th>{f9(locale,"id")}</th><th>{f9(locale,"table")}</th><th>{f9(locale,"method")}</th>
       <th>{f9(locale,"amountPaid")}</th><th>{f9(locale,"time")}</th><th>{f9(locale,"check")}</th>
      </tr></thead><tbody>{data.items.map(x=><tr key={x.id}>
        <td><code>{x.id.slice(0,8)}</code></td><td>{x.tableLabel}</td>
        <td>{f9(locale,x.method==="cash"?"cash":"manual_transfer")}</td>
        <td><b>{money(x.amountMinor,locale)}</b></td><td>{isoTime(x.createdAt,locale)}</td>
        <td><Link className="button button-small" href={base+"/checks/"+x.checkId}>
          #{x.checkNumber}<ArrowRight size={15}/></Link></td>
      </tr>)}</tbody></table></div></div>:
    <div className="settings-card empty-panel"><Wallet size={34}/><h3>{f9(locale,"emptyTransactions")}</h3></div>}
   {!!data&&data.total>data.perPage&&<div className="pager">
     <button className="button button-small" disabled={page===1}
       onClick={()=>setPage(x=>x-1)}>‹</button>
     <span>{page} / {Math.ceil(data.total/data.perPage)}</span>
     <button className="button button-small" disabled={page>=Math.ceil(data.total/data.perPage)}
       onClick={()=>setPage(x=>x+1)}>›</button></div>}
 </div>;
}
