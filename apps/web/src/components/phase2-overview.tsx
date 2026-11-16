"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, BadgeCheck, Building2, CheckCircle2, ClipboardList, MailPlus, Settings2, UsersRound, UtensilsCrossed } from "lucide-react";
import { useWorkspace } from "@/components/workspace-provider";
import { jsonRequest, type PageResult } from "@/lib/phase2-api";
import { p2 } from "@/lib/phase2-copy";
type Setup={restaurant:string;location:{name:string;city:string}|null;teamCount:number;pendingInvites:number;trialExpiresAt:string|null};
type Org={id:string;name:string;slug:string;status:string;createdAt:string};
export function RestaurantOverview(){
  const {workspace}=useWorkspace(),locale=workspace.locale;
  const [setup,setSetup]=useState<Setup|null>(null),[error,setError]=useState(""),[loading,setLoading]=useState(true);
  const load=useCallback(async()=>{setLoading(true);setError("");
    try{setSetup(await jsonRequest<Setup>("/api/tenant/setup"));}
    catch(e){setError(e instanceof Error?e.message:p2(locale,"error"));}finally{setLoading(false);}
  },[locale]);
  useEffect(()=>{void load();},[load]);
  return <div className="content-stack">
    <div className="page-heading"><div><div className="eyebrow">{p2(locale,"restaurant")}</div>
      <h1>{workspace.tenantName}</h1><p>{p2(locale,"setupHelp")}</p></div>
      <span className="status-pill"><BadgeCheck size={16}/>{p2(locale,"setupReady")}</span></div>
    <div className="overview-hero"><span className="hero-icon"><CheckCircle2 size={30}/></span>
      <div><div className="eyebrow">DINEFLOW SETUP</div><h2>{p2(locale,"finishSetup")}</h2>
        <p>{setup?.location?setup.location.name+", "+setup.location.city:p2(locale,"setup")}</p></div></div>
    {error&&<p className="form-error" role="alert">{error}<button className="text-link" onClick={()=>void load()}>{p2(locale,"retry")}</button></p>}
    {loading?<div className="list-skeleton"><span/><span/></div>:setup&&<>
      <div className="stat-grid">
        <div className="stat-card"><span><UsersRound size={20}/>{p2(locale,"staffCount")}</span><strong>{setup.teamCount}</strong></div>
        <div className="stat-card"><span><MailPlus size={20}/>{p2(locale,"pendingInvites")}</span><strong>{setup.pendingInvites}</strong></div>
        <div className="stat-card"><span><Building2 size={20}/>{p2(locale,"location")}</span><strong>{setup.location?.name??"—"}</strong></div>
      </div>
      <section className="settings-card"><div className="section-heading"><div><h2>{p2(locale,"setup")}</h2>
        <p className="muted">{p2(locale,"setupHelp")}</p></div><ClipboardList size={25} color="var(--brand)"/></div>
        <div className="setup-checklist">
          <div><CheckCircle2 size={23} color="var(--brand)"/><div><strong>{p2(locale,"createRestaurant")}</strong>
            <p className="muted">{p2(locale,"setupComplete")}</p></div>
            <Link className="button button-small" href="/app/settings/restaurant">{p2(locale,"settings")} <ArrowUpRight size={16}/></Link></div>
          <div><MailPlus size={23} color="var(--brand)"/><div><strong>{p2(locale,"invite")}</strong>
            <p className="muted">{p2(locale,"staffFirst")}</p></div>
            <Link className="button button-primary button-small" href="/app/staff/invitations">{p2(locale,"invite")} <ArrowUpRight size={16}/></Link></div>
          <div><UtensilsCrossed size={23} color="var(--brand)"/><div><strong>{locale==="en"?"Build and publish menu":locale==="fa-AF"?"ایجاد و نشر منو":"مینو جوړ او خپور کړئ"}</strong>
            <p className="muted">{locale==="en"?"Categories, meals, modifiers and stock":locale==="fa-AF"?"دسته‌ها، غذاها، انتخاب‌ها و موجودی":"کټګورۍ، خواړه، انتخابونه او شتون"}</p></div>
            <Link className="button button-primary button-small" href="/app/menu/items">{locale==="en"?"Open menu":locale==="fa-AF"?"باز کردن منو":"مینو پرانیستل"} <ArrowUpRight size={16}/></Link></div>
          <div className="planned-item"><Building2 size={23}/><div><strong>{p2(locale,"tableLater")}</strong></div>
            <span className="muted">P04</span></div>
        </div>
      </section>
      <p className="muted">{p2(locale,"trialConfig")} {setup.trialExpiresAt?new Date(setup.trialExpiresAt).toLocaleDateString(locale):""}</p>
    </>}
  </div>;
}
export function PlatformOverview(){
  const {workspace}=useWorkspace(),locale=workspace.locale;
  const [data,setData]=useState<PageResult<Org>|null>(null),[error,setError]=useState("");
  useEffect(()=>{void jsonRequest<PageResult<Org>>("/api/platform/restaurants?page=1").then(setData)
    .catch(e=>setError(e instanceof Error?e.message:p2(locale,"error")));},[locale]);
  return <div className="content-stack"><div className="page-heading"><div><div className="eyebrow">DINEFLOW PLATFORM</div>
      <h1>{p2(locale,"platformOverview")}</h1><p>{p2(locale,"operationalDataPrivate")}</p></div>
      <span className="status-pill"><BadgeCheck size={16}/>{p2(locale,"active")}</span></div>
    <div className="overview-hero"><span className="hero-icon"><Building2 size={30}/></span>
      <div><h2>{p2(locale,"recentRestaurants")}</h2><p>{p2(locale,"planLater")}</p></div></div>
    {error&&<p className="form-error" role="alert">{error}</p>}
    <div className="stat-grid"><div className="stat-card"><span><Building2 size={20}/>{p2(locale,"businesses")}</span>
      <strong>{data?.total??"—"}</strong></div></div>
    <section className="settings-card"><div className="section-heading"><h2>{p2(locale,"recentRestaurants")}</h2>
      <Link className="button button-primary" href="/platform/restaurants">{p2(locale,"open")}</Link></div>
      {data?.items.length?data.items.slice(0,5).map(item=><Link key={item.id} className="recent-link" href={"/platform/restaurants/"+item.id}>
        <Building2 size={19}/><strong>{item.name}</strong><span className="data-badge trial">{item.status}</span><ArrowUpRight size={17}/></Link>):
        <p className="muted">{data?p2(locale,"noRestaurants"):p2(locale,"loading")}</p>}
    </section></div>;
}
