"use client";
import {useCallback,useEffect,useState} from "react";
import Link from "next/link";
import {Bell,CheckCheck,Clock3,Droplets,FileText,MessageCircle,RefreshCw,Send} from "lucide-react";
import {useGuest} from "./guest-shell";
import {guestRequest} from "@/lib/guest-client";
import {help8,type ServiceItem} from "@/lib/service-copy";
const kinds=["call_waiter","water","bill","other"] as const;
const icons={call_waiter:Bell,water:Droplets,bill:FileText,other:MessageCircle};
export function GuestAssistance(){
 const {session,locale,visit}=useGuest();
 const [items,setItems]=useState<ServiceItem[]>([]),[kind,setKind]=useState<typeof kinds[number]>("call_waiter");
 const [note,setNote]=useState(""),[busy,setBusy]=useState(false),[loading,setLoading]=useState(true);
 const [error,setError]=useState(""),[success,setSuccess]=useState("");
 const load=useCallback(async()=>{
   try{
     const result=await guestRequest<{items:ServiceItem[]}>(session.token,"/requests");
     setItems(result.items);setError("");
   }catch(e){setError(e instanceof Error?e.message:help8(locale,"retry"));}
   finally{setLoading(false);}
 },[locale,session.token]);
 useEffect(()=>{void load();const timer=setInterval(()=>{if(document.visibilityState==="visible")void load();},12000);
   return()=>clearInterval(timer);},[load]);
 const active=items.find(x=>x.type===kind&&["pending","acknowledged"].includes(x.status));
 async function send(){
   if(busy||active||kind==="other"&&note.trim().length<3)return;
   setBusy(true);setError("");setSuccess("");
   try{
     await guestRequest(session.token,"/requests",{method:"POST",
       body:JSON.stringify({type:kind,note:note.trim()})});
     setSuccess(help8(locale,"success"));setNote("");await load();
   }catch(e){setError(e instanceof Error?e.message:help8(locale,"retry"));await load();}
   finally{setBusy(false);}
 }
 return <div className="guest-page guest-help">
   <div className="guest-page-heading"><div><span className="guest-eyebrow">DINEFLOW / {help8(locale,"request")}</span>
     <h2>{help8(locale,"title")}</h2><p>{help8(locale,"subtitle")}</p></div>
     <button type="button" className="guest-icon-button" onClick={()=>void load()}
       aria-label={help8(locale,"refresh")}><RefreshCw size={20}/></button></div>
   <div className="guest-help-grid">
    {kinds.map(key=>{const Icon=icons[key];return <button type="button" key={key}
      className={"guest-help-option"+(kind===key?" selected":"")}
      aria-pressed={kind===key} onClick={()=>{setKind(key);setError("");setSuccess("");}}>
        <Icon size={23}/><strong>{help8(locale,key)}</strong>
        <small>{help8(locale,(key+"Desc") as "callDesc"|"waterDesc"|"billDesc"|"otherDesc")}</small>
       </button>;})}</div>
   <section className="guest-help-form">
     <h3>{help8(locale,kind)}</h3>
     <label className="finance-field"><span>{help8(locale,"note")}</span>
      <textarea rows={3} maxLength={200} value={note} placeholder={help8(locale,"describe")}
       onChange={e=>setNote(e.target.value)} disabled={!!active}/></label>
     <small className="guest-help-counter">{note.length}/200</small>
     {active&&<div className="guest-help-current"><Clock3 size={19}/>
        <span>{help8(locale,active.status==="pending"?"pending":"acknowledged")}. {help8(locale,"slow")}</span></div>}
     {success&&<div role="status" className="guest-help-success"><CheckCheck size={18}/>{success}</div>}
     {error&&<div className="guest-error" role="alert">{error}
       <button type="button" onClick={()=>void load()}>{help8(locale,"retry")}</button></div>}
     <button className="guest-button primary guest-help-submit" type="button" disabled={busy||!!active||
       kind==="other"&&note.trim().length<3} onClick={()=>void send()}>
       <Send size={18}/>{busy?help8(locale,"busy"):help8(locale,"send")}</button>
   </section>
   <section className="guest-help-history"><div className="guest-help-history-header">
      <h3>{help8(locale,"active")}</h3><button onClick={()=>void load()} aria-label={help8(locale,"refresh")}
        className="guest-icon-button"><RefreshCw size={17}/></button></div>
     {loading?<p>{help8(locale,"busy")}</p>:items.length===0?<p>{help8(locale,"empty")}</p>:
     items.map(x=>{const Icon=icons[x.type];return <article key={x.id} className="guest-help-row">
        <span className="guest-help-icon"><Icon size={20}/></span><div>
         <strong>{help8(locale,x.type)}</strong><small>{help8(locale,x.status)}</small>
         {x.note&&<p>{x.note}</p>}{x.resolutionNote&&<p>{x.resolutionNote}</p>}
        </div><time>{new Date(x.createdAt).toLocaleTimeString(locale,{hour:"2-digit",minute:"2-digit"})}</time>
       </article>;})}</section>
   <Link href={"/g/"+visit+"/orders"} className="guest-button secondary">{help8(locale,"back")}</Link>
 </div>;
}
