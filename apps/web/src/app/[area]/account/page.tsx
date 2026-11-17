"use client";

import {type FormEvent,useCallback,useEffect,useRef,useState} from "react";
import Link from "next/link";
import {useRouter} from "next/navigation";
import {BadgeCheck,Languages,LockKeyhole,UserRound,ShieldCheck,MonitorSmartphone,
  RefreshCw,LogOut,Building2,KeyRound,CheckCircle2} from "lucide-react";
import {t,type Locale} from "@dineflow/shared";
import {api,getContext} from "@/lib/context";
import {authClient} from "@/lib/auth-client";
import {au,validPassword} from "@/lib/auth-ux-copy";
import {useWorkspace} from "@/components/workspace-provider";
import {PasswordField} from "@/components/ui/auth-ui";
import {useInteraction} from "@/components/ui/interaction-provider";
import {InlineFeedback} from "@/components/ui/interaction-controls";
import {LoadingSkeleton,StatusBadge} from "@/components/ui/design-system";

type SessionInfo={token:string;userAgent?:string|null;ipAddress?:string|null;
 createdAt:Date|string;updatedAt:Date|string;expiresAt:Date|string};
type Tab="profile"|"workspace"|"security";
function stamp(value:Date|string,locale:Locale){
 const date=new Date(value);
 return Number.isNaN(date.getTime())?"—":date.toLocaleString(locale,{dateStyle:"medium",timeStyle:"short"});
}
function roleName(locale:Locale,role:string){
 const platform=locale==="en"?"Platform administrator":locale==="fa-AF"?"مدیر پلتفرم":"د پلېټفارم مدیر";
 const mapped:Record<string,[string,string,string]>={
  owner:["Owner","مالک","مالک"],manager:["Manager","مدیر","مدیر"],waiter:["Waiter","گارسون","ګارسون"],
  kitchen:["Kitchen","آشپزخانه","پخلنځی"],cashier:["Cashier","صندوق‌دار","صندوق‌دار"]
 };
 const labels=mapped[role];
 return !labels?platform:labels[locale==="en"?0:locale==="ps-AF"?2:1];
}
export default function AccountPage(){
 const {workspace,setWorkspace}=useWorkspace(),router=useRouter();
 const locale=workspace.locale;
 const {notify,confirm}=useInteraction();
 const [tab,setTab]=useState<Tab>("profile"),[busy,setBusy]=useState("");
 const [name,setName]=useState(workspace.user.name),[error,setError]=useState("");
 const [currentPassword,setCurrentPassword]=useState(""),[newPassword,setNewPassword]=useState("");
 const [confirmPassword,setConfirmPassword]=useState("");
 const [sessions,setSessions]=useState<SessionInfo[]>([]),[currentToken,setCurrentToken]=useState("");
 const [sessionsLoading,setSessionsLoading]=useState(true),[sessionsError,setSessionsError]=useState("");
 const mutationLock=useRef(false);
 useEffect(()=>{setName(workspace.user.name);},[workspace.user.name]);

 const loadSessions=useCallback(async()=>{
  setSessionsLoading(true);setSessionsError("");
  try{
   const [list,current]=await Promise.all([authClient.listSessions(),authClient.getSession()]);
   if(list.error||current.error)throw new Error("SESSION_UNAVAILABLE");
   setSessions((list.data??[]) as SessionInfo[]);
   setCurrentToken(current.data?.session.token??"");
  }catch{setSessionsError(au(locale,"sessionsFailed"));}
  finally{setSessionsLoading(false);}
 },[locale]);
 useEffect(()=>{void loadSessions();},[loadSessions]);

 function begin(action:string){
  if(mutationLock.current)return false;
  mutationLock.current=true;setBusy(action);setError("");
  return true;
 }
 function finish(){mutationLock.current=false;setBusy("");}
 async function changeLocale(next:Locale){
  if(!begin("locale"))return;
  try{
   await api("/api/preferences/locale",{method:"PUT",body:JSON.stringify({locale:next})});
   setWorkspace(prev=>prev?{...prev,locale:next}:prev);
   notify(t(next,"languageSaved"));
  }catch{setError(t(locale,"offline"));}
  finally{finish();}
 }
 async function switchTenant(tenantId:string){
  if(!begin("tenant"))return;
  try{
   await api("/api/context/tenant",{method:"PUT",body:JSON.stringify({tenantId})});
   const next=await getContext();window.location.assign(next.defaultRoute);
  }catch{setError(t(locale,"accessDenied"));finish();}
 }
 async function saveProfile(event:FormEvent<HTMLFormElement>){
  event.preventDefault();
  const cleaned=name.trim();
  if(cleaned.length<2||cleaned.length>80){setError(au(locale,"nameError"));return;}
  if(cleaned===workspace.user.name){setError(au(locale,"noChange"));return;}
  if(!begin("profile"))return;
  try{
   const result=await authClient.updateUser({name:cleaned});
   if(result.error)throw new Error("UPDATE_FAILED");
   const next=await getContext();
   setWorkspace(next);notify(au(locale,"profileSaved"));
   // Server's context remains the single source of user identity and permissions.
  }catch{setError(au(locale,"requestFailed"));}
  finally{finish();}
 }
 async function changePassword(event:FormEvent<HTMLFormElement>){
  event.preventDefault();
  if(!validPassword(newPassword)){setError(au(locale,newPassword.length<12?"passwordShort":"passwordTooLong"));return;}
  if(newPassword!==confirmPassword){setError(au(locale,"passwordMismatch"));return;}
  if(currentPassword===newPassword){setError(au(locale,"noChange"));return;}
  if(!begin("password"))return;
  try{
   const result=await authClient.changePassword({
    currentPassword,newPassword,revokeOtherSessions:true
   });
   if(result.error)throw new Error("PASSWORD_FAILED");
   setCurrentPassword("");setNewPassword("");setConfirmPassword("");
   notify(au(locale,"passwordChanged"));void loadSessions();
  }catch{setError(au(locale,"requestFailed"));}
  finally{finish();}
 }
 async function revokeOther(){
  if(busy||!(await confirm({title:au(locale,"revokeOthers"),description:au(locale,"revokeOthersConfirm"),
    confirmLabel:au(locale,"revokeOthers"),cancelLabel:locale==="en"?"Cancel":locale==="fa-AF"?"لغو":"لغوه کول",danger:true})))return;
  if(!begin("sessions"))return;
  try{
   const result=await authClient.revokeOtherSessions();
   if(result.error)throw new Error("REVOKE_FAILED");
   notify(au(locale,"revokeDone"));await loadSessions();
  }catch{setError(au(locale,"requestFailed"));}
  finally{finish();}
 }
 async function revokeOne(token:string){
  if(token===currentToken)return;
  if(busy||!(await confirm({title:au(locale,"revoke"),description:au(locale,"revokeConfirm"),
    confirmLabel:au(locale,"revoke"),cancelLabel:locale==="en"?"Cancel":locale==="fa-AF"?"لغو":"لغوه کول",danger:true})))return;
  if(!begin("sessions"))return;
  try{
   const result=await authClient.revokeSession({token});
   if(result.error)throw new Error("REVOKE_FAILED");
   notify(au(locale,"revokeDone"));await loadSessions();
  }catch{setError(au(locale,"requestFailed"));}
  finally{finish();}
 }
 async function signOut(){
  if(!begin("logout"))return;
  try{
   const result=await authClient.signOut();
   if(result.error)throw new Error("LOGOUT_FAILED");
   router.replace("/login");
  }catch{setError(au(locale,"requestFailed"));finish();}
 }
 const tabs:{key:Tab;label:string;icon:typeof UserRound}[]=[
  {key:"profile",label:au(locale,"editProfile"),icon:UserRound},
  {key:"workspace",label:t(locale,"workspace"),icon:Building2},
  {key:"security",label:au(locale,"accountSecurity"),icon:LockKeyhole}
 ];
 return <div className="content-stack p18-account">
  <div className="page-heading"><div><div className="eyebrow">DINEFLOW / {t(locale,"account")}</div>
    <h1>{au(locale,"accountSettings")}</h1><p>{t(locale,"secureBody")}</p></div>
    <StatusBadge tone="success"><BadgeCheck size={16}/>{t(locale,"active")}</StatusBadge>
  </div>
  <nav className="context-tabs p18-account-tabs" aria-label={t(locale,"account")}>
   {tabs.map(({key,label,icon:Icon})=><button key={key} type="button"
      className={"context-tab"+(tab===key?" current":"")} aria-current={tab===key?"page":undefined}
      aria-pressed={tab===key} onClick={()=>{setTab(key);setError("");}}>
     <Icon size={18}/>{label}</button>)}
  </nav>
  {error&&<InlineFeedback message={error}/>}
  {tab==="profile"&&<div className="settings-grid">
   <section className="settings-card">
    <div className="settings-heading"><span className="settings-icon"><UserRound size={21}/></span>
      <div><h2>{au(locale,"editProfile")}</h2><p>{au(locale,"editProfileHint")}</p></div></div>
    <form onSubmit={e=>void saveProfile(e)}>
      <div className="field"><label htmlFor="p18-profile-name">{au(locale,"fullName")}</label>
        <input id="p18-profile-name" name="name" autoComplete="name" required minLength={2} maxLength={80}
          value={name} disabled={!!busy} onChange={e=>setName(e.target.value)}/></div>
      <div className="field"><label htmlFor="p18-email">{t(locale,"email")}</label>
        <input id="p18-email" type="email" dir="ltr" readOnly value={workspace.user.email}/></div>
      <button className="button button-primary" type="submit"
        disabled={!!busy||name.trim()===workspace.user.name}>
        {busy==="profile"?au(locale,"loading"):au(locale,"saveProfile")}
      </button>
    </form>
   </section>
   <section className="settings-card">
    <div className="settings-heading"><span className="settings-icon"><ShieldCheck size={21}/></span>
      <div><h2>{au(locale,"accountSettings")}</h2><p>{au(locale,"securityHint")}</p></div></div>
    <dl className="profile-list">
      <div><dt>{au(locale,"role")}</dt><dd>{roleName(locale,workspace.role)}</dd></div>
      <div><dt>{au(locale,"tenant")}</dt><dd>{workspace.tenantName??"DineFlow"}</dd></div>
      <div><dt>{t(locale,"email")}</dt><dd><bdi>{workspace.user.email}</bdi></dd></div>
    </dl>
    <button className="button" type="button" onClick={()=>setTab("security")}>
      <KeyRound size={17}/>{au(locale,"accountSecurity")}
    </button>
   </section>
  </div>}
  {tab==="workspace"&&<div className="settings-grid">
    <section className="settings-card"><div className="settings-heading">
      <span className="settings-icon"><Languages size={21}/></span>
      <div><h2>{t(locale,"language")}</h2><p>{t(locale,"workspace")}</p></div></div>
      <div className="field"><label htmlFor="profile-language">{t(locale,"language")}</label>
        <select id="profile-language" value={locale} disabled={!!busy}
          onChange={e=>void changeLocale(e.target.value as Locale)}>
          <option value="fa-AF">دری</option><option value="ps-AF">پښتو</option><option value="en">English</option>
        </select></div>
      {workspace.memberships.length>1&&workspace.role!=="platform_admin"&&
        <div className="field"><label htmlFor="tenant-selection">{t(locale,"selectRestaurant")}</label>
         <select id="tenant-selection" disabled={!!busy} value={workspace.tenantId??""}
           onChange={e=>void switchTenant(e.target.value)}>
          {workspace.memberships.map(m=><option key={m.tenantId} value={m.tenantId}>{m.tenantName}</option>)}
         </select></div>}
    </section>
    <section className="settings-card">
      <div className="settings-heading"><span className="settings-icon"><Building2 size={21}/></span>
       <div><h2>{au(locale,"tenant")}</h2><p>{t(locale,"secureBody")}</p></div></div>
      <dl className="profile-list"><div><dt>{au(locale,"tenant")}</dt><dd>{workspace.tenantName??"DineFlow"}</dd></div>
        <div><dt>{au(locale,"role")}</dt><dd>{roleName(locale,workspace.role)}</dd></div></dl>
    </section>
  </div>}
  {tab==="security"&&<div className="p18-security-grid">
   <section className="settings-card">
    <div className="settings-heading"><span className="settings-icon"><KeyRound size={21}/></span>
      <div><h2>{au(locale,"changePassword")}</h2><p>{au(locale,"passwordGuide")}</p></div></div>
    <form onSubmit={e=>void changePassword(e)} className="p18-password-form">
     <PasswordField id="p18-current-password" label={au(locale,"currentPassword")}
       locale={locale} value={currentPassword} onChange={setCurrentPassword} autoComplete="current-password" minLength={1}/>
     <PasswordField id="p18-new-password" label={au(locale,"newPassword")} locale={locale}
       value={newPassword} onChange={setNewPassword} hint={au(locale,"passwordGuide")}/>
     <PasswordField id="p18-confirm-password" label={au(locale,"confirmPassword")} locale={locale}
       value={confirmPassword} onChange={setConfirmPassword}
       error={!!confirmPassword&&newPassword!==confirmPassword?au(locale,"passwordMismatch"):undefined}/>
     <button className="button button-primary" type="submit"
       disabled={!!busy||!currentPassword||!validPassword(newPassword)||newPassword!==confirmPassword}>
       {busy==="password"?au(locale,"loading"):au(locale,"changePassword")}
     </button>
    </form>
    <Link className="text-link p18-recovery-inline" href="/forgot-password">{au(locale,"forgotLink")}</Link>
   </section>
   <section className="settings-card">
    <div className="settings-heading"><span className="settings-icon"><MonitorSmartphone size={21}/></span>
      <div><h2>{au(locale,"sessions")}</h2><p>{au(locale,"sessionsHint")}</p></div></div>
    <div className="p18-session-actions">
      <button className="button button-small" type="button" disabled={!!busy||sessionsLoading}
       onClick={()=>void loadSessions()}><RefreshCw size={16}/>{au(locale,"retry")}</button>
      <button className="button button-small danger-button" type="button"
       disabled={!!busy||sessionsLoading||sessions.filter(s=>s.token!==currentToken).length===0}
       onClick={()=>void revokeOther()}>{au(locale,"revokeOthers")}</button>
    </div>
    {sessionsError&&<InlineFeedback message={sessionsError} retry={()=>void loadSessions()} onRetryLabel={au(locale,"retry")}/>}
    {sessionsLoading?<LoadingSkeleton label={au(locale,"sessions")} rows={2}/>:
      sessions.length===0?<p className="muted">{au(locale,"noSessions")}</p>:
      <div className="p18-session-list">
       {sessions.map(session=><article className="p18-session" key={session.token}>
        <div className="p18-session-icon"><MonitorSmartphone size={20}/></div>
        <div className="p18-session-info">
         <strong>{session.token===currentToken?au(locale,"currentSession"):au(locale,"otherSession")}</strong>
         <p>{(session.userAgent||au(locale,"unknownDevice")).slice(0,120)}</p>
         <small>{au(locale,"lastSeen")}: {stamp(session.updatedAt,locale)}</small>
         <small>{au(locale,"expires")}: {stamp(session.expiresAt,locale)}</small>
        </div>
        {session.token===currentToken?<CheckCircle2 size={18} color="var(--brand)"/>:
          <button type="button" className="button button-small" disabled={!!busy}
           onClick={()=>void revokeOne(session.token)}>{au(locale,"revoke")}</button>}
       </article>)}
      </div>}
   </section>
  </div>}
  <div className="p18-signout-row">
    <button className="button danger-button" type="button" disabled={!!busy}
      onClick={()=>void signOut()}><LogOut size={17}/>{busy==="logout"?au(locale,"loading"):au(locale,"signOut")}</button>
  </div>
 </div>;
}
