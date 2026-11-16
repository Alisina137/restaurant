"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, BadgeCheck, Building2, CheckCircle2, ClipboardList, MailPlus, Settings2, UsersRound, UtensilsCrossed, BarChart3, Wallet, Armchair, ReceiptText } from "lucide-react";
import { useWorkspace } from "@/components/workspace-provider";
import { jsonRequest, type PageResult } from "@/lib/phase2-api";
import { p2 } from "@/lib/phase2-copy";
import {r11} from "@/lib/report-copy";
import {money} from "@/lib/finance-types";
import {PlatformDashboard} from "./phase12-platform";
import type {OverviewReport} from "@/lib/report-types";
type Setup={restaurant:string;location:{name:string;city:string}|null;teamCount:number;pendingInvites:number;trialExpiresAt:string|null};
type Org={id:string;name:string;slug:string;status:string;createdAt:string};
export function RestaurantOverview(){
  const {workspace}=useWorkspace(),locale=workspace.locale;
  const [setup,setSetup]=useState<Setup|null>(null),[error,setError]=useState(""),[loading,setLoading]=useState(true);
  const [pulse,setPulse]=useState<OverviewReport|null>(null),[pulseError,setPulseError]=useState(""),[pulseLoading,setPulseLoading]=useState(true);
  const refreshPulse=useCallback(async()=>{
   try{setPulse(await jsonRequest<OverviewReport>("/api/reports/overview"));setPulseError("");}
   catch(e){setPulseError(e instanceof Error?e.message:r11(locale,"failure"));}
   finally{setPulseLoading(false);}
  },[locale]);
  useEffect(()=>{void refreshPulse();const interval=setInterval(()=>{if(document.visibilityState==="visible")void refreshPulse();},30000);
    return()=>clearInterval(interval);},[refreshPulse]);
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

    <section className="settings-card p11-overview-pulse">
     <div className="section-heading"><div><h2>{r11(locale,"businessToday")}</h2>
      <p>{r11(locale,"overviewHint")}</p></div>
      <Link className="button button-primary button-small" href="/app/reports">
       <BarChart3 size={16}/>{r11(locale,"view")}<ArrowUpRight size={15}/></Link></div>
     {pulseError&&<div className="form-error" role="alert">{r11(locale,"dataPending")}
       <button className="text-link" onClick={()=>void refreshPulse()}>{r11(locale,"refresh")}</button></div>}
     {pulseLoading&&!pulse?<div className="list-skeleton"><span/><span/></div>:pulse&&
      <><div className="p11-kpi-grid">
       <article className="p11-kpi"><span className="p11-kpi-label"><Armchair size={17}/>{r11(locale,"activeTables")}</span>
        <strong>{pulse.activeTables}</strong></article>
       <article className="p11-kpi"><span className="p11-kpi-label"><ReceiptText size={17}/>{r11(locale,"ordersToday")}</span>
        <strong>{pulse.ordersToday}</strong></article>
       <article className="p11-kpi"><span className="p11-kpi-label"><Wallet size={17}/>{r11(locale,"unpaidChecks")}</span>
        <strong>{pulse.unpaidChecks}</strong></article>
       <article className="p11-kpi"><span className="p11-kpi-label"><BarChart3 size={17}/>{r11(locale,"todayRevenue")}</span>
        <strong>{money(pulse.netCollectedTodayMinor,locale)}</strong></article>
      </div><p className="muted p11-tz">{pulse.businessDate} · {pulse.timezone}</p></>}
    </section>
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
          <div><Building2 size={23} color="var(--brand)"/><div>
            <strong>{locale==="en"?"Configure sections and tables":locale==="fa-AF"?"تنظیم بخش‌ها و میزها":"برخې او مېزونه تنظیمول"}</strong>
            <p className="muted">{locale==="en"?"Create floor sections, seat guests and assign waiters":locale==="fa-AF"?"ایجاد بخش‌ها، تعیین گارسون و نشاندن مشتری":"برخې جوړې کړئ، ګارسون وټاکئ او مېلمانه کېنوئ"}</p></div>
            <Link className="button button-primary button-small" href="/app/tables/board">{locale==="en"?"Open floor":locale==="fa-AF"?"باز کردن سالن":"تالار پرانیستل"} <ArrowUpRight size={16}/></Link></div>
        </div>
      </section>
      <p className="muted">{p2(locale,"trialConfig")} {setup.trialExpiresAt?new Date(setup.trialExpiresAt).toLocaleDateString(locale):""}</p>
    </>}
  </div>;
}
export function PlatformOverview(){return <PlatformDashboard/>;}
