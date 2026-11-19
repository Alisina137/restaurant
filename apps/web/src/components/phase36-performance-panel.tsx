"use client";
import type {Locale} from "@dineflow/shared";
import {Activity,AlertTriangle,Clock3,Database,ServerCog} from "lucide-react";

export type PerformanceDiagnostics={
 windowSeconds:300;sampleCapacity:1024;sampleCount:number;limitedToRecentSamples:boolean;
 sampledFrom:"completed_api_requests_on_this_instance";p50Ms:number|null;p95Ms:number|null;
 serverErrors:number;rateLimited:number;slowRequests:number;
 routeGroups:Array<{route:string;count:number;p95Ms:number}>;
 checkedAt:string;uptimeSeconds:number;
 pool:{total:number;idle:number;waiting:number;maxConfigured:number};
 availability:{
  level:"insufficient_samples"|"observed"|"investigate";
  signals:Array<"API_P95_ELEVATED"|"API_SERVER_ERRORS"|"DB_POOL_WAITING">;
  actualSlaCertified:false;
 };
};
const copy={
 en:{
  title:"API performance",subtitle:"Last five minutes · this API instance only",
  observations:"Observed responses",median:"Median response",p95:"95th percentile",
  errors:"Server errors",throttled:"Rate limited",pool:"Waiting for database",
  capacity:"Database connections",slow:"Over 1.5 seconds",sufficient:"Observed traffic",
  insufficient:"Limited evidence: at least 20 requests are needed to assess latency trends.",
  limited:"Only the most recent 1,024 requests are represented; this is not the full interval.",
  note:"No production SLA or user-device latency is certified by these synthetic/instance-local observations.",
  noData:"No completed API requests have been observed on this server yet.",
  route:"API area",requests:"Requests",milliseconds:"ms",warning:"Needs investigation",
  observed:"Measurement only — not release approval",
  API_P95_ELEVATED:"Observed API p95 exceeds 1.5 seconds.",
  API_SERVER_ERRORS:"Three or more server errors in the current sample.",
  DB_POOL_WAITING:"Three or more database queries waiting for a pool connection."
 },
 "fa-AF":{
  title:"کارایی API",subtitle:"پنج دقیقهٔ اخیر · فقط این سرور API",
  observations:"پاسخ‌های مشاهده‌شده",median:"زمان پاسخ میانه",p95:"صدک ۹۵ زمان پاسخ",
  errors:"خطاهای سرور",throttled:"درخواست‌های محدودشده",pool:"در انتظار اتصال دیتابیس",
  capacity:"اتصالات دیتابیس",slow:"بیش از ۱٫۵ ثانیه",sufficient:"ترافیک مشاهده‌شده",
  insufficient:"شواهد محدود است: برای بررسی روند تأخیر دست‌کم ۲۰ درخواست لازم است.",
  limited:"فقط ۱۰۲۴ درخواست تازه ثبت شده است؛ تمام این بازه را در بر نمی‌گیرد.",
  note:"این مشاهدهٔ محدود به سرور، SLA تولید یا تأخیر موبایل کاربران را تصدیق نمی‌کند.",
  noData:"هنوز پاسخ API روی این سرور مشاهده نشده است.",
  route:"بخش API",requests:"درخواست‌ها",milliseconds:"میلی‌ثانیه",warning:"نیازمند بررسی",
  observed:"فقط اندازه‌گیری؛ اجازهٔ انتشار نیست",
  API_P95_ELEVATED:"صدک ۹۵ تأخیر API بیش از ۱٫۵ ثانیه است.",
  API_SERVER_ERRORS:"سه خطای سرور یا بیشتر در نمونهٔ اخیر وجود دارد.",
  DB_POOL_WAITING:"سه درخواست یا بیشتر در انتظار اتصال دیتابیس‌اند."
 },
 "ps-AF":{
  title:"د API فعالیت",subtitle:"وروستۍ پنځه دقیقې · یوازې دا API سرور",
  observations:"کتل شوي ځوابونه",median:"د ځواب منځنۍ موده",p95:"د ځواب ۹۵مه سلنه",
  errors:"د سرور تېروتنې",throttled:"محدودې شوې غوښتنې",pool:"د ډیټابېس اتصال ته منتظر",
  capacity:"د ډیټابېس اتصالونه",slow:"له ۱٫۵ ثانیو زیات",sufficient:"کتل شوې غوښتنې",
  insufficient:"شواهد محدود دي: د ځنډ ارزونې لپاره لږ تر لږه ۲۰ غوښتنې اړینې دي.",
  limited:"یوازې وروستۍ ۱۰۲۴ غوښتنې ثبتېږي؛ ټولې پنځه دقیقې نه رانغاړي.",
  note:"د دې سرور شمېرې د تولید SLA یا د موبایل کاروونکي ځنډ نه تصدیقوي.",
  noData:"تر اوسه دې سرور د API ځواب نه دی ثبت کړی.",
  route:"د API برخه",requests:"غوښتنې",milliseconds:"ملي ثانیې",warning:"څېړنې ته اړتیا لري",
  observed:"یوازې اندازه‌ګیري؛ د خپرېدو اجازه نه ده",
  API_P95_ELEVATED:"د API د ځواب ۹۵مه سلنه له ۱٫۵ ثانیو زیاته ده.",
  API_SERVER_ERRORS:"په دې نمونه کې درې یا زیاتې د سرور تېروتنې شته.",
  DB_POOL_WAITING:"درې یا زیاتې غوښتنې د ډیټابېس اتصال ته منتظرې دي."
 }
} as const;
export function PlatformPerformancePanel({data,locale}:{data:PerformanceDiagnostics|undefined;locale:Locale}){
 const w=copy[locale]??copy.en;
 if(!data||data.availability.actualSlaCertified!==false||
    data.sampledFrom!=="completed_api_requests_on_this_instance")
  return <div className="p36-card" role="status"><p>{w.insufficient}</p></div>;
 const fmt=(n:number)=>n.toLocaleString(locale);
 const duration=(v:number|null)=>v===null?"—":fmt(v)+" "+w.milliseconds;
 const caution=data.availability.signals.length>0;
 return <section className="p36-card" aria-labelledby="p36-title">
  <div className="p36-head">
   <div><div className="eyebrow">DINEFLOW / PERFORMANCE</div>
    <h3 id="p36-title"><Activity size={19} aria-hidden="true"/>{w.title}</h3>
    <p>{w.subtitle}</p></div>
   <span className={"p36-badge"+(caution?" p36-badge-warn":"")}>
    {caution?<AlertTriangle size={15} aria-hidden="true"/>:<Clock3 size={15} aria-hidden="true"/>}
    {caution?w.warning:w.observed}</span>
  </div>
  <div className="p36-metrics">
   <div><span>{w.observations}</span><strong>{fmt(data.sampleCount)}</strong></div>
   <div><span>{w.median}</span><strong>{duration(data.p50Ms)}</strong></div>
   <div><span>{w.p95}</span><strong>{duration(data.p95Ms)}</strong></div>
   <div><span>{w.errors}</span><strong>{fmt(data.serverErrors)}</strong></div>
   <div><span>{w.throttled}</span><strong>{fmt(data.rateLimited)}</strong></div>
   <div><span>{w.slow}</span><strong>{fmt(data.slowRequests)}</strong></div>
   <div><span>{w.pool}</span><strong>{fmt(data.pool.waiting)}</strong></div>
   <div><span>{w.capacity}</span><strong>{fmt(data.pool.total-data.pool.idle)} / {fmt(data.pool.maxConfigured)}</strong></div>
  </div>
  {data.sampleCount===0&&<p className="p36-note">{w.noData}</p>}
  {data.sampleCount<20&&<p className="p36-note">{w.insufficient}</p>}
  {data.limitedToRecentSamples&&<p className="p36-note">{w.limited}</p>}
  {caution&&<div className="p36-warnings" role="status">
   {data.availability.signals.map(signal=><p key={signal}>
    <AlertTriangle size={16} aria-hidden="true"/>{w[signal]}</p>)}
  </div>}
  {data.routeGroups.length>0&&<div className="p36-table-wrap">
   <table className="p36-table">
    <thead><tr><th scope="col"><ServerCog size={14} aria-hidden="true"/>{w.route}</th>
     <th scope="col">{w.requests}</th><th scope="col">{w.p95}</th></tr></thead>
    <tbody>{data.routeGroups.map(group=><tr key={group.route}><th scope="row">{group.route}</th>
     <td>{fmt(group.count)}</td><td>{duration(group.p95Ms)}</td></tr>)}</tbody>
   </table>
  </div>}
  <div className="p36-footer"><Database size={16} aria-hidden="true"/><span>{w.note}</span></div>
 </section>;
}
