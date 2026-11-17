"use client";

import {type FormEvent,useRef,useState} from "react";
import Link from "next/link";
import {ArrowLeft,CheckCircle2,Mail,ShieldCheck,UtensilsCrossed} from "lucide-react";
import {direction} from "@dineflow/shared";
import {authClient} from "@/lib/auth-client";
import {au} from "@/lib/auth-ux-copy";
import {AuthLanguage,useAuthLocale} from "@/components/ui/auth-ui";
import {InlineFeedback} from "@/components/ui/interaction-controls";

export default function ForgotPasswordPage(){
  const {locale,setLocale}=useAuthLocale();
  const [email,setEmail]=useState(""),[busy,setBusy]=useState(false);
  const [done,setDone]=useState(false),[error,setError]=useState("");
  const submitting=useRef(false);
  async function submit(event:FormEvent<HTMLFormElement>){
    event.preventDefault();
    if(submitting.current)return;
    submitting.current=true;setBusy(true);setError("");
    try{
      const result=await authClient.requestPasswordReset({
        email:email.trim().toLowerCase(),
        redirectTo:window.location.origin+"/reset-password"
      });
      // Never disclose whether an address exists in the database.
      if(result.error)throw new Error("REQUEST_FAILED");
      setDone(true);
    }catch{setError(au(locale,"requestFailed"));}
    finally{submitting.current=false;setBusy(false);}
  }
  return <main className="auth-layout p18-auth-layout" dir={direction(locale)}>
    <section className="auth-intro"><div className="auth-brand">
      <span className="brand-mark"><UtensilsCrossed size={25}/></span>DineFlow
    </div><div className="auth-copy"><span className="eyebrow">ACCOUNT SECURITY</span>
      <h1>{au(locale,"forgotTitle")}</h1><p>{au(locale,"forgotHint")}</p>
      <div className="auth-benefit"><ShieldCheck size={20}/>{au(locale,"securityHint")}</div>
    </div></section>
    <section className="auth-form-panel">
      <div className="auth-form-top"><AuthLanguage locale={locale} onChange={setLocale} id="forgot-language"/></div>
      <div className="auth-card">
        <span className="auth-card-icon">{done?<CheckCircle2 size={23}/>:<Mail size={23}/>}</span>
        <h2>{done?au(locale,"checkEmailTitle"):au(locale,"forgotTitle")}</h2>
        <p className="muted">{done?au(locale,"resetSent"):au(locale,"forgotHint")}</p>
        {done?<div className="p18-auth-success">
          <p className="p18-safe-email"><bdi>{email.trim().toLowerCase()}</bdi></p>
          <p className="muted">{au(locale,"verificationHelp")}</p>
          <button className="button" type="button" onClick={()=>{setDone(false);setError("");}}>
            {au(locale,"retry")}
          </button>
        </div>:<form onSubmit={submit}>
          <div className="field"><label htmlFor="recover-email">{au(locale,"invitedEmail")}</label>
            <input id="recover-email" type="email" dir="ltr" autoComplete="email"
              value={email} onChange={e=>setEmail(e.target.value)} required maxLength={254}
              placeholder="you@example.com"/></div>
          {error&&<InlineFeedback message={error}/>}
          <button className="button button-primary button-wide" type="submit" disabled={busy}>
            {busy?au(locale,"loading"):au(locale,"sendReset")}
          </button>
        </form>}
        <Link className="p18-back-link" href="/login"><ArrowLeft size={18}/>{au(locale,"backLogin")}</Link>
      </div>
    </section>
  </main>;
}
