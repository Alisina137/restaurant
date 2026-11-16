"use client";
import {useCallback,useEffect,useState} from "react";
import Link from "next/link";
import {ArrowLeft,FileDown,Printer,ReceiptText,RefreshCw,Search,ShieldCheck} from "lucide-react";
import {useWorkspace} from "./workspace-provider";
import {jsonRequest} from "@/lib/phase2-api";
import {f9} from "@/lib/finance-copy";
import {isoTime,money,receiptName,type ReceiptDetails,type ReceiptEntry} from "@/lib/finance-types";
type Page={items:ReceiptEntry[];total:number;page:number;perPage:number};
export function FinanceReceipts({area="cashier"}:{area?:"cashier"|"app"}){
 const {workspace}=useWorkspace(),locale=workspace.locale,base=area==="cashier"?"/cashier":"/app/billing";
 const [items,setItems]=useState<Page|null>(null),[page,setPage]=useState(1),[query,setQuery]=useState("");
 const [loading,setLoading]=useState(true),[error,setError]=useState("");
 const load=useCallback(async()=>{
   setLoading(true);
   try{setItems(await jsonRequest<Page>("/api/finance/receipts?page="+page+"&q="+encodeURIComponent(query)));
     setError("");}
   catch(e){setError(e instanceof Error?e.message:f9(locale,"actionFailed"));}
   finally{setLoading(false);}
 },[page,query,locale]);
 useEffect(()=>{void load();},[load]);
 return <div className="content-stack finance-console">
   <div className="page-heading"><div><div className="eyebrow">DINEFLOW / {f9(locale,"checkout")}</div>
      <h1>{f9(locale,"receipts")}</h1><p>{f9(locale,"receiptSnapshot")}</p></div>
      <button type="button" className="button" onClick={()=>void load()}>
        <RefreshCw size={17}/>{f9(locale,"refresh")}</button></div>
   <nav className="finance-area-tabs">
     <Link href={base+"/checks"}>{f9(locale,"checks")}</Link>
     <Link href={base+"/transactions"}>{f9(locale,"transactions")}</Link>
     {area==="cashier"?<Link href="/cashier/shifts">{f9(locale,"shifts")}</Link>:
       <Link href="/app/billing/shifts">{f9(locale,"oversight")}</Link>}
     <Link href={base+"/receipts"} className="selected">{f9(locale,"receipts")}</Link>
   </nav>
   <label className="finance-search finance-receipt-search"><Search size={19}/>
     <input type="search" placeholder={f9(locale,"search")} value={query}
      onChange={e=>{setQuery(e.target.value);setPage(1);}}/></label>
   {error&&<p role="alert" className="form-error">{error}</p>}
   {loading&&!items?<div className="settings-card list-skeleton"><span/><span/></div>:
    items?.items.length?<div className="finance-receipt-grid">
      {items.items.map(row=><article className="finance-receipt-card" key={row.id}>
       <div className="finance-receipt-icon"><ReceiptText size={24}/></div>
       <div className="finance-receipt-data"><span className="eyebrow">{f9(locale,"receiptNumber")}</span>
        <h2>{row.number}</h2>
        <p>{f9(locale,"table")} {row.tableLabel} · {isoTime(row.createdAt,locale)}</p>
        <strong>{money(row.totalMinor,locale)}</strong></div>
       <Link href={base+"/receipts/"+row.id} className="button button-primary">
         {f9(locale,"viewReceipt")}</Link>
       </article>)}</div>:
    <div className="settings-card empty-panel"><ReceiptText size={35}/><h3>{f9(locale,"emptyReceipts")}</h3></div>}
   {!!items&&items.total>items.perPage&&<div className="pager">
     <button type="button" className="button button-small" disabled={page===1}
       onClick={()=>setPage(p=>p-1)}>‹</button>
     <span>{page} / {Math.ceil(items.total/items.perPage)}</span>
     <button type="button" className="button button-small" disabled={page>=Math.ceil(items.total/items.perPage)}
       onClick={()=>setPage(p=>p+1)}>›</button></div>}
 </div>;
}
export function ReceiptView({area="cashier",id}:{area?:"cashier"|"app";id:string}){
 const {workspace}=useWorkspace(),locale=workspace.locale,base=area==="cashier"?"/cashier":"/app/billing";
 const [receipt,setReceipt]=useState<ReceiptDetails|null>(null),[loading,setLoading]=useState(true),
  [busy,setBusy]=useState(false),[error,setError]=useState("");
 const load=useCallback(async()=>{
   setLoading(true);
   try{const r=await jsonRequest<ReceiptDetails>("/api/finance/receipts/"+id);
     setReceipt(r);setError("");}
   catch(e){setError(e instanceof Error?e.message:f9(locale,"actionFailed"));}
   finally{setLoading(false);}
 },[id,locale]);
 useEffect(()=>{void load();},[load]);
 async function reprint(){
   setBusy(true);setError("");
   try{
     await jsonRequest("/api/finance/receipts/"+id+"/reprint",{method:"POST",body:"{}"});
     await load();window.print();
   }catch(e){setError(e instanceof Error?e.message:f9(locale,"actionFailed"));}
   finally{setBusy(false);}
 }
 return <div className="content-stack finance-console finance-receipt-view">
   <div className="page-heading finance-no-print"><div>
     <Link className="finance-back" href={base+"/receipts"}><ArrowLeft size={17}/>{f9(locale,"back")}</Link>
     <h1>{f9(locale,"receiptTitle")}</h1><p>{f9(locale,"receiptSnapshot")}</p></div>
     <button type="button" className="button button-primary" disabled={!receipt||busy}
       onClick={()=>void reprint()}><Printer size={18}/>{f9(locale,"print")}</button>
   </div>
   {error&&<p className="form-error finance-no-print" role="alert">{error}</p>}
   {loading&&!receipt?<div className="settings-card list-skeleton"><span/><span/></div>:
    receipt&&<div className="finance-print-sheet">
      <div className="finance-receipt-header"><div className="finance-receipt-mark"><ReceiptText size={30}/></div>
       <div className="eyebrow">DINEFLOW</div>
       <h2>{receipt.snapshot.restaurant}</h2>
       <p>{f9(locale,"receiptTitle")}</p>
       <strong>{receipt.snapshot.receiptNumber}</strong></div>
      <div className="finance-receipt-details">
       <div><span>{f9(locale,"table")}</span><strong>{receipt.snapshot.tableLabel}</strong></div>
       <div><span>{f9(locale,"check")}</span><strong>#{receipt.snapshot.checkNumber}</strong></div>
       <div><span>{f9(locale,"receiptDate")}</span><strong>{isoTime(receipt.snapshot.issuedAt,locale)}</strong></div>
      </div>
      <div className="finance-receipt-lines">
       <div className="finance-receipt-columns"><span>{f9(locale,"items")}</span>
        <span>{f9(locale,"price")}</span><span>{f9(locale,"amount")}</span></div>
       {receipt.snapshot.lines.map((line,i)=><div className="finance-receipt-line" key={i}>
         <span>{line.quantity} × {receiptName(line,locale)}</span>
         <span>{money(line.unitPriceMinor,locale)}</span>
         <strong>{money(line.lineTotalMinor,locale)}</strong>
       </div>)}
      </div>
      <div className="finance-receipt-totals">
       <div><span>{f9(locale,"subtotal")}</span><b>{money(receipt.snapshot.subtotalMinor,locale)}</b></div>
       <div><span>{f9(locale,"tax")}</span><b>{money(receipt.snapshot.taxMinor,locale)}</b></div>
       <div><span>{f9(locale,"service")}</span><b>{money(receipt.snapshot.serviceMinor,locale)}</b></div>
       <div className="grand"><span>{f9(locale,"total")}</span><strong>{money(receipt.snapshot.totalMinor,locale)}</strong></div>
       <div><span>{f9(locale,"paid")}</span><b>{money(receipt.snapshot.paidMinor,locale)}</b></div>
       <div><span>{f9(locale,"due")}</span><b>{money(0,locale)}</b></div>
      </div>
      <div className="finance-receipt-tenders">
       <h3>{f9(locale,"payments")}</h3>
       {receipt.snapshot.payments.map((p,i)=><div key={i}>
         <span>{f9(locale,p.method==="cash"?"cash":"manual_transfer")}</span>
         <strong>{money(p.amountMinor,locale)}</strong></div>)}
      </div>
      {!!receipt.snapshot.footer&&<p className="finance-receipt-footer">{receipt.snapshot.footer}</p>}
      <div className="finance-receipt-verified"><ShieldCheck size={18}/>
        {f9(locale,"settled")} · {f9(locale,"receiptSnapshot")}</div>
     </div>}
   <p className="finance-no-print finance-muted"><FileDown size={16}/>{f9(locale,"printHint")}</p>
 </div>;
}
