"use client";
import { type FormEvent, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { CheckCircle2, Mail, ShieldCheck, UserRoundPlus } from "lucide-react";
import { direction, isLocale, type Locale } from "@dineflow/shared";
import { authClient } from "@/lib/auth-client";
import { jsonRequest, Phase2Error } from "@/lib/phase2-api";
import { p2 } from "@/lib/phase2-copy";
type Invitation = { restaurant:string; email:string; role:string; expiresAt:string };
type Status = { user:{id:string;name:string;email:string;verified:boolean} };
export default function InvitePage() {
  const router=useRouter(), params=useParams<{token:string}>();
  const token=params.token;
  const [locale,setLocale]=useState<Locale>("fa-AF"),[invite,setInvite]=useState<Invitation|null>(null),
    [identity,setIdentity]=useState<Status|null>(null);
  const [loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[registered,setRegistered]=useState(false);
  const [name,setName]=useState(""),[password,setPassword]=useState(""),[error,setError]=useState(""),[success,setSuccess]=useState("");
  useEffect(()=>{const stored=localStorage.getItem("dineflow-locale");if(isLocale(stored))setLocale(stored);},[]);
  useEffect(()=>{document.documentElement.dir=direction(locale);document.documentElement.lang=locale;localStorage.setItem("dineflow-locale",locale);},[locale]);
  const load=useCallback(async()=>{
    try{
      const next=await jsonRequest<Invitation>("/api/invitations/"+encodeURIComponent(token));
      setInvite(next);
      try {setIdentity(await jsonRequest<Status>("/api/onboarding/status"));}catch(e){
        if(!(e instanceof Phase2Error&&e.status===401))throw e;
      }
    }catch(e){setError(e instanceof Error?e.message:p2(locale,"invitationInvalid"));}
    finally{setLoading(false);}
  },[token,locale]);
  useEffect(()=>{void load();},[load]);
  async function signUp(event:FormEvent<HTMLFormElement>){
    event.preventDefault();setBusy(true);setError("");
    try{
      const result=await authClient.signUp.email({name:name.trim(),email:invite!.email,password,
        callbackURL:window.location.href});
      if(result.error)throw new Error(result.error.message??p2(locale,"error"));
      setRegistered(true);
    }catch(e){setError(e instanceof Error?e.message:p2(locale,"emailError"));}
    finally{setBusy(false);}
  }
  async function accept(){
    if(!invite)return;
    setBusy(true);setError("");
    try {
      await jsonRequest("/api/invitations/"+encodeURIComponent(token)+"/accept",{method:"POST",body:"{}"});
      const context=await jsonRequest<{defaultRoute:string}>("/api/context");
      router.replace(context.defaultRoute);
    } catch(e){setError(e instanceof Error?e.message:p2(locale,"error"));}
    finally{setBusy(false);}
  }
  if(loading)return <main className="center-viewport"><span className="spinner"/> {p2(locale,"loading")}</main>;
  return <main className="center-viewport" dir={direction(locale)}>
    <section className="notice-card invite-card">
      <div className="invite-brand"><span className="brand-mark"><Mail size={22}/></span><strong>DineFlow</strong>
        <select className="language-select" aria-label="Language" value={locale} onChange={e=>setLocale(e.target.value as Locale)}>
          <option value="fa-AF">دری</option><option value="ps-AF">پښتو</option><option value="en">English</option></select></div>
      <h1>{p2(locale,"inviteTitle")}</h1>
      {invite ? <>
        <p>{p2(locale,"invitedTo")} <strong>{invite.restaurant}</strong></p>
        <div className="invite-meta"><div><Mail size={18}/><bdi>{invite.email}</bdi></div>
          <div><ShieldCheck size={18}/>{p2(locale,invite.role as "owner"|"manager"|"waiter"|"kitchen"|"cashier")}</div></div>
        {identity?.user.verified && identity.user.email.toLowerCase()===invite.email.toLowerCase() ?
          <button className="button button-primary button-wide" disabled={busy} onClick={()=>void accept()}>
            <CheckCircle2 size={18}/>{busy?p2(locale,"loading"):p2(locale,"acceptInvitation")}</button>
          :identity ? <div className="content-stack"><p className="form-error" role="alert">
              {identity.user.email.toLowerCase()!==invite.email.toLowerCase()?p2(locale,"inviteWrongEmail"):p2(locale,"verifyEmail")}</p>
              <Link className="button button-primary" href={"/login?next="+encodeURIComponent("/auth/invite/"+token)}>{p2(locale,"signInToAccept")}</Link>
            </div>
          : registered ? <div className="content-stack"><p className="success-text" role="status">{p2(locale,"checkEmail")}</p>
              <Link className="button button-primary" href={"/login?next="+encodeURIComponent("/auth/invite/"+token)}>{p2(locale,"signInToAccept")}</Link></div>
          : <form onSubmit={signUp}><h2>{p2(locale,"createStaffAccount")}</h2>
              <div className="field"><label htmlFor="staff-name">{p2(locale,"fullName")}</label>
                <input id="staff-name" value={name} minLength={2} required onChange={e=>setName(e.target.value)}/></div>
              <div className="field"><label htmlFor="staff-password">{p2(locale,"password")}</label>
                <input id="staff-password" type="password" value={password} minLength={12} required onChange={e=>setPassword(e.target.value)}/></div>
              <button type="submit" className="button button-primary button-wide" disabled={busy}>
                <UserRoundPlus size={18}/>{busy?p2(locale,"loading"):p2(locale,"signUp")}</button>
              <p className="auth-note"><Link className="text-link" href={"/login?next="+encodeURIComponent("/auth/invite/"+token)}>
                {p2(locale,"alreadyAccount")} {p2(locale,"goLogin")}</Link></p>
            </form>}
      </>:<p className="form-error">{p2(locale,"invitationInvalid")}</p>}
      {error&&<p className="form-error" role="alert">{error}</p>}
      {success&&<p className="success-text" role="status">{success}</p>}
    </section>
  </main>;
}
