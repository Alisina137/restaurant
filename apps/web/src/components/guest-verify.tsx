"use client";
import {useCallback,useEffect,useState,type FormEvent} from "react";
import {useRouter} from "next/navigation";
import {CheckCircle2,LockKeyhole,RefreshCw,ShieldCheck,UtensilsCrossed,KeyRound,Clock3} from "lucide-react";
import {direction,type Locale} from "@dineflow/shared";
import {guestPublic,GuestError,storeSession,type GuestSession} from "@/lib/guest-client";
import {g7} from "@/lib/guest-copy";
type Entry={restaurant:string;slug:string;tableLabel:string;activeVisit:boolean;policy:string};
const digit=(s:string)=>s.replace(/[۰-۹]/g,c=>String(c.charCodeAt(0)-1776))
 .replace(/[٠-٩]/g,c=>String(c.charCodeAt(0)-1632)).replace(/[^0-9]/g,"").slice(0,6);
export function GuestVerify({slug,qr}:{slug:string;qr:string}){
 const router=useRouter(),[locale,setLocale]=useState<Locale>("fa-AF");
 const [entry,setEntry]=useState<Entry|null>(null),[pin,setPin]=useState(""),
   [busy,setBusy]=useState(false),[loading,setLoading]=useState(true),[error,setError]=useState("");
 const load=useCallback(async()=>{
  setLoading(true);setError("");
  try{setEntry(await guestPublic<Entry>("/entry/"+encodeURIComponent(slug)+"/"+encodeURIComponent(qr)));}
  catch(e){setEntry(null);setError(e instanceof Error?e.message:g7(locale,"offline"));}
  finally{setLoading(false);}
 },[slug,qr,locale]);
 useEffect(()=>{const lang=localStorage.getItem("df:guest:locale");
   if(lang==="fa-AF"||lang==="ps-AF"||lang==="en")setLocale(lang);},[]);
 useEffect(()=>{document.documentElement.dir=direction(locale);document.documentElement.lang=locale;},[locale]);
 useEffect(()=>{void load();},[load]);
 async function submit(e:FormEvent){
   e.preventDefault();if(busy)return;
   if(pin.length!==6){setError(g7(locale,"invalidPinFormat"));return;}
   setBusy(true);setError("");
   try{
     const session=await guestPublic<GuestSession>(
       "/entry/"+encodeURIComponent(slug)+"/"+encodeURIComponent(qr)+"/verify",{pin});
     storeSession(session,"/g/"+encodeURIComponent(slug)+"/t/"+encodeURIComponent(qr));
     router.replace("/g/"+encodeURIComponent(session.visitId)+"/menu");
   }catch(e){
     setError(e instanceof GuestError&&e.code==="PIN_RATE_LIMITED"?g7(locale,"limited"):
       e instanceof GuestError&&(e.code==="INVALID_PIN"||e.code==="INVALID_PIN_FORMAT")?g7(locale,"incorrect"):
       e instanceof Error?e.message:g7(locale,"offline"));
   }finally{setBusy(false);}
 }
 return <div className="guest-app guest-gate" dir={direction(locale)}>
   <div className="guest-gate-top">
    <div className="guest-logo"><span><UtensilsCrossed size={22}/></span><strong>DineFlow</strong></div>
    <label className="guest-lang"><select aria-label={g7(locale,"language")} value={locale}
      onChange={e=>{setLocale(e.target.value as Locale);localStorage.setItem("df:guest:locale",e.target.value);}}>
      <option value="fa-AF">دری</option><option value="ps-AF">پښتو</option><option value="en">English</option>
    </select></label>
   </div>
   <main className="guest-gate-card">
    <div className="guest-gate-icon"><ShieldCheck size={32}/></div>
    <div className="guest-eyebrow">{g7(locale,"verification")}</div>
    <h1>{g7(locale,"scanTitle")}</h1>
    {entry&&<div className="guest-gate-identity">
       <h2>{entry.restaurant}</h2>
       <span className="guest-table-tag">{g7(locale,"table")} {entry.tableLabel}</span>
      </div>}
    {loading?<div className="guest-loading-inline"><span className="guest-spinner"/>{g7(locale,"loading")}</div>:
     entry?.activeVisit?<form onSubmit={e=>void submit(e)} className="guest-verify-form">
       <p>{g7(locale,"scanDesc")}</p>
       <label htmlFor="guest-pin">{g7(locale,"pinLabel")}</label>
       <div className="guest-pin-field"><KeyRound size={23}/>
        <input id="guest-pin" type="text" inputMode="numeric" autoComplete="one-time-code"
         autoFocus pattern="[0-9]{6}" required maxLength={6} aria-label={g7(locale,"pinLabel")}
         dir="ltr" value={pin} onChange={e=>{setPin(digit(e.target.value));setError("");}}
         placeholder="••••••" /></div>
       <button className="guest-button primary" type="submit" disabled={busy||pin.length!==6}>
        <LockKeyhole size={18}/>{busy?g7(locale,"loading"):g7(locale,"verify")}</button>
       <div className="guest-privacy"><CheckCircle2 size={17}/>{g7(locale,"guestOnly")}</div>
     </form>:<div className="guest-gate-empty">
       <Clock3 size={27}/><p>{entry?g7(locale,"noVisit"):g7(locale,"sessionExpired")}</p>
       <button className="guest-button secondary" type="button" onClick={()=>void load()}>
         <RefreshCw size={18}/>{g7(locale,"retry")}</button></div>}
    {!!error&&<div className="guest-error" role="alert">{error}</div>}
   </main>
   <footer className="guest-gate-footer">{g7(locale,"expiry")}</footer>
 </div>;
}
