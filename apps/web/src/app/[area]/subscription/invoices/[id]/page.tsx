"use client";
import {use} from "react";
import {useSaasData} from "@/lib/phase12-api";
import {money} from "@/lib/finance-types";
import {p12} from "@/lib/phase12-copy";
import {useWorkspace} from "@/components/workspace-provider";
import {Printer,ArrowLeft} from "lucide-react";
import Link from "next/link";
type Invoice={id:string;number:string;status:string;amountMinor:number;currency:string;
 periodStart:string;periodEnd:string;dueAt:string;issuedAt:string;paidAt:string|null;
 planSnapshot:{name:string;planKey:string;version:number;periodDays:number;priceMinor:number;
 maxTables:number;maxStaff:number;maxLocations:number}};
export default function InvoicePrint({params}:{params:Promise<{area:string;id:string}>}){
 const {id}=use(params),{workspace}=useWorkspace(),locale=workspace.locale;
 const {data,error,loading}=useSaasData<{invoice:Invoice;restaurant:{name:string;slug:string}|null}>(
  "/api/subscription/invoices/"+encodeURIComponent(id));
 const i=data?.invoice;
 function date(v:string){return new Date(v).toLocaleDateString(locale,{year:"numeric",month:"long",day:"numeric"});}
 return <div className="content-stack p12-console p12-print-page">
  <div className="p12-print-actions"><Link className="button" href="/app/subscription"><ArrowLeft size={17}/>{p12(locale,"back")}</Link>
   <button className="button button-primary" disabled={!i} onClick={()=>window.print()}><Printer size={18}/>{p12(locale,"printInvoice")}</button></div>
  {loading&&!i&&<div className="list-skeleton"><span/><span/></div>}
  {error&&<div className="form-error" role="alert">{error}</div>}
  {i&&<article className="p12-print-document">
   <div className="p12-print-heading"><div><span className="eyebrow">DINEFLOW</span>
    <h1>{p12(locale,"invoiceNumber")} {i.number}</h1>
    <p>{data?.restaurant?.name} · {data?.restaurant?.slug}</p></div>
    <span className="data-badge">{i.status.toUpperCase()}</span></div>
   <dl className="profile-list">
    <div><dt>{p12(locale,"plans")}</dt><dd>{i.planSnapshot.name} (v{i.planSnapshot.version})</dd></div>
    <div><dt>{p12(locale,"issued")}</dt><dd>{date(i.issuedAt)}</dd></div>
    <div><dt>{p12(locale,"due")}</dt><dd>{date(i.dueAt)}</dd></div>
    <div><dt>{p12(locale,"status")}</dt><dd>{i.status}</dd></div>
    <div><dt>{p12(locale,"periodDays")}</dt><dd>{date(i.periodStart)} — {date(i.periodEnd)}</dd></div>
    <div><dt>{p12(locale,"tables")}</dt><dd>{i.planSnapshot.maxTables}</dd></div>
    <div><dt>{p12(locale,"staff")}</dt><dd>{i.planSnapshot.maxStaff}</dd></div>
    <div><dt>{p12(locale,"locations")}</dt><dd>{i.planSnapshot.maxLocations}</dd></div>
   </dl><div className="p12-print-total"><span>{p12(locale,"amount")}</span>
    <strong>{money(i.amountMinor,locale)}</strong></div>
   <p className="muted">{p12(locale,"proofWarning")}</p>
   {i.paidAt&&<p>{p12(locale,"paid")}: {date(i.paidAt)}</p>}
  </article>}
 </div>;
}
