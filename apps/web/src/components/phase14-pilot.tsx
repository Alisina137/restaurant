"use client";
import {useState,type FormEvent} from "react";
import Link from "next/link";
import {ArrowLeft,ArrowRight,ClipboardCheck,ShieldCheck,RefreshCw,CheckCircle2,
 AlertTriangle,Clock3,FileText,Building2} from "lucide-react";
import {useWorkspace} from "./workspace-provider";
import {postSaas,useSaasData} from "@/lib/phase12-api";
import type {Locale} from "@dineflow/shared";

type Gate={key:string;title:string;help:string;review:{id:number;result:"passed"|"failed";
 evidence:string;actorId:string;createdAt:string}|null};
type Signature={id:number;decision:string;note:string;actorId:string;
 ownerSignoffId:number|null;fingerprint:string;createdAt:string};
type Pilot={tenantId:string;gates:Gate[];completed:number;total:number;complete:boolean;
 fingerprint:string;ownerSignoff:Signature|null;platformDecision:Signature|null;
 status:"blocked"|"awaiting_owner"|"awaiting_platform"|"held"|"signed_off";
 canEdit?:boolean;restaurant?:{id:string;name:string;status:string}};
type ListItem={id:string;name:string;status:string;pilotStatus:string;completed:number;total:number};
const words={
 en:{title:"Supervised pilot & release gates",intro:"Evidence-led readiness for real restaurant operations. Recorded statements do not constitute testing.",
  label:"Operational checklist",owner:"Owner review",platform:"Independent platform review",pending:"Pending",
  passed:"Passed",failed:"Failed",gates:"Gates passed",evidence:"Observed evidence and tester notes",
  note:"Sign-off notes (who, when, location and unresolved risks)",save:"Record gate result",
  sign:"Sign off as restaurant owner",approve:"Approve supervised pilot evidence",hold:"Place approval on hold",
  refresh:"Refresh",back:"All pilots",status:"State",retry:"Retry",noData:"No pilot evidence yet.",
  approved:"Signed off (reported)",blocked:"Blocked — missing or failed evidence",
  awaiting_owner:"Awaiting owner sign-off",awaiting_platform:"Awaiting independent platform review",
  held:"Held by platform operator",signed_off:"Signed off — external certification still required",
  success:"Recorded. Readiness has been refreshed.",error:"Could not save. Review the information and try again.",
  ownerHint:"Only the restaurant owner may record evidence and sign. Manager access is read-only.",
  platformHint:"An independent platform operator reviews the current evidence and owner sign-off. Any changed gate invalidates the prior decision.",
  warning:"Do not mark a gate passed without performing the physical test. Never include customer personal data, secrets, QR/PIN codes or bank account numbers in evidence.",
  limited:"This is an accountable internal sign-off record. A real full-service shift, cash handling, Android, receipts, backup/restore and incident drill must still happen outside this application.",
  choose:"Choose a gate",decision:"Outcome",addEvidence:"Describe the actual device, operator, measured result, and evidence location (25–1500 characters).",
  approveOnly:"Approval requires all 12 passed gates and a current owner sign-off.",external:"Manual evidence, not automated certification.",
  view:"Review",restaurants:"Restaurant pilot reviews",noRestaurants:"No restaurants registered.",next:"Next",previous:"Previous"},
 "fa-AF":{title:"آمادگی آزمایش عملی و راه‌اندازی",intro:"آمادگی واقعی رستورانت با ثبت شواهد. این ثبت جایگزین آزمایش عملی نیست.",
  label:"فهرست بررسی عملیاتی",owner:"بررسی مالک",platform:"بررسی مستقل پلتفرم",pending:"انجام نشده",
  passed:"موفق",failed:"ناموفق",gates:"موارد تأییدشده",evidence:"شواهد و یادداشت آزمایش",
  note:"توضیحات تأیید (شخص، زمان، مکان و خطرات باقی‌مانده)",save:"ثبت نتیجه",
  sign:"تأیید توسط مالک",approve:"تأیید شواهد آزمایش عملی",hold:"تعلیق تأیید",
  refresh:"تازه‌سازی",back:"همه آزمایش‌ها",status:"وضعیت",retry:"تلاش دوباره",noData:"هنوز شواهد ثبت نشده است.",
  approved:"تأیید ثبت شد",blocked:"مسدود — شواهد ناقص یا ناموفق",
  awaiting_owner:"در انتظار تأیید مالک",awaiting_platform:"در انتظار تأیید مستقل پلتفرم",
  held:"توسط پلتفرم تعلیق شده",signed_off:"تأیید ثبت شد — بررسی واقعی هنوز لازم است",
  success:"ثبت شد و وضعیت به‌روز گردید.",error:"ذخیره نشد؛ اطلاعات را بررسی کنید.",
  ownerHint:"فقط مالک شواهد را ثبت و تأیید می‌کند؛ مدیر صرفاً مشاهده می‌کند.",
  platformHint:"اپراتور مستقل شواهد فعلی را بررسی می‌کند؛ تغییر هر مورد تأیید قبلی را بی‌اعتبار می‌سازد.",
  warning:"بدون آزمایش واقعی گزینه موفق را انتخاب نکنید. اطلاعات مشتری، رمز، کد QR/PIN یا مشخصات بانکی را ثبت نکنید.",
  limited:"این ثبت داخلی است. شیفت واقعی، صندوق، اندروید، چاپ رسید، بازیابی پشتیبان و تمرین حادثه باید جداگانه انجام شوند.",
  choose:"انتخاب مورد",decision:"نتیجه",addEvidence:"دستگاه، آزمایشگر، نتیجه و محل شواهد را بنویسید (۲۵ تا ۱۵۰۰ نویسه).",
  approveOnly:"برای تأیید، هر ۱۲ مورد و امضای مالک باید تکمیل باشد.",external:"شواهد دستی، نه تأیید خودکار.",
  view:"بررسی",restaurants:"بررسی آزمایش رستورانت‌ها",noRestaurants:"رستورانتی ثبت نشده است.",next:"بعدی",previous:"قبلی"},
 "ps-AF":{title:"د ازمایښتي پړاو او خپرولو چمتووالی",intro:"د رستورانت د واقعي کار لپاره د شواهدو ثبت؛ دا د عملي ازموینې بدیل نه دی.",
  label:"د عملیاتي کتنې لېست",owner:"د خاوند کتنه",platform:"د پلېټفارم خپلواکه کتنه",pending:"پاتې",
  passed:"بریالی",failed:"ناکام",gates:"بریالۍ کتنې",evidence:"شواهد او د ازموینې یادښتونه",
  note:"د تایید یادښتونه (څوک، کله، چېرته او پاتې خطرونه)",save:"پایله ثبت کړه",
  sign:"د خاوند تایید",approve:"د ازمایښتي شواهدو تایید",hold:"تایید وځنډوه",
  refresh:"تازه کول",back:"ټولې ازموینې",status:"حالت",retry:"بیا هڅه",noData:"تر اوسه شواهد نشته.",
  approved:"تایید ثبت شو",blocked:"بند — شواهد نیمګړي یا ناکام دي",
  awaiting_owner:"د خاوند تایید ته په تمه",awaiting_platform:"د پلېټفارم خپلواکې کتنې ته په تمه",
  held:"پلېټفارم ځنډولی",signed_off:"تایید ثبت شو — واقعي تصدیق لا اړین دی",
  success:"ثبت او تازه شو.",error:"ثبت ناکام شو؛ معلومات وګورئ.",
  ownerHint:"یوازې خاوند شواهد ثبتوي او تاییدوي؛ مدیر یې یوازې ویني.",
  platformHint:"خپلواک څارونکی شواهد او د خاوند تایید ګوري؛ هر نوی بدلون پخوانی تایید باطلوي.",
  warning:"له واقعي ازموینې پرته بریالی مه ټاکئ. د مشتریانو معلومات، رمزونه، QR/PIN او بانکي شمېرې مه لیکئ.",
  limited:"دا داخلي ثبت دی. واقعي شیفټ، پیسې، اندروید، رسیدونه، بیک اپ او د پېښې تمرین باید جلا ترسره شي.",
  choose:"یو مورد وټاکئ",decision:"پایله",addEvidence:"وسیله، آزموینه کوونکی، نتیجه او د شواهدو ځای ولیکئ (۲۵–۱۵۰۰ توري).",
  approveOnly:"ټول ۱۲ موارد او د خاوند تازه تایید اړین دي.",external:"لاسي شواهد، نه اتومات تصدیق.",
  view:"کتنه",restaurants:"د رستورانتونو ازمایښتي کتنې",noRestaurants:"رستورانت نشته.",next:"بل",previous:"مخکینی"}
} as const;
type CopyKey=keyof typeof words.en;
function t(locale:Locale,key:CopyKey){return words[locale]?.[key]??words.en[key];}
const gateLabels:Record<string,[string,string]>={
 roles:["دسترسی نقش‌ها و جداسازی اطلاعات","د رولونو لاسرسی او جلاوالی"],
 qr:["امنیت QR و نشست مهمان","د QR او مېلمه امنیت"],
 orders:["چرخه سفارش و آشپزخانه","د فرمایش او پخلنځي بهیر"],
 cash:["صندوق، بازپرداخت و تطبیق حساب","نغدې، بیرته ورکول او حساب"],
 billing:["اشتراک و تأیید فاکتور","ګډون او د بل تایید"],
 languages:["دری، پشتو و انگلیسی","دري، پښتو او انګلیسي"],
 devices:["دستگاه‌ها و چاپگر رسید","وسیلې او رسید چاپوونکی"],
 accessibility:["دسترس‌پذیری و صفحه‌کلید","لاسرسی او کیبورډ"],
 reliability:["فشار کاری و وصل مجدد","د بوختیا او بیا وصل ازموینه"],
 backups:["بازیابی پایگاه داده و رسانه","د ډیټابېس او رسنیو بیا رغونه"],
 rollback:["بازگشت نسخه و تمرین حادثه","د نسخې بېرته ګرځول او پېښه"],
 shift:["شیفت کامل واقعی با نظارت","د واقعي څارل شوي شیفټ ازموینه"]};
function StateChip({status,locale}:{status:Pilot["status"];locale:Locale}){
 return <span className={"p14-chip p14-"+status}><ShieldCheck size={16}/>{t(locale,status)}</span>;
}
function Dt({when,locale}:{when:string;locale:Locale}){return <time dateTime={when}>{new Date(when).toLocaleString(locale)}</time>;}
export function PilotReview({tenantId}:{tenantId?:string}){
 const {workspace}=useWorkspace(),locale=workspace.locale;
 const isPlatform=!!tenantId;
 const path=isPlatform?"/api/platform/pilots/"+encodeURIComponent(tenantId):"/api/pilot";
 const {data,loading,error,load}=useSaasData<Pilot>(path);
 const [selected,setSelected]=useState(""),[result,setResult]=useState("passed"),
  [evidence,setEvidence]=useState(""),[note,setNote]=useState(""),
  [busy,setBusy]=useState(false),[notice,setNotice]=useState(""),[problem,setProblem]=useState("");
 const canEdit=!isPlatform&&workspace.role==="owner";
 async function submit(path:string,body:Record<string,unknown>){
  if(busy)return;
  setBusy(true);setProblem("");setNotice("");
  try{await postSaas(path,body);await load();setNotice(t(locale,"success"));setEvidence("");setNote("");}
  catch(e){setProblem(e instanceof Error?e.message:t(locale,"error"));}
  finally{setBusy(false);}
 }
 function submitGate(ev:FormEvent){
  ev.preventDefault();void submit("/api/pilot/gates",{key:selected,result,evidence});
 }
 const canApprove=data?.complete&&data.ownerSignoff?.fingerprint===data.fingerprint;
 return <div className="content-stack p14-console">
  {isPlatform&&<Link className="text-link" href="/platform/pilots"><ArrowLeft size={17}/>{t(locale,"back")}</Link>}
  <div className="page-heading"><div><span className="eyebrow">DINEFLOW / PILOT OPERATIONS</span>
   <h1>{data?.restaurant?.name??t(locale,"title")}</h1><p>{t(locale,"intro")}</p></div>
   <button className="button" onClick={()=>void load()} disabled={busy||loading}><RefreshCw size={16}/>{t(locale,"refresh")}</button></div>
  <div className="p14-notice" role="note"><AlertTriangle size={21}/><p>{t(locale,"limited")}</p></div>
  {error&&<div className="form-error" role="alert">{error}</div>}
  {problem&&<div className="form-error" role="alert">{problem}</div>}
  {notice&&<div className="success-banner" role="status">{notice}</div>}
  {loading&&!data?<div className="list-skeleton"><span/><span/><span/></div>:data&&<>
   <div className="p14-summary">
    <div className="settings-card p14-summary-card"><span>{t(locale,"gates")}</span>
     <strong>{data.completed}/{data.total}</strong><div className="p14-meter"><div style={{width:(100*data.completed/data.total)+"%"}}/></div></div>
    <div className="settings-card p14-summary-card"><span>{t(locale,"status")}</span><StateChip status={data.status} locale={locale}/></div>
    <div className="settings-card p14-summary-card"><span>{t(locale,"owner")}</span>
     <strong>{data.ownerSignoff?.fingerprint===data.fingerprint&&data.complete?"✓": "—"}</strong></div>
    <div className="settings-card p14-summary-card"><span>{t(locale,"platform")}</span>
     <strong>{data.status==="signed_off"?"✓":"—"}</strong></div>
   </div>
   <section className="settings-card p14-panel">
    <div className="section-heading"><div><h2>{t(locale,"label")}</h2>
     <p>{t(locale,"warning")}</p></div><ClipboardCheck size={24}/></div>
    <div className="p14-gate-grid">{data.gates.map((g,i)=>{
     const label=locale==="en"?g.title:gateLabels[g.key]?.[locale==="ps-AF"?1:0]??g.title;
     return <article key={g.key} className={"p14-gate"+(g.review?.result==="failed"?" p14-failed":"")}>
      <div className="p14-gate-top"><span className="p14-gate-num">{String(i+1).padStart(2,"0")}</span>
       <strong>{label}</strong><span className={"p14-badge "+(g.review?.result??"pending")}>
        {g.review?.result==="passed"?t(locale,"passed"):g.review?.result==="failed"?t(locale,"failed"):t(locale,"pending")}</span></div>
      {locale==="en"&&<p className="p14-help">{g.help}</p>}
      {g.review&&<div className="p14-evidence"><span>{t(locale,"evidence")}</span><p>{g.review.evidence}</p>
       <small><Dt when={g.review.createdAt} locale={locale}/></small></div>}
      {canEdit&&<button type="button" className="button button-small" onClick={()=>{setSelected(g.key);setProblem("");document.getElementById("p14-gate-form")?.scrollIntoView({behavior:"smooth",block:"center"});}}>
        <FileText size={15}/>{t(locale,"save")}</button>}
     </article>;
    })}</div>
   </section>
   {canEdit&&<section className="settings-card p14-panel" id="p14-gate-form"><h2>{t(locale,"save")}</h2>
    <form className="p14-form" onSubmit={submitGate}>
     <label>{t(locale,"choose")}<select required value={selected} onChange={e=>setSelected(e.target.value)}>
      <option value="">{t(locale,"choose")}</option>{data.gates.map(g=><option key={g.key} value={g.key}>
       {locale==="en"?g.title:gateLabels[g.key]?.[locale==="ps-AF"?1:0]??g.title}</option>)}</select></label>
     <label>{t(locale,"decision")}<select value={result} onChange={e=>setResult(e.target.value)}>
      <option value="passed">{t(locale,"passed")}</option><option value="failed">{t(locale,"failed")}</option></select></label>
     <label className="p14-full">{t(locale,"evidence")}<textarea required minLength={25} maxLength={1500}
      placeholder={t(locale,"addEvidence")} value={evidence} onChange={e=>setEvidence(e.target.value)}/></label>
     <button className="button button-primary" type="submit" disabled={!selected||evidence.trim().length<25||busy}>{t(locale,"save")}</button>
    </form></section>}
   {(isPlatform||canEdit)&&<section className="settings-card p14-panel"><h2>{isPlatform?t(locale,"platform"):t(locale,"owner")}</h2>
    <p>{isPlatform?t(locale,"platformHint"):t(locale,"ownerHint")}</p>
    {data.ownerSignoff&&<p className="p14-signoff"><CheckCircle2 size={17}/>{t(locale,"owner")}: <Dt when={data.ownerSignoff.createdAt} locale={locale}/> — {data.ownerSignoff.note}</p>}
    {data.platformDecision&&<p className="p14-signoff"><Clock3 size={17}/>{t(locale,"platform")}: {data.platformDecision.decision} — {data.platformDecision.note}</p>}
    <label className="p14-note-label">{t(locale,"note")}<textarea minLength={30} maxLength={1500}
      value={note} onChange={e=>setNote(e.target.value)}/></label>
    <div className="p14-buttons">{isPlatform?<>
      <button className="button button-primary" disabled={!canApprove||note.trim().length<30||busy}
       onClick={()=>void submit(path+"/decision",{decision:"approved",note})}><CheckCircle2 size={17}/>{t(locale,"approve")}</button>
      <button className="button" disabled={note.trim().length<30||busy}
       onClick={()=>void submit(path+"/decision",{decision:"hold",note})}><AlertTriangle size={17}/>{t(locale,"hold")}</button>
     </>:<button className="button button-primary" disabled={!data.complete||note.trim().length<30||busy}
       onClick={()=>void submit("/api/pilot/signoff",{note})}><ShieldCheck size={17}/>{t(locale,"sign")}</button>}</div>
    {isPlatform&&!canApprove&&<p className="muted">{t(locale,"approveOnly")}</p>}
   </section>}
  </>}
 </div>;
}
export function PilotDirectory(){
 const {workspace}=useWorkspace(),locale=workspace.locale;const [page,setPage]=useState(1);
 const {data,loading,error,load}=useSaasData<{items:ListItem[];page:number;perPage:number}>("/api/platform/pilots?page="+page);
 return <div className="content-stack p14-console"><div className="page-heading"><div>
  <span className="eyebrow">DINEFLOW / PLATFORM OPERATIONS</span><h1>{t(locale,"restaurants")}</h1>
  <p>{t(locale,"platformHint")}</p></div>
  <button className="button" onClick={()=>void load()}><RefreshCw size={17}/>{t(locale,"refresh")}</button></div>
  {error&&<div className="form-error" role="alert">{error}</div>}
  <div className="p14-notice"><AlertTriangle size={21}/>{t(locale,"limited")}</div>
  {loading&&!data?<div className="list-skeleton"><span/><span/></div>:data&&<section className="settings-card p14-panel">
   {data.items.length===0?<div className="empty-panel">{t(locale,"noRestaurants")}</div>:
    <div className="p14-directory">{data.items.map(row=><Link className="p14-directory-row"
     key={row.id} href={"/platform/pilots/"+encodeURIComponent(row.id)}>
     <Building2 size={22}/><span><strong>{row.name}</strong><small>{row.status} · {row.completed}/{row.total}</small></span>
     <span className="p14-badge pending">{t(locale,"status")}: {row.pilotStatus}</span>
     {locale==="en"?<ArrowRight size={17}/>:<ArrowLeft size={17}/>}</Link>)}</div>}
   <div className="p14-buttons"><button className="button" disabled={page===1}
    onClick={()=>setPage(p=>p-1)}>{t(locale,"previous")}</button>
    <span>{page}</span><button className="button" disabled={data.items.length<20}
    onClick={()=>setPage(p=>p+1)}>{t(locale,"next")}</button></div>
  </section>}
 </div>;
}
