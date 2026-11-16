"use client";
import {useCallback,useEffect,useMemo,useState,type FormEvent} from "react";
import Link from "next/link";
import {useRouter,useSearchParams} from "next/navigation";
import {ArrowLeft,ArrowRight,Check,CheckCircle2,Clock3,RefreshCw,Search,
 ShoppingBasket,Trash2,UtensilsCrossed,X,Plus,Minus,ReceiptText,ShieldCheck,AlertCircle} from "lucide-react";
import {g7} from "@/lib/guest-copy";
import {guestRequest,guestPublic,GuestError,cartKey,cost,money,nameOf,orderKey,validLine,
 type GuestCart,type GuestLine,type GuestItem,type GuestGroup,type GuestOrderFeed,type SubmitAck,type GuestSubmission,
 type GuestRound,type GuestCatalog} from "@/lib/guest-client";
import {GuestImage,useGuest} from "./guest-shell";
import type {Locale} from "@dineflow/shared";

function PolicyBadge({policy,locale}:{policy:string;locale:Locale}){
 return <div className="guest-policy"><ShieldCheck size={18}/>
   <span>{g7(locale,policy==="direct_to_kitchen"?"direct":"approval")}</span></div>;
}
export function GuestMenuPage(){
 const {locale,catalog,visit,session,refreshCatalog}=useGuest();
 const [search,setSearch]=useState(""),[category,setCategory]=useState("");
 const filtered=useMemo(()=>catalog?.items.filter(item=>
   (!category||item.categoryId===category)&&
   (!search.trim()||[item.nameFa,item.namePs,item.nameEn,item.description]
    .some(value=>value.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()))))??[],
 [catalog,category,search]);
 return <div className="guest-page guest-menu">
  <div className="guest-page-heading">
    <div><span className="guest-eyebrow">{g7(locale,"menuDesc")}</span>
     <h2>{g7(locale,"menu")}</h2></div>
    <button className="guest-icon-button" aria-label={g7(locale,"refreshMenu")} type="button"
     onClick={()=>void refreshCatalog()}><RefreshCw size={19}/></button>
  </div>
  <PolicyBadge policy={session.policy} locale={locale}/>
  <div className="guest-search"><Search size={20}/><input type="search" autoComplete="off"
    value={search} onChange={e=>setSearch(e.target.value)} placeholder={g7(locale,"search")}/></div>
  <div className="guest-chips" role="group" aria-label={g7(locale,"categories")}>
    <button className={!category?"selected":""} onClick={()=>setCategory("")}>{g7(locale,"all")}</button>
    {catalog?.categories.map(c=><button key={c.id} className={category===c.id?"selected":""}
      onClick={()=>setCategory(c.id)}>{nameOf(c,locale)}</button>)}
  </div>
  {filtered.length?<div className="guest-food-grid">{filtered.map(item=><article className="guest-food-card" key={item.id}>
    <Link href={"/g/"+visit+"/item/"+item.id} className="guest-food-image-link">
      <GuestImage imageId={item.imageId} alt={nameOf(item,locale)}/></Link>
    <div className="guest-food-content">
      <div><h3>{nameOf(item,locale)}</h3>{item.description&&<p className="guest-description">{item.description}</p>}</div>
      {!!item.allergens.length&&<p className="guest-allergens">{g7(locale,"allergens")}: {item.allergens.join(", ")}</p>}
      <div className="guest-food-foot"><strong>{money(item.priceMinor,locale)}</strong>
       <Link className="guest-add" href={"/g/"+visit+"/item/"+item.id} aria-label={g7(locale,"customize")+" "+nameOf(item,locale)}>
         <Plus size={18}/>{g7(locale,item.groupIds.length?"customize":"add")}</Link></div>
    </div>
  </article>)}</div>:<div className="guest-empty"><UtensilsCrossed size={37}/>
   <h3>{g7(locale,catalog?.items.length?"noResults":"noMeals")}</h3>
   {!!category||!!search?<button className="guest-button secondary" onClick={()=>{setSearch("");setCategory("");}}>
     {g7(locale,"clear")}</button>:null}</div>}
 </div>;
}
function CartSelector({line,setLine}:{line:GuestLine;setLine:(v:GuestLine)=>void}){
 const {locale}=useGuest();
 return <div className="guest-qty"><button type="button" aria-label={g7(locale,"remove")}
    onClick={()=>setLine({...line,quantity:Math.max(1,line.quantity-1)})}><Minus size={18}/></button>
  <strong>{line.quantity}</strong>
  <button type="button" aria-label={g7(locale,"add")}
    onClick={()=>setLine({...line,quantity:Math.min(99,line.quantity+1)})}><Plus size={18}/></button></div>;
}
export function GuestItemPage({id}:{id:string}){
 const {visit,locale,catalog,cart,setCart}=useGuest(),router=useRouter(),params=useSearchParams();
 const item=catalog?.items.find(x=>x.id===id);
 const [draft,setDraft]=useState<GuestLine|null>(null),[error,setError]=useState("");
 const [edit,setEdit]=useState<number|null>(null);
 const groupList=catalog&&item?catalog.groups.filter(g=>item.groupIds.includes(g.id)):[];
 useEffect(()=>{
   if(!item||!catalog)return;
   const value=params.get("edit"),at=value!==null&&/^\d+$/.test(value)?Number(value):null;
   const existing=at!==null?cart.lines[at]:undefined;
   if(existing?.itemId===item.id&&existing.itemVersion===item.version){
      setDraft(existing);setEdit(at);
   }else{
     setEdit(null);setDraft({itemId:item.id,itemVersion:item.version,quantity:1,note:"",
       selections:groupList.map(g=>({groupId:g.id,version:g.version,optionIds:[]}))});
   }
 // A new product identity resets editing state, but quantity/options editing should not reinitialise on every cart update.
 // eslint-disable-next-line react-hooks/exhaustive-deps
 },[id,catalog,params]);
 if(!catalog||!item||!draft)return <div className="guest-empty"><AlertCircle size={33}/>
   <h3>{g7(locale,"notFound")}</h3><Link href={"/g/"+visit+"/menu"}>{g7(locale,"back")}</Link></div>;
 const subtotal=cost(draft,catalog)??0;
 function toggle(group:GuestGroup,optionId:string){
   const current=draft!.selections.find(s=>s.groupId===group.id);
   if(!current)return;
   const selected=current.optionIds.includes(optionId);
   let values:string[];
   if(group.selectionMode==="single")values=selected?[]:[optionId];
   else values=selected?current.optionIds.filter(x=>x!==optionId):
      current.optionIds.length>=group.maxSelections?current.optionIds:[...current.optionIds,optionId];
   setDraft({...draft!,selections:draft!.selections.map(x=>x.groupId===group.id?{...x,optionIds:values}:x)});
   setError("");
 }
 function add(){
   if(!validLine(draft!,catalog!)){setError(g7(locale,"invalidOptions"));return;}
   setCart(old=>{
     if(edit!==null)return {...old,lines:old.lines.map((x,i)=>i===edit?draft!:x),idempotencyKey:orderKey()};
     if(old.lines.length>=40){setError(g7(locale,"emptyLine"));return old;}
     const signature=(x:GuestLine)=>JSON.stringify({itemId:x.itemId,itemVersion:x.itemVersion,
       selections:x.selections,note:x.note});
     const idx=old.lines.findIndex(x=>signature(x)===signature(draft!)&&x.quantity+draft!.quantity<=99);
     const lines=idx>=0?old.lines.map((x,i)=>i===idx?{...x,quantity:x.quantity+draft!.quantity}:x):
       [...old.lines,draft!];
     return {...old,lines,idempotencyKey:orderKey()};
   });
   router.push("/g/"+visit+"/cart");
 }
 return <div className="guest-page guest-item">
   <div className="guest-back"><Link href={"/g/"+visit+"/menu"}><ArrowLeft size={18}/>{g7(locale,"back")}</Link></div>
   <div className="guest-item-layout">
    <GuestImage imageId={item.imageId} alt={nameOf(item,locale)} className="guest-item-photo"/>
    <section className="guest-item-info">
     <div className="guest-eyebrow">{g7(locale,"customize")}</div>
     <h2>{nameOf(item,locale)}</h2>
     <p className="guest-item-description">{item.description}</p>
     <div className="guest-item-price">{money(item.priceMinor,locale)}</div>
     <div className="guest-allergen-block"><b>{g7(locale,"allergens")}</b>
       <span>{item.allergens.length?item.allergens.join(", "):g7(locale,"noAllergens")}</span></div>
     {groupList.map(group=>{
       const choice=draft.selections.find(s=>s.groupId===group.id),selected=choice?.optionIds??[];
       return <fieldset className="guest-choice-group" key={group.id}>
         <legend><strong>{nameOf(group,locale)}</strong><span>{group.minSelections>0?g7(locale,"required"):g7(locale,"optional")}
           {" · "}{group.minSelections}–{group.maxSelections}</span></legend>
         {group.options.map(option=><label className={"guest-option"+(selected.includes(option.id)?" chosen":"")}
           key={option.id}>
            <input type={group.selectionMode==="single"?"radio":"checkbox"} name={group.id}
              checked={selected.includes(option.id)} onChange={()=>toggle(group,option.id)}/>
            <span>{nameOf(option,locale)}</span><small>{option.deltaMinor>0?"+"+money(option.deltaMinor,locale):
              option.deltaMinor<0?money(option.deltaMinor,locale):"—"}</small>
           </label>)}
       </fieldset>;
     })}
     <label className="guest-form-field"><span>{g7(locale,"special")}</span>
       <textarea maxLength={250} rows={3} placeholder={g7(locale,"specialHint")}
         value={draft.note} onChange={e=>setDraft({...draft,note:e.target.value})}/></label>
     <div className="guest-quantity-row"><label>{g7(locale,"quantity")}</label><CartSelector line={draft} setLine={setDraft}/></div>
     {!!error&&<p className="guest-error" role="alert">{error}</p>}
     <button type="button" className="guest-button primary" onClick={add}>
       <ShoppingBasket size={20}/>{g7(locale,"addToCart")} · {money(subtotal,locale)}</button>
    </section>
   </div>
 </div>;
}
function LineModifiers({line,catalog,locale}:{line:GuestLine;catalog:GuestCatalog;locale:Locale}){
 return <p className="guest-cart-mods">{line.selections.flatMap(s=>{
   const group=catalog.groups.find(g=>g.id===s.groupId);
   return s.optionIds.map(id=>group?.options.find(x=>x.id===id)).filter(x=>!!x).map(x=>nameOf(x!,locale));
 }).join(" · ")}{line.note?" · "+line.note:""}</p>;
}
type AckResult={status:"pending"|"approved";id:string;roundId:string|null};
export function GuestCartPage(){
 const {visit,locale,catalog,cart,setCart,session,stale}=useGuest(),router=useRouter();
 const [busy,setBusy]=useState(false),[error,setError]=useState(""),[uncertain,setUncertain]=useState(false);
 const [removed,setRemoved]=useState<{line:GuestLine;index:number}|null>(null);
 const key="df:guest:pending:"+visit+":"+session.token.slice(0,12);
 const [outstanding,setOutstanding]=useState<{idempotencyKey:string;note:string;lines:GuestLine[]}|null>(null);
 useEffect(()=>{
   try{const raw=sessionStorage.getItem(key);if(raw){const value=JSON.parse(raw);
     if(value.idempotencyKey&&Array.isArray(value.lines)){setOutstanding(value);setUncertain(true);}}}
   catch{/* Ignore corrupt draft marker. */}
 },[key]);
 async function reconcile(data:{idempotencyKey:string;note:string;lines:GuestLine[]},showError=false):Promise<AckResult|null>{
   try{
     const existing=await guestRequest<{status:"pending"|"approved"|"rejected";id:string;roundId:string|null}>(
       session.token,"/orders/by-key/"+encodeURIComponent(data.idempotencyKey));
     if(existing.status!=="rejected"){confirmed();return {status:existing.status,id:existing.id,roundId:existing.roundId};}
     if(showError)setError(g7(locale,"reviewStatus"));
     sessionStorage.removeItem(key);setOutstanding(null);setUncertain(false);
     return null;
   }catch(e){
     if(e instanceof GuestError&&e.status===404){
       sessionStorage.removeItem(key);setOutstanding(null);setUncertain(false);return null;
     }
     if(showError)setError(g7(locale,"orderRetry"));
     return null;
   }
 }
 function confirmed(){
   sessionStorage.removeItem(key);setOutstanding(null);setUncertain(false);setCart({lines:[],note:"",idempotencyKey:orderKey()});
   router.replace("/g/"+visit+"/orders");
 }
 useEffect(()=>{
   if(!outstanding)return;
   void reconcile(outstanding);
 // eslint-disable-next-line react-hooks/exhaustive-deps
 },[outstanding?.idempotencyKey]);
 function mutate(fn:(c:GuestCart)=>GuestCart){if(uncertain)return;
   setError("");setRemoved(null);setCart(old=>({...fn(old),idempotencyKey:orderKey()}));}
 function remove(index:number){
   const line=cart.lines[index];if(!line)return;
   setRemoved({line,index});mutate(old=>({...old,lines:old.lines.filter((_,i)=>i!==index)}));
   setRemoved({line,index});
 }
 function undo(){
   if(!removed)return;
   mutate(old=>({...old,lines:[...old.lines.slice(0,removed.index),removed.line,...old.lines.slice(removed.index)]}));
   setRemoved(null);
 }
 async function submit(){
   if(busy||!cart.lines.length||!catalog||stale)return;
   const payload=outstanding??{idempotencyKey:cart.idempotencyKey,note:cart.note,lines:cart.lines};
   if(!payload.lines.every(x=>validLine(x,catalog))){setError(g7(locale,"invalidOptions"));return;}
   setBusy(true);setError("");
   setOutstanding(payload);setUncertain(true);sessionStorage.setItem(key,JSON.stringify(payload));
   try{
     const ack=await guestRequest<SubmitAck>(session.token,"/orders",{
       method:"POST",body:JSON.stringify(payload)});
     if(ack.status==="pending"||ack.status==="approved"){confirmed();}
     else {setError(g7(locale,"reviewStatus"));sessionStorage.removeItem(key);setUncertain(false);}
   }catch(e){
     if(e instanceof GuestError&&e.status===409){
       if(["PRICE_CHANGED","ITEM_UNAVAILABLE","MODIFIER_CHANGED","INVALID_MODIFIERS"].includes(e.code)){
         sessionStorage.removeItem(key);setUncertain(false);setOutstanding(null);
         setError(g7(locale,"changed"));return;
       }
     }
     const recovered=await reconcile(payload,false);
     if(!recovered)setError(e instanceof Error?e.message:g7(locale,"orderRetry"));
   }finally{setBusy(false);}
 }
 const total=cart.lines.reduce((n,line)=>n+(catalog?cost(line,catalog)??0:0),0);
 if(!catalog)return <div className="guest-loading-inline">{g7(locale,"loading")}</div>;
 return <div className="guest-page guest-cart-page">
   <div className="guest-page-heading"><div><span className="guest-eyebrow">{g7(locale,"cart")}</span>
     <h2>{g7(locale,"cart")}</h2></div>
     <Link className="guest-text-link" href={"/g/"+visit+"/menu"}>{g7(locale,"continueShopping")}</Link></div>
   {cart.lines.length?<>
    <div className="guest-cart-layout"><div className="guest-cart-items">
     {cart.lines.map((line,index)=>{
       const item=catalog.items.find(x=>x.id===line.itemId);
       return <article className="guest-cart-line" key={index}>
        <div className="guest-cart-line-head">
          <strong>{item?nameOf(item,locale):g7(locale,"notFound")}</strong>
          <span>{cost(line,catalog)===null?"—":money(cost(line,catalog)!,locale)}</span></div>
        <LineModifiers line={line} catalog={catalog} locale={locale}/>
        <div className="guest-cart-line-actions">
         <div className="guest-qty"><button type="button" disabled={uncertain} aria-label={g7(locale,"remove")}
            onClick={()=>mutate(c=>({...c,lines:c.lines.map((x,i)=>i===index?{...x,quantity:Math.max(1,x.quantity-1)}:x)}))}>
             <Minus size={17}/></button><strong>{line.quantity}</strong>
           <button type="button" disabled={uncertain} aria-label={g7(locale,"add")}
            onClick={()=>mutate(c=>({...c,lines:c.lines.map((x,i)=>i===index?{...x,quantity:Math.min(99,x.quantity+1)}:x)}))}>
             <Plus size={17}/></button></div>
         <Link aria-disabled={uncertain} href={uncertain?"#":"/g/"+visit+"/item/"+line.itemId+"?edit="+index}
            className="guest-text-link">{g7(locale,"edit")}</Link>
         <button type="button" className="guest-destructive" disabled={uncertain}
            onClick={()=>remove(index)}><Trash2 size={16}/>{g7(locale,"remove")}</button>
        </div>
       </article>;
     })}
     {removed&&!uncertain&&<div className="guest-undo" role="status">{g7(locale,"remove")}
       <button type="button" onClick={undo}>{g7(locale,"undo")}</button></div>}
     <label className="guest-form-field"><span>{g7(locale,"note")}</span>
      <textarea value={cart.note} maxLength={500} rows={2} disabled={uncertain}
       placeholder={g7(locale,"specialHint")}
       onChange={e=>mutate(c=>({...c,note:e.target.value}))}/></label>
    </div>
    <aside className="guest-cart-summary">
      <div className="guest-eyebrow">{g7(locale,"receipt")}</div>
      <div className="guest-summary-row"><span>{g7(locale,"items")}</span><b>{cart.lines.reduce((n,x)=>n+x.quantity,0)}</b></div>
      <div className="guest-summary-row big"><span>{g7(locale,"total")}</span><strong>{money(total,locale)}</strong></div>
      <p>{g7(locale,"estimate")}</p>
      <PolicyBadge policy={session.policy} locale={locale}/>
      <p>{g7(locale,session.policy==="direct_to_kitchen"?"directHint":"approvalHint")}</p>
      {!!error&&<div role="alert" className="guest-error">{error}</div>}
      {stale&&<div role="alert" className="guest-error">{g7(locale,"changed")}</div>}
      {uncertain&&<div role="status" className="guest-hold">
        <Clock3 size={18}/>{g7(locale,"orderRetry")}
       </div>}
      <button className="guest-button primary" type="button" disabled={busy||stale||!cart.lines.length}
        onClick={()=>void submit()}>
        {busy?<RefreshCw size={18} className="guest-spinning"/>:<Check size={19}/>}
        {busy?g7(locale,"placing"):uncertain?g7(locale,"retry"):g7(locale,"placeOrder")}</button>
      {uncertain&&outstanding&&<button type="button" className="guest-button secondary" disabled={busy}
        onClick={()=>void reconcile(outstanding,true)}><RefreshCw size={17}/>{g7(locale,"refresh")}</button>}
      <button className="guest-text-link" disabled={busy||uncertain} type="button"
        onClick={()=>{if(window.confirm(g7(locale,"confirmClear")))mutate(c=>({...c,lines:[],note:""}));}}>
        {g7(locale,"clearCart")}</button>
    </aside></div>
   </>:<div className="guest-empty"><ShoppingBasket size={42}/>
     <h3>{g7(locale,"cartEmpty")}</h3><p>{g7(locale,"cartEmptyHint")}</p>
     <Link className="guest-button primary" href={"/g/"+visit+"/menu"}>{g7(locale,"browse")}</Link></div>}
 </div>;
}
function RoundCard({row,locale}:{row:GuestRound;locale:Locale}){
 return <article className="guest-round-card">
   <div className="guest-round-top"><div><span className="guest-eyebrow">{g7(locale,"round")} #{row.roundNumber}</span>
     <h3>{row.source==="guest_qr"?g7(locale,"order"):g7(locale,"restaurant")}</h3></div>
    <span className={"guest-status "+row.status}>{g7(locale,row.status)}</span></div>
   <div className="guest-round-lines">{row.lines.map((line,i)=><div key={line.roundId+"-"+i}>
     <span>{line.quantity} × {nameOf(line,locale)}</span><span>{money(line.lineTotalMinor,locale)}</span></div>)}</div>
   <div className="guest-summary-row big"><span>{g7(locale,"total")}</span><strong>{money(row.totalMinor,locale)}</strong></div>
   <div className="guest-round-date">{new Date(row.createdAt).toLocaleString(locale)} · {g7(locale,"orderStatus")}: {g7(locale,row.status)}</div>
 </article>;
}
export function GuestOrdersPage(){
 const {visit,locale,session}=useGuest(),[feed,setFeed]=useState<GuestOrderFeed|null>(null),
  [tab,setTab]=useState<"active"|"past">("active"),[loading,setLoading]=useState(true),[error,setError]=useState("");
 const load=useCallback(async(silent=false)=>{
   if(!silent)setLoading(true);
   try{const result=await guestRequest<GuestOrderFeed>(session.token,"/orders");
     setFeed(result);setError("");}
   catch(e){setError(e instanceof Error?e.message:g7(locale,"offline"));}
   finally{setLoading(false);}
 },[session.token,locale]);
 useEffect(()=>{
   void load();
   const timer=setInterval(()=>{if(document.visibilityState==="visible")void load(true);},12000);
   const resume=()=>{if(document.visibilityState==="visible")void load(true);};
   document.addEventListener("visibilitychange",resume);
   return()=>{clearInterval(timer);document.removeEventListener("visibilitychange",resume);};
 },[load]);
 const active=feed?.rounds.filter(x=>x.status!=="served")??[];
 const done=feed?.rounds.filter(x=>x.status==="served")??[];
 const pending=feed?.pending.filter(x=>x.status==="pending")??[];
 const rejected=feed?.pending.filter(x=>x.status==="rejected")??[];
 return <div className="guest-page guest-orders-page">
  <div className="guest-page-heading"><div><div className="guest-eyebrow">{g7(locale,"activeOrder")}</div>
    <h2>{g7(locale,"order")}</h2></div><button className="guest-icon-button" aria-label={g7(locale,"refresh")}
      onClick={()=>void load()}><RefreshCw size={19}/></button></div>
  <nav className="guest-segments" aria-label={g7(locale,"order")}>
    {(["active","past"] as const).map(k=><button key={k} className={k===tab?"selected":""}
      onClick={()=>setTab(k)}>{g7(locale,k)}</button>)}</nav>
  {!!error&&<div role="alert" className="guest-error">{error}
    <button type="button" onClick={()=>void load()}>{g7(locale,"retry")}</button></div>}
  {loading&&!feed?<div className="guest-loading-inline"><span className="guest-spinner"/>{g7(locale,"loading")}</div>:
  tab==="active"?<div className="guest-rounds-list">
    {pending.map(x=><article key={x.id} className="guest-round-card pending">
       <div className="guest-round-top"><div><span className="guest-eyebrow">{g7(locale,"orderNumber")} {x.id.slice(0,8)}</span>
        <h3>{g7(locale,"successPending")}</h3></div><span className="guest-status pending">{g7(locale,"awaiting")}</span></div>
       <div className="guest-round-lines">{x.preview.map((l,i)=><div key={i}><span>{l.quantity} × {nameOf(l,locale)}</span>
        <span>{money(l.lineTotalMinor,locale)}</span></div>)}</div>
       <div className="guest-summary-row big"><span>{g7(locale,"total")}</span>
        <strong>{money(x.estimatedMinor,locale)}</strong></div>
       <p className="guest-round-date">{g7(locale,"pendingStatus")}</p>
     </article>)}
    {active.map(r=><RoundCard key={r.id} row={r} locale={locale}/>)}
    {!pending.length&&!active.length&&<div className="guest-empty"><ReceiptText size={38}/>
     <h3>{g7(locale,"historyEmpty")}</h3>
     <Link className="guest-button primary" href={"/g/"+visit+"/menu"}>{g7(locale,"browse")}</Link></div>}
  </div>:<div className="guest-rounds-list">
   {rejected.map(x=><article key={x.id} className="guest-round-card rejected">
     <div className="guest-round-top"><h3>{g7(locale,"rejected")}</h3>
       <span className="guest-status rejected">{g7(locale,"rejected")}</span></div>
     <div className="guest-round-lines">{x.preview.map((line,i)=><div key={i}>
       <span>{line.quantity} × {nameOf(line,locale)}</span><span>{money(line.lineTotalMinor,locale)}</span></div>)}</div>
     {!!x.rejectionReason&&<p className="guest-error">{g7(locale,"reason")}: {x.rejectionReason}</p>}
    </article>)}
   {done.map(x=><RoundCard key={x.id} row={x} locale={locale}/>)}
   {!rejected.length&&!done.length&&<div className="guest-empty"><ReceiptText size={38}/><h3>{g7(locale,"historyEmpty")}</h3></div>}
  </div>}
  <Link className="guest-button secondary" href={"/g/"+visit+"/bill"}>{g7(locale,"receipt")} · {g7(locale,"total")}</Link>
  <div className="guest-footer-note"><ShieldCheck size={19}/>{g7(locale,"noPayment")}</div>
  <Link className="guest-button secondary" href={"/g/"+visit+"/menu"}>{g7(locale,"more")}</Link>
 </div>;
}
