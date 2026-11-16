"use client";
import {useCallback,useEffect,useState} from "react";
import Link from "next/link";
import {ArrowLeft,CheckCircle2,ReceiptText,RefreshCw,ShieldCheck} from "lucide-react";
import {useGuest} from "./guest-shell";
import {guestRequest} from "@/lib/guest-client";
import {f9} from "@/lib/finance-copy";
import {g7} from "@/lib/guest-copy";
import {money,receiptName} from "@/lib/finance-types";
type Bill={visitId:string;tableLabel:string;restaurant:string;checkNumber:number|null;
 status:string;subtotalMinor:number;discountMinor:number;taxMinor:number;serviceMinor:number;totalMinor:number;
 paidMinor:number;dueMinor:number;splitMode:string;currency:string;noPaymentAction:boolean;
 lines:Array<{nameFa:string;namePs:string;nameEn:string;quantity:number;lineTotalMinor:number}>};
export function GuestBill(){
 const {visit,session,locale}=useGuest();
 const [bill,setBill]=useState<Bill|null>(null),[error,setError]=useState(""),[loading,setLoading]=useState(true);
 const load=useCallback(async()=>{
   setLoading(true);
   try{setBill(await guestRequest<Bill>(session.token,"/bill"));setError("");}
   catch(e){setError(e instanceof Error?e.message:g7(locale,"offline"));}
   finally{setLoading(false);}
 },[session.token,locale]);
 useEffect(()=>{void load();const timer=setInterval(()=>{if(document.visibilityState==="visible")void load();},20000);
   return()=>clearInterval(timer);},[load]);
 return <div className="guest-page guest-bill">
   <div className="guest-page-heading"><div><Link href={"/g/"+visit+"/orders"}
      className="guest-back"><ArrowLeft size={16}/>{g7(locale,"back")}</Link>
      <span className="guest-eyebrow">{f9(locale,"customerBill")}</span>
      <h2>{f9(locale,"customerBill")}</h2></div>
     <button type="button" className="guest-icon-button" onClick={()=>void load()}
      aria-label={f9(locale,"refresh")}><RefreshCw size={19}/></button></div>
   <div className="guest-policy"><ShieldCheck size={19}/>{f9(locale,"beforeSettlement")}</div>
   {error&&<div role="alert" className="guest-error">{error}
      <button type="button" onClick={()=>void load()}>{g7(locale,"retry")}</button></div>}
   {loading&&!bill?<div className="guest-loading-inline"><span className="guest-spinner"/>{g7(locale,"loading")}</div>:
    bill&&<div className="guest-bill-card">
      <div className="guest-bill-brand"><ReceiptText size={31}/>
       <h3>{bill.restaurant}</h3>
       <p>{f9(locale,"table")} {bill.tableLabel} · {bill.checkNumber?"#"+bill.checkNumber:f9(locale,"open")}</p>
      </div>
      <div className="guest-bill-items">{bill.lines.map((l,i)=><div key={i}>
        <span>{l.quantity} × {receiptName(l,locale)}</span><b>{money(l.lineTotalMinor,locale)}</b>
      </div>)}</div>
      <div className="guest-bill-totals">
       <div><span>{f9(locale,"subtotal")}</span><b>{money(bill.subtotalMinor,locale)}</b></div>
       {bill.discountMinor>0&&<div><span>{f9(locale,"discount")}</span><b>−{money(bill.discountMinor,locale)}</b></div>}
       <div><span>{f9(locale,"tax")}</span><b>{money(bill.taxMinor,locale)}</b></div>
       <div><span>{f9(locale,"service")}</span><b>{money(bill.serviceMinor,locale)}</b></div>
       <div className="total"><span>{f9(locale,"total")}</span><b>{money(bill.totalMinor,locale)}</b></div>
       <div><span>{f9(locale,"paid")}</span><b>{money(bill.paidMinor,locale)}</b></div>
       <div className="due"><span>{f9(locale,"due")}</span><strong>{money(bill.dueMinor,locale)}</strong></div>
      </div>
      <div className="guest-footer-note"><CheckCircle2 size={18}/>{g7(locale,"noPayment")}</div>
      <Link className="guest-button secondary" href={"/g/"+visit+"/orders"}>{g7(locale,"order")}</Link>
    </div>}
 </div>;
}
