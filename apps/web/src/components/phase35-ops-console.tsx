"use client";
import {useCallback,useEffect,useRef,useState} from "react";
import Link from "next/link";
import {AlertTriangle,Activity,RefreshCw,ShieldAlert,ShieldCheck} from "lucide-react";
import type {Locale} from "@dineflow/shared";
import {useWorkspace} from "./workspace-provider";
import {jsonRequest} from "@/lib/phase2-api";

type Signal="OUTBOX_BACKLOG"|"OUTBOX_DELAY"|"OUTBOX_CRITICAL_DELAY"|
 "WORKER_DISABLED"|"WORKER_RETRYING"|"WORKER_STALLED"|"WORKER_STARTING";
type Pulse={
 status:"ok"|"attention";severity:"ok"|"investigate"|"urgent";
 signals:Signal[];checkedAt:string;actionRequired:boolean;pilotCertified:false;
 scope:"server_instance_and_shared_outbox";
 pendingOutbox:number;oldestPendingAt:string|null;oldestPendingAgeSeconds:number|null;
 polling:"database_revision";
 reconciler:{
  mode:"starting"|"active"|"disabled"|"stopped";
  startedAt:string|null;lastAttemptAt:string|null;lastSuccessAt:string|null;
  lastFailureAt:string|null;consecutiveFailures:number;inFlight:boolean;
  processedSinceStart:number;
 };
};
const words={
 en:{
  title:"Operational recovery",subtitle:"Live revision publication diagnostics · platform operators only",
  refresh:"Refresh diagnostics",pending:"Pending internal events",oldest:"Oldest event age",
  processed:"Reconciled by this server",failures:"Consecutive retry failures",
  lastSuccess:"Last successful scan",worker:"Worker state",noPending:"No pending events",
  status_ok:"Observed OK",status_investigate:"Needs investigation",status_urgent:"Urgent operator attention",
  unavailable:"Diagnostics unavailable. Do not assume service is healthy; retry or check the API.",
  help:"These readings combine shared database backlog with one API instance's recovery worker. They do not confirm delivery to an Android device, financial correctness, or pilot approval.",
  pilot:"Review pilot blockers",support:"Open support queue",notCertified:"Not production or pilot certification",
  none:"No active diagnostic signals",secs:"seconds",
  active:"Active",starting:"Starting",disabled:"Disabled",stopped:"Stopped",
  OUTBOX_BACKLOG:"More than 5,000 pending events: investigate publication backlog.",
  OUTBOX_DELAY:"Oldest pending event exceeds 60 seconds.",
  OUTBOX_CRITICAL_DELAY:"Oldest pending event exceeds five minutes: urgent triage.",
  WORKER_DISABLED:"Automatic outbox reconciliation is disabled.",
  WORKER_RETRYING:"Reconciliation has encountered repeated retry errors.",
  WORKER_STALLED:"This API worker has not completed a recent successful scan.",
  WORKER_STARTING:"Recovery worker is starting; evidence is not yet complete."
 },
 "fa-AF":{
  title:"بازیابی عملیاتی",subtitle:"تشخیص نشر پایدار رویدادها · فقط برای مسئولان پلتفرم",
  refresh:"تازه‌سازی تشخیص‌ها",pending:"رویدادهای داخلی منتظر",oldest:"عمر قدیمی‌ترین رویداد",
  processed:"بازیابی‌شده توسط این سرور",failures:"خطاهای پیاپی تلاش دوباره",
  lastSuccess:"آخرین بررسی موفق",worker:"وضعیت پردازشگر",noPending:"رویداد منتظر وجود ندارد",
  status_ok:"وضعیت مشاهده‌شده عادی",status_investigate:"نیازمند بررسی",status_urgent:"نیازمند اقدام فوری",
  unavailable:"تشخیص‌ها در دسترس نیست. سرویس را سالم فرض نکنید؛ دوباره کوشش کنید یا API را بررسی نمایید.",
  help:"این ارقام صف مشترک دیتابیس و پردازشگر بازیابی یک نمونه API را نشان می‌دهند؛ رسیدن پیام به موبایل، درستی حساب‌ها یا تأیید آزمایشی را ثابت نمی‌کنند.",
  pilot:"بررسی موانع آزمایش",support:"صف پشتیبانی",notCertified:"تأیید تولید یا آزمایش نیست",
  none:"هشدار فعال وجود ندارد",secs:"ثانیه",
  active:"فعال",starting:"در حال آغاز",disabled:"غیرفعال",stopped:"متوقف",
  OUTBOX_BACKLOG:"بیش از ۵۰۰۰ رویداد منتظر؛ صف نشر را بررسی کنید.",
  OUTBOX_DELAY:"قدیمی‌ترین رویداد بیش از ۶۰ ثانیه منتظر است.",
  OUTBOX_CRITICAL_DELAY:"قدیمی‌ترین رویداد بیش از پنج دقیقه منتظر است؛ بررسی فوری.",
  WORKER_DISABLED:"بازیابی خودکار رویدادها غیرفعال است.",
  WORKER_RETRYING:"بازیابی با خطاهای تلاش مجدد روبه‌رو شده است.",
  WORKER_STALLED:"این پردازشگر API اخیراً بررسی موفق نداشته است.",
  WORKER_STARTING:"پردازشگر در حال آغاز است؛ شواهد هنوز کامل نیست."
 },
 "ps-AF":{
  title:"عملیاتي بېرته رغونه",subtitle:"د دوامدارو پېښو د خپرېدو څارنه · یوازې د پلاتفورم چارواکي",
  refresh:"څارنه تازه کړئ",pending:"په تمه داخلي پېښې",oldest:"د پخوانۍ پېښې عمر",
  processed:"د دې سرور بېرته رغول شوې پېښې",failures:"پرله‌پسې د بیا هڅې تېروتنې",
  lastSuccess:"وروستۍ بریالۍ کتنه",worker:"د کارکوونکي حالت",noPending:"په تمه پېښې نشته",
  status_ok:"لیدل شوی حالت سم دی",status_investigate:"څېړنې ته اړتیا لري",status_urgent:"بیړنۍ څېړنې ته اړتیا لري",
  unavailable:"څارنه نشته. خدمت روغ مه ګڼئ؛ بیا هڅه وکړئ یا API وګورئ.",
  help:"دا شمېرې د ګډ ډیټابېس کتار او د یوه API کارکوونکي حالت ښيي؛ موبایل ته د پیغام رسېدل، د پیسو سمون یا د ازموینې تایید نه ثابتوي.",
  pilot:"د ازموینې خنډونه وګورئ",support:"د مرستې کتار",notCertified:"د تولید یا ازموینې تصدیق نه دی",
  none:"فعالې نښې نشته",secs:"ثانیې",
  active:"فعال",starting:"پیلېږي",disabled:"غیرفعال",stopped:"درېدلی",
  OUTBOX_BACKLOG:"له ۵۰۰۰ زیاتې پېښې په تمه دي؛ کتار وڅېړئ.",
  OUTBOX_DELAY:"پخوانۍ پېښه له ۶۰ ثانیو زیاته په تمه ده.",
  OUTBOX_CRITICAL_DELAY:"پخوانۍ پېښه له پنځو دقیقو زیاته په تمه ده؛ بیړنۍ څېړنه.",
  WORKER_DISABLED:"اتومات بېرته رغونه بنده ده.",
  WORKER_RETRYING:"د بېرته رغونې بیا هڅې تېروتنې لري.",
  WORKER_STALLED:"دې API کارکوونکي په دې وروستیو کې بریالۍ کتنه نه ده کړې.",
  WORKER_STARTING:"کارکوونکی پیلېږي؛ شواهد لا بشپړ نه دي."
 }
} as const;
function dateTime(v:string|null,locale:Locale){
 if(!v)return "—";
 const timestamp=new Date(v);
 return Number.isNaN(timestamp.getTime())?"—":timestamp.toLocaleString(locale,{dateStyle:"medium",timeStyle:"short"});
}
export function PlatformOperationsPulse(){
 const {workspace}=useWorkspace(),locale=workspace.locale;
 const copy=words[locale]??words.en;
 const [data,setData]=useState<Pulse|null>(null);
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState(false);
 const sequence=useRef(0);
 const load=useCallback(async()=>{
  const id=++sequence.current;
  setLoading(true);setError(false);
  try{
   const pulse=await jsonRequest<Pulse>("/api/health/operations");
   if(id!==sequence.current)return;
   if(pulse.pilotCertified!==false||pulse.scope!=="server_instance_and_shared_outbox")
    throw new Error("Invalid diagnostics payload");
   setData(pulse);
  }catch{
   if(id===sequence.current){setData(null);setError(true);}
  }finally{
   if(id===sequence.current)setLoading(false);
  }
 },[]);
 useEffect(()=>{
  void load();
  const refreshVisible=()=>{if(document.visibilityState==="visible")void load();};
  const interval=setInterval(refreshVisible,30000);
  document.addEventListener("visibilitychange",refreshVisible);
  return ()=>{sequence.current++;clearInterval(interval);
   document.removeEventListener("visibilitychange",refreshVisible);};
 },[load]);
 const severity=data?.severity??"investigate";
 return <section className="settings-card p12-panel p35-ops" aria-labelledby="p35-ops-title">
  <div className="section-heading p35-ops-head">
   <div><div className="eyebrow">DINEFLOW / OPERATIONS</div>
    <h2 id="p35-ops-title">{copy.title}</h2><p>{copy.subtitle}</p></div>
   <button className="button button-small" type="button" onClick={()=>void load()}
    disabled={loading} aria-busy={loading}>
    <RefreshCw size={16} aria-hidden="true"/>{copy.refresh}
   </button>
  </div>
  {error&&<div role="alert" className="form-error p35-ops-error">{copy.unavailable}</div>}
  {!error&&(!data||loading)&&<p className="muted" role="status">…</p>}
  {!error&&data&&<div className="p35-ops-body" aria-live="polite">
   <div className={"p35-ops-status p35-ops-status-"+severity}
     role={severity==="urgent"?"alert":"status"}>
    {severity==="ok"?<ShieldCheck size={20} aria-hidden="true"/>:
     <ShieldAlert size={20} aria-hidden="true"/>}
    <strong>{copy[severity==="ok"?"status_ok":severity==="urgent"?"status_urgent":"status_investigate"]}</strong>
    <span>{dateTime(data.checkedAt,locale)}</span>
   </div>
   <div className="p35-ops-grid">
    <div><span>{copy.pending}</span><strong>{data.pendingOutbox.toLocaleString(locale)}</strong></div>
    <div><span>{copy.oldest}</span><strong>{data.oldestPendingAgeSeconds===null?
     copy.noPending:data.oldestPendingAgeSeconds.toLocaleString(locale)+" "+copy.secs}</strong></div>
    <div><span>{copy.processed}</span><strong>{data.reconciler.processedSinceStart.toLocaleString(locale)}</strong></div>
    <div><span>{copy.failures}</span><strong>{data.reconciler.consecutiveFailures.toLocaleString(locale)}</strong></div>
    <div><span>{copy.worker}</span><strong>{copy[data.reconciler.mode]}</strong></div>
    <div><span>{copy.lastSuccess}</span><strong>{dateTime(data.reconciler.lastSuccessAt,locale)}</strong></div>
   </div>
   <div className="p35-ops-signals">
    {data.signals.filter(signal=>signal!=="WORKER_STARTING").length===0?
     <p><Activity size={17} aria-hidden="true"/>{copy.none}</p>:
     data.signals.map(signal=><p key={signal}>
      <AlertTriangle size={17} aria-hidden="true"/>{copy[signal]}</p>)}
   </div>
  </div>}
  <div className="p35-ops-foot">
   <p>{copy.help}</p>
   <strong>{copy.notCertified}</strong>
   <div className="p35-ops-links">
    <Link className="button button-small" href="/platform/pilots">{copy.pilot}</Link>
    <Link className="button button-small" href="/platform/support">{copy.support}</Link>
   </div>
  </div>
 </section>;
}
