"use client";
import {createContext,useCallback,useContext,useEffect,useMemo,useState,type Dispatch,type SetStateAction,type ReactNode} from "react";
import {usePathname,useRouter} from "next/navigation";
import Link from "next/link";
import {ArrowLeft,BellRing,BookOpen,CheckCircle2,ShoppingBasket,ReceiptText,RefreshCw,ShieldCheck,UtensilsCrossed,WifiOff} from "lucide-react";
import {direction,type Locale} from "@dineflow/shared";
import {g7} from "@/lib/guest-copy";
import {s8} from "@dineflow/shared";
import {API_URL} from "@/lib/auth-client";
import {cartKey,cost,entryKey,guestRequest,nameOf,money,orderKey,readSession,sessionKey,
 type GuestCart,type GuestCatalog,type GuestSession} from "@/lib/guest-client";

type GuestState={session:GuestSession;locale:Locale;setLocale:(locale:Locale)=>void;
 cart:GuestCart;setCart:Dispatch<SetStateAction<GuestCart>>;
 catalog:GuestCatalog|null;refreshCatalog:()=>Promise<void>;loading:boolean;error:string;
 total:number;units:number;stale:boolean;visit:string};
const GuestContext=createContext<GuestState|null>(null);
export function useGuest(){const state=useContext(GuestContext);if(!state)throw new Error("Guest session is unavailable");return state;}
const newCart=():GuestCart=>({lines:[],note:"",idempotencyKey:orderKey()});
export function GuestShell({visit,children}:{visit:string;children:ReactNode}){
 const router=useRouter(),pathname=usePathname();
 const [session,setSession]=useState<GuestSession|null>(null),[hydrated,setHydrated]=useState(false);
 const [locale,setLanguage]=useState<Locale>("fa-AF"),[cart,setCart]=useState<GuestCart>(newCart);
 const [catalog,setCatalog]=useState<GuestCatalog|null>(null),[loading,setLoading]=useState(true),[error,setError]=useState("");
 const [expired,setExpired]=useState(false);
 const setLocale=useCallback((next:Locale)=>{setLanguage(next);localStorage.setItem("df:guest:locale",next);},[]);
 const refreshCatalog=useCallback(async()=>{
   if(!session)return;
   try{const data=await guestRequest<GuestCatalog>(session.token,"/catalog");
     setCatalog(data);setError("");}
   catch(e){
     if(e instanceof Error&&(e as {status?:number}).status===401){
       sessionStorage.removeItem(sessionKey(visit));setExpired(true);setSession(null);
     }else setError(e instanceof Error?e.message:g7(locale,"offline"));
   }
 },[session,visit,locale]);
 useEffect(()=>{
   const value=localStorage.getItem("df:guest:locale");
   if(value==="fa-AF"||value==="ps-AF"||value==="en")setLanguage(value);
   const existing=readSession(visit);
   if(!existing){setHydrated(true);setLoading(false);setExpired(true);return;}
   setSession(existing);
   try{
     const raw=sessionStorage.getItem(cartKey(existing));
     if(raw){
       const cached=JSON.parse(raw) as GuestCart;
       if(Array.isArray(cached?.lines)&&typeof cached.idempotencyKey==="string")
         setCart(cached);
     }
   }catch{/* Invalid local draft will not be submitted. */}
   setHydrated(true);
 },[visit]);
 useEffect(()=>{
   document.documentElement.dir=direction(locale);document.documentElement.lang=locale;
 },[locale]);
 useEffect(()=>{
   if(!session||!hydrated)return;
   sessionStorage.setItem(cartKey(session),JSON.stringify(cart));
 },[cart,session,hydrated]);
 useEffect(()=>{
   if(!session)return;
   let active=true;
   const probe=async()=>{
     try{
       await guestRequest(session.token,"/session");
       if(!active)return;const data=await guestRequest<GuestCatalog>(session.token,"/catalog");
       if(active){setCatalog(data);setError("");}
     }catch(e){
       if(!active)return;
       if(e instanceof Error&&(e as {status?:number}).status===401){
         sessionStorage.removeItem(sessionKey(visit));setSession(null);setExpired(true);
       }else setError(e instanceof Error?e.message:g7(locale,"offline"));
     }finally{if(active)setLoading(false);}
   };
   void probe();
   const interval=setInterval(()=>{if(document.visibilityState==="visible")void probe();},20000);
   const resume=()=>{if(document.visibilityState==="visible")void probe();};
   document.addEventListener("visibilitychange",resume);
   return()=>{active=false;clearInterval(interval);document.removeEventListener("visibilitychange",resume);};
 },[session,visit,locale]);
 const total=useMemo(()=>cart.lines.reduce((n,l)=>n+(catalog?cost(l,catalog)??0:0),0),[cart,catalog]);
 const stale=useMemo(()=>!catalog||cart.lines.some(l=>cost(l,catalog)===null),[cart,catalog]);
 const units=cart.lines.reduce((n,l)=>n+l.quantity,0);
 if(!hydrated||loading&&!catalog)return <div className="guest-app"><div className="guest-loading">
    <div className="guest-brand"><UtensilsCrossed size={22}/> DineFlow</div>
    <span className="guest-spinner"/><p>{g7(locale,"loading")}</p></div></div>;
 if(!session)return <div className="guest-app guest-expired">
   <div className="guest-hero-symbol"><ShieldCheck size={32}/></div>
   <h1>{g7(locale,"sessionExpired")}</h1><p>{g7(locale,"scanAgain")}</p>
   <p>{expired?g7(locale,"signedOut"):g7(locale,"expiry")}</p>
   {typeof window!=="undefined"&&sessionStorage.getItem(entryKey(visit))&&
      <Link href={sessionStorage.getItem(entryKey(visit))!} className="guest-button primary">{g7(locale,"verify")}</Link>}
 </div>;
 const base="/g/"+encodeURIComponent(visit),inMenu=pathname.includes("/menu")||pathname.includes("/item/"),
   inOrders=pathname.includes("/orders"),inHelp=pathname.includes("/help");
 const state={session,locale,setLocale,cart,setCart,catalog,refreshCatalog,loading,error,total,units,stale,visit};
 return <GuestContext.Provider value={state}>
   <div className="guest-app" dir={direction(locale)}>
    <header className="guest-topbar">
      <Link href={base+"/menu"} className="guest-logo"><span><UtensilsCrossed size={22}/></span><strong>DineFlow</strong></Link>
      <label className="guest-lang" aria-label={g7(locale,"language")}>
       <select aria-label={g7(locale,"language")} value={locale} onChange={e=>setLocale(e.target.value as Locale)}>
        <option value="fa-AF">دری</option><option value="ps-AF">پښتو</option><option value="en">English</option>
       </select></label>
    </header>
    <div className="guest-restaurant-row">
      <div><span className="guest-eyebrow">{g7(locale,"welcome")}</span>
       <h1>{session.restaurant}</h1></div>
      <div className="guest-table-tag"><UtensilsCrossed size={17}/>{g7(locale,"table")} {session.tableLabel}</div>
    </div>
    <div className="guest-trust"><CheckCircle2 size={15}/>{g7(locale,"connected")}</div>
    {!!error&&<div className="guest-error" role="alert"><WifiOff size={19}/>{error}
      <button type="button" onClick={()=>void refreshCatalog()}><RefreshCw size={16}/>{g7(locale,"retry")}</button></div>}
    <main className="guest-main" id="guest-main-content">{children}</main>
    <div className="guest-bottom-actions">
     {units>0&&!pathname.includes("/cart")&&<Link href={base+"/cart"} className="guest-cart-cta">
       <span><ShoppingBasket size={20}/>{g7(locale,"viewCart")} <b>{units}</b></span><strong>{money(total,locale)}</strong></Link>}
     <nav className="guest-bottom-nav" aria-label={g7(locale,"menu")}>
       <Link href={base+"/menu"} className={inMenu?"selected":""} aria-current={inMenu?"page":undefined}>
         <BookOpen size={21}/><span>{g7(locale,"menu")}</span></Link>
       <Link href={base+"/orders"} className={inOrders?"selected":""} aria-current={inOrders?"page":undefined}>
         <ReceiptText size={21}/><span>{g7(locale,"order")}</span></Link>
       <Link href={base+"/help"} className={inHelp?"selected":""}
          aria-current={inHelp?"page":undefined}>
         <BellRing size={21}/><span>{s8(locale,"assistance")}</span></Link>
     </nav>
    </div>
   </div>
 </GuestContext.Provider>;
}
export function GuestImage({imageId,alt,className=""}:{imageId:string|null;alt:string;className?:string}){
 const {session}=useGuest();
 const [src,setSrc]=useState<string|null>(null);
 useEffect(()=>{
   if(!imageId){setSrc(null);return;}
   let active=true,uri:string|null=null;
   const controller=new AbortController();
   const fetchImage=async()=>{
     try{
       const response=await fetch(API_URL+"/api/guest/images/"+encodeURIComponent(imageId),
         {signal:controller.signal,credentials:"omit",headers:{Authorization:"Bearer "+session.token}});
       if(!response.ok)throw new Error("Image unavailable");
       const blob=await response.blob();if(!active)return;
       uri=URL.createObjectURL(blob);setSrc(uri);
     }catch{if(active)setSrc(null);}
   };
   void fetchImage();
   return()=>{active=false;controller.abort();if(uri)URL.revokeObjectURL(uri);};
 },[imageId,session.token]);
 return <div className={"guest-photo "+className}>{src?
   <img src={src} alt={alt} loading="lazy"/>:
   <div className="guest-photo-fallback" role="img" aria-label={alt}><UtensilsCrossed size={30}/></div>}</div>;
}
