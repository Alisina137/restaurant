"use client";
import {useCallback,useEffect,useState,type FormEvent} from "react";
import Link from "next/link";
import {Check,FileText,RefreshCw,ShieldCheck,Percent,Settings2} from "lucide-react";
import {useWorkspace} from "./workspace-provider";
import {jsonRequest,Phase2Error} from "@/lib/phase2-api";
import {f9} from "@/lib/finance-copy";
import {afnInput,parseAFN} from "@/lib/finance-types";
type Policy={tenantId:string;version:number;taxRateBps:number;taxInclusive:boolean;
 serviceRateBps:number;serviceFixedMinor:number;receiptFooter:string};
function asRate(raw:string):number|null{
 const normalized=raw.trim().replace(/[۰-۹]/g,c=>String(c.charCodeAt(0)-1776))
   .replace(/[٠-٩]/g,c=>String(c.charCodeAt(0)-1632));
 if(!/^\d{1,3}(\.\d{1,2})?$/.test(normalized))return null;
 const value=Math.round(Number(normalized)*100);return value>=0&&value<=10000?value:null;
}
export function FinanceChargeSettings(){
 const {workspace}=useWorkspace(),locale=workspace.locale;
 const [data,setData]=useState<Policy|null>(null),[tax,setTax]=useState("0"),
  [inclusive,setInclusive]=useState(false),[service,setService]=useState("0"),
  [fixed,setFixed]=useState("0"),[footer,setFooter]=useState(""),
  [loading,setLoading]=useState(true),[busy,setBusy]=useState(false),
  [notice,setNotice]=useState(""),[error,setError]=useState("");
 const load=useCallback(async()=>{
   setLoading(true);setError("");
   try{
    const policy=await jsonRequest<Policy>("/api/finance/policy");
    setData(policy);setTax(String(policy.taxRateBps/100));setInclusive(policy.taxInclusive);
    setService(String(policy.serviceRateBps/100));setFixed(afnInput(policy.serviceFixedMinor));
    setFooter(policy.receiptFooter);
   }catch(e){setError(e instanceof Error?e.message:f9(locale,"actionFailed"));}
   finally{setLoading(false);}
 },[locale]);
 useEffect(()=>{void load();},[load]);
 async function save(e:FormEvent){
   e.preventDefault();if(!data||busy)return;
   const taxRateBps=asRate(tax),serviceRateBps=asRate(service),serviceFixedMinor=parseAFN(fixed);
   if(taxRateBps===null||serviceRateBps===null||serviceFixedMinor===null||serviceFixedMinor>100_000_000){
     setError(f9(locale,"invalid"));return;
   }
   setBusy(true);setError("");setNotice("");
   try{
    const result=await jsonRequest<Policy>("/api/finance/policy",{
     method:"PATCH",body:JSON.stringify({version:data.version,taxRateBps,taxInclusive:inclusive,
       serviceRateBps,serviceFixedMinor,receiptFooter:footer})});
    setData(result);setNotice(f9(locale,"policySaved"));
   }catch(e){setError(e instanceof Phase2Error&&e.code==="VERSION_CONFLICT"?f9(locale,"changed"):
      e instanceof Error?e.message:f9(locale,"actionFailed"));}
   finally{setBusy(false);}
 }
 return <div className="content-stack finance-console">
   <div className="page-heading"><div><div className="eyebrow">DINEFLOW / {f9(locale,"checkout")}</div>
    <h1>{f9(locale,"chargeSettings")}</h1><p>{f9(locale,"chargeHelp")}</p></div>
    <button type="button" className="button" onClick={()=>void load()}><RefreshCw size={17}/>{f9(locale,"refresh")}</button>
   </div>
   <nav className="context-tabs">
     <Link className="context-tab" href="/app/settings/restaurant">{f9(locale,"account")}</Link>
     <Link className="context-tab" href="/app/settings/ordering">{f9(locale,"checkout")}</Link>
     <Link className="context-tab current" href="/app/settings/charges" aria-current="page">
       <Percent size={18}/>{f9(locale,"chargeSettings")}</Link>
   </nav>
   <div className="finance-info"><ShieldCheck size={19}/>{f9(locale,"chargeHelp")}</div>
   {notice&&<p role="status" className="success-banner"><Check size={17}/>{notice}</p>}
   {error&&<p role="alert" className="form-error">{error}</p>}
   {loading&&!data?<div className="settings-card list-skeleton"><span/><span/><span/></div>:
    <form className="settings-card finance-charge-form" onSubmit={e=>void save(e)}>
      <div className="section-heading"><h2>{f9(locale,"chargeSettings")}</h2><Settings2 size={25}/></div>
      <div className="finance-policy-grid">
       <label className="finance-field"><span>{f9(locale,"taxRate")}</span>
         <input value={tax} required inputMode="decimal" onChange={e=>setTax(e.target.value)}/></label>
       <label className="finance-field"><span>{f9(locale,"serviceRate")}</span>
         <input value={service} required inputMode="decimal" onChange={e=>setService(e.target.value)}/></label>
       <label className="finance-field"><span>{f9(locale,"serviceFixed")}</span>
         <input value={fixed} required inputMode="decimal" onChange={e=>setFixed(e.target.value)}/></label>
       <label className="finance-checkbox"><input type="checkbox" checked={inclusive}
         onChange={e=>setInclusive(e.target.checked)}/>{f9(locale,"taxIncluded")}</label>
      </div>
      <label className="finance-field"><span>{f9(locale,"footer")}</span>
        <textarea maxLength={250} rows={3} value={footer} onChange={e=>setFooter(e.target.value)}/></label>
      <button className="button button-primary" type="submit" disabled={busy||!data}>
        <Check size={18}/>{busy?f9(locale,"processing"):f9(locale,"savePolicy")}</button>
    </form>}
 </div>;
}
