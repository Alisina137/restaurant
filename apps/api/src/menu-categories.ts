import { Router } from "express";
import { and, asc, count, eq, isNotNull, isNull } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { db } from "./db";
import { menuCategory, menuItem } from "./schema";
import { bodyObject, bool, changed, fail, field, int, labelFields, paging, paramId, route, scopeFor, version } from "./menu-helpers";

export const categoryRouter = Router();
categoryRouter.get("/", route(async (req, res) => {
  const scope = await scopeFor(req,true), { page, limit, offset } = paging(req);
  const archive = req.query.archive === "1";
  const predicate = and(eq(menuCategory.tenantId,scope.tenantId), eq(menuCategory.locationId,scope.locationId),
    archive ? isNotNull(menuCategory.archivedAt) : isNull(menuCategory.archivedAt));
  const [items,total] = await Promise.all([
    db.select().from(menuCategory).where(predicate).orderBy(asc(menuCategory.sortOrder),asc(menuCategory.nameFa)).limit(limit).offset(offset),
    db.select({ n: count() }).from(menuCategory).where(predicate)
  ]);
  res.json({ items, total: total[0]?.n??0, page, perPage:limit });
}));
function parseCategory(value: Record<string,unknown>) {
  return { ...labelFields(value), description:field(value.description??"",500,"Description"),
    sortOrder:int(value.sortOrder??0,"sort order",-9999,9999),
    published:bool(value.published??false,"published") };
}
categoryRouter.post("/", route(async (req,res) => {
  const scope = await scopeFor(req,true), input=parseCategory(bodyObject(req));
  const id=randomUUID();
  await db.transaction(async tx=>{
    await tx.insert(menuCategory).values({id,tenantId:scope.tenantId,locationId:scope.locationId,...input});
    await changed(tx,scope,"menu.category_created",{categoryId:id});
  });
  res.status(201).json({ id, created:true });
}));
categoryRouter.patch("/:id", route(async(req,res)=>{
  const scope=await scopeFor(req,true), id=paramId(req);
  const x=bodyObject(req), input=parseCategory(x), v=version(x.version);
  await db.transaction(async tx=>{
    const [old]=await tx.select().from(menuCategory).where(and(eq(menuCategory.id,id),
      eq(menuCategory.tenantId,scope.tenantId),eq(menuCategory.locationId,scope.locationId),isNull(menuCategory.archivedAt))).limit(1);
    if(!old)fail(404,"NOT_FOUND","Category not found.");
    if(old.version!==v)fail(409,"VERSION_CONFLICT","Category was edited elsewhere. Reload before saving.");
    if(!input.published && old.published){
      const [published]=await tx.select({ id:menuItem.id }).from(menuItem)
        .where(and(eq(menuItem.tenantId,scope.tenantId),eq(menuItem.categoryId,id),eq(menuItem.published,true),isNull(menuItem.archivedAt))).limit(1);
      if(published)fail(409,"CATEGORY_IN_USE","Unpublish the meals in this category first.");
    }
    const [updated]=await tx.update(menuCategory).set({...input,version:v+1,updatedAt:new Date()})
      .where(and(eq(menuCategory.id,id),eq(menuCategory.tenantId,scope.tenantId),
        eq(menuCategory.locationId,scope.locationId),eq(menuCategory.version,v),isNull(menuCategory.archivedAt))).returning({id:menuCategory.id});
    if(!updated)fail(409,"VERSION_CONFLICT","Reload the category.");
    await changed(tx,scope,"menu.category_updated",{categoryId:id});
  });
  res.json({saved:true});
}));
categoryRouter.post("/:id/archive",route(async(req,res)=>{
  const scope=await scopeFor(req,true),id=paramId(req),v=version(bodyObject(req).version);
  await db.transaction(async tx=>{
    const [category]=await tx.select().from(menuCategory).where(and(eq(menuCategory.id,id),
      eq(menuCategory.tenantId,scope.tenantId),eq(menuCategory.locationId,scope.locationId),isNull(menuCategory.archivedAt))).limit(1);
    if(!category)fail(404,"NOT_FOUND","Category not found.");
    if(category.version!==v)fail(409,"VERSION_CONFLICT","Category changed. Reload before archiving.");
    const [item]=await tx.select({ id:menuItem.id }).from(menuItem).where(and(
      eq(menuItem.tenantId,scope.tenantId),eq(menuItem.locationId,scope.locationId),
      eq(menuItem.categoryId,id),isNull(menuItem.archivedAt))).limit(1);
    if(item)fail(409,"CATEGORY_IN_USE","Move or archive meals before archiving their category.");
    const [done]=await tx.update(menuCategory).set({archivedAt:new Date(),published:false,version:v+1,updatedAt:new Date()})
      .where(and(eq(menuCategory.id,id),eq(menuCategory.version,v),
        eq(menuCategory.tenantId,scope.tenantId),eq(menuCategory.locationId,scope.locationId),isNull(menuCategory.archivedAt)))
      .returning({id:menuCategory.id});
    if(!done)fail(409,"VERSION_CONFLICT","Category changed. Reload.");
    await changed(tx,scope,"menu.category_archived",{categoryId:id});
  });
  res.json({ archived:true });
}));
