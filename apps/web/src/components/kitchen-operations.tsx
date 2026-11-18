"use client";
import {useCallback,useEffect,useRef,useState,type FormEvent} from "react";
import Link from "next/link";
import {
 BellRing,Check,CheckCircle2,ChefHat,Clock3,History,RefreshCw,Search,
 ShieldAlert,Timer,Truck,UtensilsCrossed,Volume2,VolumeX,X
} from "lucide-react";
import type {Locale} from "@dineflow/shared";
import {useWorkspace} from "./workspace-provider";
import {jsonRequest,Phase2Error} from "@/lib/phase2-api";
import {API_URL} from "@/lib/auth-client";
import {name,amount,type WebDetail,type WebPage} from "@/lib/order-web-types";
import {k6} from "@/lib/kitchen-copy";
import {k27} from "@/lib/kitchen27-copy";
import {k28} from "@/lib/kitchen28-copy";
import {actionOutcome,advanceCursor,cleanUncertain,isTicketState,saveUncertain,validateWatermark,
 type KitchenTicketState,type KitchenWatermark,type KitchenChanges,type UncertainAction} from "@/lib/kitchen28";
import {elapsedMinutes,elapsedLabel,newTicketIds,preparedSummary,priority,validSummary,
 type KitchenOverview,type QueueStatus} from "@/lib/kitchen27";
import {useInteraction} from "./ui/interaction-provider";
import {useDialogFocus} from "./ui/use-dialog-focus";
import {InlineFeedback,PageControls} from "./ui/interaction-controls";
import {EmptyState,LoadingSkeleton,Surface} from "./ui/design-system";
import {ux} from "@/lib/interaction-copy";

type Status=QueueStatus;
type Tab="new"|"preparing"|"ready"|"history";
type HistoryRow={
 id:string;roundId:string;visitId:string;tableId:string;tableLabel:string;
 status:Status;version:number;createdAt:string;startedAt:string|null;readyAt:string|null;
 pickedUpAt:string|null;servedAt:string|null;totalMinor:number;roundNumber:number;source:string;
};
type Page<T>={items:T[];total:number;page:number;perPage:number};
type TicketRow={
 id:string;roundId:string;ticketId:string;ticketVersion:number;tableId:string;tableLabel:string;
 roundNumber:number;status:Status;createdAt:string;totalMinor:number;startedAt:string|null;
 readyAt:string|null;pickedUpAt:string|null;servedAt:string|null;
};
const tabs:Tab[]=["new","preparing","ready","history"];
const links:Record<Tab,string>={new:"/kitchen/live",preparing:"/kitchen/preparing",
 ready:"/kitchen/ready",history:"/kitchen/history"};
function formatDate(value:string|null,locale:Locale){
 if(!value)return "—";
 const date=new Date(value);
 return Number.isNaN(date.getTime())?"—":
  date.toLocaleString(locale,{month:"short",day:"numeric",hour:"2-digit",minute:"2-digit"});
}
function Label({status,locale}:{status:Status;locale:Locale}){
 return <span className={"order-pill "+status}>{k6(locale,status)}</span>;
}
function Details({detail,locale,compact=false}:{detail:WebDetail;locale:Locale;compact?:boolean}){
 const progress=preparedSummary(detail.lines);
 return <div className="k27-lines">
  <div className="k27-progress">
   <span>{k27(locale,"lineProgress")}</span>
   <strong>{progress.ready} / {progress.total}</strong>
  </div>
  <div className="k27-progress-rail" aria-hidden="true">
   <span style={{width:(progress.total?Math.round(progress.ready*100/progress.total):0)+"%"}}/>
  </div>
  <div className="k27-dishes">
   {detail.lines.map(line=><div className="k27-dish" key={line.id}>
    <div className="k27-dish-top">
     <div className="k27-dish-title"><strong className="k27-quantity">{line.quantity}×</strong>
      <strong>{name({nameFa:line.itemNameFa,nameEn:line.itemNameEn,namePs:line.itemNamePs},locale)}</strong>
     </div>
     <span className={"kitchen-line-pill "+line.kitchenStatus}>
      {k6(locale,line.kitchenStatus as Status)}</span>
    </div>
    {!!line.modifierSnapshot.length&&<div className="k27-mods">
     {line.modifierSnapshot.flatMap(group=>group.options.map(option=>
      <span key={group.groupId+option.id}>
       {name(group,locale)}: {name(option,locale)}
      </span>))}
    </div>}
    {!!line.note&&<div className="k27-cook-note">
     <strong>{k27(locale,"itemNotes")}</strong><span>{line.note}</span>
    </div>}
   </div>)}
  </div>
  {!!detail.round.orderNote&&<div className="k27-cook-note k27-round-note">
   <strong>{k27(locale,"orderNotes")}</strong><span>{detail.round.orderNote}</span>
  </div>}
  {!compact&&<div className="kitchen-ticket-total">
   <span>{k6(locale,"total")}</span><strong>{amount(detail.round.totalMinor,locale)}</strong>
  </div>}
 </div>;
}
function DetailModal({id,locale,onClose}:{id:string;locale:Locale;onClose:()=>void}){
 const modalRef=useDialogFocus<HTMLElement>(true,onClose);
 const [detail,setDetail]=useState<WebDetail|null>(null),[error,setError]=useState("");
 const [serverState,setServerState]=useState<KitchenTicketState|null>(null);
 const [retry,setRetry]=useState(0);
 useEffect(()=>{let active=true;setDetail(null);setError("");setServerState(null);
  void jsonRequest<WebDetail>("/api/orders/rounds/"+encodeURIComponent(id))
   .then(async result=>{
    if(active)setDetail(result);
    if(result.ticket){
     const status=await jsonRequest<KitchenTicketState>(
      "/api/orders/kitchen/tickets/"+encodeURIComponent(result.ticket.id)+"/state");
     if(active&&isTicketState(status))setServerState(status);
    }
   }).catch(err=>{if(active)setError(err instanceof Error?err.message:k27(locale,"needsMoreData"));});
  return()=>{active=false;};
 },[id,locale,retry]);
 return <div className="dialog-backdrop kitchen-backdrop" role="presentation"
  onMouseDown={event=>{if(event.target===event.currentTarget)onClose();}}>
  <section ref={modalRef} tabIndex={-1} className="kitchen-dialog k27-detail-dialog"
   role="dialog" aria-modal="true" aria-labelledby="kitchen-ticket-modal-title">
   <div className="kitchen-dialog-head"><div>
    <div className="eyebrow">DINEFLOW / {k6(locale,"ticket")}</div>
    <h2 id="kitchen-ticket-modal-title">{k27(locale,"openDetails")}</h2>
   </div>
    <button type="button" className="icon-action" aria-label={ux(locale,"cancel")} onClick={onClose}>
     <X size={22}/></button>
   </div>
   {!!error&&<InlineFeedback message={error} retry={()=>setRetry(value=>value+1)}
    onRetryLabel={k27(locale,"retry")}/>}
   {detail?<><div className="kitchen-meta-row">
    <strong>{k6(locale,"table")} {detail.ticket?.tableLabel??"—"}</strong>
    <span>#{detail.round.roundNumber}</span>
    <Label status={(detail.ticket?.status??"new") as Status} locale={locale}/>
   </div>
   <Details detail={detail} locale={locale}/>
   <div className="k28-proof" aria-label={k28(locale,"receipt")}>
    <div><strong>{k28(locale,"kitchenHandoff")}</strong>
     <time>{formatDate(detail.ticket?.pickedUpAt??null,locale)}</time></div>
    <div><strong>{k28(locale,"receipt")}</strong>
     <time>{formatDate(detail.ticket?.pickupAcknowledgedAt??null,locale)}</time></div>
    <div><strong>{k28(locale,"waiterAlert")}</strong>
     <span>{!serverState?"—":!serverState.waiterAlertExists?k28(locale,"alertNone"):
      serverState.waiterSeenAt?k28(locale,"alertSeen"):k28(locale,"alertUnread")}</span></div>
    <div><strong>{k6(locale,"served")}</strong>
     <time>{formatDate(detail.ticket?.servedAt??null,locale)}</time></div>
   </div>
   <div className="kitchen-activity"><h3>{k6(locale,"history")}</h3>
    {detail.activity.map(item=><div key={item.id}>
     <span>{item.action.replaceAll("."," · ")}</span>
     <time>{formatDate(item.createdAt,locale)}</time></div>)}
   </div>
   </>:!error&&<LoadingSkeleton rows={3} label={ux(locale,"loading")}/>}
  </section>
 </div>;
}
function TicketCard({row,locale,now,busy,stale,uncertain,onAction,onLine,onView,onVerify}:{
 row:TicketRow;locale:Locale;now:number;busy:boolean;stale:boolean;uncertain:boolean;
 onAction:(row:TicketRow,kind:"start"|"ready"|"handoff"|"notify")=>void;
 onLine:(row:TicketRow,lineId:string)=>void;onView:(id:string)=>void;
 onVerify:(ticketId:string)=>void;
}){
 const [detail,setDetail]=useState<WebDetail|null>(null),[error,setError]=useState("");
 const [retry,setRetry]=useState(0);
 useEffect(()=>{let live=true;setDetail(null);setError("");
  void jsonRequest<WebDetail>("/api/orders/rounds/"+encodeURIComponent(row.roundId))
   .then(result=>{if(live)setDetail(result);})
   .catch(err=>{if(live)setError(err instanceof Error?err.message:k27(locale,"needsMoreData"));});
  return()=>{live=false;};
 },[row.roundId,row.ticketVersion,locale,retry]);
 const status=row.status,ageStart=(status==="ready"||status==="picked_up")?
  (row.readyAt??row.createdAt):row.createdAt;
 const elapsed=elapsedMinutes(ageStart,now);
 const attention=priority(status,row.createdAt,row.readyAt,now)==="attention";
 const canChange=!busy&&!stale&&!uncertain&&!!detail&&!error&&detail.ticket?.version===row.ticketVersion;
 const remaining=detail?.lines.filter(line=>["new","preparing"].includes(line.kitchenStatus))??[];
 return <article className={"kitchen-ticket k27-ticket "+status+(attention?" k27-attention":"")}>
  <header className="kitchen-ticket-top k27-ticket-top">
   <div className="k27-table-identity">
    <span className="k27-ticket-code">{k6(locale,"ticketNumber")}{row.roundNumber}</span>
    <h2>{k6(locale,"table")} <b>{row.tableLabel}</b></h2>
   </div>
   <Label locale={locale} status={status}/>
  </header>
  <div className="k27-ticket-meta">
   <div className="k27-timer" aria-label={k27(locale,"ticketAge")}>
    <Clock3 size={19} aria-hidden="true"/>
    <strong>{elapsedLabel(elapsed)}</strong>
    <span>{status==="ready"||status==="picked_up"?k27(locale,"readySince"):k27(locale,"waiting")}</span>
   </div>
   {attention&&<span className="k27-long-wait"><ShieldAlert size={15}/>{k27(locale,"attentionBadge")}</span>}
   <time>{formatDate(row.createdAt,locale)}</time>
  </div>
  {!!error&&<div className="k27-error">
   <span role="alert">{k27(locale,"needsMoreData")}</span>
   <button type="button" className="button button-small" onClick={()=>setRetry(value=>value+1)}>
    <RefreshCw size={15}/>{k27(locale,"reloadDetails")}</button>
  </div>}
  {detail?<><Details detail={detail} locale={locale} compact/>
   {status==="preparing"&&remaining.length>0&&<div className="k27-line-actions">
    <h3>{k6(locale,"markLineReady")}</h3>
    {remaining.map(line=><button type="button" className="k27-line-action" key={line.id}
     disabled={!canChange} onClick={()=>onLine(row,line.id)}>
     <CheckCircle2 size={18}/>
     <span>{line.quantity}× {name({nameFa:line.itemNameFa,
       nameEn:line.itemNameEn,namePs:line.itemNamePs},locale)}</span>
    </button>)}
   </div>}
  </>:!error&&<div className="list-skeleton" aria-label={ux(locale,"loading")}>
   <span/><span/></div>}
  {["ready","picked_up"].includes(status)&&detail?.ticket&&<div className="k28-handoff">
    <Truck size={17}/>
    <span>{status==="picked_up"?
     detail.ticket.pickupAcknowledgedAt?k28(locale,"receiptConfirmed"):k28(locale,"receiptPending"):
     k28(locale,"alertSent")}</span>
   </div>}
   {uncertain&&<div role="alert" className="k28-uncertain-card">
    <strong>{k28(locale,"uncertain")}</strong>
    <span>{k28(locale,"actionsLocked")}</span>
    <button className="button button-primary" type="button" disabled={busy}
     onClick={()=>onVerify(row.ticketId)}>{busy?k28(locale,"verifying"):k28(locale,"verify")}</button>
   </div>}
  {status==="picked_up"&&<p className="k27-served-hint">
   <Truck size={16}/>{k27(locale,"noMoreHandoff")}</p>}
  <footer className="kitchen-ticket-actions k27-actions">
   <button type="button" className="button button-small k27-details-button"
    onClick={()=>onView(row.roundId)}>{k6(locale,"details")}</button>
   {status==="new"&&<button type="button" className="button button-primary"
    disabled={!canChange} onClick={()=>onAction(row,"start")}>
    <ChefHat size={19}/>{k27(locale,"startWorking")}</button>}
   {status==="preparing"&&remaining.length>0&&<button type="button"
    className="button button-primary" disabled={!canChange} onClick={()=>onAction(row,"ready")}>
    <Check size={19}/>{k27(locale,"markRemaining")}</button>}
   {status==="ready"&&<button type="button" className="button button-primary"
    disabled={!canChange} onClick={()=>onAction(row,"handoff")}>
    <Truck size={19}/>{k6(locale,"markHandoff")}</button>}
   {(status==="ready"||status==="picked_up")&&<button type="button"
    className="button button-small" disabled={!canChange} onClick={()=>onAction(row,"notify")}>
    <BellRing size={17}/>{k6(locale,"notifyAgain")}</button>}
  </footer>
 </article>;
}
export function KitchenOperations({tab}:{tab:Tab}){
 const {workspace}=useWorkspace(),locale=workspace.locale;
 const {confirm,notify}=useInteraction();
 const [page,setPage]=useState(1),[data,setData]=useState<Page<TicketRow>|null>(null);
 const [summary,setSummary]=useState<KitchenOverview|null>(null);
 const [loading,setLoading]=useState(true),[refreshing,setRefreshing]=useState(false);
 const [busyId,setBusyId]=useState(""),[error,setError]=useState(""),[summaryError,setSummaryError]=useState(false);
 const [notice,setNotice]=useState(""),[selected,setSelected]=useState<string|null>(null);
 const [businessZone,setBusinessZone]=useState("Asia/Kabul");
 const [status,setStatus]=useState("all"),[table,setTable]=useState(""),[from,setFrom]=useState(""),[to,setTo]=useState("");
 const [applied,setApplied]=useState({status:"all",table:"",from:"",to:""});
 const [search,setSearch]=useState(""),[appliedSearch,setAppliedSearch]=useState("");
 const [now,setNow]=useState(0),[streamConnected,setStreamConnected]=useState(false);
 const [lastSync,setLastSync]=useState<number|null>(null),[sound,setSound]=useState(false);
 const [soundError,setSoundError]=useState("");
 const [uncertain,setUncertain]=useState<UncertainAction[]>([]);
 const [mutationWarning,setMutationWarning]=useState(""),[verifiedState,setVerifiedState]=useState("");
 const [replayStatus,setReplayStatus]=useState(""),[replaying,setReplaying]=useState(false);
 const scopeKey=workspace.user.id+":"+(workspace.tenantId??"none");
 const uncertainKey="dineflow:kitchen:uncertain:v1:"+scopeKey;
 const soundKey="dineflow:kitchen:sound:v27:"+workspace.user.id+":"+(workspace.tenantId??"none");
 const soundRef=useRef<AudioContext|null>(null),known=useRef<Set<string>>(new Set());
 const hydrated=useRef(false),lastBeep=useRef(0),revision=useRef<number|null>(null);
 const actionLock=useRef(false),requestId=useRef(0),mounted=useRef(true);
 const cursor=useRef<number|null>(null),replayLock=useRef(false),scopeGuard=useRef(scopeKey);
 useEffect(()=>{
  scopeGuard.current=scopeKey;cursor.current=null;revision.current=null;
  setMutationWarning("");setVerifiedState("");setReplayStatus("");
  try{
   const restored=cleanUncertain(JSON.parse(localStorage.getItem(uncertainKey)??"[]"),Date.now());
   setUncertain(restored);
   localStorage.setItem(uncertainKey,JSON.stringify(restored));
  }catch{setUncertain([]);}
 },[uncertainKey,scopeKey]);
 const isHistory=tab==="history";
 const path=isHistory?
  "/api/orders/kitchen/history?page="+page+"&status="+encodeURIComponent(applied.status)+
   (applied.table?"&table="+encodeURIComponent(applied.table):"")+
   (applied.from?"&from="+applied.from:"")+(applied.to?"&to="+applied.to:""):
  "/api/orders/kitchen?status="+tab+"&page="+page+
   (appliedSearch?"&table="+encodeURIComponent(appliedSearch):"");
 useEffect(()=>{if(notice){notify(notice,"success");setNotice("");}},[notice,notify]);
 useEffect(()=>{
  mounted.current=true;setNow(Date.now());
  const clock=setInterval(()=>{if(!document.hidden)setNow(Date.now());},10000);
  return()=>{mounted.current=false;requestId.current++;clearInterval(clock);};
 },[]);
 useEffect(()=>{
  // Consent persists per account, but browser autoplay may require a new gesture.
  // Never display 'Sound on' unless the AudioContext can actually run.
  let active=true;
  const previous=soundRef.current;
  soundRef.current=null;
  if(previous)void previous.close();
  const resume=async()=>{
   let enabled=false;
   try{enabled=localStorage.getItem(soundKey)==="1";}catch{/* storage disabled */}
   if(!enabled||!active){if(active)setSound(false);return;}
   try{
    const context=new AudioContext();
    if(!active){void context.close();return;}
    soundRef.current=context;
    await context.resume();
    if(!active)return;
    if(context.state!=="running")throw new Error("AUDIO_LOCKED");
    setSound(true);
   }catch{
    if(active){setSound(false);setSoundError(k27(locale,"soundBlocked"));}
   }
  };
  void resume();
  return()=>{active=false;void soundRef.current?.close();soundRef.current=null;};
 },[soundKey,locale]);
 const load=useCallback(async(silent=false)=>{
  if(document.hidden)return;
  const sequence=++requestId.current;
  if(!silent)setLoading(true);else setRefreshing(true);
  const results=await Promise.allSettled([
   isHistory?jsonRequest<Page<HistoryRow>&{timezone:string}>(path):jsonRequest<WebPage>(path),
   jsonRequest<KitchenOverview>("/api/orders/kitchen/overview")
  ]);
  if(!mounted.current||sequence!==requestId.current)return;
  const [queue,overview]=results;
  if(queue.status==="fulfilled"){
   if(isHistory){
    const q=queue.value as Page<HistoryRow>&{timezone:string};
    setBusinessZone(q.timezone);setData({items:q.items.map(x=>({
     id:x.roundId,roundId:x.roundId,ticketId:x.id,ticketVersion:x.version,
     tableId:x.tableId,tableLabel:x.tableLabel,roundNumber:x.roundNumber,status:x.status,
     createdAt:x.createdAt,totalMinor:x.totalMinor,startedAt:x.startedAt,readyAt:x.readyAt,
     pickedUpAt:x.pickedUpAt,servedAt:x.servedAt})),total:q.total,page:q.page,perPage:q.perPage});
   }else{
    const q=queue.value as WebPage;
    setData({items:q.items.map(x=>({...x,roundId:x.id,pickedUpAt:null,servedAt:null})),
     total:q.total,page:q.page,perPage:q.perPage});
   }
   setLastSync(Date.now());setError("");
  }else{
   const err=queue.reason;
   if(err instanceof Phase2Error&&err.status===401){
    window.location.assign("/login?expired=1");return;
   }
   if(err instanceof Phase2Error&&err.status===403){
    setData(null);setSummary(null);setError(k27(locale,"roleChanged"));
   }else setError(k27(locale,"refreshFailed"));
  }
  if(overview.status==="fulfilled"&&validSummary(overview.value)){
   setSummary(overview.value);setSummaryError(false);
  }else setSummaryError(true);
  setLoading(false);setRefreshing(false);
 },[isHistory,locale,path]);
 useEffect(()=>{
  // Reset only this query's presentation; never interrupt an accepted mutation.
  requestId.current++;setData(null);setLoading(true);
  known.current.clear();hydrated.current=false;revision.current=null;
  void load();
 },[load]);
 /**
  * Cursor replay is an invalidation feed, not a queue mutation stream.
  * The revision row is locked before event seq allocation server-side, so
  * a committed cursor never skips an earlier uncommitted kitchen event.
  */
 const synchronize=useCallback(async()=>{
  if(document.hidden||replayLock.current)return;
  replayLock.current=true;setReplaying(true);
  const currentScope=scopeKey;
  let more=false;
  try{
   if(cursor.current===null){
    const mark=await jsonRequest<KitchenWatermark>("/api/orders/kitchen/watermark");
    if(!validateWatermark(mark))throw new Error("INVALID_WATERMARK");
    if(scopeGuard.current!==currentScope)return;
    cursor.current=mark.cursor;revision.current=mark.revision;
    // Always load AFTER the watermark; events committed during GET are then
    // either included in this snapshot or picked up in the next replay pass.
    await load(true);
    setReplayStatus("");
   }else{
    let next=cursor.current,changed=false;
    for(let batchNumber=0;batchNumber<8;batchNumber++){
     const batch=await jsonRequest<KitchenChanges>("/api/orders/changes?after="+next);
     const advanced=advanceCursor(next,batch);
     if(advanced===null)throw new Error("INVALID_EVENT_SEQUENCE");
     if(scopeGuard.current!==currentScope)return;
     changed ||=advanced!==next;next=advanced;more=batch.hasMore;
     if(!more)break;
    }
    cursor.current=next;
    if(changed||more)await load(true);
    if(scopeGuard.current===currentScope)
     setReplayStatus(more?k28(locale,"replay"):"");
   }
  }catch(err){
   if(scopeGuard.current!==currentScope)return;
   if(err instanceof Phase2Error&&err.status===401){
    window.location.assign("/login?expired=1");return;
   }
   setReplayStatus(k28(locale,"syncIssue"));
   // Never discard the cursor or pretend failed pages were replayed.
   await load(true);
  }finally{
   replayLock.current=false;if(mounted.current)setReplaying(false);
   if(more&&mounted.current&&scopeGuard.current===currentScope)
    setTimeout(()=>{if(mounted.current&&!document.hidden)void synchronize();},250);
  }
 },[load,locale,scopeKey]);
 useEffect(()=>{
  const source=new EventSource(API_URL+"/api/orders/events",{withCredentials:true});
  source.onopen=()=>{setStreamConnected(true);void synchronize();};
  source.onerror=()=>setStreamConnected(false);
  const onVersion=(event:MessageEvent<string>)=>{
   try{
    const value=JSON.parse(event.data) as {version:unknown};
    if(typeof value.version!=="number"||!Number.isSafeInteger(value.version))return;
    if(revision.current!==null&&revision.current!==value.version&&!document.hidden)
     void synchronize();
    revision.current=value.version;
   }catch{/* Periodic replay is the fallback. */}
  };
  source.addEventListener("orders",onVersion as EventListener);
  void synchronize();
  const interval=setInterval(()=>{if(!document.hidden)void synchronize();},12000);
  const visible=()=>{if(!document.hidden)void synchronize();};
  document.addEventListener("visibilitychange",visible);
  return()=>{source.removeEventListener("orders",onVersion as EventListener);
   source.close();clearInterval(interval);document.removeEventListener("visibilitychange",visible);
  };
 },[synchronize]);
 useEffect(()=>{
  if(tab!=="new"||!data||loading||error)return;
  const current=new Set(data.items.map(item=>item.ticketId));
  const fresh=newTicketIds(known.current,current,hydrated.current);
  known.current=current;hydrated.current=true;
  if(!fresh.length||!sound||!soundRef.current||Date.now()-lastBeep.current<20000)return;
  try{
   const audio=soundRef.current;
   if(audio.state!=="running")return;
   const tone=audio.createOscillator(),gain=audio.createGain();
   tone.type="sine";tone.frequency.value=680;
   gain.gain.setValueAtTime(.12,audio.currentTime);
   gain.gain.exponentialRampToValueAtTime(.001,audio.currentTime+.24);
   tone.connect(gain);gain.connect(audio.destination);
   tone.start();tone.stop(audio.currentTime+.25);
   lastBeep.current=Date.now();
  }catch{/* Audible alerts are strictly optional. */}
 },[data,tab,loading,error,sound]);
 async function toggleSound(){
  const next=!sound;setSoundError("");
  if(next){
   try{
    soundRef.current??=new AudioContext();
    await soundRef.current.resume();
    if(soundRef.current.state!=="running")throw Error("AUDIO_BLOCKED");
   }catch{setSound(false);setSoundError(k27(locale,"soundBlocked"));return;}
  }
  setSound(next);
  try{localStorage.setItem(soundKey,next?"1":"0");}catch{/* Preference remains session-local. */}
 }
 async function action(row:TicketRow,kind:"start"|"ready"|"handoff"|"notify",lineId?:string){
  if(actionLock.current||!!error)return;
  const key=lineId?"confirmLineReady":kind==="handoff"?"confirmHandoff":
   kind==="notify"?"confirmNotify":kind==="start"?"confirmStart":"confirmReady";
  const question=key==="confirmReady"?k27(locale,"confirmReady"):k6(locale,key);
  const allowed=await confirm({title:k6(locale,"ticket")+" #"+row.roundNumber,
   description:question,confirmLabel:ux(locale,"confirm"),cancelLabel:ux(locale,"cancel")});
  if(!allowed||actionLock.current)return;
  actionLock.current=true;setBusyId(row.ticketId);setError("");setNotice("");
  let endpoint="/api/orders/tickets/"+encodeURIComponent(row.ticketId);
  const body:Record<string,unknown>={version:row.ticketVersion};
  if(lineId)endpoint+="/lines/"+encodeURIComponent(lineId)+"/ready";
  else if(kind==="start"||kind==="ready"){
   endpoint+="/transition";body.nextStatus=kind==="start"?"preparing":"ready";
  }else endpoint+="/"+(kind==="handoff"?"handoff":"notify");
  try{
   await jsonRequest(endpoint,{method:"POST",body:JSON.stringify(body)});
   setNotice(k6(locale,kind==="start"?"preparing":kind==="handoff"?"handedOff":
    kind==="notify"?"notifyAgain":"lineReady"));
   await load(true);
  }catch(err){
   setError(err instanceof Phase2Error&&
    ["VERSION_CONFLICT","INVALID_TRANSITION","NOT_READY"].includes(err.code)?
     k27(locale,"updatedInOtherTab"):err instanceof Error?err.message:k6(locale,"error"));
   await load(true);
  }finally{actionLock.current=false;setBusyId("");}
 }
 function applyFilters(event:FormEvent<HTMLFormElement>){
  event.preventDefault();
  if(from&&to&&to<from){setError(k27(locale,"invalidDate"));return;}
  setError("");setApplied({status,table:table.trim(),from,to});setPage(1);
 }
 function applySearch(event:FormEvent<HTMLFormElement>){
  event.preventDefault();
  if(search.trim().length>60){setError(k27(locale,"invalidTable"));return;}
  setError("");setPage(1);setAppliedSearch(search.trim());
 }
 function clearHistory(){
  setStatus("all");setTable("");setFrom("");setTo("");
  setApplied({status:"all",table:"",from:"",to:""});setPage(1);
 }
 const rows=data?.items??[];
 const currentTitle=tab==="history"?"history":tab==="new"?"newTitle":
  tab==="preparing"?"preparingTitle":"readyTitle";
 const currentCount=tab==="new"?summary?.new:tab==="preparing"?summary?.preparing:
  tab==="ready"?summary?.ready:data?.total;
 const allActive=summary?summary.new+summary.preparing+summary.ready:null;
 const isStale=!!error;
 return <div className="content-stack kitchen-console k27-console">
  <div className="k27-hero">
   <div className="k27-hero-main">
    <div className="k27-hero-crest"><ChefHat size={28}/></div>
    <div className="k27-hero-copy">
     <div className="eyebrow">DINEFLOW / KITCHEN OPERATIONS</div>
     <h1>{k27(locale,"board")}</h1>
     <p>{k27(locale,"subtitle")}</p>
     <strong>{workspace.tenantName??"DineFlow"}</strong>
    </div>
   </div>
   <div className="k27-hero-controls">
    <button type="button" className="k27-hero-button" onClick={()=>void load(false)}
     disabled={refreshing||loading} aria-label={k6(locale,"refresh")}>
     <RefreshCw size={19} className={refreshing?"k27-spin":undefined}/>
     <span>{k6(locale,"refresh")}</span>
    </button>
    <button type="button" className="k27-hero-button" aria-pressed={sound}
     title={k27(locale,"soundInfo")} onClick={()=>void toggleSound()}>
     {sound?<Volume2 size={19}/>:<VolumeX size={19}/>}
     <span>{k6(locale,sound?"soundOn":"soundOff")}</span>
    </button>
   </div>
  </div>
  <div className="k27-summary-grid" aria-label={k27(locale,"activeQueue")}>
   {(["new","preparing","ready"] as const).map(value=>{
    const label=value==="new"?"incoming":value==="preparing"?"prepping":"handoff";
    const count=value==="new"?summary?.new:value==="preparing"?summary?.preparing:summary?.ready;
    const oldest=value==="new"?summary?.oldestNewAt:value==="preparing"?
     summary?.oldestPreparingAt:summary?.oldestReadyAt;
    return <Link className={"k27-summary-card k27-summary-"+value+(tab===value?" selected":"")}
     href={links[value]} key={value} aria-current={tab===value?"page":undefined}>
     <div className="k27-summary-head">
      <span>{value==="new"?<BellRing size={20}/>:value==="preparing"?<Timer size={20}/>:<CheckCircle2 size={20}/>}</span>
      <span>{k27(locale,label)}</span>
     </div>
     <div className="k27-summary-count">{summary&&!summaryError?count??0:"—"}</div>
     <small>{k27(locale,"oldest")}: {oldest&&!summaryError?
      elapsedLabel(elapsedMinutes(oldest,now)):"—"}</small>
    </Link>;
   })}
  </div>
  {summary&&summary.waiting15m>0&&<div className="k27-attention-strip">
   <ShieldAlert size={22} aria-hidden="true"/>
   <strong>{summary.waiting15m} · {k27(locale,"attention")}</strong>
   <span>{k27(locale,"attentionHint")}</span>
  </div>}
  <nav className="context-tabs k27-stage-tabs" aria-label={k27(locale,"statusBoard")}>
   {tabs.map(value=><Link key={value} className={"context-tab"+(tab===value?" current":"")}
    href={links[value]} aria-current={tab===value?"page":undefined}>
    {value==="history"?<History size={18}/>:value==="new"?<BellRing size={18}/>:
     value==="preparing"?<ChefHat size={18}/>:<Truck size={18}/>}
    <span>{k6(locale,value)}</span>
   </Link>)}
  </nav>
  <div className="k27-control-strip">
   <div className="k27-sync-state">
    <span className={"k27-sync-dot"+(streamConnected?" connected":"")}/>
    <strong>{k27(locale,streamConnected?"liveStream":"pollOnly")}</strong>
    <small>{k27(locale,"lastChecked")}: {lastSync?
     formatDate(new Date(lastSync).toISOString(),locale):"—"}</small>
   </div>
   <div className="k27-queue-stats">
    <span>{k27(locale,"totalActive")}: <strong>{summary&&!summaryError?allActive:"—"}</strong></span>
    <span>{k27(locale,"ticketCount")}: <strong>{data?.total??"—"}</strong></span>
    {!isHistory&&<span>{k27(locale,"allSorted")}</span>}
   </div>
  </div>
  {!!soundError&&<div role="alert" className="k27-warning">{soundError}</div>}
  {!!error&&<InlineFeedback message={error} retry={()=>void load(false)}
   onRetryLabel={k27(locale,"retry")}/>}
  {summaryError&&<div className="k27-warning" role="status">{k27(locale,"refreshFailed")}</div>}
  {isStale&&data&&<div className="k27-warning" role="status">{k27(locale,"stale")}</div>}
  {!isHistory&&<form className="k27-search" onSubmit={applySearch} role="search">
    <label htmlFor="kitchen-table-search">{k27(locale,"tableSearch")}</label>
    <div className="k27-search-row">
     <Search size={20} aria-hidden="true"/>
     <input id="kitchen-table-search" value={search}
      onChange={event=>setSearch(event.target.value)} maxLength={60}
      placeholder={k27(locale,"tableSearch")}/>
     <button type="submit" className="button button-primary" disabled={!!busyId}>
      {k27(locale,"search")}</button>
     {(search||appliedSearch)&&<button type="button" className="button"
      onClick={()=>{setSearch("");setAppliedSearch("");setPage(1);}}>
      <X size={16}/>{k27(locale,"clearSearch")}</button>}
    </div>
   </form>}
  {isHistory&&<form className="kitchen-history-filters settings-card k27-history-filter"
   onSubmit={applyFilters}>
   <label className="field"><span>{k6(locale,"statusFilter")}</span>
    <select value={status} onChange={event=>setStatus(event.target.value)}>
     {(["all","new","preparing","ready","picked_up","served","voided"] as const).map(value=>
      <option key={value} value={value}>{value==="all"?k6(locale,"allStatus"):k6(locale,value)}</option>)}
    </select></label>
   <label className="field"><span>{k6(locale,"tableFilter")}</span>
    <input value={table} onChange={event=>setTable(event.target.value)} maxLength={100}/></label>
   <label className="field"><span>{k6(locale,"fromDate")}</span>
    <input type="date" value={from} onChange={event=>setFrom(event.target.value)}/></label>
   <label className="field"><span>{k6(locale,"toDate")}</span>
    <input type="date" value={to} onChange={event=>setTo(event.target.value)}/></label>
   <button className="button button-primary" type="submit">{k27(locale,"applyHistory")}</button>
   <button className="button" type="button" onClick={clearHistory}>{k6(locale,"clear")}</button>
   <p className="muted">{k6(locale,"filterHint")} · {businessZone}</p>
  </form>}
  <div className="k27-section-heading">
   <div>
    <div className="eyebrow">{k27(locale,"activeQueue")}</div>
    <h2>{k6(locale,currentTitle)} <span className="k27-heading-count">
     {currentCount??"—"}</span></h2>
   </div>
   {appliedSearch&&!isHistory&&<span className="k27-filter-pill">
    {k27(locale,"tableResults")}: {appliedSearch}</span>}
  </div>
  {loading&&!data?<LoadingSkeleton rows={3} label={ux(locale,"loading")}/>:
   rows.length?isHistory?<div className="settings-card kitchen-history-list k27-history-list">
    <div className="table-scroll"><table className="data-table">
     <thead><tr><th scope="col">{k6(locale,"ticket")}</th>
      <th scope="col">{k6(locale,"table")}</th>
      <th scope="col">{k6(locale,"status")}</th>
      <th scope="col">{k6(locale,"received")}</th>
      <th scope="col">{k6(locale,"duration")}</th>
      <th scope="col">{k6(locale,"actions")}</th></tr></thead>
     <tbody>{rows.map(row=><tr key={row.ticketId}>
      <td><strong>#{row.roundNumber}</strong></td>
      <td><strong>{row.tableLabel}</strong></td>
      <td><Label locale={locale} status={row.status}/></td>
      <td>{formatDate(row.createdAt,locale)}</td>
      <td>{elapsedLabel(elapsedMinutes(row.createdAt,row.readyAt?
       new Date(row.readyAt).getTime():now))}</td>
      <td><button type="button" className="button button-small"
       onClick={()=>setSelected(row.roundId)}>{k6(locale,"details")}</button></td>
     </tr>)}</tbody>
    </table></div>
   </div>:
   <div className="kitchen-ticket-grid k27-ticket-grid">
    {rows.map(row=><TicketCard key={row.ticketId} row={row}
     locale={locale} now={now} busy={!!busyId} stale={!!error}
     onAction={(ticket,kind)=>void action(ticket,kind)}
     onLine={(ticket,lineId)=>void action(ticket,"ready",lineId)}
     onView={setSelected}/>)}
   </div>:
   !error?<Surface><EmptyState icon={<UtensilsCrossed size={33}/>}
    title={k6(locale,isHistory?"noHistory":"empty")}/></Surface>:null}
  {!!data&&<PageControls page={page} total={data.total} perPage={data.perPage}
   onPageChange={setPage} previousLabel={k6(locale,"newer")}
   nextLabel={k6(locale,"older")} pageLabel={ux(locale,"page")}
   ofLabel={ux(locale,"of")} busy={loading||!!busyId}/>}
  {tab==="ready"&&<p className="k27-footnote">{k6(locale,"handoffNote")} {k6(locale,"servedNote")}</p>}
  {tab==="history"&&<p className="k27-footnote">{k27(locale,"historyHint")}</p>}
  {selected&&<DetailModal locale={locale} id={selected} onClose={()=>setSelected(null)}/>}
 </div>;
}
