"use client";
import {type FormEvent,useCallback,useEffect,useMemo,useRef,useState} from "react";
import Link from "next/link";
import {AlertCircle,ArrowRight,Building2,CheckCircle2,Clock3,Languages,
 LockKeyhole,RefreshCcw,RefreshCw,Save,Settings2,ShieldCheck,ChefHat,Percent,
 ReceiptText,MapPin,Phone,CalendarDays} from "lucide-react";
import {type Locale} from "@dineflow/shared";
import {useWorkspace} from "@/components/workspace-provider";
import {jsonRequest,Phase2Error} from "@/lib/phase2-api";
import {p2} from "@/lib/phase2-copy";
import {sg7} from "@/lib/guest-staff-copy";
import {f9} from "@/lib/finance-copy";
import {s22} from "@/lib/staff22-copy";
import {useInteraction} from "./ui/interaction-provider";
import {InlineFeedback} from "./ui/interaction-controls";
import {LoadingSkeleton} from "./ui/design-system";

type Tab="restaurant"|"localization"|"security";
const days=["mon","tue","wed","thu","fri","sat","sun"] as const;
type Day=typeof days[number];
type Hours=Partial<Record<Day,null|{open:string;close:string}>>;
type Data={restaurant:{name:string;slug:string;status:string}|null;
 location:{name:string;city:string}|null;
 setting:{phone:string|null;address:string|null;timezone:string;locale:Locale;
 currency:string;orderingPolicy:string;receiptFooter:string;managerCanInvite:boolean;
 openingHours:Record<string,unknown>;updatedAt:string}|null};
type Form={name:string;locationName:string;city:string;phone:string;address:string;
 timezone:string;locale:Locale;receiptFooter:string;managerCanInvite:boolean;openingHours:Hours};
function parseHours(input:Record<string,unknown>|undefined):Hours{
 const result:Hours={};
 for(const day of days){
  if(!input||!(day in input))continue;
  const row=input[day];
  if(row===null){result[day]=null;continue;}
  if(!row||typeof row!=="object"||Array.isArray(row))continue;
  const time=row as Record<string,unknown>;
  if(typeof time.open==="string"&&typeof time.close==="string")
   result[day]={open:time.open,close:time.close};
 }
 return result;
}
const fields=(data:Data):Form=>({
 name:data.restaurant?.name??"",locationName:data.location?.name??"",
 city:data.location?.city??"",phone:data.setting?.phone??"",address:data.setting?.address??"",
 timezone:data.setting?.timezone??"Asia/Kabul",locale:data.setting?.locale??"fa-AF",
 receiptFooter:data.setting?.receiptFooter??"",
 managerCanInvite:data.setting?.managerCanInvite??false,
 openingHours:parseHours(data.setting?.openingHours)
});
const same=(a:Form|null,b:Form|null)=>a&&b?JSON.stringify(a)===JSON.stringify(b):true;
const preview=(schedule:Hours,day:Day,locale:Locale)=>{
 const hour=schedule[day];
 if(hour===undefined)return s22(locale,"scheduleUnset");
 if(hour===null)return s22(locale,"scheduleClosed");
 return hour.open+" – "+hour.close;
};
export function RestaurantSettings({tab}:{tab:Tab}){
 const {workspace}=useWorkspace(),locale=workspace.locale,owner=workspace.role==="owner";
 const {notify}=useInteraction();
 const [data,setData]=useState<Data|null>(null),[form,setForm]=useState<Form|null>(null);
 const [original,setOriginal]=useState<Form|null>(null);
 const [loading,setLoading]=useState(true),[saving,setSaving]=useState(false),[error,setError]=useState("");
 const requestId=useRef(0),mutating=useRef(false);
 const dirty=!same(form,original);
 const invalidHours=useMemo(()=>form?days.some(day=>{
  const entry=form.openingHours[day];
  return !!entry&&(entry.open>=entry.close||
   !/^([01]\d|2[0-3]):[0-5]\d$/.test(entry.open)||
   !/^([01]\d|2[0-3]):[0-5]\d$/.test(entry.close));
 }):false,[form]);
 const load=useCallback(async(silent=false)=>{
  const id=++requestId.current;
  if(!silent)setLoading(true);
  try{
   const fetched=await jsonRequest<Data>("/api/tenant/settings");
   if(id!==requestId.current)return;
   setData(fetched);const next=fields(fetched);setForm(next);setOriginal(next);setError("");
  }catch(e){if(id===requestId.current)setError(e instanceof Error?e.message:s22(locale,"settingsError"));}
  finally{if(id===requestId.current)setLoading(false);}
 },[locale]);
 useEffect(()=>{void load();return()=>{requestId.current++;};},[load]);
 useEffect(()=>{
  const reload=()=>{if(document.visibilityState==="visible"&&!dirty&&!saving&&navigator.onLine)void load(true);};
  document.addEventListener("visibilitychange",reload);
  return()=>document.removeEventListener("visibilitychange",reload);
 },[load,dirty,saving]);
 function change<K extends keyof Form>(key:K,value:Form[K]){
  if(!owner||saving)return;
  setForm(previous=>previous?{...previous,[key]:value}:previous);setError("");
 }
 function changeHours(day:Day,mode:"unset"|"closed"|"open"){
  if(!form)return;
  const next:Hours={...form.openingHours};
  if(mode==="unset")delete next[day];
  else if(mode==="closed")next[day]=null;
  else next[day]={open:"09:00",close:"17:00"};
  change("openingHours",next);
 }
 function updateTime(day:Day,key:"open"|"close",value:string){
  if(!form)return;
  const next:Hours={...form.openingHours};
  const old=next[day];
  if(!old)return;
  next[day]={...old,[key]:value};change("openingHours",next);
 }
 async function save(e:FormEvent){
  e.preventDefault();
  if(!form||!owner||!dirty||mutating.current||saving)return;
  if(invalidHours){setError(s22(locale,"hoursInvalid"));return;}
  if(!form.name.trim()||!form.locationName.trim()||!form.city.trim()){
   setError(s22(locale,"fieldRequired"));return;
  }
  mutating.current=true;setSaving(true);setError("");
  try{
   await jsonRequest("/api/tenant/settings",{method:"PATCH",
    body:JSON.stringify({...form,expectedUpdatedAt:data?.setting?.updatedAt})});
   await load(true);notify(s22(locale,"settingsSaved"),"success");
  }catch(e){
   if(e instanceof Phase2Error&&e.code==="VERSION_CONFLICT")
    setError(s22(locale,"settingsUpdatedElsewhere"));
   else if(e instanceof Phase2Error&&e.code==="INVALID_HOURS")
    setError(s22(locale,"hoursInvalid"));
   else setError(e instanceof Error?e.message:s22(locale,"settingsError"));
  }finally{mutating.current=false;setSaving(false);}
 }
 function revert(){if(!original)return;setForm({...original,openingHours:{...original.openingHours}});setError("");}
 const tabs=[{key:"restaurant",icon:Building2},{key:"localization",icon:Languages},
  {key:"security",icon:LockKeyhole}] as const;
 const timezoneChoices=["Asia/Kabul","Asia/Dubai","UTC"];
 return <div className="content-stack p22-settings">
  <header className="page-heading"><div>
   <div className="eyebrow">DINEFLOW / {p2(locale,"restaurant")} / {p2(locale,"settings")}</div>
   <h1>{p2(locale,"settings")}</h1><p>{s22(locale,"setupHelp")}</p></div>
   <div className="p22-page-actions">
    {data&&<span className="p22-settings-business"><Building2 size={17}/>{data.restaurant?.name??workspace.tenantName}</span>}
    <button type="button" className="button" disabled={loading||saving}
      onClick={()=>void load()}><RefreshCw size={17}/>{s22(locale,"refresh")}</button>
   </div>
  </header>
  <nav className="context-tabs p22-tabs" aria-label={p2(locale,"settings")}>
   {tabs.map(({key,icon:Icon})=><Link key={key} href={"/app/settings/"+key}
     className={"context-tab"+(key===tab?" current":"")} aria-current={key===tab?"page":undefined}>
     <Icon size={18}/>{p2(locale,key)}</Link>)}
   <Link href="/app/settings/ordering" className="context-tab"><ChefHat size={18}/>{sg7(locale,"rules")}</Link>
   <Link href="/app/settings/charges" className="context-tab"><Percent size={18}/>{f9(locale,"chargeSettings")}</Link>
  </nav>
  {!owner&&<InlineFeedback tone="info" message={s22(locale,"readOnlySettings")}/>}
  {error&&<InlineFeedback message={error} retry={()=>void load()} onRetryLabel={s22(locale,"retry")}/>}
  {loading&&!data?<LoadingSkeleton rows={4} className="settings-card" label={s22(locale,"loading")}/>:
   form&&data?<form className="p22-settings-form" onSubmit={e=>void save(e)}>
    <div className="p22-settings-state" aria-live="polite">
     <span className={"p22-change-state"+(dirty?" is-dirty":"")}>
      {dirty?<AlertCircle size={17}/>:<CheckCircle2 size={17}/>}
      {s22(locale,dirty?"unsaved":"saved")}</span>
     <span className="p22-settings-slug"><bdi dir="ltr">{data.restaurant?.slug??"—"}</bdi></span>
    </div>
    {tab==="restaurant"&&<>
     <section className="settings-card p22-settings-card">
      <div className="section-heading"><div><h2>{s22(locale,"restaurantDetails")}</h2>
       <p className="muted">{s22(locale,"profileHelp")}</p></div><Building2 size={24}/></div>
      <div className="form-grid">
       <div className="field"><label htmlFor="p22-name">{p2(locale,"restaurantName")} *</label>
        <input id="p22-name" required minLength={2} maxLength={100} value={form.name} disabled={!owner||saving}
         onChange={e=>change("name",e.target.value)}/></div>
       <div className="field"><label htmlFor="p22-branch">{p2(locale,"branchName")} *</label>
        <input id="p22-branch" required minLength={2} maxLength={80} value={form.locationName} disabled={!owner||saving}
         onChange={e=>change("locationName",e.target.value)}/></div>
       <div className="field"><label htmlFor="p22-city">{p2(locale,"city")} *</label>
        <input id="p22-city" required minLength={2} maxLength={80} value={form.city} disabled={!owner||saving}
         onChange={e=>change("city",e.target.value)}/></div>
       <div className="field"><label htmlFor="p22-phone">{p2(locale,"phone")}</label>
        <input id="p22-phone" type="tel" dir="ltr" maxLength={30} value={form.phone} disabled={!owner||saving}
         onChange={e=>change("phone",e.target.value)}/></div>
       <div className="field form-span"><label htmlFor="p22-address">{p2(locale,"address")}</label>
        <textarea id="p22-address" rows={2} maxLength={200} value={form.address} disabled={!owner||saving}
         onChange={e=>change("address",e.target.value)}/></div>
      </div>
     </section>
     <section className="settings-card p22-settings-card p22-hour-section">
      <div className="section-heading"><div><h2>{s22(locale,"schedule")}</h2>
       <p className="muted">{s22(locale,"scheduleHint")}</p></div><CalendarDays size={24}/></div>
      <div className="p22-schedule-grid">{days.map(day=>{
       const entry=form.openingHours[day],
        mode=entry===undefined?"unset":entry===null?"closed":"open";
       return <div key={day} className={"p22-day-row"+(mode==="open"?" is-open":"")}>
         <strong>{s22(locale,day)}</strong>
         <label className="field"><span className="sr-only">{s22(locale,day)}</span>
          <select aria-label={s22(locale,day)} disabled={!owner||saving} value={mode}
           onChange={e=>changeHours(day,e.target.value as "unset"|"closed"|"open")}>
           <option value="unset">{s22(locale,"scheduleUnset")}</option>
           <option value="closed">{s22(locale,"scheduleClosed")}</option>
           <option value="open">{s22(locale,"scheduleOpen")}</option></select></label>
         {entry&&<div className="p22-hours-inputs">
          <label><span>{s22(locale,"opens")}</span>
           <input aria-label={s22(locale,day)+" "+s22(locale,"opens")} type="time"
            value={entry.open} disabled={!owner||saving} onChange={e=>updateTime(day,"open",e.target.value)}/></label>
          <label><span>{s22(locale,"closes")}</span>
           <input aria-label={s22(locale,day)+" "+s22(locale,"closes")} type="time"
            value={entry.close} disabled={!owner||saving} onChange={e=>updateTime(day,"close",e.target.value)}/></label>
         </div>}
         {entry===null&&<span className="p22-closed-badge">{s22(locale,"hoursClosed")}</span>}
         {entry===undefined&&<span className="p22-unset-badge">{s22(locale,"scheduleUnset")}</span>}
       </div>})}</div>
      <p className="p22-hours-note"><Clock3 size={16}/>{s22(locale,"hoursEmpty")}</p>
      {invalidHours&&<InlineFeedback message={s22(locale,"hoursInvalid")}/>}
     </section>
     <section className="settings-card p22-settings-card">
      <div className="section-heading"><div><h2>{s22(locale,"receipt")}</h2>
       <p className="muted">{s22(locale,"receiptPreview")}</p></div><ReceiptText size={24}/></div>
      <div className="field"><label htmlFor="p22-receipt">{p2(locale,"receiptFooter")}</label>
       <textarea id="p22-receipt" rows={2} maxLength={160} value={form.receiptFooter}
         disabled={!owner||saving} onChange={e=>change("receiptFooter",e.target.value)}/></div>
      <div className="p22-receipt-preview"><ReceiptText size={17}/><span>{form.receiptFooter||"—"}</span></div>
     </section>
    </>}
    {tab==="localization"&&<section className="settings-card p22-settings-card">
      <div className="section-heading"><div><h2>{p2(locale,"localization")}</h2>
       <p className="muted">{s22(locale,"timezoneHelp")}</p></div><Languages size={24}/></div>
      <div className="form-grid">
       <div className="field"><label htmlFor="p22-timezone">{p2(locale,"timeZone")}</label>
        <select id="p22-timezone" disabled={!owner||saving} value={form.timezone}
         onChange={e=>change("timezone",e.target.value)}>
         {timezoneChoices.map(time=> <option value={time} key={time}>
          {time}{time==="Asia/Kabul"?" (UTC+4:30)":""}</option>)}
         {!timezoneChoices.includes(form.timezone)&&<option value={form.timezone}>{form.timezone}</option>}
        </select></div>
       <div className="field"><label htmlFor="p22-language">Language / ژبه / زبان</label>
        <select id="p22-language" disabled={!owner||saving} value={form.locale}
         onChange={e=>change("locale",e.target.value as Locale)}>
         <option value="fa-AF">دری</option><option value="ps-AF">پښتو</option>
         <option value="en">English</option></select></div>
       <div className="field form-span"><label htmlFor="p22-currency">{p2(locale,"currency")}</label>
        <input id="p22-currency" dir="ltr" readOnly value={data.setting?.currency??"AFN"}/>
        <small>{s22(locale,"currencyFixed")}</small></div>
      </div>
    </section>}
    {tab==="security"&&<section className="settings-card p22-settings-card">
      <div className="section-heading"><div><h2>{s22(locale,"securityPolicy")}</h2>
       <p className="muted">{s22(locale,"securityHint")}</p></div><LockKeyhole size={24}/></div>
      <label className="p22-policy-toggle"><input type="checkbox" checked={form.managerCanInvite}
        disabled={!owner||saving} onChange={e=>change("managerCanInvite",e.target.checked)}/>
       <span><strong>{s22(locale,"managerInviteToggle")}</strong>
        <small>{s22(locale,"managerInviteHelp")}</small></span></label>
      <InlineFeedback tone="info" message={s22(locale,"safeOwners")}/>
      <div className="p22-security-links">
       <Link className="button button-small" href="/app/staff/permissions">
        <ShieldCheck size={17}/>{p2(locale,"rolePermissions")}<ArrowRight size={16}/></Link>
       <Link className="button button-small" href="/app/staff/directory">
        <Settings2 size={17}/>{s22(locale,"linkStaff")}<ArrowRight size={16}/></Link>
      </div>
    </section>}
    {owner?<footer className="p22-settings-savebar">
     <div className="p22-save-description"><ShieldCheck size={20}/><span>{s22(locale,"pageSummary")}</span></div>
     <div className="p22-save-actions">
      <button type="button" className="button" disabled={!dirty||saving} onClick={revert}>
       <RefreshCcw size={17}/>{s22(locale,"revert")}</button>
      <button type="submit" className="button button-primary" disabled={!dirty||saving||loading||invalidHours}>
       <Save size={17}/>{saving?s22(locale,"saving"):s22(locale,"save")}</button>
     </div>
    </footer>:<InlineFeedback tone="info" message={s22(locale,"ownerOnly")}/>}
   </form>:!loading?<div className="settings-card p22-settings-empty">
     <AlertCircle size={26}/><p>{s22(locale,"settingsError")}</p>
     <button className="button" type="button" onClick={()=>void load()}>{s22(locale,"retry")}</button>
    </div>:null}
 </div>;
}
