"use client";
import Link from "next/link";
import {ArrowRight,CheckCircle2,Layers3,PackageX,PenLine,RefreshCw,ShieldCheck,UtensilsCrossed} from "lucide-react";
import type {Locale} from "@dineflow/shared";
import {m20} from "@/lib/menu20-copy";
import {LoadingSkeleton} from "./ui/design-system";

export type MenuSummary={
 items:{total:number;published:number;draft:number;soldOut:number};
 categories:{total:number;published:number};
 modifierGroups:number;
 revision:{version:number;changedAt?:string|null};
};

export function MenuHealth({locale,summary,loading,refresh}:{
 locale:Locale;summary:MenuSummary|null;loading:boolean;refresh:()=>void;
}){
 const ready=!!summary&&summary.categories.published>0&&summary.items.published>0;
 const cards=summary?[
  {key:"total" as const,value:summary.items.total,icon:UtensilsCrossed,href:"/app/menu/items"},
  {key:"publishedItems" as const,value:summary.items.published,icon:CheckCircle2,href:"/app/menu/items"},
  {key:"draftItems" as const,value:summary.items.draft,icon:PenLine,href:"/app/menu/items"},
  {key:"soldOutItems" as const,value:summary.items.soldOut,icon:PackageX,href:"/app/menu/availability"},
  {key:"categoryReady" as const,value:summary.categories.published,icon:Layers3,href:"/app/menu/categories"}
 ]:[];

 return <section className="p20-health" aria-labelledby="p20-health-heading">
  <div className="p20-health-top">
   <div><span className="eyebrow">DINEFLOW / MENU</span>
    <h2 id="p20-health-heading">{m20(locale,"overview")}</h2>
    <p>{m20(locale,"overviewHint")}</p></div>
   <button className="button button-small" type="button" onClick={refresh} disabled={loading}
     aria-label={m20(locale,"refreshCatalog")}><RefreshCw size={17}/>{m20(locale,"refreshCatalog")}</button>
  </div>
  {loading&&!summary?<LoadingSkeleton rows={2} label={m20(locale,"overview")}/>:
   summary?<div className="p20-health-cards">{cards.map(({key,value,icon:Icon,href})=>
    <Link className="p20-health-card" key={key} href={href}>
     <span className="p20-health-icon"><Icon size={19}/></span>
     <div><span>{m20(locale,key)}</span><strong>{new Intl.NumberFormat(locale).format(value)}</strong></div>
     <ArrowRight size={15} className="p20-health-arrow" aria-hidden="true"/>
    </Link>)}</div>:null}
  {summary&&<div className={"p20-readiness"+(ready?" is-ready":"")}>
   <ShieldCheck size={22} aria-hidden="true"/>
   <div><strong>{m20(locale,ready?"catalogReady":"requiresSetup")}</strong>
    <p>{ready?m20(locale,"readyForOrders"):
      summary.categories.published===0?m20(locale,"publishCategoryFirst"):m20(locale,"publishItemNext")}</p></div>
   <Link href={ready?"/app/menu/availability":summary.categories.published===0?
     "/app/menu/categories":"/app/menu/items"}>
    {m20(locale,ready?"inventory":summary.categories.published===0?"stepCategory":"stepItems")}
    <ArrowRight size={16}/></Link>
  </div>}
 </section>;
}
