"use client";

import {type FormEvent,useRef,useState} from "react";
import {useRouter} from "next/navigation";
import Link from "next/link";
import {ArrowLeft,ArrowRight,LockKeyhole,UtensilsCrossed,ShieldCheck} from "lucide-react";
import {direction,t} from "@dineflow/shared";
import {authClient} from "@/lib/auth-client";
import {getContext,ApiError} from "@/lib/context";
import {au,validInviteRedirect} from "@/lib/auth-ux-copy";
import {AuthLanguage,PasswordField,useAuthLocale} from "@/components/ui/auth-ui";
import {InlineFeedback} from "@/components/ui/interaction-controls";

export default function LoginPage(){
 const router=useRouter(),{locale,setLocale}=useAuthLocale();
 const [email,setEmail]=useState(""),[password,setPassword]=useState("");
 const [busy,setBusy]=useState(false),[error,setError]=useState(""),[needVerify,setNeedVerify]=useState(false);
 const [resending,setResending]=useState(false),[verificationNotice,setVerificationNotice]=useState("");
 const submitting=useRef(false);
 const expired=typeof window!=="undefined"&&new URLSearchParams(window.location.search).get("expired")==="1";
 const inviteNext=typeof window!=="undefined"?
    validInviteRedirect(new URLSearchParams(window.location.search).get("next")):null;
 async function submit(event:FormEvent<HTMLFormElement>){
  event.preventDefault();
  if(submitting.current)return;
  submitting.current=true;setBusy(true);setError("");setNeedVerify(false);setVerificationNotice("");
  try{
   const result=await authClient.signIn.email({email:email.trim().toLowerCase(),password});
   if(result.error){
     if(result.error.code==="EMAIL_NOT_VERIFIED"){setNeedVerify(true);setError(au(locale,"emailVerified"));}
     else setError(t(locale,"invalidLogin"));
     return;
   }
   if(inviteNext){router.replace(inviteNext);return;}
   try{
     const context=await getContext();
     router.replace(context.defaultRoute);
   }catch(e){
     if(e instanceof ApiError&&e.status===403)router.replace("/onboarding/restaurant");
     else if(e instanceof ApiError&&e.status===401){setError(au(locale,"expiredSession"));}
     else setError(t(locale,"offline"));
   }
  }catch{setError(t(locale,"offline"));}
  finally{submitting.current=false;setBusy(false);}
 }
 async function resendVerification(){
   if(resending||!email.trim())return;
   setResending(true);setVerificationNotice("");
   try{
    const next=inviteNext??"/onboarding/restaurant";
    const result=await authClient.sendVerificationEmail({
      email:email.trim().toLowerCase(),callbackURL:window.location.origin+next
    });
    if(result.error)throw new Error("VERIFY_FAILED");
    setVerificationNotice(au(locale,"resendSent"));
   }catch{setError(au(locale,"requestFailed"));}
   finally{setResending(false);}
 }
 const arrow=direction(locale)==="rtl"?<ArrowLeft size={18}/>:<ArrowRight size={18}/>;
 return <main className="auth-layout p18-auth-layout" dir={direction(locale)}>
   <section className="auth-intro">
     <div className="auth-brand"><span className="brand-mark"><UtensilsCrossed size={25}/></span><span>DineFlow</span></div>
     <div className="auth-copy">
       <span className="eyebrow">RESTAURANT OPERATIONS</span>
       <h1>{t(locale,"welcome")}<span className="accent-dot">.</span></h1>
       <p>{t(locale,"signInHelp")}</p>
       <div className="auth-benefit"><ShieldCheck size={20}/><span>{t(locale,"secureBody")}</span></div>
     </div>
     <div className="auth-decoration" aria-hidden="true"><span className="orbit orbit-one"/><span className="orbit orbit-two"/><UtensilsCrossed size={72}/></div>
   </section>
   <section className="auth-form-panel">
     <div className="auth-form-top"><AuthLanguage locale={locale} onChange={setLocale} id="signin-language"/></div>
     <form onSubmit={submit} className="auth-card">
       <span className="auth-card-icon"><LockKeyhole size={22}/></span>
       <h2>{t(locale,"signIn")}</h2><p className="muted">{t(locale,"signInHelp")}</p>
       {expired&&<InlineFeedback tone="info" message={au(locale,"expiredSession")}/>}
       <div className="field"><label htmlFor="signin-email">{t(locale,"email")}</label>
         <input id="signin-email" name="email" type="email" autoComplete="username" value={email}
           onChange={e=>setEmail(e.target.value)} required maxLength={254}
           placeholder="staff@example.com" dir="ltr" autoFocus/>
       </div>
       <PasswordField id="signin-password" label={t(locale,"password")} value={password}
          onChange={setPassword} locale={locale} autoComplete="current-password" minLength={1}/>
       <div className="p18-auth-links"><Link className="text-link" href="/forgot-password">{au(locale,"forgotLink")}</Link></div>
       {error&&<InlineFeedback message={error}/>}
       {needVerify&&<button className="button" type="button" disabled={busy||resending}
         onClick={()=>void resendVerification()}>{resending?au(locale,"loading"):au(locale,"resend")}</button>}
       {verificationNotice&&<InlineFeedback tone="success" message={verificationNotice}/>}
       <button className="button button-primary button-wide" type="submit" disabled={busy}>
         <span>{busy?t(locale,"loading"):t(locale,"signIn")}</span>{busy?<span className="button-spinner"/>:arrow}
       </button>
       <p className="auth-note">{t(locale,"support")}</p>
       <p className="auth-note"><Link className="text-link" href="/register">
         {locale==="en"?"Create a restaurant account":locale==="fa-AF"?"ایجاد حساب رستورانت":"د رستورانت حساب جوړول"}
       </Link></p>
     </form>
   </section>
 </main>;
}
