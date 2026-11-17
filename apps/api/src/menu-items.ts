import { Router } from "express";
import { and, asc, count, desc, eq, ilike, inArray, isNotNull, isNull, or, sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { db } from "./db";
import { menuCategory, menuImage, menuItem, menuItemGroup, menuModifierGroup, menuModifierOption } from "./schema";
import { bodyObject, bool, changed, fail, field, int, paging, paramId, route, scopeFor, version, type MenuScope } from "./menu-helpers";

export const itemRouter=Router();
const allowedAllergens=["milk","eggs","fish","shellfish","tree-nuts","peanuts","wheat","soy","sesame"] as const;
type MenuInput = {
 categoryId:string;nameFa:string;namePs:string;nameEn:string;description:string;sku:string|null;
 priceMinor:number;imageId:string|null;allergens:string[];preparationMinutes:number|null;
 sortOrder:number;published:boolean;groupIds:string[];
};
function parseItem(x:Record<string,unknown>):MenuInput {
  const nameFa=field(x.nameFa,100,"Dari meal name",2);
  const namePs=field(x.namePs??"",100,"Pashto name");
  const nameEn=field(x.nameEn??"",100,"English name");
  const description=field(x.description??"",500,"Description");
  const skuValue=field(x.sku??"",50,"SKU");
  if(skuValue && !/^[a-zA-Z0-9_-]{2,50}$/.test(skuValue))
    fail(400,"INVALID_SKU","SKU must use 2–50 letters, numbers, underscores or hyphens.");
  const rawImage=x.imageId;
  const imageId=rawImage===null||rawImage===""||rawImage===undefined ? null : field(rawImage,100,"Image ID",1);
  const allergens=x.allergens??[];
  if(!Array.isArray(allergens)||allergens.length>9||allergens.some(a=>typeof a!=="string"||!allowedAllergens.includes(a as typeof allowedAllergens[number]))||
    new Set(allergens).size!==allergens.length)fail(400,"INVALID_ALLERGENS","Use only known allergen values.");
  const groupIds=x.groupIds??[];
  if(!Array.isArray(groupIds)||groupIds.length>12||groupIds.some(g=>typeof g!=="string"||g.length>100||g.length<1)||
     new Set(groupIds).size!==groupIds.length)fail(400,"INVALID_MODIFIER","Select valid unique modifier groups.");
  const preparationMinutes=x.preparationMinutes===null||x.preparationMinutes===""||x.preparationMinutes===undefined ?
    null:int(x.preparationMinutes,"Preparation minutes",1,240);
  return {
    categoryId:field(x.categoryId,100,"Category ID",1),nameFa,namePs,nameEn,description,
    sku:skuValue||null,priceMinor:int(x.priceMinor,"Base price",0,1_000_000_000),
    imageId,allergens:allergens as string[],preparationMinutes,
    sortOrder:int(x.sortOrder??0,"Sort order",-9999,9999),published:bool(x.published??false,"Published"),groupIds:groupIds as string[]
  };
}
// Called inside the same transaction as writes; foreign keys never come from an untrusted client tenant ID.
async function validateRelations(tx: typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0], scope:MenuScope, data:MenuInput) {
  const [category]=await tx.select().from(menuCategory).where(and(eq(menuCategory.id,data.categoryId),
    eq(menuCategory.tenantId,scope.tenantId),eq(menuCategory.locationId,scope.locationId),isNull(menuCategory.archivedAt))).limit(1);
  if(!category)fail(400,"INVALID_CATEGORY","Choose a category from this restaurant.");
  if(data.published&&!category.published)fail(409,"CATEGORY_UNPUBLISHED","Publish the category before publishing its meals.");
  if(data.imageId){
    const [picture]=await tx.select({id:menuImage.id}).from(menuImage).where(and(
      eq(menuImage.id,data.imageId),eq(menuImage.tenantId,scope.tenantId),eq(menuImage.locationId,scope.locationId))).limit(1);
    if(!picture)fail(400,"INVALID_IMAGE","Choose a picture uploaded to this restaurant.");
  }
  if(data.groupIds.length){
    const groups=await tx.select().from(menuModifierGroup).where(and(inArray(menuModifierGroup.id,data.groupIds),
      eq(menuModifierGroup.tenantId,scope.tenantId),eq(menuModifierGroup.locationId,scope.locationId),
      isNull(menuModifierGroup.archivedAt)));
    if(groups.length!==data.groupIds.length)fail(400,"INVALID_MODIFIER","One or more modifier groups are unavailable.");
    const opts=await tx.select().from(menuModifierOption).where(inArray(menuModifierOption.groupId,data.groupIds));
    for(const group of groups){
      const active=opts.filter(o=>o.groupId===group.id&&o.active).length;
      if(active<group.minSelections||active<group.maxSelections)
        fail(409,"INVALID_MODIFIER","Modifier group has too few active choices to publish.");
    }
  }
}
async function groupLinks(items:{id:string}[]) {
  if(!items.length)return [] as {itemId:string;groupId:string}[];
  return db.select().from(menuItemGroup).where(inArray(menuItemGroup.itemId,items.map(x=>x.id)));
}
function listFilter(scope:MenuScope,req:import("express").Request) {
  const status=typeof req.query.status==="string"?req.query.status:"all";
  const cat=typeof req.query.category==="string"?req.query.category:"";
  const q=typeof req.query.q==="string"?req.query.q.trim().slice(0,80):"";
  return and(eq(menuItem.tenantId,scope.tenantId),eq(menuItem.locationId,scope.locationId),
    req.query.archive==="1"?isNotNull(menuItem.archivedAt):isNull(menuItem.archivedAt),
    status==="published"?eq(menuItem.published,true):status==="draft"?eq(menuItem.published,false):
      status==="soldout"?eq(menuItem.soldOut,true):undefined,
    cat?eq(menuItem.categoryId,cat):undefined,
    q?or(ilike(menuItem.nameFa,"%"+q+"%"),ilike(menuItem.nameEn,"%"+q+"%"),
      ilike(menuItem.namePs,"%"+q+"%"),ilike(menuItem.sku,"%"+q+"%")):undefined);
}
itemRouter.get("/",route(async(req,res)=>{
  const scope=await scopeFor(req,true),{page,limit,offset}=paging(req),where=listFilter(scope,req);
  const [items,totals]=await Promise.all([
    db.select({id:menuItem.id,categoryId:menuItem.categoryId,categoryName:menuCategory.nameFa,
      nameFa:menuItem.nameFa,namePs:menuItem.namePs,nameEn:menuItem.nameEn,
      description:menuItem.description,sku:menuItem.sku,priceMinor:menuItem.priceMinor,imageId:menuItem.imageId,
      published:menuItem.published,soldOut:menuItem.soldOut,soldOutReason:menuItem.soldOutReason,
      version:menuItem.version,createdAt:menuItem.createdAt,updatedAt:menuItem.updatedAt})
      .from(menuItem).innerJoin(menuCategory,eq(menuItem.categoryId,menuCategory.id)).where(where)
      .orderBy(asc(menuItem.sortOrder),desc(menuItem.createdAt)).limit(limit).offset(offset),
    db.select({n:count()}).from(menuItem).where(where)
  ]);
  res.json({items,total:totals[0]?.n??0,page,perPage:limit});
}));
itemRouter.get("/:id",route(async(req,res)=>{
  const scope=await scopeFor(req,true),id=paramId(req);
  const [item]=await db.select().from(menuItem).where(and(eq(menuItem.id,id),
    eq(menuItem.tenantId,scope.tenantId),eq(menuItem.locationId,scope.locationId))).limit(1);
  if(!item)fail(404,"NOT_FOUND","Meal not found.");
  const links=await db.select({groupId:menuItemGroup.groupId}).from(menuItemGroup).where(eq(menuItemGroup.itemId,id));
  res.json({item:{...item,groupIds:links.map(l=>l.groupId)}});
}));
itemRouter.post("/",route(async(req,res)=>{
  const scope=await scopeFor(req,true),data=parseItem(bodyObject(req)),id=randomUUID();
  await db.transaction(async tx=>{
    await validateRelations(tx,scope,data);
    const {groupIds,...fields}=data;
    await tx.insert(menuItem).values({id,tenantId:scope.tenantId,locationId:scope.locationId,...fields});
    for(const groupId of groupIds)await tx.insert(menuItemGroup).values({itemId:id,groupId});
    await changed(tx,scope,"menu.item_created",{itemId:id,published:data.published});
  });
  res.status(201).json({id,created:true});
}));
itemRouter.patch("/:id",route(async(req,res)=>{
  const scope=await scopeFor(req,true),id=paramId(req),x=bodyObject(req),v=version(x.version),data=parseItem(x);
  await db.transaction(async tx=>{
    const [old]=await tx.select().from(menuItem).where(and(eq(menuItem.id,id),eq(menuItem.tenantId,scope.tenantId),
      eq(menuItem.locationId,scope.locationId),isNull(menuItem.archivedAt))).limit(1);
    if(!old)fail(404,"NOT_FOUND","Meal not found.");
    if(old.version!==v)fail(409,"VERSION_CONFLICT","Meal was edited by someone else. Reload before saving.");
    await validateRelations(tx,scope,data);
    const {groupIds,...fields}=data;
    const [updated]=await tx.update(menuItem).set({...fields,version:v+1,updatedAt:new Date()})
      .where(and(eq(menuItem.id,id),eq(menuItem.tenantId,scope.tenantId),eq(menuItem.locationId,scope.locationId),
        eq(menuItem.version,v),isNull(menuItem.archivedAt))).returning({id:menuItem.id});
    if(!updated)fail(409,"VERSION_CONFLICT","Reload the meal.");
    await tx.delete(menuItemGroup).where(eq(menuItemGroup.itemId,id));
    for(const groupId of groupIds)await tx.insert(menuItemGroup).values({itemId:id,groupId});
    await changed(tx,scope,"menu.item_updated",{itemId:id,priceFrom:old.priceMinor,priceTo:data.priceMinor,
      publishedFrom:old.published,publishedTo:data.published});
  });
  res.json({saved:true});
}));
/** Fast publish/unpublish, with the SAME category/modifier validation and version gate as the editor. */
itemRouter.patch("/:id/publication",route(async(req,res)=>{
  const scope=await scopeFor(req,true),id=paramId(req),body=bodyObject(req);
  const target=bool(body.published,"Published"),v=version(body.version);
  await db.transaction(async tx=>{
    const [item]=await tx.select().from(menuItem).where(and(eq(menuItem.id,id),
      eq(menuItem.tenantId,scope.tenantId),eq(menuItem.locationId,scope.locationId),
      isNull(menuItem.archivedAt))).limit(1);
    if(!item)fail(404,"NOT_FOUND","Meal not found.");
    if(item.version!==v)fail(409,"VERSION_CONFLICT","Meal changed. Reload before publishing.");
    if(item.published===target){
      // A matching version is an idempotent no-op. Avoid misleading revision and audit noise.
      return;
    }
    const links=await tx.select({groupId:menuItemGroup.groupId}).from(menuItemGroup)
      .where(eq(menuItemGroup.itemId,id));
    if(target){
      const data=parseItem({...item,published:true,groupIds:links.map(x=>x.groupId)});
      await validateRelations(tx,scope,data);
    }
    const [saved]=await tx.update(menuItem).set({published:target,version:v+1,updatedAt:new Date()})
      .where(and(eq(menuItem.id,id),eq(menuItem.tenantId,scope.tenantId),
        eq(menuItem.locationId,scope.locationId),eq(menuItem.version,v),isNull(menuItem.archivedAt)))
      .returning({id:menuItem.id});
    if(!saved)fail(409,"VERSION_CONFLICT","Meal changed while publishing.");
    await changed(tx,scope,"menu.item_publication_changed",{itemId:id,from:item.published,to:target});
  });
  res.json({saved:true,published:target});
}));

itemRouter.post("/:id/duplicate",route(async(req,res)=>{
  const scope=await scopeFor(req,true),id=paramId(req),copyId=randomUUID();
  await db.transaction(async tx=>{
    const [source]=await tx.select().from(menuItem).where(and(eq(menuItem.id,id),
      eq(menuItem.tenantId,scope.tenantId),eq(menuItem.locationId,scope.locationId),isNull(menuItem.archivedAt))).limit(1);
    if(!source)fail(404,"NOT_FOUND","Original meal not found.");
    await tx.insert(menuItem).values({id:copyId,tenantId:scope.tenantId,locationId:scope.locationId,
      categoryId:source.categoryId,nameFa:(source.nameFa.slice(0,90)+" (کاپی)"),
      namePs:source.namePs,nameEn:source.nameEn,description:source.description,sku:null,
      priceMinor:source.priceMinor,imageId:source.imageId,allergens:source.allergens,
      preparationMinutes:source.preparationMinutes,sortOrder:source.sortOrder,published:false});
    const links=await tx.select().from(menuItemGroup).where(eq(menuItemGroup.itemId,id));
    for(const l of links)await tx.insert(menuItemGroup).values({itemId:copyId,groupId:l.groupId});
    await changed(tx,scope,"menu.item_duplicated",{itemId:copyId,originalId:id});
  });
  res.status(201).json({id:copyId,created:true});
}));
itemRouter.post("/:id/archive",route(async(req,res)=>{
  const scope=await scopeFor(req,true),id=paramId(req),v=version(bodyObject(req).version);
  await db.transaction(async tx=>{
    const [old]=await tx.select().from(menuItem).where(and(eq(menuItem.id,id),
      eq(menuItem.tenantId,scope.tenantId),eq(menuItem.locationId,scope.locationId),isNull(menuItem.archivedAt))).limit(1);
    if(!old)fail(404,"NOT_FOUND","Meal not found.");
    if(old.version!==v)fail(409,"VERSION_CONFLICT","Meal changed. Reload.");
    const [changedRow]=await tx.update(menuItem).set({archivedAt:new Date(),published:false,
      version:v+1,updatedAt:new Date()}).where(and(eq(menuItem.id,id),eq(menuItem.version,v),
        eq(menuItem.tenantId,scope.tenantId),eq(menuItem.locationId,scope.locationId),isNull(menuItem.archivedAt)))
      .returning({id:menuItem.id});
    if(!changedRow)fail(409,"VERSION_CONFLICT","Meal changed. Reload.");
    await changed(tx,scope,"menu.item_archived",{itemId:id});
  });
  res.json({archived:true});
}));
itemRouter.post("/availability/bulk",route(async(req,res)=>{
  const scope=await scopeFor(req,true),payload=bodyObject(req);
  if(!Array.isArray(payload.changes)||payload.changes.length<1||payload.changes.length>50)
    fail(400,"INVALID_AVAILABILITY","Choose 1–50 meals.");
  const changes=(payload.changes as unknown[]).map(value=>{
    if(!value||typeof value!=="object"||Array.isArray(value))return fail(400,"INVALID_AVAILABILITY","Invalid change.");
    const x=value as Record<string,unknown>;
    return {id:field(x.id,100,"Meal ID",1),version:version(x.version),soldOut:bool(x.soldOut,"Sold out"),
      reason:field(x.reason??"",120,"Sold-out reason")};
  });
  if(new Set(changes.map(c=>c.id)).size!==changes.length)fail(400,"INVALID_AVAILABILITY","Each meal can appear once.");
  await db.transaction(async tx=>{
    for(const entry of changes){
      const [updated]=await tx.update(menuItem).set({soldOut:entry.soldOut,
        soldOutReason:entry.soldOut?entry.reason:"",version:entry.version+1,updatedAt:new Date()})
        .where(and(eq(menuItem.id,entry.id),eq(menuItem.tenantId,scope.tenantId),
          eq(menuItem.locationId,scope.locationId),eq(menuItem.version,entry.version),isNull(menuItem.archivedAt)))
        .returning({id:menuItem.id});
      if(!updated) {
        const [found]=await tx.select({id:menuItem.id}).from(menuItem).where(and(eq(menuItem.id,entry.id),
          eq(menuItem.tenantId,scope.tenantId),eq(menuItem.locationId,scope.locationId),isNull(menuItem.archivedAt))).limit(1);
        if(!found)fail(404,"NOT_FOUND","A meal is unavailable.");
        fail(409,"VERSION_CONFLICT","Availability was changed elsewhere. Refresh and retry.");
      }
    }
    await changed(tx,scope,"menu.availability_updated",{items:changes.map(c=>({id:c.id,soldOut:c.soldOut}))});
  });
  res.json({updated:changes.length});
}));
