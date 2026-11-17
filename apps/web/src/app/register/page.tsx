"use client";

import {type FormEvent,useRef,useState} from "react";
import Link from "next/link";
import {CheckCircle2,CircleUserRound,Mail,ShieldCheck,UtensilsCrossed} from "lucide-react";
import {direction} from "@dineflow/shared";
import {authClient} from "@/lib/auth-client";
import {p2} from "@/lib/phase2-copy";
import {au,validPassword} from "@/lib/auth-ux-copy";
import {AuthLanguage,PasswordField,useAuthLocale} from "@/components/ui/auth-ui";
import {InlineFeedback} from "@/components/ui/interaction-controls";

export default function RegisterPage(){
 const {locale,setLocale}=useAuthLocale();
 const [name,setName]=useState(""),[email,setEmail]=useState("");
 const [password,setPassword]=useState(""),[confirmPassword,setConfirmPassword]=useState("");
 const [busy,setBusy]=useState(false),[done,setDone]=useState(false),[error,setError]=useState("");
 const [resending,setResending]=useState(false),[resendNotice,setResendNotice]=useState("");
 const submitting=useRef(false);
 async function submit(event:FormEvent<HTMLFormElement>){
  event.preventDefault();
  if(submitting.current)return;
  const cleanName=name.trim();
  if(cleanName.length<2||cleanName.length>80){setError(au(locale,"nameError"));return;}
  if(!validPassword(password)){
    setError(au(locale,password.length<12?"passwordShort":"passwordTooLong"));return;
  }
  if(password!==confirmPassword){setError(au(locale,"passwordMismatch"));return;}
  submitting.current=true;setBusy(true);setError("");
  try{
   const result=await authClient.signUp.email({
    name:cleanName,email:email.trim().toLowerCase(),password,
    callbackURL:window.location.origin+"/onboarding/restaurant"
   });
   if(result.error){setError(result.error.message??p2(locale,"error"));return;}
   setDone(true);setPassword("");setConfirmPassword("");
  }catch{setError(au(locale,"requestFailed"));}
  finally{submitting.current=false;setBusy(false);}
 }
 async function resend(){
  if(resending)return;
  setResending(true);setResendNotice("");
  try{
   const result=await authClient.sendVerificationEmail({
    email:email.trim().toLowerCase(),callbackURL:window.location.origin+"/onboarding/restaurant"
   });
   if(result.error)throw new Error("VERIFY_FAILED");
   setResendNotice(au(locale,"resendSent"));
  }catch{setError(au(locale,"requestFailed"));}
  finally{setResending(false);}
 }
 return <main className="auth-layout p18-auth-layout" dir={direction(locale)}>
   <section className="auth-intro">
     <div className="auth-brand"><span className="brand-mark"><UtensilsCrossed size={24}/></span>DineFlow</div>
     <div className="auth-copy"><span className="eyebrow">RESTAURANT OPERATIONS</span>
       <h1>{p2(locale,"createRestaurant")}<span className="accent-dot">.</span></h1>
       <p>{p2(locale,"createAccountHelp")}</p>
       <div className="auth-benefit"><ShieldCheck size={20}/>{au(locale,"verificationRequired")}</div>
     </div>
   </section>
   <section className="auth-form-panel">
     <div className="auth-form-top"><AuthLanguage locale={locale} onChange={setLocale} id="register-language"/></div>
     <div className="auth-card">
       <span className="auth-card-icon">{done?<CheckCircle2 size={23}/>:<CircleUserRound size={23}/>}</span>
       <h2>{done?au(locale,"checkEmailTitle"):p2(locale,"createAccount")}</h2>
       {done?<div className="content-stack p18-registration-success">
         <InlineFeedback tone="success" message={au(locale,"checkEmailHint")}/>
         <p className="p18-safe-email" dir="ltr"><Mail size={18}/><bdi>{email.trim().toLowerCase()}</bdi></p>
         <p className="muted">{au(locale,"verificationHelp")}</p>
         {resendNotice&&<InlineFeedback tone="success" message={resendNotice}/>}
         {error&&<InlineFeedback message={error}/>}
         <button className="button" type="button" disabled={resending} onClick={()=>void resend()}>
           {resending?au(locale,"loading"):au(locale,"resend")}
         </button>
         <Link className="button button-primary button-wide" href="/login">{p2(locale,"goLogin")}</Link>
       </div>:
       <form onSubmit={submit} className="p18-auth-form">
         <div className="field"><label htmlFor="owner-name">{p2(locale,"fullName")}</label>
           <input id="owner-name" name="name" autoComplete="name" minLength={2} maxLength={80} required
             value={name} onChange={e=>setName(e.target.value)}/></div>
         <div className="field"><label htmlFor="owner-email">{p2(locale,"email")}</label>
           <input id="owner-email" name="email" dir="ltr" type="email" autoComplete="email" required
             maxLength={254} value={email} onChange={e=>setEmail(e.target.value)}/></div>
         <PasswordField id="owner-password" label={p2(locale,"password")} value={password}
           onChange={setPassword} locale={locale} hint={au(locale,"passwordGuide")}/>
         <PasswordField id="owner-confirm-password" label={au(locale,"confirmPassword")} value={confirmPassword}
           onChange={setConfirmPassword} locale={locale}
           error={!!confirmPassword&&password!==confirmPassword?au(locale,"passwordMismatch"):undefined}/>
         {error&&<InlineFeedback message={error}/>}
         <button className="button button-primary button-wide" type="submit"
           disabled={busy||!validPassword(password)||password!==confirmPassword}>
           {busy?p2(locale,"loading"):p2(locale,"signUp")}
         </button>
         <p className="auth-note">{p2(locale,"alreadyAccount")} <Link className="text-link" href="/login">{p2(locale,"goLogin")}</Link></p>
       </form>}
     </div>
   </section>
 </main>;
}
