import { Router } from "express";
import { and, asc, count, eq, isNotNull, isNull, sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { db } from "./db";
import { diningSection,diningTable,diningVisit } from "./schema";
import { floorScope, floorRoute, recordId, bodyObject, field, int, bool, version, paging, fail, bump } from "./floor-helpers";

export const sectionRouter=Router();
function fields(input:Record<string,unknown>){
  return {name:field(input.name,40,"Section name",2),
    sortOrder:int(input.sortOrder??0,"Sort order",-9999,9999),
    active:bool(input.active??true,"Active")};
}
sectionRouter.get("/",floorRoute(async(req,res)=>{
  const scope=await floorScope(req),{page,limit,offset}=paging(req);
  const predicate=and(eq(diningSection.tenantId,scope.tenantId),eq(diningSection.locationId,scope.locationId),
    req.query.archive==="1"?isNotNull(diningSection.archivedAt):isNull(diningSection.archivedAt));
  const [rows,totals]=await Promise.all([
    db.select().from(diningSection).where(predicate)
      .orderBy(asc(diningSection.sortOrder),asc(diningSection.name)).limit(limit).offset(offset),
    db.select({n:count()}).from(diningSection).where(predicate)
  ]);
  res.json({items:rows,total:totals[0]?.n??0,page,perPage:limit});
}));
sectionRouter.post("/",floorRoute(async(req,res)=>{
  const scope=await floorScope(req,true),values=fields(bodyObject(req)),id=randomUUID();
  await db.transaction(async tx=>{
    await tx.insert(diningSection).values({...values,id,tenantId:scope.tenantId,locationId:scope.locationId});
    await bump(tx,scope,"floor.section_created",{sectionId:id});
  });
  res.status(201).json({id,created:true});
}));
sectionRouter.patch("/:id",floorRoute(async(req,res)=>{
  const scope=await floorScope(req,true),id=recordId(req.params.id),input=bodyObject(req),v=version(input.version),values=fields(input);
  await db.transaction(async tx=>{
    // Lock section to serialize concurrent category changes and table creation.
    await tx.execute(sql`SELECT id FROM dining_sections WHERE id=${id} AND tenant_id=${scope.tenantId} FOR UPDATE`);
    const [old]=await tx.select().from(diningSection).where(and(eq(diningSection.id,id),
      eq(diningSection.tenantId,scope.tenantId),eq(diningSection.locationId,scope.locationId),isNull(diningSection.archivedAt))).limit(1);
    if(!old)fail(404,"NOT_FOUND","Section unavailable.");
    if(old.version!==v)fail(409,"VERSION_CONFLICT","Section changed on another device.");
    if(!values.active){
      const [busy]=await tx.select({id:diningTable.id}).from(diningTable).where(and(eq(diningTable.sectionId,id),
        eq(diningTable.tenantId,scope.tenantId),isNull(diningTable.archivedAt),eq(diningTable.active,true))).limit(1);
      if(busy)fail(409,"SECTION_IN_USE","Disable or move active tables before disabling this section.");
    }
    const [done]=await tx.update(diningSection).set({...values,version:v+1,updatedAt:new Date()}).where(and(
      eq(diningSection.id,id),eq(diningSection.version,v),eq(diningSection.tenantId,scope.tenantId),
      eq(diningSection.locationId,scope.locationId),isNull(diningSection.archivedAt))).returning({id:diningSection.id});
    if(!done)fail(409,"VERSION_CONFLICT","Section changed. Refresh.");
    await bump(tx,scope,"floor.section_updated",{sectionId:id});
  });
  res.json({saved:true});
}));
sectionRouter.post("/:id/archive",floorRoute(async(req,res)=>{
  const scope=await floorScope(req,true),id=recordId(req.params.id),v=version(bodyObject(req).version);
  await db.transaction(async tx=>{
    await tx.execute(sql`SELECT id FROM dining_sections WHERE id=${id} AND tenant_id=${scope.tenantId} FOR UPDATE`);
    const [section]=await tx.select().from(diningSection).where(and(eq(diningSection.id,id),
      eq(diningSection.tenantId,scope.tenantId),eq(diningSection.locationId,scope.locationId),isNull(diningSection.archivedAt))).limit(1);
    if(!section)fail(404,"NOT_FOUND","Section not found.");
    if(section.version!==v)fail(409,"VERSION_CONFLICT","Section changed.");
    const [used]=await tx.select({id:diningTable.id}).from(diningTable).where(and(eq(diningTable.sectionId,id),
      eq(diningTable.tenantId,scope.tenantId),isNull(diningTable.archivedAt))).limit(1);
    if(used)fail(409,"SECTION_IN_USE","Archive or move the tables in this section first.");
    const [done]=await tx.update(diningSection).set({archivedAt:new Date(),active:false,
      version:v+1,updatedAt:new Date()}).where(and(eq(diningSection.id,id),
      eq(diningSection.tenantId,scope.tenantId),eq(diningSection.locationId,scope.locationId),
      eq(diningSection.version,v),isNull(diningSection.archivedAt))).returning({id:diningSection.id});
    if(!done)fail(409,"VERSION_CONFLICT","Section changed. Refresh.");
    await bump(tx,scope,"floor.section_archived",{sectionId:id});
  });
  res.json({archived:true});
}));
