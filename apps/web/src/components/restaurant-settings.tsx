"use client";
import { type FormEvent, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Building2, Languages, LockKeyhole, Save, Settings2, ShieldCheck, ChefHat, Percent } from "lucide-react";
import { type Locale } from "@dineflow/shared";
import { useWorkspace } from "@/components/workspace-provider";
import { jsonRequest } from "@/lib/phase2-api";
import { p2 } from "@/lib/phase2-copy";
import {sg7} from "@/lib/guest-staff-copy";
import {f9} from "@/lib/finance-copy";
type Tab="restaurant"|"localization"|"security";
type Data={restaurant:{name:string;slug:string;status:string}|null;
  location:{name:string;city:string}|null;setting:{phone:string|null;address:string|null;
  timezone:string;locale:Locale;currency:string;orderingPolicy:string;receiptFooter:string;
  managerCanInvite:boolean;openingHours:Record<string,string>}|null};
type Form={name:string;locationName:string;city:string;phone:string;address:string;timezone:string;
  locale:Locale;receiptFooter:string;managerCanInvite:boolean};
export function RestaurantSettings({tab}:{tab:Tab}){
  const {workspace}=useWorkspace(), locale=workspace.locale, owner=workspace.role==="owner";
  const [data,setData]=useState<Data|null>(null),[form,setForm]=useState<Form|null>(null),
    [loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState(""),[notice,setNotice]=useState("");
  const load=useCallback(async()=>{
    setLoading(true);setError("");
    try{
      const result=await jsonRequest<Data>("/api/tenant/settings");
      setData(result);setForm({name:result.restaurant?.name??"",locationName:result.location?.name??"",
        city:result.location?.city??"",phone:result.setting?.phone??"",address:result.setting?.address??"",
        timezone:result.setting?.timezone??"Asia/Kabul",locale:result.setting?.locale??"fa-AF",
        receiptFooter:result.setting?.receiptFooter??"",managerCanInvite:result.setting?.managerCanInvite??true});
    }catch(e){setError(e instanceof Error?e.message:p2(locale,"error"));}
    finally{setLoading(false);}
  },[locale]);
  useEffect(()=>{void load();},[load]);
  function change<K extends keyof Form>(key:K,value:Form[K]){setForm(prev=>prev?{...prev,[key]:value}:prev);setError("");setNotice("");}
  async function save(e:FormEvent){
    e.preventDefault();if(!form||!owner)return;setBusy(true);setError("");setNotice("");
    try{
      await jsonRequest("/api/tenant/settings",{method:"PATCH",body:JSON.stringify(form)});
      setNotice(p2(locale,"saveSuccess"));await load();
    }catch(e){setError(e instanceof Error?e.message:p2(locale,"error"));}
    finally{setBusy(false);}
  }
  const tabs=[{key:"restaurant",label:"restaurant",icon:Building2},{key:"localization",label:"localization",icon:Languages},
    {key:"security",label:"security",icon:LockKeyhole}] as const;
  return <div className="content-stack">
    <div className="page-heading"><div><div className="eyebrow">{p2(locale,"restaurant")} / {p2(locale,"settings")}</div>
      <h1>{p2(locale,"settings")}</h1><p className="muted">{workspace.tenantName}</p></div><Settings2 size={28} color="var(--brand)"/></div>
    <nav className="context-tabs" aria-label={p2(locale,"settings")}>{tabs.map(({key,label,icon:Icon})=>
      <Link key={key} className={"context-tab"+(key===tab?" current":"")} aria-current={key===tab?"page":undefined}
        href={"/app/settings/"+key}><Icon size={18}/>{p2(locale,label)}</Link>)}
      <Link href="/app/settings/ordering" className="context-tab"><ChefHat size={18}/>{sg7(locale,"rules")}</Link>
      <Link href="/app/settings/charges" className="context-tab"><Percent size={18}/>{f9(locale,"chargeSettings")}</Link></nav>
    {error&&<p className="form-error" role="alert">{error} <button type="button" className="text-link" onClick={()=>void load()}>{p2(locale,"retry")}</button></p>}
    {notice&&<p role="status" className="success-banner"><ShieldCheck size={18}/>{notice}</p>}
    {loading?<section className="settings-card"><div className="list-skeleton"><span/><span/><span/></div></section>:
    form&&data?<form className="settings-card settings-form" onSubmit={e=>void save(e)}>
      {tab==="restaurant"&&<><div className="section-heading"><div><h2>{p2(locale,"restaurant")}</h2>
        <p className="muted"><bdi dir="ltr">{data.restaurant?.slug}</bdi></p></div><Building2 size={26} color="var(--brand)"/></div>
        <div className="form-grid">
          <div className="field"><label htmlFor="setting-name">{p2(locale,"restaurantName")}</label>
            <input id="setting-name" required minLength={2} maxLength={100} value={form.name} disabled={!owner}
              onChange={e=>change("name",e.target.value)}/></div>
          <div className="field"><label htmlFor="setting-branch">{p2(locale,"branchName")}</label>
            <input id="setting-branch" required minLength={2} maxLength={80} value={form.locationName} disabled={!owner}
              onChange={e=>change("locationName",e.target.value)}/></div>
          <div className="field"><label htmlFor="setting-city">{p2(locale,"city")}</label>
            <input id="setting-city" required minLength={2} maxLength={80} value={form.city} disabled={!owner}
              onChange={e=>change("city",e.target.value)}/></div>
          <div className="field"><label htmlFor="setting-phone">{p2(locale,"phone")}</label>
            <input id="setting-phone" maxLength={30} dir="ltr" value={form.phone} disabled={!owner}
              onChange={e=>change("phone",e.target.value)}/></div>
          <div className="field form-span"><label htmlFor="setting-address">{p2(locale,"address")}</label>
            <input id="setting-address" maxLength={200} value={form.address} disabled={!owner}
              onChange={e=>change("address",e.target.value)}/></div>
          <div className="field form-span"><label htmlFor="setting-receipt">{p2(locale,"receiptFooter")}</label>
            <input id="setting-receipt" maxLength={160} value={form.receiptFooter} disabled={!owner}
              onChange={e=>change("receiptFooter",e.target.value)}/></div>
        </div></>}
      {tab==="localization"&&<><div className="section-heading"><div><h2>{p2(locale,"localization")}</h2>
        <p className="muted">{p2(locale,"timezoneTip")}</p></div><Languages size={26} color="var(--brand)"/></div>
        <div className="form-grid">
          <div className="field"><label htmlFor="setting-timezone">{p2(locale,"timeZone")}</label>
            <select id="setting-timezone" value={form.timezone} disabled={!owner} onChange={e=>change("timezone",e.target.value)}>
              <option value="Asia/Kabul">Asia/Kabul (UTC+4:30)</option><option value="Asia/Dubai">Asia/Dubai</option>
              <option value="UTC">UTC</option>{!["Asia/Kabul","Asia/Dubai","UTC"].includes(form.timezone)&&<option value={form.timezone}>{form.timezone}</option>}</select></div>
          <div className="field"><label htmlFor="setting-lang">Language / ژبه / زبان</label>
            <select id="setting-lang" value={form.locale} disabled={!owner} onChange={e=>change("locale",e.target.value as Locale)}>
              <option value="fa-AF">دری</option><option value="ps-AF">پښتو</option><option value="en">English</option></select></div>
          <div className="field"><label htmlFor="setting-currency">{p2(locale,"currency")}</label>
            <input id="setting-currency" dir="ltr" readOnly value={data.setting?.currency??"AFN"}/></div>
        </div></>}
      {tab==="security"&&<><div className="section-heading"><div><h2>{p2(locale,"security")}</h2>
        <p className="muted">{p2(locale,"managerInviteHelp")}</p></div><LockKeyhole size={26} color="var(--brand)"/></div>
        <label className="checkbox-line"><input type="checkbox" disabled={!owner} checked={form.managerCanInvite}
          onChange={e=>change("managerCanInvite",e.target.checked)}/>{p2(locale,"managerInvite")}</label>
        <div className="secure-note"><ShieldCheck size={23}/>
          <p>{p2(locale,"lastOwner")}</p></div>
        <Link href="/app/staff/permissions" className="text-link">{p2(locale,"rolePermissions")}</Link></>}
      {!owner?<p className="muted" role="note">{p2(locale,"onlyOwner")}</p>:
        <div className="section-actions"><span className="muted">{p2(locale,"saveSettings")}</span>
          <button className="button button-primary" type="submit" disabled={busy}><Save size={17}/>{busy?p2(locale,"loading"):p2(locale,"save")}</button></div>}
    </form>:null}
  </div>;
}
