"use client";
import {useState,type FormEvent} from "react";
import Link from "next/link";
import {ArrowUpRight,BadgeCheck,Banknote,BookOpen,Building2,ClipboardCheck,
 CreditCard,FileText,Headphones,History,Plus,RefreshCw,Settings2,ShieldCheck,TicketCheck,UsersRound} from "lucide-react";
import {useWorkspace} from "./workspace-provider";
import {SaasConversation} from "./phase12-tenant";
import {useSaasData,postSaas} from "@/lib/phase12-api";
import {p12} from "@/lib/phase12-copy";
import {money} from "@/lib/finance-types";
import type {Locale} from "@dineflow/shared";
type Plan={id:string;planKey:string;version:number;name:string;priceMinor:number;periodDays:number;
 maxTables:number;maxStaff:number;maxLocations:number;active:boolean;features:string[]};
type Tenant={id:string;name:string;slug:string;status:string;createdAt:string;planId:string|null;
 subscriptionStatus:string|null;trialEndsAt:string|null;periodEnd:string|null};
type Invoice={id:string;tenantId:string;tenantName:string;number:string;status:string;
 amountMinor:number;issuedAt:string;dueAt:string;paidAt:string|null;
 planSnapshot:{name:string;version:number;priceMinor:number}};
type Proof={id:string;invoiceId:string;invoiceNumber:string;tenantId:string;tenantName:string;
 amountMinor:number;status:string;method:string;reference:string;note:string;createdAt:string;reviewReason:string|null};
type Ticket={id:string;tenantId:string;tenantName:string;subject:string;status:string;
 kind:string;priority:string;createdAt:string};
type Grant={id:string;tenantId:string;tenantName:string;scope:string;reason:string;
 expiresAt:string;revokedAt:string|null};
type Audit={id:string;actorId:string|null;tenantId:string|null;action:string;createdAt:string};
type Settings={trialDays:number;graceDays:number;supportEmail:string;incidentBanner:string};
type Page<T>={items:T[];total:number;page:number;perPage:number};
function dt(v:string|null|undefined,locale:Locale){return v?new Date(v).toLocaleDateString(locale,
 {month:"short",day:"numeric",year:"numeric"}):"—";}
function Display({error,notice}:{error:string;notice:string}){return <>
 {error&&<div className="form-error" role="alert">{error}</div>}
 {notice&&<div className="success-banner" role="status">{notice}</div>}</>;}
function Empty({text}:{text:string}){return <div className="empty-panel">{text}</div>;}
function Refresh({onClick,label}:{onClick:()=>void;label:string}){return <button className="button" type="button" onClick={onClick}><RefreshCw size={16}/>{label}</button>;}
function Pager({page,total,perPage,setPage,locale}:{page:number;total:number;perPage:number;setPage:(n:number)=>void;locale:Locale}){
 if(total<=perPage)return null;
 return <div className="pager"><button className="button" disabled={page<=1} onClick={()=>setPage(page-1)}>{p12(locale,"previous")}</button>
 <span>{page}/{Math.ceil(total/perPage)}</span><button className="button" disabled={page>=Math.ceil(total/perPage)}
 onClick={()=>setPage(page+1)}>{p12(locale,"next")}</button></div>;
}
function Header({title,desc}:{title:string;desc:string}){
 return <div className="page-heading"><div><div className="eyebrow">DINEFLOW / PLATFORM OPERATIONS</div>
 <h1>{title}</h1><p>{desc}</p></div><ShieldCheck size={27}/></div>;
}
function useOperate(reloads:Array<()=>Promise<void>>,locale:Locale){
 const [busy,setBusy]=useState(false),[error,setError]=useState(""),[notice,setNotice]=useState("");
 async function run(path:string,body:Record<string,unknown>,method="POST"){
  if(busy)return false;
  setBusy(true);setError("");setNotice("");
  try{await postSaas(path,body,method);setNotice(p12(locale,"success"));await Promise.all(reloads.map(f=>f()));return true;}
  catch(e){setError(e instanceof Error?e.message:p12(locale,"error"));return false;}
  finally{setBusy(false);}
 }
 return {run,busy,error,notice};
}
export function PlatformDashboard(){
 const {workspace}=useWorkspace(),locale=workspace.locale;
 const {data,loading,error,load}=useSaasData<{tenants:number;trials:number;suspended:number;
  overdueInvoices:number;paymentReviews:number;openTickets:number;pendingRestaurants:number}>("/api/platform/overview");
 const cards=[["restaurants",data?.tenants,Building2,"/platform/restaurants"],
  ["trial",data?.trials,BadgeCheck,"/platform/restaurants?status=trial"],
  ["suspended",data?.suspended,ShieldCheck,"/platform/restaurants?status=suspended"],
  ["overdue",data?.overdueInvoices,FileText,"/platform/subscriptions"],
  ["proofReview",data?.paymentReviews,CreditCard,"/platform/subscriptions"],
  ["ticketQueue",data?.openTickets,Headphones,"/platform/support"],
  ["pending",data?.pendingRestaurants,ClipboardCheck,"/platform/restaurants?status=pending"]] as const;
 return <div className="content-stack p12-console"><Header title={p12(locale,"overview")} desc={p12(locale,"platformHelp")}/>
 <Refresh onClick={()=>void load()} label={p12(locale,"refresh")}/><Display error={error} notice=""/>
 <div className="p12-stat-grid">{cards.map(([key,count,Icon,href])=><Link href={href} className="p12-stat" key={key}>
  <Icon size={22}/><span>{p12(locale,key)}</span><strong>{loading?"—":count??"—"}</strong>
  <ArrowUpRight size={16}/></Link>)}</div>
 <div className="p12-split"><section className="settings-card p12-panel"><h2>{p12(locale,"manuallyVerified")}</h2>
  <p>{p12(locale,"privateNote")}</p><Link className="button button-primary" href="/platform/subscriptions">
   <Banknote size={16}/>{p12(locale,"payments")}</Link></section>
  <section className="settings-card p12-panel"><h2>{p12(locale,"support")}</h2>
   <p>{p12(locale,"grantHelp")}</p><Link className="button" href="/platform/support">
   <TicketCheck size={16}/>{p12(locale,"tickets")}</Link></section></div></div>;
}
type TenantDetail={restaurant:{id:string;name:string;status:string;slug:string};
 subscription:{planId:string|null;status:string;periodEnd:string|null;trialEndsAt:string|null;graceEndsAt:string|null}|null;
 locations:{name:string;city:string}[];owners:{name:string;email:string}[];
 invoices:{id:string;number:string;status:string;amountMinor:number;dueAt:string}[]};
export function PlatformTenantDetail({id}:{id:string}){
 const {workspace}=useWorkspace(),locale=workspace.locale;
 const d=useSaasData<TenantDetail>("/api/platform/tenants/"+encodeURIComponent(id));
 const plans=useSaasData<{items:Plan[]}>("/api/platform/plans");
 const {run,busy,error,notice}=useOperate([d.load],locale);
 const [reason,setReason]=useState(""),[plan,setPlan]=useState("");
 const planId=plan||d.data?.subscription?.planId||plans.data?.items[0]?.id||"";
 return <div className="content-stack p12-console">
 <Header title={d.data?.restaurant.name??p12(locale,"tenantName")} desc={p12(locale,"privateNote")}/>
 <Link className="button" href="/platform/restaurants">{p12(locale,"back")}</Link>
 <Display error={error||d.error||plans.error} notice={notice}/>
 {d.data&&<div className="p12-split"><section className="settings-card p12-panel">
  <div className="section-heading"><h2>{d.data.restaurant.name}</h2><span className="data-badge">{d.data.restaurant.status}</span></div>
  <dl className="profile-list"><div><dt>Slug</dt><dd>{d.data.restaurant.slug}</dd></div>
   <div><dt>{p12(locale,"planKey")}</dt><dd>{d.data.subscription?.planId??"—"}</dd></div>
   <div><dt>{p12(locale,"status")}</dt><dd>{d.data.subscription?.status??"—"}</dd></div>
   <div><dt>{p12(locale,"renews")}</dt><dd>{dt(d.data.subscription?.periodEnd,locale)}</dd></div>
   <div><dt>{p12(locale,"trialEnds")}</dt><dd>{dt(d.data.subscription?.trialEndsAt,locale)}</dd></div>
   <div><dt>{p12(locale,"locations")}</dt><dd>{d.data.locations.map(x=>x.name+", "+x.city).join("; ")||"—"}</dd></div>
   <div><dt>{p12(locale,"owner")}</dt><dd>{d.data.owners.map(x=>x.name+" · "+x.email).join("; ")||"—"}</dd></div></dl>
  </section><section className="settings-card p12-panel"><h2>{p12(locale,"changeState")}</h2>
   <label>{p12(locale,"reason")}<textarea required minLength={5} maxLength={300}
    value={reason} onChange={e=>setReason(e.target.value)}/></label>
   <div className="p12-actions">{(["suspend","grace","restore","approve","reject"] as const).map(act=><button key={act}
    className={"button button-small"+(act==="suspend"||act==="reject"?" button-danger":"")}
    disabled={busy||reason.trim().length<5}
    onClick={()=>void run("/api/platform/tenants/"+encodeURIComponent(id)+"/status",{action:act,reason})}>
    {p12(locale,act==="grace"?"graceAction":act)}</button>)}</div>
   <hr/><h3>{p12(locale,"assignPlan")}</h3><div className="p12-form-row">
    <select value={planId} onChange={e=>setPlan(e.target.value)} aria-label={p12(locale,"plans")}>
     {plans.data?.items.filter(p=>p.active).map(p=><option value={p.id} key={p.id}>{p.name} v{p.version}</option>)}</select>
    <button className="button button-primary" disabled={busy||!planId}
     onClick={()=>void run("/api/platform/tenants/"+encodeURIComponent(id)+"/plan",{planId})}>{p12(locale,"assign")}</button></div>
  </section></div>}
 <section className="settings-card p12-panel"><h2>{p12(locale,"history")}</h2>
  {!d.data?.invoices.length?<Empty text={p12(locale,"noInvoices")}/>:
   <div className="p12-list">{d.data?.invoices.map(i=><div className="p12-list-row" key={i.id}>
    <FileText size={18}/><span><strong>{i.number}</strong><small>{dt(i.dueAt,locale)}</small></span>
    <strong>{money(i.amountMinor,locale)}</strong><span className="data-badge">{i.status}</span></div>)}</div>}</section>
 </div>;
}
export function PlatformTenants(){
 const {workspace}=useWorkspace(),locale=workspace.locale;
 const [page,setPage]=useState(1),[status,setStatus]=useState(""),[q,setQ]=useState(""),[search,setSearch]=useState("");
 const filter=new URLSearchParams({page:String(page)});if(status)filter.set("status",status);if(search)filter.set("q",search);
 const d=useSaasData<Page<Tenant>>("/api/platform/tenants?"+filter.toString());
 return <div className="content-stack p12-console"><Header title={p12(locale,"restaurants")} desc={p12(locale,"privateNote")}/>
 <form className="settings-card p12-form-row" onSubmit={e=>{e.preventDefault();setPage(1);setSearch(q);}}>
  <label className="p12-grow">{p12(locale,"restaurants")}<input value={q} onChange={e=>setQ(e.target.value)}
   maxLength={80} placeholder={p12(locale,"tenantName")}/></label>
  <label>{p12(locale,"status")}<select value={status} onChange={e=>{setPage(1);setStatus(e.target.value);}}>
   <option value="">{p12(locale,"all")}</option>{(["active","trial","pending","suspended","rejected"] as const)
    .map(k=><option value={k} key={k}>{p12(locale,k==="pending"?"pending":k)}</option>)}</select></label>
  <button type="submit" className="button button-primary">{p12(locale,"filter")}</button>
  <Refresh onClick={()=>void d.load()} label={p12(locale,"refresh")}/></form>
 <Display error={d.error} notice=""/><section className="settings-card p12-panel">
  <div className="section-heading"><h2>{p12(locale,"restaurants")}</h2><span className="p12-pill">{d.data?.total??"—"}</span></div>
  {!d.data?.items.length&&!d.loading?<Empty text={p12(locale,"noData")}/>:
   <div className="table-scroll"><table className="data-table"><thead><tr>
    <th>{p12(locale,"tenantName")}</th><th>{p12(locale,"status")}</th><th>{p12(locale,"plans")}</th>
    <th>{p12(locale,"renews")}</th><th>{p12(locale,"action")}</th></tr></thead>
    <tbody>{d.data?.items.map(t=><tr key={t.id}>
     <td><strong>{t.name}</strong><div className="muted">{t.slug}</div></td>
     <td><span className={"data-badge "+t.status}>{t.status}</span></td>
     <td>{t.planId??"—"}<div className="muted">{t.subscriptionStatus??"—"}</div></td>
     <td>{dt(t.periodEnd??t.trialEndsAt,locale)}</td>
     <td><Link className="button button-small" href={"/platform/restaurants/"+encodeURIComponent(t.id)}>
      {p12(locale,"view")}<ArrowUpRight size={15}/></Link></td></tr>)}</tbody></table></div>}
  <Pager page={page} total={d.data?.total??0} perPage={20} setPage={setPage} locale={locale}/>
 </section></div>;
}
export function PlatformSubscriptions(){
 const {workspace}=useWorkspace(),locale=workspace.locale;
 const [tab,setTab]=useState<"plans"|"invoices"|"payments">("plans");
 const plans=useSaasData<{items:Plan[]}>("/api/platform/plans");
 const tenants=useSaasData<Page<Tenant>>("/api/platform/tenants");
 const [invoicePage,setInvoicePage]=useState(1),[proofPage,setProofPage]=useState(1),[proofStatus,setProofStatus]=useState("pending");
 const invoices=useSaasData<Page<Invoice>>("/api/platform/invoices?page="+invoicePage);
 const proofs=useSaasData<Page<Proof>>("/api/platform/payments?status="+proofStatus+"&page="+proofPage);
 const {run,busy,error,notice}=useOperate([plans.load,invoices.load,proofs.load],locale);
 const [planKey,setPlanKey]=useState("starter"),[name,setName]=useState(""),[price,setPrice]=useState(99000);
 const [tableLimit,setTableLimit]=useState(20),[staffLimit,setStaffLimit]=useState(10),[period,setPeriod]=useState(30);
 const [tenantId,setTenantId]=useState(""),[invoicePlanId,setInvoicePlanId]=useState(""),[dueDays,setDueDays]=useState(14);
 const [reviewId,setReviewId]=useState(""),[reviewReason,setReviewReason]=useState("");
 const chosenTenant=tenantId||tenants.data?.items[0]?.id||"",chosenPlan=invoicePlanId||plans.data?.items[0]?.id||"";
 return <div className="content-stack p12-console"><Header title={p12(locale,"subscription")} desc={p12(locale,"platformHelp")}/>
 <div className="p12-tabs">{(["plans","invoices","payments"] as const).map(k=><button type="button" key={k}
  className={"p12-tab"+(tab===k?" selected":"")} onClick={()=>setTab(k)}>{p12(locale,k)}</button>)}</div>
 <Display error={error||plans.error||invoices.error||proofs.error} notice={notice}/>
 {tab==="plans"&&<><section className="settings-card p12-panel"><div className="section-heading">
  <h2>{p12(locale,"plans")}</h2><BookOpen size={22}/></div>
  <div className="p12-plan-grid">{plans.data?.items.map(p=><article className="p12-plan-card" key={p.id}>
   <span className="p12-pill">{p.planKey} v{p.version}</span><h3>{p.name}</h3>
   <strong>{money(p.priceMinor,locale)}</strong><p>{p.periodDays} {p12(locale,"periodDays")}</p>
   <dl><div><dt>{p12(locale,"tables")}</dt><dd>{p.maxTables}</dd></div>
    <div><dt>{p12(locale,"staff")}</dt><dd>{p.maxStaff}</dd></div>
    <div><dt>{p12(locale,"locations")}</dt><dd>{p.maxLocations}</dd></div></dl>
  </article>)}</div></section>
 <section className="settings-card p12-panel"><div className="section-heading"><h2>{p12(locale,"createPlan")}</h2><Plus/></div>
  <form className="p12-form-stack" onSubmit={e=>{e.preventDefault();void run("/api/platform/plans",
   {planKey,name,priceMinor:price,periodDays:period,maxTables:tableLimit,maxStaff:staffLimit,maxLocations:1});}}>
   <div className="p12-form-row"><label>{p12(locale,"planKey")}<input required minLength={3}
    maxLength={30} value={planKey} onChange={e=>setPlanKey(e.target.value)}/></label>
    <label className="p12-grow">{p12(locale,"planName")}<input required minLength={3}
    maxLength={70} value={name} onChange={e=>setName(e.target.value)}/></label>
    <label>{p12(locale,"price")}<input type="number" required min={0} value={price}
     onChange={e=>setPrice(Number(e.target.value))}/></label>
    <label>{p12(locale,"periodDays")}<input type="number" min={1} max={365} value={period}
     onChange={e=>setPeriod(Number(e.target.value))}/></label></div>
   <div className="p12-form-row"><label>{p12(locale,"maxTables")}<input type="number" min={1} value={tableLimit}
     onChange={e=>setTableLimit(Number(e.target.value))}/></label>
    <label>{p12(locale,"maxStaff")}<input type="number" min={1} value={staffLimit}
     onChange={e=>setStaffLimit(Number(e.target.value))}/></label>
    <button className="button button-primary" type="submit" disabled={busy}>{p12(locale,"createPlan")}</button></div>
  </form></section></>}
 {tab==="invoices"&&<><section className="settings-card p12-panel"><h2>{p12(locale,"newInvoice")}</h2>
  <p>{p12(locale,"manuallyVerified")}</p><form className="p12-form-row" onSubmit={e=>{e.preventDefault();void run("/api/platform/invoices",
   {tenantId:chosenTenant,planId:chosenPlan,dueDays});}}>
   <label className="p12-grow">{p12(locale,"tenantName")}<select value={chosenTenant}
    onChange={e=>setTenantId(e.target.value)}>{tenants.data?.items.map(t=><option value={t.id} key={t.id}>{t.name}</option>)}</select></label>
   <label className="p12-grow">{p12(locale,"plans")}<select value={chosenPlan}
    onChange={e=>setInvoicePlanId(e.target.value)}>{plans.data?.items.map(p=><option value={p.id} key={p.id}>
    {p.name} v{p.version} · {money(p.priceMinor,locale)}</option>)}</select></label>
   <label>{p12(locale,"dueDays")}<input type="number" min={1} max={90} value={dueDays}
    onChange={e=>setDueDays(Number(e.target.value))}/></label>
   <button className="button button-primary" disabled={busy||!chosenTenant||!chosenPlan} type="submit">{p12(locale,"issueInvoice")}</button>
  </form></section><section className="settings-card p12-panel"><h2>{p12(locale,"invoices")}</h2>
   {!invoices.data?.items.length&&!invoices.loading?<Empty text={p12(locale,"noInvoices")}/>:
   <div className="table-scroll"><table className="data-table"><thead><tr><th>{p12(locale,"invoiceNumber")}</th>
    <th>{p12(locale,"tenantName")}</th><th>{p12(locale,"amount")}</th>
    <th>{p12(locale,"status")}</th><th>{p12(locale,"due")}</th><th>{p12(locale,"action")}</th></tr></thead>
    <tbody>{invoices.data?.items.map(i=><tr key={i.id}>
     <td>{i.number}<div className="muted">{i.planSnapshot.name}</div></td><td>{i.tenantName}</td>
     <td>{money(i.amountMinor,locale)}</td><td><span className="data-badge">{i.status}</span></td>
     <td>{dt(i.dueAt,locale)}</td><td>{i.status==="issued"&&<button disabled={busy} className="button button-small"
      onClick={()=>{const reason=window.prompt(p12(locale,"reason"));if(reason&&reason.trim().length>=5)
       void run("/api/platform/invoices/"+encodeURIComponent(i.id)+"/void",{reason});}}>
      {p12(locale,"voided")}</button>}</td></tr>)}</tbody></table></div>}
   <Pager page={invoicePage} total={invoices.data?.total??0} perPage={20} setPage={setInvoicePage} locale={locale}/>
  </section></>}
 {tab==="payments"&&<section className="settings-card p12-panel"><div className="section-heading">
  <h2>{p12(locale,"proofReview")}</h2>
  <select value={proofStatus} onChange={e=>{setProofPage(1);setProofStatus(e.target.value);}}>
   {(["pending","verified","rejected"] as const).map(k=><option value={k} key={k}>{p12(locale,k)}</option>)}</select></div>
  {!proofs.data?.items.length&&!proofs.loading?<Empty text={p12(locale,"noData")}/>:
  <div className="p12-list">{proofs.data?.items.map(p=><article className="p12-proof" key={p.id}>
   <div className="p12-invoice-main"><CreditCard size={22}/><div><strong>{p.invoiceNumber} — {p.tenantName}</strong>
    <small>{dt(p.createdAt,locale)} · {p.method} · {p.reference}</small></div></div>
   <div><strong>{money(p.amountMinor,locale)}</strong><p>{p.note||"—"}</p></div>
   {p.status==="pending"?<><label>{p12(locale,"reason")}<input maxLength={280} minLength={5}
    value={reviewId===p.id?reviewReason:""} onChange={e=>{setReviewId(p.id);setReviewReason(e.target.value);}}
    placeholder={p12(locale,"reason")}/></label>
   <div className="p12-actions"><button className="button button-primary" disabled={busy||reviewId!==p.id||reviewReason.trim().length<5}
    onClick={()=>void run("/api/platform/payments/"+encodeURIComponent(p.id)+"/review",
     {decision:"verify",reason:reviewReason})}>{p12(locale,"verify")}</button>
    <button className="button" disabled={busy||reviewId!==p.id||reviewReason.trim().length<5}
     onClick={()=>void run("/api/platform/payments/"+encodeURIComponent(p.id)+"/review",
      {decision:"reject",reason:reviewReason})}>{p12(locale,"reject")}</button></div></>:
    <span className="p12-pill">{p12(locale,p.status==="verified"?"verified":"rejected")} · {p.reviewReason}</span>}
  </article>)}</div>}
  <Pager page={proofPage} total={proofs.data?.total??0} perPage={20} setPage={setProofPage} locale={locale}/>
 </section>}
 <div className="p12-note"><ShieldCheck size={18}/>{p12(locale,"manuallyVerified")}</div>
 </div>;
}
export function PlatformSupport(){
 const {workspace}=useWorkspace(),locale=workspace.locale;
 const tickets=useSaasData<Page<Ticket>>("/api/platform/support/tickets");
 const grants=useSaasData<{items:Grant[]}>("/api/platform/support/grants");
 const [selected,setSelected]=useState("");
 const [metaId,setMetaId]=useState("");
 const metadata=useSaasData<{scope:string;expiresAt:string;restaurant:{name:string}|null;
  subscription:{status:string;planId:string}|null;settings:{timezone:string;locale:string}|null}>(
   metaId?"/api/platform/support/grants/"+encodeURIComponent(metaId)+"/metadata":"/api/platform/overview");
 return <div className="content-stack p12-console"><Header title={p12(locale,"support")} desc={p12(locale,"grantHelp")}/>
 <Display error={tickets.error||grants.error} notice=""/>
 <section className="settings-card p12-panel"><div className="section-heading">
  <h2>{p12(locale,"ticketQueue")}</h2><Refresh onClick={()=>void tickets.load()} label={p12(locale,"refresh")}/></div>
  {!tickets.data?.items.length&&!tickets.loading?<Empty text={p12(locale,"noData")}/>:
   <div className="p12-list">{tickets.data?.items.map(t=><button key={t.id} className={"p12-list-row"+(t.id===selected?" selected":"")}
    onClick={()=>setSelected(t.id)}><TicketCheck size={20}/><span><strong>{t.subject}</strong>
    <small>{t.tenantName} · {t.kind} · {dt(t.createdAt,locale)}</small></span>
    <span className="data-badge">{t.status}</span><ArrowUpRight size={16}/></button>)}</div>}</section>
 {selected&&<SaasConversation id={selected} key={selected}/>}
 <section className="settings-card p12-panel"><div className="section-heading">
  <h2>{p12(locale,"grants")}</h2><ShieldCheck size={22}/></div>
  {!grants.data?.items.length&&!grants.loading?<Empty text={p12(locale,"notGranted")}/>:
  <div className="p12-list">{grants.data?.items.map(g=><div className="p12-list-row" key={g.id}>
   <ShieldCheck size={19}/><span><strong>{g.tenantName} · {g.scope}</strong>
    <small>{g.reason} · {dt(g.expiresAt,locale)}</small></span>
   <span className="p12-pill">{g.revokedAt?"Revoked":new Date(g.expiresAt)>new Date()?"Active":"Expired"}</span>
   {g.revokedAt===null&&new Date(g.expiresAt)>new Date()&&<button className="button button-small"
    onClick={()=>setMetaId(g.id)}>{p12(locale,"supportMeta")}</button>}</div>)}</div>}
  {metaId&&<div className="p12-metadata"><h3>{p12(locale,"supportMeta")}</h3>
   {metadata.error&&<Display error={metadata.error} notice=""/>}
   {metadata.data&&metadata.data.restaurant&&<dl className="profile-list">
    <div><dt>{p12(locale,"tenantName")}</dt><dd>{metadata.data.restaurant.name}</dd></div>
    <div><dt>{p12(locale,"grantScope")}</dt><dd>{metadata.data.scope}</dd></div>
    <div><dt>{p12(locale,"status")}</dt><dd>{metadata.data.subscription?.status??"—"}</dd></div>
    <div><dt>{p12(locale,"settings")}</dt><dd>{metadata.data.settings?.timezone??"—"}</dd></div></dl>}
  </div>}</section></div>;
}
export function PlatformAudit(){
 const {workspace}=useWorkspace(),locale=workspace.locale;
 const [page,setPage]=useState(1),[action,setAction]=useState(""),[q,setQ]=useState("");
 const filter=new URLSearchParams({page:String(page)});if(q)filter.set("action",q);
 const d=useSaasData<Page<Audit>>("/api/platform/audit?"+filter.toString());
 return <div className="content-stack p12-console"><Header title={p12(locale,"auditEvents")} desc={p12(locale,"privateNote")}/>
 <form className="settings-card p12-form-row" onSubmit={e=>{e.preventDefault();setPage(1);setQ(action);}}>
  <label className="p12-grow">{p12(locale,"searchAction")}<input maxLength={90} value={action}
   onChange={e=>setAction(e.target.value)} placeholder="platform."/></label>
  <button className="button button-primary" type="submit">{p12(locale,"filter")}</button></form>
 <Display error={d.error} notice=""/>
 <section className="settings-card p12-panel">{!d.data?.items.length&&!d.loading?<Empty text={p12(locale,"noData")}/>:
 <div className="table-scroll"><table className="data-table"><thead><tr>
  <th>{p12(locale,"issued")}</th><th>{p12(locale,"action")}</th>
  <th>{p12(locale,"owner")}</th><th>{p12(locale,"tenantName")}</th></tr></thead>
  <tbody>{d.data?.items.map(x=><tr key={x.id}><td>{dt(x.createdAt,locale)}</td>
   <td><code>{x.action}</code></td><td><code>{x.actorId?.slice(0,8)??"—"}</code></td>
   <td><code>{x.tenantId?.slice(0,8)??"—"}</code></td></tr>)}</tbody></table></div>}
 <Pager page={page} total={d.data?.total??0} perPage={50} setPage={setPage} locale={locale}/></section></div>;
}
export function PlatformSettings(){
 const {workspace}=useWorkspace(),locale=workspace.locale;
 const d=useSaasData<Settings>("/api/platform/settings");
 const [trialDays,setTrialDays]=useState(14),[graceDays,setGraceDays]=useState(7),[incidentBanner,setBanner]=useState(""),[supportEmail,setEmail]=useState("");
 const [confirm,setConfirm]=useState(false),[dirty,setDirty]=useState(false);
 const {run,busy,error,notice}=useOperate([d.load],locale);
 function prefill(){
  if(!d.data)return;setTrialDays(d.data.trialDays);setGraceDays(d.data.graceDays);
  setBanner(d.data.incidentBanner);setEmail(d.data.supportEmail);setDirty(true);
 }
 return <div className="content-stack p12-console"><Header title={p12(locale,"settings")} desc={p12(locale,"platformHelp")}/>
 <Display error={error||d.error} notice={notice}/>
 <section className="settings-card p12-panel"><div className="section-heading"><h2>{p12(locale,"settings")}</h2>
  <button className="button" onClick={prefill} disabled={!d.data}><Settings2 size={16}/>{p12(locale,"view")}</button></div>
  {d.data&&!dirty&&<dl className="profile-list">
   <div><dt>{p12(locale,"trialDays")}</dt><dd>{d.data.trialDays}</dd></div>
   <div><dt>{p12(locale,"graceDays")}</dt><dd>{d.data.graceDays}</dd></div>
   <div><dt>{p12(locale,"supportEmail")}</dt><dd>{d.data.supportEmail||"—"}</dd></div>
   <div><dt>{p12(locale,"incident")}</dt><dd>{d.data.incidentBanner||"—"}</dd></div>
  </dl>}
  {dirty&&<form className="p12-form-stack" onSubmit={e=>{e.preventDefault();void run("/api/platform/settings",
   {trialDays,graceDays,incidentBanner,supportEmail,confirm:true},"PATCH").then(ok=>{if(ok){setConfirm(false);setDirty(false);}});}}>
   <div className="p12-form-row"><label>{p12(locale,"trialDays")}<input type="number" min={1} max={90}
    value={trialDays} onChange={e=>setTrialDays(Number(e.target.value))}/></label>
    <label>{p12(locale,"graceDays")}<input type="number" min={0} max={30}
     value={graceDays} onChange={e=>setGraceDays(Number(e.target.value))}/></label>
    <label className="p12-grow">{p12(locale,"supportEmail")}<input type="email" maxLength={254}
     value={supportEmail} onChange={e=>setEmail(e.target.value)}/></label></div>
   <label>{p12(locale,"incident")}<textarea maxLength={300} value={incidentBanner}
    onChange={e=>setBanner(e.target.value)}/></label>
   <label className="p12-checkbox"><input type="checkbox" checked={confirm}
    onChange={e=>setConfirm(e.target.checked)}/>{p12(locale,"confirmPolicy")}</label>
   <button disabled={!confirm||busy} className="button button-primary" type="submit">
    {p12(locale,"saveSettings")}</button></form>}
 </section></div>;
}
