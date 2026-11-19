"use client";

import {useCallback,useEffect,useState} from "react";
import Link from "next/link";
import {
 ArrowRight,AlertCircle,CheckCircle2,ChefHat,ClipboardList,Copy,
 CreditCard,ExternalLink,Globe2,Monitor,RefreshCw,ShieldCheck,
 Smartphone,Store,UtensilsCrossed,WifiOff,QrCode
} from "lucide-react";
import type {Locale} from "@dineflow/shared";
import {direction} from "@dineflow/shared";
import {API_URL} from "@/lib/auth-client";
import {dl,type LauncherKey} from "@/lib/dev-interface-launcher-copy";
import {apiReadyReply,interfaceCards,parseGuestEntryRoute,type InterfaceId} from "@/lib/dev-interface-launcher";

const cardText:Record<InterfaceId,{title:LauncherKey;description:LauncherKey;role:LauncherKey}>={
 management:{title:"management",description:"managementDesc",role:"ownerRole"},
 waiter:{title:"waiter",description:"waiterDesc",role:"waiterRole"},
 kitchen:{title:"kitchen",description:"kitchenDesc",role:"kitchenRole"},
 cashier:{title:"cashier",description:"cashierDesc",role:"cashierRole"},
 customer:{title:"customer",description:"customerDesc",role:"guestRole"},
 platform:{title:"platform",description:"platformDesc",role:"platformRole"}
};
const symbols={
 management:Store,waiter:Smartphone,kitchen:ChefHat,
 cashier:CreditCard,customer:QrCode,platform:ShieldCheck
} as const;
const terminalCommands=[
 {key:"apiCommand" as const,command:"pnpm dev:api"},
 {key:"webCommand" as const,command:"pnpm dev:web"},
 {key:"mobileCommand" as const,command:"pnpm dev:mobile"}
];
type ServiceStatus="checking"|"ready"|"unavailable";
export function DeveloperInterfaceLauncher(){
 const [locale,setLocale]=useState<Locale>("en");
 const [apiStatus,setApiStatus]=useState<ServiceStatus>("checking");
 const [lastCheck,setLastCheck]=useState<string|null>(null);
 const [retry,setRetry]=useState(0);
 const [guestValue,setGuestValue]=useState("");
 const [guestTouched,setGuestTouched]=useState(false);
 const [copied,setCopied]=useState("");
 const guestRoute=parseGuestEntryRoute(guestValue,"http://localhost:3000");
 const checkAgain=useCallback(()=>setRetry(i=>i+1),[]);
 useEffect(()=>{
  let mounted=true,requestSeq=0;
  const check=async()=>{
   if(document.visibilityState==="hidden")return;
   const request=++requestSeq;setApiStatus("checking");
   const abort=new AbortController(),timeout=setTimeout(()=>abort.abort(),5000);
   try{
    const result=await fetch(API_URL+"/api/health/ready",{
     method:"GET",cache:"no-store",credentials:"omit",signal:abort.signal
    });
    const json:unknown=result.ok?await result.json():null;
    if(mounted&&request===requestSeq)
     setApiStatus(result.ok&&apiReadyReply(json)?"ready":"unavailable");
   }catch{
    if(mounted&&request===requestSeq)setApiStatus("unavailable");
   }finally{
    clearTimeout(timeout);
    if(mounted&&request===requestSeq)setLastCheck(new Date().toISOString());
   }
  };
  void check();
  const timer=setInterval(()=>void check(),30000);
  const visible=()=>{if(!document.hidden)void check();};
  document.addEventListener("visibilitychange",visible);
  return()=>{mounted=false;clearInterval(timer);
   document.removeEventListener("visibilitychange",visible);};
 },[retry]);

 async function copyText(value:string,tag:string){
  try{await navigator.clipboard.writeText(value);setCopied(tag);
   window.setTimeout(()=>setCopied(current=>current===tag?"":current),2000);
  }catch{setCopied("");}
 }
 const statusLabel=apiStatus==="ready"?dl(locale,"ready"):apiStatus==="checking"?
  dl(locale,"checking"):dl(locale,"unavailable");
 return <main className="dl-root" dir={direction(locale)} lang={locale}>
  <div className="dl-wrap">
   <header className="dl-top">
    <div className="dl-brand"><span className="dl-mark"><UtensilsCrossed size={22}/></span>
     <span>DineFlow <small>DEV LAB</small></span></div>
    <div className="dl-top-actions">
     <span className="dl-local"><span className="dl-local-dot"/>{dl(locale,"local")}</span>
     <label className="dl-language">
      <span className="sr-only">Language</span>
      <Globe2 size={17} aria-hidden="true"/>
      <select aria-label="Language" value={locale} onChange={e=>setLocale(e.target.value as Locale)}>
       <option value="en">English</option>
       <option value="fa-AF">دری</option>
       <option value="ps-AF">پښتو</option>
      </select>
     </label>
     <Link className="dl-login" href="/login">{dl(locale,"signIn")}<ArrowRight size={16}/></Link>
    </div>
   </header>
   <section className="dl-hero">
    <div className="dl-hero-copy">
     <span className="dl-eyebrow"><span className="dl-dot"/>{dl(locale,"tag")}</span>
     <h1>{dl(locale,"title")}</h1>
     <p>{dl(locale,"subtitle")}</p>
     <div className="dl-hero-footer"><ShieldCheck size={17}/>{dl(locale,"localHint")}</div>
    </div>
    <div className="dl-hero-decoration" aria-hidden="true">
     <span className="dl-orbit dl-orbit-a"/><span className="dl-orbit dl-orbit-b"/>
     <span className="dl-hero-icon"><Monitor size={48}/><Smartphone size={29}/></span>
     <span className="dl-hero-count">06<small>INTERFACES</small></span>
    </div>
   </section>

   <section className="dl-section" aria-label={dl(locale,"services")}>
    <div className="dl-section-head"><div><span className="dl-section-eyebrow">01 / SERVICES</span>
     <h2>{dl(locale,"services")}</h2></div>
     <button className="dl-subtle-btn" type="button" onClick={checkAgain}
      disabled={apiStatus==="checking"}><RefreshCw size={16}/>{dl(locale,"retry")}</button>
    </div>
    <div className="dl-services">
     <article className="dl-service">
      <div className="dl-service-top"><span className="dl-service-icon"><Monitor size={19}/></span>
       <span className="dl-chip dl-ok"><CheckCircle2 size={14}/>{dl(locale,"ready")}</span></div>
      <h3>{dl(locale,"web")}</h3><span className="dl-service-url" dir="ltr">localhost:3000</span>
     </article>
     <article className="dl-service">
      <div className="dl-service-top"><span className="dl-service-icon"><Globe2 size={19}/></span>
       <span role="status" className={"dl-chip "+(apiStatus==="ready"?"dl-ok":apiStatus==="checking"?"dl-pending":"dl-bad")}>
        {apiStatus==="ready"?<CheckCircle2 size={14}/>:apiStatus==="unavailable"?<AlertCircle size={14}/>:<RefreshCw size={14}/>}
        {statusLabel}</span></div>
      <h3>{dl(locale,"api")}</h3><span className="dl-service-url" dir="ltr">{API_URL}</span>
     </article>
     <article className="dl-service">
      <div className="dl-service-top"><span className="dl-service-icon"><Smartphone size={19}/></span>
       <span className="dl-chip dl-pending">{dl(locale,"manual")}</span></div>
      <h3>{dl(locale,"mobile")}</h3><span className="dl-service-url" dir="ltr">pnpm dev:mobile</span>
     </article>
    </div>
    <div className="dl-info-bar">
     {apiStatus==="ready"?<CheckCircle2 size={16}/>:<WifiOff size={16}/>}
     <p>{dl(locale,"apiHint")} {dl(locale,"mobileHint")}</p>
     {lastCheck&&<time dateTime={lastCheck}>{dl(locale,"last")}: {new Date(lastCheck).toLocaleTimeString(locale)}</time>}
    </div>
   </section>

   <section className="dl-section" aria-label={dl(locale,"interfaceLabel")}>
    <div className="dl-section-head"><div><span className="dl-section-eyebrow">02 / ROLES</span>
     <h2>{dl(locale,"interfaceLabel")}</h2></div><span className="dl-count">06</span>
    </div>
    <div className="dl-grid">
     {interfaceCards.map((item,index)=>{
      const Icon=symbols[item.id],texts=cardText[item.id];
      return <article className="dl-card" key={item.id}>
       <div className="dl-card-top"><span className={"dl-card-icon dl-icon-"+item.id}><Icon size={26}/></span>
        <span className="dl-card-num">{String(index+1).padStart(2,"0")}</span></div>
       <div><h3>{dl(locale,texts.title)}</h3><p className="dl-card-desc">{dl(locale,texts.description)}</p></div>
       <div className="dl-card-bottom">
        <span className="dl-type">{item.kind==="expo"?dl(locale,"phone"):item.kind==="guest"?
         dl(locale,"guest"):dl(locale,"browser")}</span>
        <span className="dl-role">{dl(locale,texts.role)}</span>
        {item.path?
         <Link href={item.path} target="_blank" rel="noopener noreferrer" className="dl-card-action">
          {dl(locale,"open")}<ExternalLink size={17} aria-hidden="true"/></Link>:
         <a href={item.kind==="guest"?"#dl-guest":"#dl-setup"} className="dl-card-action">
          {item.kind==="guest"?dl(locale,"guestOpen"):dl(locale,"run")}<ArrowRight size={17}/></a>}
       </div>
      </article>;
     })}
    </div>
    <p className="dl-guidance"><ShieldCheck size={16} aria-hidden="true"/>{dl(locale,"staffNote")}</p>
   </section>

   <section id="dl-guest" className="dl-section dl-guest-section" aria-label={dl(locale,"guestTitle")}>
    <div className="dl-section-head"><div><span className="dl-section-eyebrow">03 / CUSTOMER</span>
     <h2>{dl(locale,"guestTitle")}</h2></div><QrCode size={27}/></div>
    <div className="dl-guest-layout">
     <ol className="dl-steps">
      <li>{dl(locale,"guestStep1")}</li>
      <li>{dl(locale,"guestStep2")}</li>
      <li>{dl(locale,"guestStep3")}</li>
     </ol>
     <div className="dl-guest-form">
      <label htmlFor="dl-qr-url">{dl(locale,"guestUrl")}</label>
      <input id="dl-qr-url" type="url" dir="ltr" placeholder={dl(locale,"guestPlaceholder")}
       value={guestValue} onChange={e=>{setGuestValue(e.target.value);setGuestTouched(false);}}
       onBlur={()=>setGuestTouched(true)} autoComplete="off" spellCheck={false} maxLength={900}
       aria-describedby="dl-qr-help" aria-invalid={guestTouched&&!!guestValue&&!guestRoute}/>
      <p className="dl-input-help" id="dl-qr-help">{guestValue&&!guestRoute&&guestTouched?
       dl(locale,"guestInvalid"):dl(locale,"guestNotEntered")}</p>
      <div className="dl-guest-actions">
       {guestRoute?<Link className="dl-primary-btn" href={guestRoute} target="_blank"
        rel="noopener noreferrer">{dl(locale,"guestOpen")}<ExternalLink size={17}/></Link>:
        <button className="dl-primary-btn" type="button" disabled
         onClick={()=>setGuestTouched(true)}>{dl(locale,"guestOpen")}<ArrowRight size={17}/></button>}
       <Link className="dl-subtle-btn" href="/app/tables/qr" target="_blank"
        rel="noopener noreferrer">{dl(locale,"qrConsole")}<ExternalLink size={15}/></Link>
      </div>
     </div>
    </div>
   </section>

   <section id="dl-setup" className="dl-section dl-setup" aria-label={dl(locale,"run")}>
    <div className="dl-section-head"><div><span className="dl-section-eyebrow">04 / GET STARTED</span>
     <h2>{dl(locale,"run")}</h2><p>{dl(locale,"runHint")}</p></div><ClipboardList size={28}/></div>
    <div className="dl-command">
     <span>{dl(locale,"project")}</span><code dir="ltr">cd C:\\projects\\restaurant</code>
     <button type="button" onClick={()=>void copyText("cd C:\\projects\\restaurant","project")}
      aria-label={dl(locale,"copy")+" "+dl(locale,"project")}>
      <Copy size={15}/>{copied==="project"?dl(locale,"copied"):dl(locale,"copy")}</button>
    </div>
    {terminalCommands.map(item=><div className="dl-command" key={item.key}>
     <span>{dl(locale,item.key)}</span><code dir="ltr">{item.command}</code>
     <button type="button" onClick={()=>void copyText(item.command,item.key)}
      aria-label={dl(locale,"copy")+" "+dl(locale,item.key)}><Copy size={15}/>
      {copied===item.key?dl(locale,"copied"):dl(locale,"copy")}</button>
    </div>)}
    <aside className="dl-notes"><h3><AlertCircle size={18}/>{dl(locale,"help")}</h3>
     <p>{dl(locale,"helpBody")}</p></aside>
   </section>
   <footer className="dl-footer"><span><ShieldCheck size={16}/>{dl(locale,"devOnly")}</span>
    <p>{dl(locale,"disclaimer")}</p></footer>
  </div>
 </main>;
}
