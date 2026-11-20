"use client";
import type {Locale} from "@dineflow/shared";
import {AlertTriangle,ArrowUpRight,CheckCircle2,ClipboardCheck,ShieldAlert} from "lucide-react";
import {pilot41NextActions,type PilotActionState,type PilotNextAction} from "@/lib/pilot41";

const words={
 en:{
  heading:"Next actions for a supervised pilot",
  intro:"Built from your recorded gate reviews, incident counts and signatures. Use this plan to conduct the missing real-world checks.",
  critical_incidents:"Critical incidents still open",
  failed_gate:"Retest a failed acceptance gate",
  untested_gate:"Perform and record a missing physical test",
  owner_signoff:"Owner must sign the current evidence",
  platform_review:"Independent platform review is required",
  platform_hold:"Platform has placed the decision on hold",
  p2_followup:"Noncritical incidents still need follow-up",
  external_verification:"Internal signatures recorded — external tests and launch authorization remain separate",
  gateAction:"Open this gate",incidentAction:"Review incident register",signAction:"Review signatures",
  platformAction:"Review platform decision",askOwner:"Ask restaurant owner to review",
  blocked:"Hold: unresolved physical or operator evidence",
  done:"Recorded reviews are complete, but this is not production certification.",
  note:"This is a task list, NOT an automatic pilot pass, financial reconciliation, device test or GO decision.",
  count:"records"
 },
 "fa-AF":{
  heading:"اقدام‌های بعدی برای آزمایش تحت نظارت",
  intro:"این فهرست از نتایج ثبت‌شده، حوادث و امضاها ساخته شده است. بررسی‌های واقعی باقی‌مانده را انجام دهید.",
  critical_incidents:"حوادث بحرانی هنوز باز اند",
  failed_gate:"آزمایش ناموفق را دوباره انجام دهید",
  untested_gate:"آزمایش عملی انجام‌نشده را ثبت کنید",
  owner_signoff:"مالک باید شواهد تازه را تأیید کند",
  platform_review:"بررسی مستقل پلتفرم لازم است",
  platform_hold:"پلتفرم تصمیم را به حالت تعلیق گذاشته است",
  p2_followup:"حوادث غیر بحرانی نیاز به پیگیری دارند",
  external_verification:"امضاهای داخلی ثبت شده؛ بررسی بیرونی و اجازهٔ راه‌اندازی جداگانه لازم است",
  gateAction:"بازکردن این مورد",incidentAction:"بررسی فهرست حوادث",
  signAction:"بررسی امضاها",platformAction:"بررسی تصمیم پلتفرم",
  askOwner:"از مالک رستورانت بخواهید بررسی کند",
  blocked:"توقف: شواهد عملی یا مسئولانه هنوز ناقص است",
  done:"بررسی‌های ثبت‌شده تکمیل است، اما تأیید نشر در محیط واقعی نیست.",
  note:"این فهرست کارهاست، نه تأیید خودکار، تطبیق صندوق، آزمایش دستگاه یا مجوز نشر.",
  count:"مورد"
 },
 "ps-AF":{
  heading:"د څارل شوې ازموینې راتلونکي کارونه",
  intro:"دا لېست له ثبت شویو کتنو، پېښو او لاسلیکونو جوړ شوی؛ پاتې عملي ازموینې پوره کړئ.",
  critical_incidents:"جدي پېښې لا پرانیستې دي",
  failed_gate:"ناکامه ازموینه بیا ترسره کړئ",
  untested_gate:"پاتې عملي ازموینه ترسره او ثبت کړئ",
  owner_signoff:"خاوند باید اوسني شواهد لاسلیک کړي",
  platform_review:"د پلاتفورم خپلواکه کتنه اړینه ده",
  platform_hold:"پلاتفورم پرېکړه ځنډولې ده",
  p2_followup:"غیر جدي پېښې لا څېړنې ته اړتیا لري",
  external_verification:"داخلي لاسلیکونه شته؛ بهرني ازموینې او د خپرېدو اجازه جلا دي",
  gateAction:"دا مورد پرانیزئ",incidentAction:"د پېښو لېست وګورئ",
  signAction:"لاسلیکونه وګورئ",platformAction:"د پلاتفورم پرېکړه وګورئ",
  askOwner:"د رستورانت خاوند دې وګوري",
  blocked:"تم: عملي یا مسؤل شواهد لا نیمګړي دي",
  done:"ثبت شوې کتنې بشپړې دي، خو دا د واقعي خپرېدو تصدیق نه دی.",
  note:"دا د کارونو لېست دی، نه اتومات تایید، د پیسو برابرول، د وسیلو ازموینه یا د خپرېدو اجازه.",
  count:"ریکارډونه"
 }
} as const;

export function PilotActionQueue({state,locale,isPlatform,canEdit,labelForGate,onChooseGate}:{
 state:PilotActionState;locale:Locale;isPlatform:boolean;canEdit:boolean;
 labelForGate:(key:string,title:string)=>string;
 onChooseGate:(key:string)=>void
}){
 const w=words[locale]??words.en;
 const actions=pilot41NextActions(state);
 const blocked=state.incidents.blocking>0||state.gates.some(g=>g.review?.result!=="passed");
 function actionControl(item:PilotNextAction){
  if(item.kind==="untested_gate"||item.kind==="failed_gate"){
   if(!item.key)return null;
   return <button type="button" className="p41-action-button" onClick={()=>onChooseGate(item.key!)}>
    {w.gateAction}<ArrowUpRight size={15} aria-hidden="true"/></button>;
  }
  if(item.kind==="critical_incidents"||item.kind==="p2_followup"){
   if(isPlatform)return <span className="p41-readonly">{w.askOwner}</span>;
   return <a className="p41-action-button" href="#p33-incident-register">
    {w.incidentAction}<ArrowUpRight size={15} aria-hidden="true"/></a>;
  }
  if(item.kind==="external_verification")return null;
  return <a className="p41-action-button" href="#p14-signoff">
   {item.kind==="owner_signoff"?w.signAction:w.platformAction}
   <ArrowUpRight size={15} aria-hidden="true"/></a>;
 }
 return <section className="settings-card p41-panel" aria-labelledby="p41-title">
  <div className="p41-heading">
   <div><div className="eyebrow">DINEFLOW / PILOT ACTIONS</div>
    <h2 id="p41-title"><ClipboardCheck size={22} aria-hidden="true"/>{w.heading}</h2>
    <p>{w.intro}</p></div>
   <span className={"p41-pill"+(blocked?" p41-pill-blocked":"")}>
    {blocked?<ShieldAlert size={15} aria-hidden="true"/>:
     <CheckCircle2 size={15} aria-hidden="true"/>}
    {blocked?w.blocked:w.done}
   </span>
  </div>
  <ol className="p41-action-list">
   {actions.map((item,index)=>{
    const gate=state.gates.find(g=>g.key===item.key);
    const key=item.kind+":"+(item.key??index);
    const serious=item.kind==="critical_incidents"||item.kind==="failed_gate";
    return <li key={key} className={"p41-action"+(serious?" p41-action-critical":"")}>
     <span className="p41-number" aria-hidden="true">{String(index+1).padStart(2,"0")}</span>
     <div className="p41-item-copy">
      <strong>{w[item.kind]}</strong>
      {gate&&<span>{labelForGate(gate.key,gate.title)}</span>}
      {item.count!==undefined&&<span>{item.count.toLocaleString(locale)} {w.count}</span>}
     </div>
     {actionControl(item)}
     {!canEdit&&(item.kind==="failed_gate"||item.kind==="untested_gate")&&
      <span className="p41-readonly">{w.askOwner}</span>}
    </li>;
   })}
  </ol>
  <div className="p41-limits" role="note">
   <AlertTriangle size={17} aria-hidden="true"/><p>{w.note}</p>
  </div>
 </section>;
}
