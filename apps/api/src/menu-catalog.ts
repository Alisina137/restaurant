import { Router } from "express";
import { and, asc, eq, inArray, isNull, sql } from "drizzle-orm";
import { db } from "./db";
import { catalogRevision, menuCategory, menuItem, menuItemGroup,
  menuModifierGroup, menuModifierOption } from "./schema";
import { fail, route, scopeFor } from "./menu-helpers";

export const catalogRouter=Router();
async function currentRevision(locationId:string){
  const [row]=await db.select({version:catalogRevision.version,changedAt:catalogRevision.changedAt})
    .from(catalogRevision).where(eq(catalogRevision.locationId,locationId)).limit(1);
  return row??{version:0,changedAt:null};
}
/** All management counters are filtered by the active tenant and location; no fake totals. */
catalogRouter.get("/summary",route(async(req,res)=>{
  const scope=await scopeFor(req,true),{tenantId:t,locationId:l}=scope;
  const [items,categories,groups]=await Promise.all([
    db.execute(sql`SELECT COUNT(*)::int AS total,
       COUNT(*) FILTER (WHERE published)::int AS published,
       COUNT(*) FILTER (WHERE NOT published)::int AS draft,
       COUNT(*) FILTER (WHERE sold_out)::int AS soldout
      FROM menu_items WHERE tenant_id=${t} AND location_id=${l} AND archived_at IS NULL`),
    db.execute(sql`SELECT COUNT(*)::int AS total,
       COUNT(*) FILTER (WHERE published)::int AS published
      FROM menu_categories WHERE tenant_id=${t} AND location_id=${l} AND archived_at IS NULL`),
    db.execute(sql`SELECT COUNT(*)::int AS total FROM menu_modifier_groups
      WHERE tenant_id=${t} AND location_id=${l} AND archived_at IS NULL`)
  ]);
  const row=(result:typeof items)=>((result as unknown as {rows:Record<string,unknown>[]}).rows[0]??{});
  const countValue=(value:unknown)=>{
    const n=Number(value??0);
    if(!Number.isSafeInteger(n)||n<0)fail(409,"COUNT_LIMIT","Invalid menu counter.");
    return n;
  };
  const i=row(items),c=row(categories),g=row(groups);
  res.setHeader("Cache-Control","private, no-store, max-age=0");
  res.json({items:{total:countValue(i.total),published:countValue(i.published),
    draft:countValue(i.draft),soldOut:countValue(i.soldout)},
    categories:{total:countValue(c.total),published:countValue(c.published)},
    modifierGroups:countValue(g.total),revision:await currentRevision(l)});
}));
catalogRouter.get("/revision",route(async(req,res)=>{
  const scope=await scopeFor(req,false);
  res.setHeader("Cache-Control","no-store");
  res.json(await currentRevision(scope.locationId));
}));
catalogRouter.get("/editor",route(async(req,res)=>{
  const scope=await scopeFor(req,true);
  const [categories,groups]=await Promise.all([
    db.select().from(menuCategory).where(and(eq(menuCategory.tenantId,scope.tenantId),
      eq(menuCategory.locationId,scope.locationId),isNull(menuCategory.archivedAt)))
      .orderBy(asc(menuCategory.sortOrder),asc(menuCategory.nameFa)).limit(300),
    db.select().from(menuModifierGroup).where(and(eq(menuModifierGroup.tenantId,scope.tenantId),
      eq(menuModifierGroup.locationId,scope.locationId),isNull(menuModifierGroup.archivedAt)))
      .orderBy(asc(menuModifierGroup.nameFa)).limit(300)
  ]);
  const options=groups.length?await db.select().from(menuModifierOption)
    .where(inArray(menuModifierOption.groupId,groups.map(x=>x.id))).orderBy(asc(menuModifierOption.sortOrder)):[];
  res.json({categories,groups:groups.map(g=>({...g,options:options.filter(o=>o.groupId===g.id)})),
    revision:await currentRevision(scope.locationId)});
}));
catalogRouter.get("/catalog",route(async(req,res)=>{
  const scope=await scopeFor(req,false);
  const categories=await db.select({id:menuCategory.id,nameFa:menuCategory.nameFa,
    namePs:menuCategory.namePs,nameEn:menuCategory.nameEn,sortOrder:menuCategory.sortOrder})
    .from(menuCategory).where(and(eq(menuCategory.tenantId,scope.tenantId),
      eq(menuCategory.locationId,scope.locationId),eq(menuCategory.published,true),isNull(menuCategory.archivedAt)))
    .orderBy(asc(menuCategory.sortOrder),asc(menuCategory.nameFa));
  const items=categories.length?await db.select({id:menuItem.id,categoryId:menuItem.categoryId,
    nameFa:menuItem.nameFa,namePs:menuItem.namePs,nameEn:menuItem.nameEn,
    description:menuItem.description,allergens:menuItem.allergens,
    priceMinor:menuItem.priceMinor,imageId:menuItem.imageId,
    soldOut:menuItem.soldOut,soldOutReason:menuItem.soldOutReason,
    version:menuItem.version,preparationMinutes:menuItem.preparationMinutes})
    .from(menuItem).where(and(eq(menuItem.tenantId,scope.tenantId),eq(menuItem.locationId,scope.locationId),
      eq(menuItem.published,true),isNull(menuItem.archivedAt),
      inArray(menuItem.categoryId,categories.map(c=>c.id))))
    .orderBy(asc(menuItem.sortOrder),asc(menuItem.nameFa)):[];
  const links=items.length?await db.select().from(menuItemGroup)
    .where(inArray(menuItemGroup.itemId,items.map(i=>i.id))):[];
  const groupIds=Array.from(new Set(links.map(l=>l.groupId)));
  const groups=groupIds.length?await db.select().from(menuModifierGroup)
    .where(and(inArray(menuModifierGroup.id,groupIds),isNull(menuModifierGroup.archivedAt))):[];
  const options=groups.length?await db.select().from(menuModifierOption).where(and(
    inArray(menuModifierOption.groupId,groups.map(g=>g.id)),eq(menuModifierOption.active,true)))
    .orderBy(asc(menuModifierOption.sortOrder)):[];
  res.setHeader("Cache-Control","no-store");
  res.json({currency:"AFN",version:(await currentRevision(scope.locationId)).version,categories,
    items:items.map(i=>({...i,groupIds:links.filter(l=>l.itemId===i.id).map(l=>l.groupId)})),
    groups:groups.map(g=>({id:g.id,nameFa:g.nameFa,namePs:g.namePs,nameEn:g.nameEn,
      selectionMode:g.selectionMode,minSelections:g.minSelections,maxSelections:g.maxSelections,version:g.version,
      options:options.filter(o=>o.groupId===g.id).map(o=>({id:o.id,nameFa:o.nameFa,
        namePs:o.namePs,nameEn:o.nameEn,deltaMinor:o.deltaMinor}))}))});
}));
/** Streaming revision notifications work across multiple API instances via the database, not process memory. */
catalogRouter.get("/events",route(async(req,res)=>{
  const scope=await scopeFor(req,false);
  res.status(200).setHeader("Content-Type","text/event-stream");
  res.setHeader("Cache-Control","no-cache, no-transform");
  res.setHeader("Connection","keep-alive");
  res.flushHeaders();
  let closed=false,busy=false,seen=-1;
  const send=async()=>{
    if(closed||busy)return;
    busy=true;
    try{
      // Reauthorize after session revoke or tenant suspension.
      const next=await scopeFor(req,false);
      if(next.tenantId!==scope.tenantId||next.locationId!==scope.locationId){res.end();closed=true;return;}
      const rev=await currentRevision(scope.locationId);
      if(rev.version!==seen){seen=rev.version;res.write("event: catalog\ndata: "+JSON.stringify(rev)+"\n\n");}
      else res.write(": keepalive\n\n");
    }catch{res.end();closed=true;}
    finally{busy=false;}
  };
  const timer=setInterval(()=>{void send();},4000);
  res.on("close",()=>{closed=true;clearInterval(timer);});
  await send();
}));
