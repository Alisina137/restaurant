"use client";
import {useCallback,useEffect,useMemo,useRef,useState,type FormEvent} from "react";
import Link from "next/link";
import {ArrowLeft,Banknote,Check,ChefHat,Clock3,FileCheck2,ReceiptText,RefreshCw,ShieldCheck,Split,Wallet} from "lucide-react";
import {useRouter} from "next/navigation";
import {useWorkspace} from "./workspace-provider";
import {jsonRequest,Phase2Error} from "@/lib/phase2-api";
import {f9} from "@/lib/finance-copy";
import {afnInput,isoTime,money,parseAFN,titleName,type CheckDetails,type CheckShare} from "@/lib/finance-types";
import {useInteraction} from "./ui/interaction-provider";
import {InlineFeedback} from "./ui/interaction-controls";
import {LoadingSkeleton} from "./ui/design-system";
type Tab="items"|"split"|"payments"|"activity";
function nextKey(){return "payment-"+crypto.randomUUID().replaceAll("-","");}
export function CashierCheckDetails({id,area="cashier"}:{id:string;area?:"cashier"|"app"}){
 const {workspace}=useWorkspace(),locale=workspace.locale,router=useRouter();
 const {confirm,notify}=useInteraction();
 const moneyLock=useRef(false);
 const base=area==="cashier"?"/cashier":"/app/billing";
 const [data,setData]=useState<CheckDetails|null>(null),[loading,setLoading]=useState(true),
   [tab,setTab]=useState<Tab>("items"),[busy,setBusy]=useState(""),[error,setError]=useState(""),[notice,setNotice]=useState("");
 useEffect(()=>{if(notice){notify(notice,"success");setNotice("");}},[notice,notify]);
 const [shiftOpen,setShiftOpen]=useState(false),[float,setFloat]=useState("0");
 const [mode,setMode]=useState<"single"|"equal"|"items">("single"),[parts,setParts]=useState(2);
 const [allocation,setAllocation]=useState<Record<string,number>>({});
 const [shareId,setShareId]=useState(""),[method,setMethod]=useState<"cash"|"manual_transfer">("cash"),
   [amount,setAmount]=useState(""),[received,setReceived]=useState(""),[reference,setReference]=useState(""),
   [verified,setVerified]=useState(false),[note,setNote]=useState(""),[paymentKey,setPaymentKey]=useState(nextKey);
 const load=useCallback(async(silent=false)=>{
   if(!silent)setLoading(true);
   try{
     const [detail,current]=await Promise.all([
       jsonRequest<CheckDetails>("/api/finance/checks/"+encodeURIComponent(id)),
       jsonRequest<{shift:{id:string}|null}>("/api/finance/shifts/current")]);
     setData(detail);setShiftOpen(!!current.shift);setError("");
   }catch(e){setError(e instanceof Error?e.message:f9(locale,"actionFailed"));}
   finally{setLoading(false);}
 },[id,locale]);
 useEffect(()=>{void load();const tick=setInterval(()=>{if(document.visibilityState==="visible")void load(true);},14000);
   return()=>clearInterval(tick);},[load]);
 useEffect(()=>{
   if(!data)return;
   setMode(data.check.splitMode);setParts(Math.max(2,data.check.splitCount));
   setShareId(old=>data.shares.some(s=>s.id===old)?old:data.shares[0]?.id??"");
 },[data?.check.id,data?.check.splitMode,data?.check.splitCount,data?.shares.map(s=>s.id).join("|")]);
 const locked=!!data?.check.lockedAt||data?.check.status==="settled";
 const canSplit=data?.check.status==="open"&&data?.check.paidMinor===0;
 const selectedShare=data?.shares.find(s=>s.id===shareId);
 const shareDue=(selectedShare?.amountMinor??0)-(selectedShare?.paidMinor??0);
 const amountMinor=parseAFN(amount),receivedMinor=parseAFN(received),changeMinor=amountMinor!==null&&receivedMinor!==null?
   Math.max(0,receivedMinor-amountMinor):null;
 const canPost=!!shareId&&shiftOpen&&data?.check.status==="open"&&amountMinor!==null&&amountMinor>0&&
   amountMinor<=shareDue&&receivedMinor!==null&&receivedMinor>=amountMinor&&
   (method==="cash"||method==="manual_transfer"&&!!reference.trim()&&verified&&receivedMinor===amountMinor);
 const [subTab,setSubTab]=useState<Tab>("items");
 useEffect(()=>{setSubTab(tab);},[tab]);
 useEffect(()=>{
   if(!data||data.check.splitMode!=="items"||!data.allocations.length)return;
   const next:Record<string,number>={};
   for(const a of data.allocations){
     const share=data.shares.find(x=>x.id===a.shareId);
     if(share)next[a.lineId+"|"+share.shareIndex]=a.quantity;
   }
   setAllocation(next);
 },[data?.check.version]);
 function displayedAllocation(lineId:string,index:number){
   if(Object.keys(allocation).some(k=>k.startsWith(lineId+"|")))return allocation[lineId+"|"+index]??0;
   return index===1?data?.lines.find(x=>x.id===lineId)?.quantity??0:0;
 }
 async function splitSave(e:FormEvent){
   e.preventDefault();if(!data||!canSplit||moneyLock.current)return;
   const allocations=mode==="items"?data.lines.flatMap(line=>Array.from({length:parts},(_,i)=>{
     const qty=displayedAllocation(line.id,i+1);
     return qty>0?{lineId:line.id,shareIndex:i+1,quantity:qty}:null;
   }).filter((x):x is {lineId:string;shareIndex:number;quantity:number}=>!!x)):[];
   if(mode==="items"&&(data.lines.some(l=>allocations.filter(a=>a.lineId===l.id)
      .reduce((s,a)=>s+a.quantity,0)!==l.quantity)
      ||Array.from({length:parts},(_,i)=>i+1).some(i=>!allocations.some(a=>a.shareIndex===i)))){
     setError(f9(locale,"emptyShare"));return;
   }
   moneyLock.current=true;setBusy("split");setError("");setNotice("");
   try{
     await jsonRequest("/api/finance/checks/"+id+"/split",{method:"POST",
       body:JSON.stringify({mode,count:mode==="single"?1:parts,version:data.check.version,allocations})});
     setNotice(f9(locale,"saveSplit"));await load(true);
   }catch(e){setError(e instanceof Error?e.message:f9(locale,"actionFailed"));await load(true);}
   finally{moneyLock.current=false;setBusy("");}
 }
 async function openShift(){
   if(moneyLock.current)return;
   moneyLock.current=true;setBusy("shift");setError("");
   const minor=parseAFN(float);
   if(minor===null){setError(f9(locale,"invalid"));moneyLock.current=false;setBusy("");return;}
   try{await jsonRequest("/api/finance/shifts/open",{method:"POST",body:JSON.stringify({openingFloatMinor:minor})});
     setNotice(f9(locale,"shiftOpen"));await load(true);}
   catch(e){setError(e instanceof Error?e.message:f9(locale,"actionFailed"));}
   finally{moneyLock.current=false;setBusy("");}
 }
 async function pay(e:FormEvent){
   e.preventDefault();if(!data||!canPost||busy||moneyLock.current)return;
   moneyLock.current=true;setBusy("payment");setNotice("");setError("");
   const payload={version:data.check.version,shareId,method,amountMinor,receivedMinor,
     externalReference:method==="manual_transfer"?reference.trim():"",verifiedExternally:verified,
     note,idempotencyKey:paymentKey};
   try{
     await jsonRequest("/api/finance/checks/"+id+"/payments",{method:"POST",body:JSON.stringify(payload)});
     setNotice(f9(locale,"paidSuccess"));setPaymentKey(nextKey());setAmount("");setReceived("");
     setReference("");setVerified(false);setNote("");await load(true);
   }catch(e){setError(e instanceof Phase2Error&&e.code==="VERSION_CONFLICT"?f9(locale,"changed"):
     e instanceof Error?e.message:f9(locale,"actionFailed"));
     // Retain the same idempotency key: replay can safely recover an accepted payment.
     await load(true);
   }finally{moneyLock.current=false;setBusy("");}
 }
 async function settle(){
   if(!data||data.dueMinor!==0||data.check.status==="settled"||busy||moneyLock.current)return;
   if(!(await confirm({title:f9(locale,"settle"),description:f9(locale,"settleConfirm"),
     confirmLabel:f9(locale,"settle"),cancelLabel:f9(locale,"cancel"),danger:true})))return;
   if(moneyLock.current)return;
   moneyLock.current=true;setBusy("settle");setError("");setNotice("");
   try{
     const x=await jsonRequest<{receiptId:string}>("/api/finance/checks/"+id+"/settle",{
       method:"POST",body:JSON.stringify({version:data.check.version})});
     router.replace(base+"/receipts/"+x.receiptId);
   }catch(e){setError(e instanceof Error?e.message:f9(locale,"actionFailed"));await load(true);}
   finally{moneyLock.current=false;setBusy("");}
 }
 return <div className="content-stack finance-console finance-detail">
   <div className="finance-detail-header">
    <div><Link href={base+"/checks"} className="finance-back"><ArrowLeft size={17}/>{f9(locale,"back")}</Link>
      <div className="eyebrow">DINEFLOW / {f9(locale,"check")}</div>
      <h1>{f9(locale,"table")} {data?.tableLabel??"—"} <span>#{data?.check.number??"—"}</span></h1></div>
    <div className="p10-row"><Link className="button button-primary"
 href={area==="cashier"?"/cashier/adjustments?checkId="+encodeURIComponent(id):
 "/app/billing/adjustments?checkId="+encodeURIComponent(id)}>↺ {locale==="en"?"Adjustments & refunds":locale==="ps-AF"?"سمونونه او بېرته ورکړې":"اصلاحات و بازپرداخت"}</Link>
 <button type="button" className="button" onClick={()=>void load()}><RefreshCw size={17}/>{f9(locale,"refresh")}</button></div>
   </div>
   {loading&&!data?<LoadingSkeleton rows={3} label={f9(locale,"checks")} className="settings-card"/>:
    data&&<>
      <div className="finance-due-bar">
        <div><div className="eyebrow">{f9(locale,"balance")}</div>
          <strong>{money(data.dueMinor,locale)}</strong>
          <small>{f9(locale,data.check.status==="settled"?"settled":"open")} · {isoTime(data.check.createdAt,locale)}</small></div>
        <div className="finance-due-amounts">
          <span>{f9(locale,"total")} <b>{money(data.check.totalMinor,locale)}</b></span>
          <span>{f9(locale,"paid")} <b>{money(data.check.paidMinor,locale)}</b></span>
        </div>
      </div>
      {locked&&<div className="finance-info"><ShieldCheck size={20}/>{f9(locale,"financialGuard")}</div>}
      {error&&<InlineFeedback message={error} retry={()=>void load()} onRetryLabel={f9(locale,"reload")}/>}
      <nav className="finance-detail-tabs" aria-label={f9(locale,"check")}>
        {(["items","split","payments","activity"] as const).map(k=>
         <button key={k} type="button" className={tab===k?"selected":""}
          onClick={()=>setTab(k)} aria-current={tab===k?"page":undefined}>{f9(locale,k)}</button>)}
      </nav>
      {tab==="items"&&<div className="finance-body-grid">
       <section className="settings-card finance-lines">
        <div className="section-heading"><h2>{f9(locale,"items")}</h2>
          <span className="data-badge active">{data.lines.length}</span></div>
        {data.lines.length?data.lines.map(line=><div className="finance-line" key={line.id}>
         <div><strong>{line.quantity} × {titleName(line,locale)}</strong>
           <p>{line.modifierSnapshot.flatMap(g=>g.options.map(o=>
              (locale==="en"?o.nameEn:locale==="ps-AF"?o.namePs:o.nameFa)||o.nameFa)).join(" · ")}</p></div>
         <div className="finance-line-numbers"><b>{money(line.lineTotalMinor,locale)}</b>
           <span className="finance-status">{line.kitchenStatus}</span></div>
        </div>):<div className="empty-panel">{f9(locale,"noItems")}</div>}
       </section>
       <aside className="settings-card finance-math">
        <h2>{f9(locale,"summary")}</h2>
        <div><span>{f9(locale,"subtotal")}</span><b>{money(data.check.subtotalMinor,locale)}</b></div>
        <div><span>{f9(locale,"tax")}{data.check.chargePolicy.taxInclusive?" (incl.)":""}</span>
          <b>{money(data.check.taxMinor,locale)}</b></div>
        <div><span>{f9(locale,"service")}</span><b>{money(data.check.serviceMinor,locale)}</b></div>
        {data.check.discountMinor>0&&<div><span>{f9(locale,"discount")}</span><b>−{money(data.check.discountMinor,locale)}</b></div>}
        <div className="total"><span>{f9(locale,"total")}</span><strong>{money(data.check.totalMinor,locale)}</strong></div>
        <div><span>{f9(locale,"paid")}</span><b>{money(data.check.paidMinor,locale)}</b></div>
        <div className="due"><span>{f9(locale,"due")}</span><strong>{money(data.dueMinor,locale)}</strong></div>
        <button className="button button-primary" type="button" onClick={()=>setTab("payments")}>
          <Banknote size={18}/>{f9(locale,"payment")}</button>
       </aside></div>}
      {tab==="split"&&<section className="settings-card finance-split-panel">
       <div className="section-heading"><div><h2>{f9(locale,"split")}</h2>
         <p>{f9(locale,"splitHelp")}</p></div><Split size={25} color="var(--brand)"/></div>
       <form onSubmit={e=>void splitSave(e)} className="finance-form">
        <div className="finance-split-modes">{(["single","equal","items"] as const).map(k=>
          <label key={k} className={mode===k?"selected":""}>
            <input type="radio" checked={mode===k} value={k} disabled={!canSplit}
              onChange={()=>setMode(k)}/>{f9(locale,k==="items"?"byItems":k)}</label>)}</div>
        {mode!=="single"&&<label className="finance-field"><span>{f9(locale,"splitCount")}</span>
          <select value={parts} disabled={!canSplit} onChange={e=>setParts(Number(e.target.value))}>
             {Array.from({length:9},(_,i)=>i+2).map(n=><option key={n}>{n}</option>)}
          </select></label>}
        {mode==="items"&&<div className="finance-allocation-list">
           <p>{f9(locale,"emptyShare")}</p>
           {data.lines.map(line=><div className="finance-allocation" key={line.id}>
             <strong>{line.quantity} × {titleName(line,locale)} · {money(line.lineTotalMinor,locale)}</strong>
             <div className="finance-alloc-inputs">{Array.from({length:parts},(_,i)=>i+1).map(i=>
              <label key={i}><span>{f9(locale,"share")} {i}</span><input type="number" min={0} max={line.quantity}
                disabled={!canSplit} value={displayedAllocation(line.id,i)}
                onChange={e=>{const n=Math.min(line.quantity,Math.max(0,Number(e.target.value)||0));
                  setAllocation(old=>({...old,[line.id+"|"+i]:n}));}}/></label>)}</div>
           </div>)}</div>}
        <div className="finance-shares-grid">
          {mode==="single"?<div className="finance-share-card"><span>{f9(locale,"single")}</span>
            <strong>{money(data.check.totalMinor,locale)}</strong></div>:
            (mode==="equal"?Array.from({length:parts},(_,i)=>{
               const basic=Math.floor(data.check.totalMinor/parts);
               return i===parts-1?data.check.totalMinor-basic*(parts-1):basic;
            }):Array.from({length:parts},(_,i)=>i+1).map(i=>
               data.lines.reduce((sum,l)=>sum+Math.round(l.unitPriceMinor*displayedAllocation(l.id,i)),0))
            ).map((val,i)=><div className="finance-share-card" key={i}>
              <span>{f9(locale,"share")} {i+1}</span><strong>{money(val,locale)}</strong></div>)}
        </div>
        <p className="finance-muted">{f9(locale,"splitInProgress")}</p>
        <button className="button button-primary" type="submit" disabled={!canSplit||!!busy}>
          <Check size={18}/>{busy==="split"?f9(locale,"processing"):f9(locale,"saveSplit")}</button>
       </form>
      </section>}
      {tab==="payments"&&<div className="finance-body-grid">
       <section className="settings-card finance-payments">
        <div className="section-heading"><h2>{f9(locale,"payments")}</h2>
          <span className="data-badge active">{data.payments.length}</span></div>
        {data.payments.length?data.payments.map(p=><div key={p.id} className="finance-payment-row">
          <div><strong>{f9(locale,p.method)}</strong><span>{isoTime(p.createdAt,locale)}</span></div>
          <div><b>{money(p.amountMinor,locale)}</b><small>{f9(locale,"change")}: {money(p.changeMinor,locale)}</small></div>
         </div>):<div className="empty-panel">{f9(locale,"noPayment")}</div>}
       </section>
       <aside className="settings-card finance-payment-form">
        <h2>{f9(locale,"payment")}</h2>
        {!shiftOpen&&data.check.status==="open"&&<>
          <div className="finance-info"><Clock3 size={19}/>{f9(locale,"noShift")}</div>
          <label className="finance-field"><span>{f9(locale,"float")}</span>
           <input value={float} inputMode="decimal" onChange={e=>setFloat(e.target.value)}/></label>
          <button type="button" className="button button-primary" disabled={!!busy}
           onClick={()=>void openShift()}>{f9(locale,"startShift")}</button>
        </>}
        {shiftOpen&&data.check.status==="open"&&<form className="finance-form" onSubmit={e=>void pay(e)}>
          <label className="finance-field"><span>{f9(locale,"chooseShare")}</span>
            <select value={shareId} onChange={e=>{setShareId(e.target.value);setAmount("");setReceived("");
              setPaymentKey(nextKey());}}>
              {data.shares.map(s=><option key={s.id} value={s.id}>
                 {f9(locale,"share")} {s.shareIndex} · {money(s.amountMinor-s.paidMinor,locale)}</option>)}
            </select></label>
          <label className="finance-field"><span>{f9(locale,"method")}</span>
            <select value={method} onChange={e=>{setMethod(e.target.value as typeof method);
              setPaymentKey(nextKey());}}>
              <option value="cash">{f9(locale,"cash")}</option>
              <option value="manual_transfer">{f9(locale,"manual_transfer")}</option>
            </select></label>
          <label className="finance-field"><span>{f9(locale,"paymentAmount")} (AFN)</span>
            <input required inputMode="decimal" value={amount} placeholder={afnInput(shareDue)}
               onChange={e=>{setAmount(e.target.value);setPaymentKey(nextKey());}}/></label>
          <label className="finance-field"><span>{f9(locale,"cashReceived")} (AFN)</span>
            <input required inputMode="decimal" value={received} placeholder={amount}
              onChange={e=>{setReceived(e.target.value);setPaymentKey(nextKey());}}/></label>
          {method==="cash"?<div className="finance-change">
             <span>{f9(locale,"change")}</span><strong>{money(changeMinor??0,locale)}</strong></div>:
           <><label className="finance-field"><span>{f9(locale,"transferReference")}</span>
              <input required maxLength={100} value={reference} onChange={e=>setReference(e.target.value)}/></label>
              <label className="finance-checkbox"><input type="checkbox" checked={verified}
                 onChange={e=>setVerified(e.target.checked)}/>{f9(locale,"transferConfirm")}</label>
              <p className="finance-muted">{f9(locale,"noAutoGateway")}</p></>}
          <label className="finance-field"><span>{f9(locale,"paymentNote")}</span>
            <textarea rows={2} maxLength={250} value={note} onChange={e=>setNote(e.target.value)}/></label>
          <p className="finance-muted">{f9(locale,"paymentHelp")}</p>
          <button className="button button-primary" type="submit"
             disabled={!canPost||!!busy}><Banknote size={18}/>
             {busy==="payment"?f9(locale,"processing"):f9(locale,"post")}</button>
        </form>}
        {data.check.status==="settled"&&<div className="finance-info"><Check size={19}/>{f9(locale,"settled")}</div>}
       </aside>
      </div>}
      {tab==="activity"&&<section className="settings-card finance-activity-panel">
        <h2>{f9(locale,"activity")}</h2>
        {data.activities.length?data.activities.map(a=><div key={a.id} className="finance-activity">
           <div><strong>{a.action.replaceAll("."," · ")}</strong>
            <small>{isoTime(a.createdAt,locale)}</small></div>
           <span>{a.actorId.slice(0,8)}</span>
          </div>):<div className="empty-panel">{f9(locale,"none")}</div>}
      </section>}
      <section className="settings-card finance-settlement">
        <div><div className="eyebrow">{f9(locale,"readyToClose")}</div><h2>{f9(locale,"settle")}</h2>
          <p>{f9(locale,"settleHelp")}</p></div>
        {data.check.status==="settled"&&data.receipt?<Link className="button button-primary"
          href={base+"/receipts/"+data.receipt.id}><ReceiptText size={18}/>{f9(locale,"viewReceipt")}</Link>:
        <button className="button button-primary" disabled={data.dueMinor!==0||!!busy}
          onClick={()=>void settle()}><FileCheck2 size={18}/>
          {busy==="settle"?f9(locale,"processing"):f9(locale,"settle")}</button>}
      </section>
    </>}
 </div>;
}
