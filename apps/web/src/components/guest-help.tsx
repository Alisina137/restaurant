"use client";
import {useCallback,useEffect,useRef,useState} from "react";
import Link from "next/link";
import {BellRing,CheckCircle2,Clock3,RefreshCw,ReceiptText,Send,Utensils,GlassWater} from "lucide-react";
import {s8,type ServiceGuestPage,type ServiceRequest} from "@dineflow/shared";
import {useGuest} from "./guest-shell";
import {guestRequest,GuestError} from "@/lib/guest-client";
import {g7} from "@/lib/guest-copy";
const reasons=["need_help","water","cutlery","other"] as const;
const createKey=()=>"s8-"+crypto.randomUUID().replaceAll("-","");
function Badge({row}:{row:ServiceRequest}){
 const {locale}=useGuest();
 return <span className={"guest-service-badge "+row.status}>
  {row.status==="resolved"?<CheckCircle2 size={14}/>:<Clock3 size={14}/>}
  {s8(locale,row.status)}</span>;
}
export function GuestHelpPage(){
 const {visit,session,locale}=useGuest();
 const [tab,setTab]=useState<"assistance"|"bill">("assistance"),[reason,setReason]=useState<typeof reasons[number]>("need_help"),
  [note,setNote]=useState(""),[preference,setPreference]=useState<"together"|"split">("together"),
  [data,setData]=useState<ServiceGuestPage|null>(null),[loading,setLoading]=useState(true),
  [sending,setSending]=useState(false),[error,setError]=useState(""),[success,setSuccess]=useState("");
 // Preserve the retry key if the response is lost. Never retry a possible success with a fresh key.
 const key=useRef(createKey()),previous=useRef("");
 const load=useCallback(async(silent=false)=>{
   if(!silent)setLoading(true);
   try{const page=await guestRequest<ServiceGuestPage>(session.token,"/service");
     setData(page);setError("");}
   catch(e){if(!silent)setError(e instanceof Error?e.message:s8(locale,"error"));}
   finally{setLoading(false);}
 },[session.token,locale]);
 useEffect(()=>{
   void load();const timer=setInterval(()=>{if(document.visibilityState==="visible")void load(true);},9000);
   const resume=()=>{if(document.visibilityState==="visible")void load(true);};
   document.addEventListener("visibilitychange",resume);
   return()=>{clearInterval(timer);document.removeEventListener("visibilitychange",resume);};
 },[load]);
 const outstanding=(data?.items??[]).filter(x=>x.status!=="resolved");
 const active=outstanding.find(x=>x.type===tab&&(tab==="bill"||x.reason===reason));
 async function submit(){
   if(sending||active)return;
   const snapshot=JSON.stringify({type:tab,reason:tab==="bill"?"bill":reason,
     note:tab==="bill"?"":note.trim(),splitPreference:tab==="bill"?preference:undefined});
   if(snapshot!==previous.current){previous.current=snapshot;key.current=createKey();}
   setSending(true);setError("");setSuccess("");
   try{
    const result=await guestRequest<{created:boolean;status:string}>(session.token,"/service",{
     method:"POST",body:JSON.stringify({...JSON.parse(snapshot),idempotencyKey:key.current})});
    setSuccess(s8(locale,result.created?"sent":"duplicate"));
    setNote("");previous.current="";key.current=createKey();await load(true);
   }catch(e){
    if(e instanceof GuestError&&e.status===429)setError(s8(locale,"throttled"));
    else if(e instanceof GuestError&&e.status===409)setError(s8(locale,"duplicate"));
    else setError(s8(locale,"error")+" "+(e instanceof Error?e.message:""));
    // Request may have reached the API; preserve key and draft for an idempotent retry.
   }finally{setSending(false);}
 }
 return <div className="guest-page guest-help-page">
   <div className="guest-page-heading"><div>
     <span className="guest-eyebrow">DINEFLOW · {s8(locale,"service")}</span>
     <h2>{s8(locale,"assistance")}</h2>
     <p className="guest-help-subtitle">{s8(locale,"helpDesc")}</p></div>
    <button type="button" className="guest-icon-button" aria-label={s8(locale,"refresh")}
     onClick={()=>void load()}><RefreshCw size={20}/></button></div>
   <div className="guest-help-actions" role="tablist" aria-label={s8(locale,"assistance")}>
     <button type="button" role="tab" aria-selected={tab==="assistance"} className={tab==="assistance"?"active":""}
       onClick={()=>{setTab("assistance");setError("");setSuccess("");}}>
        <span className="guest-help-icon"><BellRing size={24}/></span>
        <b>{s8(locale,"callWaiter")}</b><small>{s8(locale,"helpDesc")}</small></button>
     <button type="button" role="tab" aria-selected={tab==="bill"} className={tab==="bill"?"active":""}
       onClick={()=>{setTab("bill");setError("");setSuccess("");}}>
       <span className="guest-help-icon"><ReceiptText size={24}/></span>
       <b>{s8(locale,"requestBill")}</b><small>{s8(locale,"billDesc")}</small></button>
   </div>
   <section className="guest-help-form" aria-label={s8(locale,tab==="bill"?"requestBill":"callWaiter")}>
      {tab==="assistance"?<>
       <h3>{s8(locale,"reason")}</h3>
       <div className="guest-help-reasons">
        {reasons.map(r=><button key={r} type="button" className={reason===r?"selected":""}
         aria-pressed={reason===r} onClick={()=>{setReason(r);setError("");}}>
          {r==="water"?<GlassWater size={20}/>:r==="cutlery"?<Utensils size={20}/>:<BellRing size={19}/>}
          {s8(locale,r)}</button>)}
       </div>
       <label className="guest-help-note"><span>{s8(locale,"note")}</span>
         <textarea rows={3} maxLength={200} value={note} onChange={e=>setNote(e.target.value)}
           placeholder={s8(locale,"noteHint")}/><small>{note.length}/200</small></label>
      </>:<>
       <h3>{s8(locale,"billDesc")}</h3>
       <div className="guest-help-reasons guest-help-bill-pref">
         {(["together","split"] as const).map(p=><button key={p} type="button" className={preference===p?"selected":""}
          aria-pressed={preference===p} onClick={()=>setPreference(p)}>
          <ReceiptText size={20}/>{s8(locale,p)}</button>)}
       </div>
       <Link className="guest-text-link" href={"/g/"+visit+"/bill"}>{s8(locale,"receipt")} →</Link>
      </>}
      {active&&<div className="guest-help-open"><Badge row={active}/>
       <span>{s8(locale,"duplicate")}</span></div>}
      {success&&<div className="guest-help-success" role="status"><CheckCircle2 size={19}/>{success}</div>}
      {error&&<div className="guest-error" role="alert">{error}
       <button type="button" onClick={()=>void load()}>{s8(locale,"retry")}</button></div>}
      <button type="button" className="guest-button primary" onClick={()=>void submit()}
       disabled={sending||!!active}>
        {sending?<RefreshCw className="guest-spinning" size={19}/>:<Send size={19}/>}
        {sending?s8(locale,"processing"):active?s8(locale,"waiting"):s8(locale,"send")}</button>
   </section>
   <section className="guest-help-history">
     <div className="guest-help-history-head"><h3>{s8(locale,"history")}</h3>
       <span>{data?.items.length??"—"}</span></div>
     {loading&&!data?<div className="guest-loading-inline"><span className="guest-spinner"/>{s8(locale,"load")}</div>:
       data?.items.length?data.items.map(row=><article key={row.id} className="guest-help-request">
       <div><strong>{s8(locale,row.reason)}{row.type==="bill"&&row.splitPreference?
         " · "+s8(locale,row.splitPreference):""}</strong>
         <Badge row={row}/></div>
       {row.note&&<p>{row.note}</p>}
       <small>{new Date(row.createdAt).toLocaleString(locale)}</small>
       {row.status==="resolved"&&row.resolutionNote&&<p className="guest-help-resolution">
          {s8(locale,"closeNote")}: {row.resolutionNote}</p>}
      </article>):
      <div className="guest-help-empty"><BellRing size={31}/>{s8(locale,"empty")}</div>}
   </section>
 </div>;
}
