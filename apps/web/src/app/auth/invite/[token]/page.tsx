"use client";

import {type FormEvent,useCallback,useEffect,useRef,useState} from "react";
import Link from "next/link";
import {useParams,useRouter} from "next/navigation";
import {CheckCircle2,Mail,ShieldCheck,UserRoundPlus,RefreshCw,LogOut,CalendarClock} from "lucide-react";
import {direction} from "@dineflow/shared";
import {authClient} from "@/lib/auth-client";
import {jsonRequest,Phase2Error} from "@/lib/phase2-api";
import {p2} from "@/lib/phase2-copy";
import {au,validPassword,validInviteRedirect} from "@/lib/auth-ux-copy";
import {AuthLanguage,PasswordField,useAuthLocale} from "@/components/ui/auth-ui";
import {InlineFeedback} from "@/components/ui/interaction-controls";

type Invitation={restaurant:string;email:string;role:string;expiresAt:string};
type Identity={user:{id:string;name:string;email:string;verified:boolean}};
export default function InvitePage(){
 const router=useRouter(),params=useParams<{token:string}>();
 const token=params.token,invitePath="/auth/invite/"+token;
 const {locale,setLocale}=useAuthLocale();
 const [invite,setInvite]=useState<Invitation|null>(null),[identity,setIdentity]=useState<Identity|null>(null);
 const [loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[registered,setRegistered]=useState(false);
 const [name,setName]=useState(""),[password,setPassword]=useState(""),[password2,setPassword2]=useState("");
 const [error,setError]=useState(""),[message,setMessage]=useState("");
 const [lastVerify,setLastVerify]=useState(0);
 const busyLock=useRef(false);
 const signInPath="/login?next="+encodeURIComponent(invitePath);
 const load=useCallback(async()=>{
  if(!validInviteRedirect(invitePath)){setError(au(locale,"inviteExpired"));setLoading(false);return;}
  setError("");setLoading(true);
  try{
   const result=await jsonRequest<Invitation>("/api/invitations/"+encodeURIComponent(token));
   setInvite(result);
   try{setIdentity(await jsonRequest<Identity>("/api/onboarding/status"));}
   catch(e){
    if(e instanceof Phase2Error&&e.status===401)setIdentity(null);
    else throw e;
   }
  }catch(e){setInvite(null);setError(e instanceof Phase2Error&&[404,409,410].includes(e.status)?
    au(locale,"inviteExpired"):au(locale,"requestFailed"));}
  finally{setLoading(false);}
 },[token,invitePath,locale]);
 useEffect(()=>{void load();},[load]);
 function begin(){if(busyLock.current)return false;busyLock.current=true;setBusy(true);setError("");setMessage("");return true;}
 function finish(){busyLock.current=false;setBusy(false);}
 async function signUp(event:FormEvent<HTMLFormElement>){
  event.preventDefault();
  if(!invite||!begin())return;
  try{
   if(name.trim().length<2||name.trim().length>80){setError(au(locale,"nameError"));return;}
   if(!validPassword(password)){setError(au(locale,"passwordShort"));return;}
   if(password!==password2){setError(au(locale,"passwordMismatch"));return;}
   const result=await authClient.signUp.email({
    name:name.trim(),email:invite.email,password,
    callbackURL:window.location.origin+invitePath
   });
   if(result.error){setError(result.error.message??au(locale,"requestFailed"));return;}
   setRegistered(true);setPassword("");setPassword2("");
  }catch{setError(au(locale,"requestFailed"));}
  finally{finish();}
 }
 async function accept(){
  if(!invite||!begin())return;
  try{
   await jsonRequest("/api/invitations/"+encodeURIComponent(token)+"/accept",{method:"POST",body:"{}"});
   const next=await jsonRequest<{defaultRoute:string}>("/api/context");
   router.replace(next.defaultRoute);
  }catch(e){setError(e instanceof Error?e.message:au(locale,"requestFailed"));}
  finally{finish();}
 }
 async function signOut(){
  if(!begin())return;
  try{
   const result=await authClient.signOut();
   if(result.error)throw new Error("SIGNOUT_FAILED");
   setIdentity(null);setRegistered(false);
   setMessage(au(locale,"accountExists"));
  }catch{setError(au(locale,"requestFailed"));}
  finally{finish();}
 }
 async function resendVerification(){
  if(!invite||busy||Date.now()-lastVerify<60000||!begin())return;
  try{
   const result=await authClient.sendVerificationEmail({
    email:invite.email,callbackURL:window.location.origin+invitePath
   });
   if(result.error)throw new Error("EMAIL_FAILED");
   setLastVerify(Date.now());setMessage(au(locale,"resendSent"));
  }catch{setError(au(locale,"requestFailed"));}
  finally{finish();}
 }
 const sameEmail=identity?.user.email.toLowerCase()===invite?.email.toLowerCase();
 const ready=!!identity&&sameEmail&&identity.user.verified;
 if(loading)return <main className="center-viewport" role="status" dir={direction(locale)}>
  <span className="spinner"/>{au(locale,"loading")}</main>;
 return <main className="center-viewport p18-invite-page" dir={direction(locale)}>
  <section className="notice-card invite-card p18-invite-card">
   <div className="invite-brand"><span className="brand-mark"><Mail size={22}/></span><strong>DineFlow</strong>
    <AuthLanguage locale={locale} onChange={setLocale} id="invite-language"/></div>
   <div className="p18-invite-hero"><span className="auth-card-icon"><UserRoundPlus size={25}/></span>
    <h1>{p2(locale,"inviteTitle")}</h1></div>
   {invite?<div className="content-stack">
    <p>{p2(locale,"invitedTo")} <strong>{invite.restaurant}</strong></p>
    <div className="invite-meta">
     <div><Mail size={18}/><bdi>{invite.email}</bdi></div>
     <div><ShieldCheck size={18}/>{p2(locale,invite.role as "owner"|"manager"|"waiter"|"kitchen"|"cashier")}</div>
     <div><CalendarClock size={18}/><time dateTime={invite.expiresAt}>
       {new Date(invite.expiresAt).toLocaleString(locale,{dateStyle:"medium",timeStyle:"short"})}</time></div>
    </div>
    {ready?<div className="content-stack">
      <InlineFeedback tone="success" message={au(locale,"inviteVerified")}/>
      <button className="button button-primary button-wide" type="button" disabled={busy}
       onClick={()=>void accept()}><CheckCircle2 size={19}/>{busy?au(locale,"loading"):p2(locale,"acceptInvitation")}</button>
    </div>:identity?<div className="content-stack">
      <p className="muted">{au(locale,"signedInAs")} · <bdi>{identity.user.email}</bdi></p>
      <InlineFeedback message={!sameEmail?au(locale,"inviteMismatch"):au(locale,"verificationRequired")}/>
      {sameEmail&&<div className="p18-invite-actions">
       <button className="button" type="button" disabled={busy||Date.now()-lastVerify<60000}
        onClick={()=>void resendVerification()}>{au(locale,"sendVerify")}</button>
       <button className="button" type="button" disabled={busy} onClick={()=>void load()}>
        <RefreshCw size={16}/>{au(locale,"refreshStatus")}</button>
      </div>}
      <button className="button" type="button" disabled={busy} onClick={()=>void signOut()}>
       <LogOut size={16}/>{au(locale,"switchAccount")}</button>
    </div>:registered?<div className="content-stack">
      <InlineFeedback tone="success" message={au(locale,"checkEmailHint")}/>
      <button className="button" type="button" disabled={busy||Date.now()-lastVerify<60000}
       onClick={()=>void resendVerification()}>{au(locale,"sendVerify")}</button>
      <Link className="button button-primary button-wide" href={signInPath}>{p2(locale,"signInToAccept")}</Link>
    </div>:<form onSubmit={signUp} className="p18-invite-signup">
      <h2>{p2(locale,"createStaffAccount")}</h2>
      <p className="muted">{au(locale,"invitedEmail")}: <bdi>{invite.email}</bdi></p>
      <div className="field"><label htmlFor="staff-name">{p2(locale,"fullName")}</label>
       <input id="staff-name" autoComplete="name" maxLength={80} minLength={2} required
        value={name} onChange={e=>setName(e.target.value)}/></div>
      <PasswordField id="staff-password" label={p2(locale,"password")} locale={locale}
       value={password} onChange={setPassword} hint={au(locale,"passwordGuide")}/>
      <PasswordField id="staff-confirm-password" label={au(locale,"confirmPassword")} locale={locale}
       value={password2} onChange={setPassword2}
       error={password2&&password!==password2?au(locale,"passwordMismatch"):undefined}/>
      <button type="submit" className="button button-primary button-wide"
       disabled={busy||!validPassword(password)||password!==password2}>
       <UserRoundPlus size={18}/>{busy?au(locale,"loading"):p2(locale,"signUp")}</button>
      <p className="auth-note"><Link className="text-link" href={signInPath}>
       {au(locale,"accountExists")}</Link></p>
    </form>}
   </div>:<div className="content-stack">
    <InlineFeedback message={au(locale,"inviteExpired")}/>
    <button className="button" type="button" disabled={busy} onClick={()=>void load()}>
     <RefreshCw size={17}/>{au(locale,"retry")}</button>
   </div>}
   {error&&<InlineFeedback message={error}/>}
   {message&&<InlineFeedback tone="success" message={message}/>}
  </section>
 </main>;
}
