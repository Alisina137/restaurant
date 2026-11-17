"use client";

import {type FormEvent,useEffect,useRef,useState} from "react";
import Link from "next/link";
import {CheckCircle2,KeyRound,ShieldCheck,UtensilsCrossed} from "lucide-react";
import {direction} from "@dineflow/shared";
import {authClient} from "@/lib/auth-client";
import {au,validPassword} from "@/lib/auth-ux-copy";
import {AuthLanguage,PasswordField,useAuthLocale} from "@/components/ui/auth-ui";
import {InlineFeedback} from "@/components/ui/interaction-controls";

export default function ResetPasswordPage(){
  const {locale,setLocale}=useAuthLocale();
  const [token,setToken]=useState<string|null|undefined>(undefined);
  const [password,setPassword]=useState(""),[confirmPassword,setConfirmPassword]=useState("");
  const [busy,setBusy]=useState(false),[done,setDone]=useState(false),[error,setError]=useState("");
  const submitting=useRef(false);
  useEffect(()=>{
    const url=new URL(window.location.href);
    const next=url.searchParams.get("token");
    const invalid=url.searchParams.has("error")||!next||next.length<12||next.length>2048;
    setToken(invalid?null:next);
    // Remove one-time credential from address bar and browser history immediately.
    if(next){url.searchParams.delete("token");window.history.replaceState(null,"",url.pathname+url.search+url.hash);}
  },[]);
  async function submit(event:FormEvent<HTMLFormElement>){
    event.preventDefault();
    if(submitting.current||!token)return;
    if(!validPassword(password)){setError(au(locale,password.length<12?"passwordShort":"passwordTooLong"));return;}
    if(password!==confirmPassword){setError(au(locale,"passwordMismatch"));return;}
    submitting.current=true;setBusy(true);setError("");
    try{
      const result=await authClient.resetPassword({newPassword:password,token});
      if(result.error)throw new Error("RESET_FAILED");
      setDone(true);setPassword("");setConfirmPassword("");setToken(null);
    }catch{setError(au(locale,"resetInvalid"));}
    finally{submitting.current=false;setBusy(false);}
  }
  return <main className="auth-layout p18-auth-layout" dir={direction(locale)}>
    <section className="auth-intro"><div className="auth-brand">
      <span className="brand-mark"><UtensilsCrossed size={25}/></span>DineFlow
    </div><div className="auth-copy"><span className="eyebrow">ACCOUNT SECURITY</span>
      <h1>{au(locale,"resetTitle")}</h1><p>{au(locale,"resetHint")}</p>
      <div className="auth-benefit"><ShieldCheck size={20}/>{au(locale,"securityHint")}</div>
    </div></section>
    <section className="auth-form-panel">
      <div className="auth-form-top"><AuthLanguage locale={locale} onChange={setLocale} id="reset-language"/></div>
      <div className="auth-card"><span className="auth-card-icon">{done?<CheckCircle2 size={23}/>:<KeyRound size={23}/>}</span>
        <h2>{done?au(locale,"complete"):au(locale,"resetTitle")}</h2>
        {token===undefined?<p className="muted" role="status">{au(locale,"loading")}</p>:
         done?<div className="content-stack">
          <InlineFeedback tone="success" message={au(locale,"resetSuccess")}/>
          <Link className="button button-primary button-wide" href="/login">{au(locale,"backLogin")}</Link>
         </div>:!token?<div className="content-stack">
          <InlineFeedback message={au(locale,"resetInvalid")}/>
          <Link className="button button-primary button-wide" href="/forgot-password">{au(locale,"sendReset")}</Link>
         </div>:<form onSubmit={submit}>
          <p className="muted">{au(locale,"passwordGuide")}</p>
          <PasswordField id="new-password" label={au(locale,"newPassword")} value={password}
            onChange={setPassword} locale={locale} hint={au(locale,"passwordGuide")}/>
          <PasswordField id="confirm-password" label={au(locale,"confirmPassword")} value={confirmPassword}
            onChange={setConfirmPassword} locale={locale}
            error={confirmPassword.length>0&&password!==confirmPassword?au(locale,"passwordMismatch"):undefined}/>
          {error&&<InlineFeedback message={error}/>}
          <button className="button button-primary button-wide" type="submit"
            disabled={busy||!validPassword(password)||password!==confirmPassword}>
            {busy?au(locale,"loading"):au(locale,"resetAction")}
          </button>
        </form>}
        <Link className="p18-back-link" href="/login">{au(locale,"backLogin")}</Link>
      </div>
    </section>
  </main>;
}
