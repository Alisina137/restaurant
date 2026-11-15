"use client";
import { type FormEvent, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { CheckCircle2, ChevronLeft, ChevronRight, ClipboardCheck, Building2, Settings2, UserRound } from "lucide-react";
import { direction, isLocale, type Locale } from "@dineflow/shared";
import { authClient } from "@/lib/auth-client";
import { jsonRequest, Phase2Error } from "@/lib/phase2-api";
import { p2 } from "@/lib/phase2-copy";

type Draft = { name:string;slug:string;locationName:string;city:string;phone:string;address:string;
  timezone:string;locale:Locale;orderingPolicy:"waiter_approval"|"direct_to_kitchen";receiptFooter:string;acceptedTerms:boolean };
type Status = { user:{id:string;name:string;email:string;verified:boolean};tenantId:string|null;defaultRoute:string|null;mayCreate:boolean };
const initial:Draft={name:"",slug:"",locationName:"Main branch",city:"Kabul",phone:"",address:"",timezone:"Asia/Kabul",
  locale:"fa-AF",orderingPolicy:"waiter_approval",receiptFooter:"",acceptedTerms:false};
const steps = ["accountStep","restaurantStep","defaultsStep","reviewStep"] as const;
export default function RestaurantOnboarding() {
  const router=useRouter(), [locale,setLocale]=useState<Locale>("fa-AF");
  const [status,setStatus]=useState<Status|null>(null), [draft,setDraft]=useState<Draft>(initial);
  const [step,setStep]=useState(0), [loading,setLoading]=useState(true),[busy,setBusy]=useState(false);
  const [error,setError]=useState(""),[notice,setNotice]=useState("");
  const load=useCallback(async()=>{
    try {
      const next=await jsonRequest<Status>("/api/onboarding/status");
      if (next.defaultRoute && !next.mayCreate) { router.replace(next.defaultRoute); return; }
      setStatus(next);
      if (next.user.verified) {
        const result=await jsonRequest<{draft:Draft}>("/api/onboarding/draft");
        setDraft({ ...initial,...result.draft });
        setLocale(result.draft.locale ?? "fa-AF");
      }
    } catch(e) {
      if(e instanceof Phase2Error&&e.status===401){router.replace("/register");return;}
      setError(e instanceof Error?e.message:p2(locale,"error"));
    } finally {setLoading(false);}
  },[router,locale]);
  useEffect(()=>{void load();},[load]);
  useEffect(()=>{document.documentElement.dir=direction(locale); document.documentElement.lang=locale;},[locale]);
  function update<K extends keyof Draft>(key:K,value:Draft[K]){
    setDraft(prev=>({...prev,[key]:value}));setNotice("");setError("");
  }
  async function saveDraft(){
    const result=await jsonRequest<{draft:Draft}>("/api/onboarding/draft",{method:"PUT",body:JSON.stringify(draft)});
    setDraft(result.draft);
  }
  async function next(e?:FormEvent){
    e?.preventDefault(); setBusy(true);setError("");setNotice("");
    try{
      if(step===1 && (draft.name.trim().length<2||draft.locationName.trim().length<2||draft.city.trim().length<2||
        !/^[a-z0-9][a-z0-9-]{1,46}[a-z0-9]$/.test(draft.slug))) {
        setError("Please enter a restaurant name, a 3–48 character slug, branch and city.");return;
      }
      await saveDraft();setStep(s=>Math.min(3,s+1));
    }catch(e){setError(e instanceof Error?e.message:p2(locale,"error"));}
    finally{setBusy(false);}
  }
  async function saveOnly(){
    setBusy(true);setError("");setNotice("");
    try{await saveDraft();setNotice(p2(locale,"saveSuccess"));}catch(e){setError(e instanceof Error?e.message:p2(locale,"error"));}finally{setBusy(false);}
  }
  async function complete(){
    if(!draft.acceptedTerms){setError(p2(locale,"terms"));return;}
    setBusy(true);setError("");
    try{
      const created=await jsonRequest<{tenantId:string}>("/api/onboarding/complete",{method:"POST",body:JSON.stringify(draft)});
      if(created.tenantId) router.replace("/app/overview");
    }catch(e){setError(e instanceof Error?e.message:p2(locale,"error"));}
    finally{setBusy(false);}
  }
  async function resend(){
    if(!status?.user.email)return;
    setBusy(true);setError("");
    try{
      const result=await authClient.sendVerificationEmail({ email:status.user.email,callbackURL:window.location.origin+"/onboarding/restaurant" });
      if(result.error)throw new Error(result.error.message ?? p2(locale,"error"));
      setNotice(p2(locale,"verificationSent"));
    }catch(e){setError(e instanceof Error?e.message:p2(locale,"emailError"));}
    finally{setBusy(false);}
  }
  if(loading) return <main className="center-viewport"><span className="spinner"/>{p2(locale,"loading")}</main>;
  if(!status) return <main className="center-viewport"><section className="notice-card"><h1>{p2(locale,"error")}</h1>
    <p role="alert">{error}</p><button className="button button-primary" onClick={()=>{setLoading(true);void load();}}>{p2(locale,"retry")}</button></section></main>;
  if(!status.user.verified) return <main className="center-viewport" dir={direction(locale)}>
    <section className="notice-card"><CheckCircle2 size={35} color="var(--brand)"/><h1>{p2(locale,"verifyEmail")}</h1>
      <p dir="ltr">{status.user.email}</p>{error&&<p role="alert" className="form-error">{error}</p>}
      {notice&&<p role="status" className="success-text">{notice}</p>}
      <button className="button button-primary" disabled={busy} onClick={()=>void resend()}>{p2(locale,"resendVerification")}</button>
      <Link className="button" href="/login">{p2(locale,"goLogin")}</Link>
      <button className="button" onClick={()=>{setLoading(true);void load();}}>{p2(locale,"refresh")}</button>
    </section></main>;
  return <main className="wizard-page" dir={direction(locale)}>
    <div className="wizard-container">
      <header className="wizard-header"><div><div className="eyebrow">DINEFLOW · SETUP</div><h1>{p2(locale,"setup")}</h1>
        <p className="muted">{p2(locale,"setupHelp")}</p></div>
        <label className="field wizard-language">Language / ژبه / زبان
          <select value={locale} onChange={e=>setLocale(e.target.value as Locale)}>
            <option value="fa-AF">دری</option><option value="ps-AF">پښتو</option><option value="en">English</option>
          </select></label></header>
      <ol className="wizard-steps" aria-label="Setup progress">{steps.map((key,i)=>
        <li key={key} className={i===step?"current":i<step?"completed":""}>
          <span className="step-circle">{i<step?<CheckCircle2 size={18}/>:i+1}</span>
          <span>{p2(locale,key)}</span></li>)}</ol>
      <section className="settings-card wizard-card">
        {step===0&&<div className="wizard-section">
          <UserRound size={36} color="var(--brand)"/><h2>{p2(locale,"accountStep")}</h2>
          <p>{status.user.name} · <bdi>{status.user.email}</bdi></p>
          <p className="success-text"><CheckCircle2 size={17}/> {p2(locale,"verified")}</p></div>}
        {step===1&&<form id="wizard-details" onSubmit={e=>void next(e)} className="wizard-section">
          <Building2 size={30} color="var(--brand)"/><h2>{p2(locale,"restaurantStep")}</h2>
          <div className="form-grid">
            <div className="field"><label htmlFor="r-name">{p2(locale,"restaurantName")}</label>
              <input id="r-name" required minLength={2} maxLength={100} value={draft.name}
                onChange={e=>{ const value=e.target.value;setDraft(d=>({...d,name:value,slug:d.slug||value.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"")}));}}/></div>
            <div className="field"><label htmlFor="r-slug">{p2(locale,"slug")}</label>
              <input id="r-slug" dir="ltr" required minLength={3} maxLength={48} pattern="[a-z0-9][a-z0-9-]*[a-z0-9]"
                value={draft.slug} onChange={e=>update("slug",e.target.value.toLowerCase())}/></div>
            <div className="field"><label htmlFor="r-location">{p2(locale,"branchName")}</label>
              <input id="r-location" required minLength={2} maxLength={80} value={draft.locationName}
                onChange={e=>update("locationName",e.target.value)}/></div>
            <div className="field"><label htmlFor="r-city">{p2(locale,"city")}</label>
              <input id="r-city" required minLength={2} maxLength={80} value={draft.city} onChange={e=>update("city",e.target.value)}/></div>
            <div className="field"><label htmlFor="r-phone">{p2(locale,"phone")}</label>
              <input id="r-phone" dir="ltr" maxLength={30} value={draft.phone} onChange={e=>update("phone",e.target.value)}/></div>
            <div className="field"><label htmlFor="r-address">{p2(locale,"address")}</label>
              <input id="r-address" maxLength={200} value={draft.address} onChange={e=>update("address",e.target.value)}/></div>
          </div></form>}
        {step===2&&<form id="wizard-service" onSubmit={e=>void next(e)} className="wizard-section">
          <Settings2 size={30} color="var(--brand)"/><h2>{p2(locale,"defaultsStep")}</h2>
          <div className="form-grid">
            <div className="field"><label htmlFor="r-timezone">{p2(locale,"timeZone")}</label>
              <select id="r-timezone" value={draft.timezone} onChange={e=>update("timezone",e.target.value)}>
                <option value="Asia/Kabul">Asia/Kabul (UTC+4:30)</option><option value="Asia/Dubai">Asia/Dubai</option>
                <option value="UTC">UTC</option></select></div>
            <div className="field"><label htmlFor="r-language">Language / ژبه / زبان</label>
              <select id="r-language" value={draft.locale} onChange={e=>{update("locale",e.target.value as Locale);setLocale(e.target.value as Locale);}}>
                <option value="fa-AF">دری</option><option value="ps-AF">پښتو</option><option value="en">English</option></select></div>
            <div className="field"><label htmlFor="r-currency">{p2(locale,"currency")}</label>
              <input id="r-currency" dir="ltr" readOnly value="AFN"/></div>
            <div className="field"><label htmlFor="r-policy">{p2(locale,"ordering")}</label>
              <select id="r-policy" value={draft.orderingPolicy}
                onChange={e=>update("orderingPolicy",e.target.value as Draft["orderingPolicy"])}>
                <option value="waiter_approval">{p2(locale,"waiterApproval")}</option>
                <option value="direct_to_kitchen">{p2(locale,"directKitchen")}</option></select></div>
            <div className="field form-span"><label htmlFor="r-receipt">{p2(locale,"receiptFooter")}</label>
              <input id="r-receipt" maxLength={160} value={draft.receiptFooter} onChange={e=>update("receiptFooter",e.target.value)}/></div>
          </div></form>}
        {step===3&&<div className="wizard-section">
          <ClipboardCheck size={30} color="var(--brand)"/><h2>{p2(locale,"reviewStep")}</h2>
          <dl className="profile-list">
            <div><dt>{p2(locale,"restaurantName")}</dt><dd>{draft.name}</dd></div>
            <div><dt>{p2(locale,"slug")}</dt><dd dir="ltr">{draft.slug}</dd></div>
            <div><dt>{p2(locale,"location")}</dt><dd>{draft.locationName}, {draft.city}</dd></div>
            <div><dt>{p2(locale,"ordering")}</dt><dd>{p2(locale,draft.orderingPolicy==="waiter_approval"?"waiterApproval":"directKitchen")}</dd></div>
            <div><dt>{p2(locale,"timeZone")}</dt><dd dir="ltr">{draft.timezone}</dd></div>
          </dl>
          <label className="checkbox-line"><input type="checkbox" checked={draft.acceptedTerms}
            onChange={e=>update("acceptedTerms",e.target.checked)}/>{p2(locale,"terms")}</label></div>}
        {error&&<p className="form-error" role="alert">{error}</p>}
        {notice&&<p className="success-text" role="status">{notice}</p>}
        <div className="wizard-footer">
          <button type="button" className="button" disabled={busy||step===0} onClick={()=>setStep(s=>Math.max(0,s-1))}>
            {direction(locale)==="rtl"?<ChevronRight size={17}/>:<ChevronLeft size={17}/>} {p2(locale,"back")}</button>
          <div className="wizard-footer-actions">
            {step>0&&step<3&&<button type="button" className="button" disabled={busy} onClick={()=>void saveOnly()}>{p2(locale,"saveDraft")}</button>}
            {step<3?<button type={step===1||step===2?"submit":"button"} form={step===1?"wizard-details":step===2?"wizard-service":undefined}
              className="button button-primary" disabled={busy} onClick={step===0?()=>void next():undefined}>
                {busy?p2(locale,"loading"):p2(locale,"continue")} {direction(locale)==="rtl"?<ChevronLeft size={17}/>:<ChevronRight size={17}/>}</button>
              :<button type="button" className="button button-primary" disabled={busy||!draft.acceptedTerms} onClick={()=>void complete()}>
                {busy?p2(locale,"loading"):p2(locale,"create")}</button>}
          </div></div>
      </section>
      <p className="auth-note">{p2(locale,"trialConfig")}</p>
    </div>
  </main>;
}
