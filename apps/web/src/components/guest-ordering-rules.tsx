"use client";
import {useCallback,useEffect,useState,type FormEvent} from "react";
import Link from "next/link";
import {Check,Settings2,ShieldCheck,RefreshCw,ChefHat,UserRoundCheck,AlertTriangle} from "lucide-react";
import {useWorkspace} from "./workspace-provider";
import {jsonRequest,Phase2Error} from "@/lib/phase2-api";
import {p2} from "@/lib/phase2-copy";
import {sg7} from "@/lib/guest-staff-copy";
type Setting={policy:"waiter_approval"|"direct_to_kitchen";version:number};
export function GuestOrderingRules(){
 const {workspace}=useWorkspace(),locale=workspace.locale,editable=["owner","manager"].includes(workspace.role);
 const [data,setData]=useState<Setting|null>(null),[policy,setPolicy]=useState<Setting["policy"]>("waiter_approval"),
  [busy,setBusy]=useState(false),[loading,setLoading]=useState(true),[error,setError]=useState(""),
  [notice,setNotice]=useState("");
 const load=useCallback(async()=>{
   setLoading(true);setError("");
   try{const result=await jsonRequest<Setting>("/api/guest/staff/policy");
     setData(result);setPolicy(result.policy);}
   catch(e){setError(e instanceof Error?e.message:sg7(locale,"error"));}
   finally{setLoading(false);}
 },[locale]);
 useEffect(()=>{void load();},[load]);
 async function save(e:FormEvent){
   e.preventDefault();if(!editable||!data)return;
   setBusy(true);setError("");setNotice("");
   try{
     const result=await jsonRequest<Setting>("/api/guest/staff/policy",{method:"PATCH",
       body:JSON.stringify({policy,version:data.version})});
     setData(result);setNotice(sg7(locale,"policySaved"));
   }catch(e){setError(e instanceof Phase2Error&&e.code==="VERSION_CONFLICT"?sg7(locale,"stale"):
      e instanceof Error?e.message:sg7(locale,"error"));}
   finally{setBusy(false);}
 }
 return <div className="content-stack">
    <div className="page-heading"><div><div className="eyebrow">{p2(locale,"settings")} / DineFlow</div>
      <h1>{sg7(locale,"rulesTitle")}</h1><p>{sg7(locale,"rulesHelp")}</p></div>
     <Settings2 size={28} color="var(--brand)"/></div>
    <nav className="context-tabs" aria-label={p2(locale,"settings")}>
      <Link href="/app/settings/restaurant" className="context-tab">{p2(locale,"restaurant")}</Link>
      <Link href="/app/settings/localization" className="context-tab">{p2(locale,"localization")}</Link>
      <Link href="/app/settings/security" className="context-tab">{p2(locale,"security")}</Link>
      <Link href="/app/settings/ordering" className="context-tab current" aria-current="page">
        <ChefHat size={18}/>{sg7(locale,"rules")}</Link>
    </nav>
    {!!error&&<div className="form-error" role="alert">{error}
      <button type="button" className="text-link" onClick={()=>void load()}>{sg7(locale,"retry")}</button></div>}
    {!!notice&&<div className="success-banner" role="status"><Check size={19}/>{notice}</div>}
    {loading?<div className="settings-card list-skeleton"><span/><span/><span/></div>:
     data&&<form className="settings-card guest-policy-form" onSubmit={e=>void save(e)}>
       <div className="section-heading"><div><h2>{sg7(locale,"rules")}</h2>
        <p className="muted">{sg7(locale,"guestHint")}</p></div><ShieldCheck size={25} color="var(--brand)"/></div>
       <div className="guest-policy-options">
        <label className={"guest-policy-option"+(policy==="waiter_approval"?" selected":"")}>
          <input type="radio" name="policy" value="waiter_approval" checked={policy==="waiter_approval"}
             disabled={!editable||busy} onChange={()=>setPolicy("waiter_approval")}/>
          <UserRoundCheck size={28}/>
          <div><strong>{sg7(locale,"waiterApproval")}</strong>
            <p>{sg7(locale,"rulesHelp")}</p></div></label>
        <label className={"guest-policy-option"+(policy==="direct_to_kitchen"?" selected":"")}>
          <input type="radio" name="policy" value="direct_to_kitchen" checked={policy==="direct_to_kitchen"}
            disabled={!editable||busy} onChange={()=>setPolicy("direct_to_kitchen")}/>
          <ChefHat size={28}/>
          <div><strong>{sg7(locale,"direct")}</strong>
           <p>{sg7(locale,"directInfo")}</p></div></label>
       </div>
       {policy==="direct_to_kitchen"&&<div className="guest-admin-warning">
         <AlertTriangle size={21}/>{sg7(locale,"policyWarning")}</div>}
       <p className="muted">{sg7(locale,"restricted")}</p>
       <button type="submit" className="button button-primary" disabled={!editable||busy||policy===data.policy}>
         <Check size={19}/>{busy?sg7(locale,"refresh"):sg7(locale,"save")}</button>
     </form>}
 </div>;
}
