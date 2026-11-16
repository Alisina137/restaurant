import { Router } from "express";
import { and, asc, count, eq, inArray, isNotNull, isNull } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { db } from "./db";
import { menuItem, menuItemGroup, menuModifierGroup, menuModifierOption } from "./schema";
import { bodyObject, bool, changed, fail, field, int, isRecord, labelFields, paging, paramId, route, scopeFor, version } from "./menu-helpers";

export const groupRouter=Router();
type OptionInput={id?:string;nameFa:string;namePs:string;nameEn:string;deltaMinor:number;active:boolean;sortOrder:number};
function parseGroup(obj:Record<string,unknown>){
  const selectionMode=obj.selectionMode==="single"?"single":obj.selectionMode==="multiple"?"multiple":fail(400,"INVALID_GROUP","Choose single or multiple selection.");
  const minSelections=int(obj.minSelections,"minimum",0,10);
  const maxSelections=int(obj.maxSelections,"maximum",0,10);
  if(minSelections>maxSelections || (selectionMode==="single"&&maxSelections>1)) fail(400,"INVALID_MODIFIER","Minimum/maximum selections contradict the selection mode.");
  if(!Array.isArray(obj.options) || obj.options.length<1 || obj.options.length>30) fail(400,"INVALID_MODIFIER","A modifier group needs 1–30 options.");
  const seen=new Set<string>();
  const options:OptionInput[]=obj.options.map((o:unknown,i:number)=>{
    if(!isRecord(o)) return fail(400,"INVALID_MODIFIER","Invalid option.");
    const id=o.id===undefined?undefined:field(o.id,100,"Option ID",1);
    if(id){if(seen.has(id)) fail(400,"INVALID_MODIFIER","Duplicate option ID.");seen.add(id);}
    return {id,...labelFields(o),deltaMinor:int(o.deltaMinor,"option price",0,1_000_000_000),
      active:bool(o.active,"option active"),sortOrder:int(o.sortOrder??i,"sort order",-9999,9999)};
  });
  if(options.filter(o=>o.active).length<maxSelections) fail(400,"INVALID_MODIFIER","Maximum selections cannot exceed active options.");
  if(minSelections>options.filter(o=>o.active).length) fail(400,"INVALID_MODIFIER","Not enough active options for required selection.");
  return {...labelFields(obj),selectionMode,minSelections,maxSelections,options};
}
async function attachOptions<T extends { id:string }>(groups:T[]){
  if(!groups.length)return groups.map(g=>({...g,options:[]}));
  const opts=await db.select().from(menuModifierOption)
    .where(inArray(menuModifierOption.groupId,groups.map(g=>g.id)))
    .orderBy(asc(menuModifierOption.sortOrder),asc(menuModifierOption.nameFa));
  return groups.map(g=>({...g,options:opts.filter(o=>o.groupId===g.id)}));
}
groupRouter.get("/",route(async(req,res)=>{
  const scope=await scopeFor(req,true),{page,limit,offset}=paging(req);
  const predicate=and(eq(menuModifierGroup.tenantId,scope.tenantId),eq(menuModifierGroup.locationId,scope.locationId),
    req.query.archive==="1"?isNotNull(menuModifierGroup.archivedAt):isNull(menuModifierGroup.archivedAt));
  const [groups,total]=await Promise.all([
    db.select().from(menuModifierGroup).where(predicate).orderBy(asc(menuModifierGroup.createdAt)).limit(limit).offset(offset),
    db.select({n:count()}).from(menuModifierGroup).where(predicate)
  ]);
  res.json({items:await attachOptions(groups),total:total[0]?.n??0,page,perPage:limit});
}));
groupRouter.post("/",route(async(req,res)=>{
  const scope=await scopeFor(req,true),input=parseGroup(bodyObject(req)),id=randomUUID();
  await db.transaction(async tx=>{
    await tx.insert(menuModifierGroup).values({id,tenantId:scope.tenantId,locationId:scope.locationId,
      nameFa:input.nameFa,namePs:input.namePs,nameEn:input.nameEn,
      selectionMode:input.selectionMode,minSelections:input.minSelections,maxSelections:input.maxSelections});
    for(const o of input.options)await tx.insert(menuModifierOption).values({id:randomUUID(),groupId:id,
      nameFa:o.nameFa,namePs:o.namePs,nameEn:o.nameEn,deltaMinor:o.deltaMinor,
      active:o.active,sortOrder:o.sortOrder});
    await changed(tx,scope,"menu.modifier_group_created",{groupId:id});
  });
  res.status(201).json({id,created:true});
}));
groupRouter.patch("/:id",route(async(req,res)=>{
  const scope=await scopeFor(req,true),id=paramId(req),data=bodyObject(req),v=version(data.version),input=parseGroup(data);
  await db.transaction(async tx=>{
    const [prior]=await tx.select().from(menuModifierGroup).where(and(eq(menuModifierGroup.id,id),
      eq(menuModifierGroup.tenantId,scope.tenantId),eq(menuModifierGroup.locationId,scope.locationId),isNull(menuModifierGroup.archivedAt))).limit(1);
    if(!prior)fail(404,"NOT_FOUND","Modifier group not found.");
    if(prior.version!==v)fail(409,"VERSION_CONFLICT","Modifier group changed. Reload.");
    const oldOptions=await tx.select().from(menuModifierOption).where(eq(menuModifierOption.groupId,id));
    if(input.options.some(o=>o.id&&!oldOptions.some(old=>old.id===o.id))) fail(400,"INVALID_MODIFIER","Option does not belong to this group.");
    const [done]=await tx.update(menuModifierGroup).set({nameFa:input.nameFa,namePs:input.namePs,nameEn:input.nameEn,
      selectionMode:input.selectionMode,minSelections:input.minSelections,maxSelections:input.maxSelections,
      updatedAt:new Date(),version:v+1}).where(and(eq(menuModifierGroup.id,id),eq(menuModifierGroup.version,v),
        eq(menuModifierGroup.tenantId,scope.tenantId),eq(menuModifierGroup.locationId,scope.locationId),isNull(menuModifierGroup.archivedAt)))
      .returning({id:menuModifierGroup.id});
    if(!done)fail(409,"VERSION_CONFLICT","Modifier group changed. Reload.");
    const submitted=new Set(input.options.flatMap(o=>o.id?[o.id]:[]));
    for(const old of oldOptions)if(!submitted.has(old.id))await tx.update(menuModifierOption)
      .set({active:false}).where(eq(menuModifierOption.id,old.id));
    for(const o of input.options){
      const values={nameFa:o.nameFa,namePs:o.namePs,nameEn:o.nameEn,deltaMinor:o.deltaMinor,active:o.active,sortOrder:o.sortOrder};
      if(o.id)await tx.update(menuModifierOption).set(values).where(and(eq(menuModifierOption.id,o.id),eq(menuModifierOption.groupId,id)));
      else await tx.insert(menuModifierOption).values({id:randomUUID(),groupId:id,...values});
    }
    await changed(tx,scope,"menu.modifier_group_updated",{groupId:id});
  });
  res.json({saved:true});
}));
groupRouter.post("/:id/archive",route(async(req,res)=>{
  const scope=await scopeFor(req,true),id=paramId(req),v=version(bodyObject(req).version);
  await db.transaction(async tx=>{
    const [group]=await tx.select().from(menuModifierGroup).where(and(eq(menuModifierGroup.id,id),
      eq(menuModifierGroup.tenantId,scope.tenantId),eq(menuModifierGroup.locationId,scope.locationId),isNull(menuModifierGroup.archivedAt))).limit(1);
    if(!group)fail(404,"NOT_FOUND","Group not found.");
    if(group.version!==v)fail(409,"VERSION_CONFLICT","Group was edited elsewhere.");
    const [using]=await tx.select({id:menuItem.id}).from(menuItemGroup)
      .innerJoin(menuItem,eq(menuItemGroup.itemId,menuItem.id))
      .where(and(eq(menuItemGroup.groupId,id),eq(menuItem.tenantId,scope.tenantId),
        eq(menuItem.published,true),isNull(menuItem.archivedAt))).limit(1);
    if(using)fail(409,"GROUP_IN_USE","Unpublish or detach this group from published meals first.");
    const [done]=await tx.update(menuModifierGroup).set({archivedAt:new Date(),version:v+1,updatedAt:new Date()})
      .where(and(eq(menuModifierGroup.id,id),eq(menuModifierGroup.tenantId,scope.tenantId),
        eq(menuModifierGroup.locationId,scope.locationId),eq(menuModifierGroup.version,v),isNull(menuModifierGroup.archivedAt)))
      .returning({id:menuModifierGroup.id});
    if(!done)fail(409,"VERSION_CONFLICT","Group changed. Reload.");
    await changed(tx,scope,"menu.modifier_group_archived",{groupId:id});
  });
  res.json({archived:true});
}));
