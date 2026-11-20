"use client";
import {AlertTriangle,ClipboardCheck,ShieldAlert,ShieldCheck,Clock3} from "lucide-react";
import type {Locale} from "@dineflow/shared";
import {pilotReadinessPlan,type PilotReviewSnapshot} from "@/lib/pilot41-readiness";

const labels={
 en:{title:"Pilot action board",subtitle:"Prioritized blockers from the current evidence and incident records",
  blocker:"Critical incidents",passed:"Gates passed",pending:"Missing evidence",
  failed:"Failed tests",owner:"Owner signature",platform:"Platform review",valid:"Current",stale:"Stale / absent",
  missing:"Record physical test evidence",failedGate:"Retest and document failure",
  incident:"Resolve and retest open P0/P1 incidents; their revisions invalidate earlier approvals.",
  ownerPending:"Owner: review current evidence and sign again.",
  platformPending:"Platform: independently review the current owner's evidence.",
  platformHold:"Platform HOLD remains in effect; document retest and obtain a new decision.",
  external:"External readiness remains unverified: physical Android, kitchen display/receipt, cashier money, backups and supervised shift need named human evidence.",
  externalNotice:"Internal signatures are not production authorization. No automatic GO.",
  complete:"All software-recorded stages currently signed; external release gates remain open.",
  outstanding:"Action needed before pilot review can advance.",
  open:"Open relevant gate below",none:"No unreviewed gates"},
 "fa-AF":{title:"تابلوی اقدامات آزمایشی",subtitle:"موانع اولویت‌دار از شواهد و رویدادهای فعلی",
  blocker:"حوادث بحرانی",passed:"موارد تأیید‌شده",pending:"شواهد ناقص",failed:"آزمایش ناموفق",
  owner:"امضای مالک",platform:"بررسی پلتفرم",valid:"معتبر",stale:"کهنه یا ناموجود",
  missing:"ثبت شواهد آزمایش عملی",failedGate:"آزمایش دوباره و ثبت ناکامی",
  incident:"حوادث باز P0/P1 را بررسی، رفع و دوباره آزمایش کنید؛ تأییدهای قبلی بی‌اعتبار می‌شوند.",
  ownerPending:"مالک باید شواهد کنونی را بازبینی و دوباره امضا کند.",
  platformPending:"مسئول پلتفرم باید شواهد مالک را مستقل بررسی کند.",
  platformHold:"تعلیق پلتفرم هنوز فعال است؛ آزمایش دوباره و تصمیم جدید لازم است.",
  external:"آمادگی بیرونی هنوز تأیید نشده: اندروید واقعی، آشپزخانه، رسید، صندوق، پشتیبان و شیفت عملی شواهد انسانی می‌خواهند.",
  externalNotice:"امضاهای داخلی مجوز راه‌اندازی نیستند؛ تأیید خودکار وجود ندارد.",
  complete:"مراحل ثبت‌شده فعلاً امضا شده‌اند، اما شرایط بیرونی باقی‌اند.",
  outstanding:"پیش از ادامه بررسی آزمایشی اقدام لازم است.",
  open:"مورد مربوط را در پایین باز کنید",none:"مورد بررسی‌نشده وجود ندارد"},
 "ps-AF":{title:"د ازمایښتي کړنو بورډ",subtitle:"د اوسنیو شواهدو او پېښو لومړیتوب لرونکي خنډونه",
  blocker:"جدي پېښې",passed:"تایید شوې ازموینې",pending:"نیمګړي شواهد",failed:"ناکامې ازموینې",
  owner:"د مالک لاسلیک",platform:"د پلاتفورم کتنه",valid:"اوسنی",stale:"زوړ یا نشته",
  missing:"د عملي ازموینې شواهد ثبت کړئ",failedGate:"بیا ازموینه او د ناکامۍ ثبت",
  incident:"خلاص P0/P1 پېښې حل او بیا وازمویئ؛ مخکیني تاییدونه بې اعتباره کېږي.",
  ownerPending:"مالک باید اوسني شواهد وګوري او بیا لاسلیک وکړي.",
  platformPending:"پلاتفورم دې د مالک شواهد په خپلواکه توګه وګوري.",
  platformHold:"د پلاتفورم درول پر ځای دي؛ بیا ازموینه او نوی پرېکړه اړینه ده.",
  external:"بهرنۍ چمتووالی نه دی تایید شوی: رښتینی Android، پخلنځی، رسید، نغدې پیسې، بیک اپ او عملي شیفت انساني شواهد غواړي.",
  externalNotice:"داخلي لاسلیکونه د خپرېدو اجازه نه ده؛ اتومات GO نشته.",
  complete:"ثبت شوي پړاوونه اوس لاسلیک شوي، خو بهرنۍ شرطونه پاتې دي.",
  outstanding:"د ازمایښتي بیاکتنې تر دوام مخکې اقدام اړین دی.",
  open:"اړوند ازموینه لاندې پرانیزئ",none:"نابشپړه ازموینه نشته"}
} as const;

export function PilotReadinessBoard({snapshot,locale,isPlatform,onChooseGate}:{
 snapshot:PilotReviewSnapshot;locale:Locale;isPlatform:boolean;
 onChooseGate?:(key:string)=>void;
}){
 const p=pilotReadinessPlan(snapshot),w=labels[locale]??labels.en;
 const gates=new Map(snapshot.gates.map(g=>[g.key,g.title]));
 const hasIssues=p.steps.some(step=>step.kind!=="externally_unverified");
 return <section className="p41-panel settings-card" aria-labelledby="p41-title">
  <header className="p41-heading">
   <div><span className="eyebrow">DINEFLOW / PILOT ACTIONS</span>
    <h2 id="p41-title"><ClipboardCheck size={21} aria-hidden="true"/>{w.title}</h2>
    <p>{w.subtitle}</p></div>
   <span className={"p41-pill"+(hasIssues?" p41-pill-warn":"")} role="status">
    {hasIssues?<ShieldAlert size={16} aria-hidden="true"/>:<ShieldCheck size={16} aria-hidden="true"/>}
    {hasIssues?w.outstanding:w.complete}
   </span>
  </header>
  <div className="p41-stats" aria-label={w.title}>
   {[[w.blocker,p.blockingIncidents],[w.passed,p.gatePassed],
     [w.pending,p.pendingGates],[w.failed,p.failedGates]] .map(([label,n])=>
    <div key={String(label)} className="p41-stat"><span>{label}</span><strong>{n}</strong></div>)}
  </div>
  <div className="p41-signatures">
   <span>{w.owner}: <strong>{p.ownerCurrent?w.valid:w.stale}</strong></span>
   <span>{w.platform}: <strong>{p.platformCurrent?w.valid:w.stale}</strong></span>
  </div>
  <ol className="p41-steps">
   {p.steps.map((step,index)=>{
    let message:string;let key:string|undefined;
    if(step.kind==="incident")message=w.incident;
    else if(step.kind==="gate"){
     key=step.key;
     message=(step.gateState==="failed"?w.failedGate:w.missing)+": "+(gates.get(step.key)??step.key);
    }else if(step.kind==="owner_signature")message=w.ownerPending;
    else if(step.kind==="platform_review")message=w.platformPending;
    else if(step.kind==="platform_hold")message=w.platformHold;
    else message=w.external;
    return <li key={step.kind==="gate"?"gate-"+step.key:step.kind}
     className={"p41-action"+(step.kind==="externally_unverified"?" p41-action-external":"")}>
     {step.kind==="externally_unverified"?<AlertTriangle size={18} aria-hidden="true"/>:
      <Clock3 size={18} aria-hidden="true"/>}
     <div><strong>{index+1}.</strong> {message}
      {key&&!isPlatform&&onChooseGate&&
       <button type="button" className="p41-open" onClick={()=>onChooseGate(key!)}>
        {w.open}
       </button>}
     </div>
    </li>;
   })}
  </ol>
  <p className="p41-disclaimer" role="note">{w.externalNotice}</p>
 </section>;
}
