"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Building2, ArrowRight, RefreshCw, ShieldCheck, UsersRound } from "lucide-react";
import { useWorkspace } from "@/components/workspace-provider";
import { jsonRequest, type PageResult } from "@/lib/phase2-api";
import { p2 } from "@/lib/phase2-copy";
type Restaurant={id:string;name:string;slug:string;status:string;createdAt:string};
type Detail={restaurant:Restaurant;location:{name:string;city:string}|null;trial:{startedAt:string;expiresAt:string}|null;staffCount:number};
function formatDate(value:string,locale:string){return new Date(value).toLocaleDateString(locale,{month:"short",day:"numeric",year:"numeric"});}
export function PlatformRestaurants({id}:{id?:string}){
  const {workspace}=useWorkspace(),locale=workspace.locale;
  const [items,setItems]=useState<PageResult<Restaurant>|null>(null),[detail,setDetail]=useState<Detail|null>(null),
    [page,setPage]=useState(1),[loading,setLoading]=useState(true),[error,setError]=useState("");
  const load=useCallback(async()=>{
    setLoading(true);setError("");
    try{
      if(id)setDetail(await jsonRequest<Detail>("/api/platform/restaurants/"+encodeURIComponent(id)));
      else setItems(await jsonRequest<PageResult<Restaurant>>("/api/platform/restaurants?page="+page));
    }catch(e){setError(e instanceof Error?e.message:p2(locale,"error"));}
    finally{setLoading(false);}
  },[id,page,locale]);
  useEffect(()=>{void load();},[load]);
  return <div className="content-stack">
    <div className="page-heading"><div><div className="eyebrow">{p2(locale,"platformOverview")} / {p2(locale,"businesses")}</div>
      <h1>{id?detail?.restaurant.name??p2(locale,"details"):p2(locale,"businesses")}</h1>
      <p className="muted">{p2(locale,"operationalDataPrivate")}</p></div>
      <button className="button" aria-label={p2(locale,"refresh")} type="button" onClick={()=>void load()}><RefreshCw size={19}/></button></div>
    {id&&<Link className="text-link" href="/platform/restaurants"><ArrowRight size={17}/>{p2(locale,"backToRestaurants")}</Link>}
    {error&&<div className="form-error" role="alert">{error}<button className="text-link" onClick={()=>void load()}>{p2(locale,"retry")}</button></div>}
    {loading?<section className="settings-card"><div className="list-skeleton"><span/><span/><span/></div></section>:
      id&&detail?<div className="settings-grid">
        <section className="settings-card"><div className="settings-heading"><span className="settings-icon"><Building2 size={24}/></span>
          <div><h2>{detail.restaurant.name}</h2><p><bdi dir="ltr">{detail.restaurant.slug}</bdi></p></div></div>
          <dl className="profile-list"><div><dt>{p2(locale,"status")}</dt><dd>{detail.restaurant.status==="trial"?p2(locale,"trial"):detail.restaurant.status}</dd></div>
            <div><dt>{p2(locale,"createdAt")}</dt><dd>{formatDate(detail.restaurant.createdAt,locale)}</dd></div>
            <div><dt>{p2(locale,"location")}</dt><dd>{detail.location?detail.location.name+", "+detail.location.city:"—"}</dd></div></dl></section>
        <section className="settings-card"><div className="settings-heading"><span className="settings-icon"><UsersRound size={24}/></span>
          <div><h2>{p2(locale,"staffCount")}</h2><p>{detail.staffCount}</p></div></div>
          <dl className="profile-list"><div><dt>{p2(locale,"subscription")}</dt>
            <dd>{detail.restaurant.status==="trial"?p2(locale,"trial"):detail.restaurant.status}</dd></div>
            <div><dt>{p2(locale,"trialEnds")}</dt><dd>{detail.trial?formatDate(detail.trial.expiresAt,locale):"—"}</dd></div></dl>
          <p className="muted">{p2(locale,"planLater")}</p></section>
      </div>:!id&&items?<section className="settings-card">
        <div className="section-heading"><div><h2>{p2(locale,"recentRestaurants")}</h2><p className="muted">{items.total} {p2(locale,"businesses")}</p></div>
          <ShieldCheck size={22} color="var(--brand)"/></div>
        {items.items.length?<div className="table-scroll"><table className="data-table"><thead><tr>
          <th>{p2(locale,"restaurantName")}</th><th>{p2(locale,"status")}</th>
          <th>{p2(locale,"createdAt")}</th><th>{p2(locale,"details")}</th></tr></thead><tbody>
            {items.items.map(item=><tr key={item.id}><td><strong>{item.name}</strong><div className="muted" dir="ltr">{item.slug}</div></td>
              <td><span className={"data-badge "+item.status}>{item.status==="trial"?p2(locale,"trial"):item.status}</span></td>
              <td>{formatDate(item.createdAt,locale)}</td>
              <td><Link className="button button-small" href={"/platform/restaurants/"+item.id}>{p2(locale,"open")}</Link></td></tr>)}
          </tbody></table></div>:<div className="empty-panel"><Building2 size={30}/><h3>{p2(locale,"noRestaurants")}</h3></div>}
        <div className="pager"><button className="button button-small" disabled={page<=1} onClick={()=>setPage(page-1)}>
          {p2(locale,"previous")}</button><span>{p2(locale,"page")} {page} {p2(locale,"of")} {Math.max(1,Math.ceil(items.total/10))}</span>
          <button className="button button-small" disabled={page>=Math.ceil(items.total/10)} onClick={()=>setPage(page+1)}>
            {p2(locale,"next")}</button></div>
      </section>:null}
  </div>;
}
