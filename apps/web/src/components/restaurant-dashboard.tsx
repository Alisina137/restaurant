"use client";

import {useCallback,useEffect,useMemo,useRef,useState,type ReactNode} from "react";
import Link from "next/link";
import {
  Activity,ArrowRight,Armchair,BarChart3,BellRing,BookOpenText,CalendarDays,
  ChefHat,CheckCircle2,ChevronRight,ClipboardList,Clock3,
  CreditCard,FileText,MailPlus,RefreshCw,Settings2,ShieldCheck,
  TrendingDown,TrendingUp,UsersRound,UtensilsCrossed,Wallet,
} from "lucide-react";
import {type Locale} from "@dineflow/shared";
import {useWorkspace} from "./workspace-provider";
import {jsonRequest} from "@/lib/phase2-api";
import {money} from "@/lib/finance-types";
import {d19,type DashboardWord} from "@/lib/dashboard-copy";
import {dashboardHasCollection,percentageChange,type DashboardDay,type DashboardPeriod,type DashboardReport} from "@/lib/dashboard-types";
import {LoadingSkeleton,StatusBadge} from "./ui/design-system";
import {InlineFeedback} from "./ui/interaction-controls";

type Setup={restaurant:string;location:{name:string;city:string}|null;teamCount:number;
 pendingInvites:number;trialExpiresAt:string|null};

const shortDate=(date:string,locale:Locale)=>new Date(date+"T12:00:00.000Z")
 .toLocaleDateString(locale,{day:"numeric",month:"short",timeZone:"UTC"});

function ChangePill({current,previous,locale}:{
 current:number;previous:number;locale:Locale;
}){
 const change=percentageChange(current,previous);
 if(change===null)return <span className="p19-change muted">{d19(locale,"compareUnavailable")}</span>;
 const increase=change>0,decrease=change<0;
 return <span className={"p19-change"+(increase?" positive":decrease?" negative":" neutral")}>
  {increase?<TrendingUp size={15} aria-hidden="true"/>:decrease?<TrendingDown size={15} aria-hidden="true"/>:null}
  <bdi>{new Intl.NumberFormat(locale,{maximumFractionDigits:1,signDisplay:"exceptZero"}).format(change)}%</bdi>
  <span>{d19(locale,"previous")}</span>
 </span>;
}

function Metric({label,value,hint,current,previous,icon:Icon}:{
 label:string;value:string;hint:string;current:number;previous:number;
 icon:typeof Wallet;
}){
 const {workspace}=useWorkspace(),locale=workspace.locale;
 return <article className="p19-metric">
  <div className="p19-metric-head">
   <span className="p19-metric-icon"><Icon size={19} aria-hidden="true"/></span>
   <span className="p19-metric-label">{label}</span>
  </div>
  <strong className="p19-metric-value" dir="auto">{value}</strong>
  <ChangePill current={current} previous={previous} locale={locale}/>
  <small>{hint}</small>
 </article>;
}

function LiveTile({title,value,icon:Icon,href,urgent=false}:{
 title:string;value:number;icon:typeof Wallet;href:string;urgent?:boolean;
}){
 return <Link className={"p19-live-tile"+(urgent&&value>0?" is-urgent":"")} href={href}>
  <span className="p19-live-icon"><Icon size={21} aria-hidden="true"/></span>
  <span className="p19-live-copy"><span>{title}</span><strong>{value}</strong></span>
  <ChevronRight className="p19-tile-chevron" size={17} aria-hidden="true"/>
 </Link>;
}

function DailyChart({days,locale}:{
 days:DashboardDay[];locale:Locale;
}){
 const top=Math.max(1,...days.map(day=>Math.abs(day.netCollectedMinor)));
 const hasData=dashboardHasCollection(days);
 const dateLabel=(day:DashboardDay)=>shortDate(day.date,locale);
 if(!hasData)return <div className="p19-chart-empty">
   <BarChart3 size={32} aria-hidden="true"/>
   <p>{d19(locale,"emptyRevenue")}</p>
 </div>;
 return <div className="p19-trend-scroll">
  <div className="p19-trend-chart"
    style={{gridTemplateColumns:`repeat(${days.length},minmax(38px,1fr))`,
      minWidth:Math.max(500,days.length*51)}}
    role="img"
    aria-label={days.map(day=>day.date+": "+money(day.netCollectedMinor,locale)).join("; ")}>
   {days.map(day=>{
    const amount=day.netCollectedMinor;
    const relative=Math.max(amount===0?0:5,Math.round(Math.abs(amount)/top*100));
    return <div className="p19-day" key={day.date}
      title={day.date+" · "+money(amount,locale)}>
     <div className="p19-day-plot">
      <div className="p19-bar-upper">
       {amount>0&&<span className="p19-bar-fill" style={{height:relative+"%"}}/>}
      </div>
      <div className="p19-zero-line"/>
      <div className="p19-bar-lower">
       {amount<0&&<span className="p19-bar-fill negative" style={{height:relative+"%"}}/>}
      </div>
     </div>
     <small>{dateLabel(day)}</small>
    </div>;
   })}
  </div>
 </div>;
}

function SetupChecklist({locale,setup,error,onRetry,loading}:{
 locale:Locale;setup:Setup|null;error:string;onRetry:()=>void;loading:boolean;
}){
 const shortcuts=[
  {href:"/app/settings/restaurant",label:d19(locale,"setupRestaurant"),icon:Settings2},
  {href:"/app/staff/invitations",label:d19(locale,"setupInvite"),icon:MailPlus},
  {href:"/app/menu/items",label:d19(locale,"setupMenu"),icon:BookOpenText},
  {href:"/app/tables/manage",label:d19(locale,"setupTables"),icon:Armchair}
 ];
 return <details className="p19-setup-panel">
  <summary><span className="p19-setup-summary"><ShieldCheck size={21}/><strong>{d19(locale,"setup")}</strong>
    <span>{d19(locale,"setupHint")}</span></span>
    <span className="p19-setup-toggle"><ChevronRight size={19} aria-hidden="true"/></span></summary>
  <div className="p19-setup-content">
   {error&&<InlineFeedback message={error} retry={onRetry} onRetryLabel={d19(locale,"retry")}/>}
   {loading&&!setup?<LoadingSkeleton rows={2} label={d19(locale,"loading")}/>:setup&&
     <div className="p19-setup-facts">
      <div><small>{d19(locale,"branch")}</small><strong>{setup.location?.name??"—"}</strong></div>
      <div><small>{d19(locale,"setupTeam")}</small><strong>{setup.teamCount}</strong></div>
      <div><small>{d19(locale,"pendingInvitations")}</small><strong>{setup.pendingInvites}</strong></div>
      {setup.trialExpiresAt&&<div><small>{d19(locale,"trial")}</small>
       <strong>{new Date(setup.trialExpiresAt).toLocaleDateString(locale)}</strong></div>}
     </div>}
   <div className="p19-setup-shortcuts">{shortcuts.map(({href,label,icon:Icon})=>
     <Link key={href} href={href}><Icon size={19}/>{label}<ArrowRight size={16}/></Link>)}</div>
  </div>
 </details>;
}

export function RestaurantDashboard(){
 const {workspace}=useWorkspace(),locale=workspace.locale;
 const [period,setPeriod]=useState<DashboardPeriod>(7);
 const [data,setData]=useState<DashboardReport|null>(null);
 const [loading,setLoading]=useState(true),[refreshing,setRefreshing]=useState(false);
 const [error,setError]=useState(""),[offline,setOffline]=useState(false);
 const [setup,setSetup]=useState<Setup|null>(null),[setupError,setSetupError]=useState("");
 const [setupLoading,setSetupLoading]=useState(true);
 const activeRequest=useRef(0);
 const loader=useCallback(async(silent=false)=>{
  if(typeof navigator!=="undefined"&&!navigator.onLine){
   setOffline(true);setError(d19(locale,"offline"));setLoading(false);setRefreshing(false);return;
  }
  const request=++activeRequest.current;
  if(!silent)setLoading(true);else setRefreshing(true);
  const controller=new AbortController();
  try{
   const result=await jsonRequest<DashboardReport>("/api/reports/dashboard?period="+period,{
     signal:controller.signal
   });
   if(request!==activeRequest.current)return;
   setData(result);setError("");setOffline(false);
  }catch(e){
   if(request!==activeRequest.current)return;
   setError(e instanceof Error?e.message:d19(locale,"stale"));
  }finally{
   if(request===activeRequest.current){setLoading(false);setRefreshing(false);}
  }
 },[period,locale]);
 const loadSetup=useCallback(async()=>{
  setSetupLoading(true);
  try{setSetup(await jsonRequest<Setup>("/api/tenant/setup"));setSetupError("");}
  catch(e){setSetupError(e instanceof Error?e.message:d19(locale,"stale"));}
  finally{setSetupLoading(false);}
 },[locale]);
 useEffect(()=>{void loadSetup();},[loadSetup]);
 useEffect(()=>{
  void loader(false);
  const timer=setInterval(()=>{if(document.visibilityState==="visible")void loader(true);},30000);
  const onVisible=()=>{if(document.visibilityState==="visible")void loader(true);};
  const onOnline=()=>{setOffline(false);void loader(true);};
  const onOffline=()=>setOffline(true);
  document.addEventListener("visibilitychange",onVisible);
  window.addEventListener("online",onOnline);
  window.addEventListener("offline",onOffline);
  return()=>{
   activeRequest.current++;
   clearInterval(timer);
   document.removeEventListener("visibilitychange",onVisible);
   window.removeEventListener("online",onOnline);
   window.removeEventListener("offline",onOffline);
  };
 },[loader]);
 const current=data?.period.days===period?data:null;
 const live=current?.live;
 const attention=useMemo(()=>{
  if(!live)return[];
  const entries:{id:string;value:number;label:DashboardWord;href:string;icon:typeof Wallet}[]=[
   {id:"guest",value:live.pendingGuestApprovals,label:"guestPending",href:"/app/orders/live",icon:ClipboardList},
   {id:"service",value:live.pendingServiceRequests,label:"servicePending",href:"/app/service/requests",icon:BellRing},
   {id:"kitchen",value:live.newTickets,label:"kitchenPending",href:"/app/orders/live",icon:ChefHat},
   {id:"ready",value:live.readyTickets,label:"readyPending",href:"/app/orders/live",icon:CheckCircle2},
   {id:"unpaid",value:live.unpaidChecks,label:"unpaidPending",href:"/app/billing/checks",icon:CreditCard}
  ];
  return entries.filter(item=>item.value>0).sort((a,b)=>b.value-a.value);
 },[live]);
 const total=current?.performance.current,old=current?.performance.previous;
 const quickActions=[
  {href:"/app/orders/live",label:d19(locale,"viewOrders"),icon:ClipboardList},
  {href:"/app/tables/board",label:d19(locale,"viewFloor"),icon:Armchair},
  {href:"/app/billing/checks",label:d19(locale,"checkBills"),icon:Wallet},
  {href:"/app/menu/items",label:d19(locale,"editMenu"),icon:UtensilsCrossed},
  {href:"/app/staff/directory",label:d19(locale,"viewStaff"),icon:UsersRound},
  {href:"/app/reports",label:d19(locale,"reviewReports"),icon:BarChart3}
 ];
 const textNumber=(x:number)=>new Intl.NumberFormat(locale).format(x);
 const formatDuration=(seconds:number|null)=>seconds===null?
  d19(locale,"insufficient"):textNumber(seconds)+" "+d19(locale,"seconds");
 return <div className="content-stack p19-dashboard">
  <header className="p19-dashboard-header">
   <div><span className="eyebrow">DINEFLOW / {d19(locale,"performance")}</span>
    <h1>{d19(locale,"title")}</h1><p>{d19(locale,"subtitle")}</p></div>
   <div className="p19-dashboard-actions">
    <div className="p19-period-control" role="group" aria-label={d19(locale,"period")}>
     {([7,30] as const).map(d=><button key={d} type="button"
      className={period===d?"selected":""} aria-pressed={period===d}
      onClick={()=>setPeriod(d)}>{d19(locale,d===7?"seven":"thirty")}</button>)}
    </div>
    <button className="button" type="button" disabled={refreshing||loading}
     onClick={()=>void loader(true)}><RefreshCw size={17} className={refreshing?"p19-spin":""}/>
     {d19(locale,"refresh")}</button>
   </div>
  </header>
  <div className="p19-context-banner">
   <span><CalendarDays size={16}/>{d19(locale,"businessDay")}:{" "}
     <bdi>{current?.period.businessDate??"—"}</bdi>
     {" · "}{current?.period.timezone??"Asia/Kabul"}</span>
   <span role="status"><span className={"p19-live-dot"+(offline||error?" stale":"")}/>
     {current?d19(locale,"synced")+": "+new Date(current.generatedAt)
       .toLocaleTimeString(locale,{hour:"2-digit",minute:"2-digit"}):
       d19(locale,"loading")}</span>
  </div>
  {offline&&<InlineFeedback tone="info" message={d19(locale,"offline")}/>}
  {error&&!offline&&<InlineFeedback message={error} retry={()=>void loader(true)}
    onRetryLabel={d19(locale,"retry")}/>}
  {(loading&&!current)?<LoadingSkeleton rows={6} label={d19(locale,"loading")}/>:!current?
   <section className="settings-card p19-load-failed">
    <BarChart3 size={36}/><h2>{d19(locale,"stale")}</h2>
    <button className="button button-primary" type="button" onClick={()=>void loader(false)}>
     <RefreshCw size={17}/>{d19(locale,"retry")}</button>
   </section>:<>
   <section className="p19-financial-section" aria-label={d19(locale,"financialOverview")}>
    <div className="p19-section-head">
     <div><span className="eyebrow">{d19(locale,"financialOverview")}</span>
      <h2>{d19(locale,"performance")}</h2>
      <p>{shortDate(current.period.from,locale)} — {shortDate(current.period.to,locale)}
       {" · "}{d19(locale,"previous")}: {shortDate(current.period.previousFrom,locale)}
        {" — "}{shortDate(current.period.previousTo,locale)}</p></div>
     <Link className="button button-small" href="/app/reports">
      <FileText size={16}/>{d19(locale,"viewAll")}<ArrowRight size={15}/></Link>
    </div>
    <div className="p19-metrics">
     <Metric label={d19(locale,"collected")} value={money(total!.netCollectedMinor,locale)}
      hint={d19(locale,"collectedHint")} current={total!.netCollectedMinor}
      previous={old!.netCollectedMinor} icon={Wallet}/>
     <Metric label={d19(locale,"sales")} value={money(total!.netSalesMinor,locale)}
      hint={d19(locale,"salesHint")} current={total!.netSalesMinor}
      previous={old!.netSalesMinor} icon={BarChart3}/>
     <Metric label={d19(locale,"checks")} value={textNumber(total!.settledChecks)}
      hint={d19(locale,"checksHint")} current={total!.settledChecks}
      previous={old!.settledChecks} icon={CheckCircle2}/>
     <Metric label={d19(locale,"refunds")} value={money(total!.refundedMinor,locale)}
      hint={d19(locale,"refundHint")} current={total!.refundedMinor}
      previous={old!.refundedMinor} icon={CreditCard}/>
    </div>
   </section>
   <div className="p19-dashboard-body">
    <div className="p19-dashboard-primary">
     <section className="settings-card p19-live-panel">
      <div className="p19-section-head"><div><span className="eyebrow">{d19(locale,"today")}</span>
       <h2>{d19(locale,"live")}</h2><p>{d19(locale,"liveHint")}</p></div>
       <StatusBadge tone="success"><Activity size={15}/>{d19(locale,"active")}</StatusBadge></div>
      <div className="p19-live-grid">
       <LiveTile title={d19(locale,"activeTables")} value={live!.activeTables} icon={Armchair} href="/app/tables/board"/>
       <LiveTile title={d19(locale,"ordersToday")} value={live!.ordersToday} icon={ClipboardList} href="/app/orders/live"/>
       <LiveTile title={d19(locale,"unpaid")} value={live!.unpaidChecks} urgent icon={Wallet} href="/app/billing/checks"/>
       <LiveTile title={d19(locale,"guestApprovals")} value={live!.pendingGuestApprovals} urgent icon={BellRing} href="/app/orders/live"/>
       <LiveTile title={d19(locale,"kitchenNew")} value={live!.newTickets} urgent icon={ChefHat} href="/app/orders/live"/>
       <LiveTile title={d19(locale,"preparing")} value={live!.preparingTickets} icon={Clock3} href="/app/orders/live"/>
       <LiveTile title={d19(locale,"ready")} value={live!.readyTickets} urgent icon={CheckCircle2} href="/app/orders/live"/>
       <LiveTile title={d19(locale,"requests")} value={live!.pendingServiceRequests} urgent icon={BellRing} href="/app/service/requests"/>
      </div>
     </section>
     <section className="settings-card p19-chart-panel">
      <div className="p19-section-head"><div><span className="eyebrow">{d19(locale,"financialOverview")}</span>
       <h2>{d19(locale,"trend")}</h2><p>{d19(locale,"trendHint")}</p></div>
       <span className="p19-chart-tag">{d19(locale,"unit")}</span></div>
      <DailyChart days={current.performance.daily} locale={locale}/>
      <p className="p19-accounting-note"><ShieldCheck size={16}/>{d19(locale,"accountingNote")}</p>
     </section>
     <section className="settings-card p19-top-items-panel">
      <div className="p19-section-head"><div><span className="eyebrow">{d19(locale,"performance")}</span>
       <h2>{d19(locale,"topItems")}</h2><p>{d19(locale,"topItemsHint")}</p></div>
       <Link className="button button-small" href="/app/reports?tab=items">
        {d19(locale,"viewAll")}<ArrowRight size={15}/></Link></div>
      {current.topItems.length===0?
       <div className="p19-empty"><UtensilsCrossed size={30}/>{d19(locale,"noItems")}</div>:
       <div className="p19-item-list">{current.topItems.map((item,i)=>{
        const name=(locale==="en"?item.nameEn:locale==="ps-AF"?item.namePs:item.nameFa)||item.nameFa;
        const max=Math.max(1,current.topItems[0]?.netMinor??1);
        return <div className="p19-item-row" key={item.itemId}>
         <span className="p19-item-rank">{textNumber(i+1)}</span>
         <div className="p19-item-name"><strong>{name}</strong>
          <span>{d19(locale,"quantity")}: {textNumber(item.quantity)}</span>
          <div className="p19-item-track" aria-hidden="true">
           <span style={{width:Math.max(0,Math.min(100,Math.round(item.netMinor/max*100)))+"%"}}/></div>
         </div>
         <strong className="p19-item-money">{money(item.netMinor,locale)}</strong>
        </div>;
       })}</div>}
     </section>
    </div>
    <aside className="p19-dashboard-aside">
     <section className="settings-card p19-attention-panel">
      <div className="p19-section-head"><div><span className="eyebrow">{d19(locale,"live")}</span>
       <h2>{d19(locale,"attention")}</h2></div>
       {attention.length>0&&<span className="p19-alert-count">{textNumber(attention.length)}</span>}</div>
      {attention.length===0?<div className="p19-attention-clear">
       <CheckCircle2 size={25}/><p>{d19(locale,"attentionClear")}</p>
      </div>:<div className="p19-alerts">{attention.map(({id,value,label,href,icon:Icon})=>
       <Link key={id} className="p19-alert" href={href}>
        <span className="p19-alert-icon"><Icon size={19}/></span>
        <span className="p19-alert-copy"><strong>{d19(locale,label)}</strong>
         <small>{textNumber(value)} · {d19(locale,"lookAt")}</small></span>
        <ChevronRight size={18}/></Link>)}</div>}
     </section>
     <section className="settings-card p19-service-panel">
      <div className="p19-section-head"><div><span className="eyebrow">{d19(locale,"period")}</span>
       <h2>{d19(locale,"service")}</h2></div></div>
      <dl className="p19-service-list">
       {([
        ["tickets",textNumber(current.service.tickets)],
        ["prepared",textNumber(current.service.prepared)],
        ["served",textNumber(current.service.served)],
        ["prepMedian",formatDuration(current.service.prepMedianSeconds)],
        ["prepP95",formatDuration(current.service.prepP95Seconds)],
        ["cancelRate",current.service.cancelRatePercent===null?d19(locale,"insufficient"):
         new Intl.NumberFormat(locale,{maximumFractionDigits:2}).format(current.service.cancelRatePercent)+"%"]
       ] as Array<[DashboardWord,string]>).map(([name,value])=>
        <div key={name}><dt>{d19(locale,name)}</dt><dd>{value}</dd></div>)}
      </dl>
     </section>
     <section className="settings-card p19-actions-panel">
      <div className="p19-section-head"><h2>{d19(locale,"actions")}</h2></div>
      <div className="p19-quick-links">{quickActions.map(({href,label,icon:Icon})=>
       <Link key={href} href={href}><span><Icon size={19}/>{label}</span><ArrowRight size={16}/></Link>)}
      </div>
     </section>
    </aside>
   </div>
   <p className="p19-date-note"><CalendarDays size={16}/>{d19(locale,"dailyNote")}</p>
  </>}
  <SetupChecklist locale={locale} setup={setup} error={setupError} onRetry={()=>void loadSetup()}
   loading={setupLoading}/>
 </div>;
}
