import {Router} from "express";
import {and,asc,eq,inArray,isNull} from "drizzle-orm";
import {readFile} from "node:fs/promises";
import path from "node:path";
import {db} from "./db";
import {diningTable,diningVisit,menuCategory,menuImage,menuItem,menuItemGroup,
 menuModifierGroup,menuModifierOption,restaurantSetting,tableQr,tenant} from "./schema";
import {bodyObject,fail,field,route} from "./menu-helpers";
import {guestAccess,verifyCode} from "./guest-security";

export const guestPublicRouter=Router();
guestPublicRouter.use((_req,res,next)=>{res.setHeader("Cache-Control","no-store");
 res.setHeader("Referrer-Policy","no-referrer");next();});
async function qrEntry(slug:string,code:string){
 if(!/^[a-z0-9-]{3,48}$/.test(slug)||!(/^[A-Za-z0-9_-]{24,128}$/.test(code)))
   fail(404,"QR_NOT_FOUND","This table code is unavailable.");
 const [entry]=await db.select({qr:tableQr,table:diningTable,restaurant:tenant,setting:restaurantSetting})
   .from(tableQr).innerJoin(diningTable,eq(tableQr.tableId,diningTable.id))
   .innerJoin(tenant,eq(tenant.id,tableQr.tenantId))
   .innerJoin(restaurantSetting,eq(restaurantSetting.tenantId,tableQr.tenantId))
   .where(and(eq(tenant.slug,slug),eq(tableQr.code,code))).limit(1);
 if(!entry||entry.table.archivedAt||!entry.table.active||entry.table.id!==entry.qr.tableId||
   !["active","trial"].includes(entry.restaurant.status))
   fail(404,"QR_NOT_FOUND","This table QR has expired or was replaced.");
 const [visit]=await db.select().from(diningVisit)
   .where(and(eq(diningVisit.tableId,entry.table.id),eq(diningVisit.tenantId,entry.qr.tenantId),
     eq(diningVisit.locationId,entry.qr.locationId),eq(diningVisit.status,"open"))).limit(1);
 return {...entry,visit};
}
guestPublicRouter.get("/entry/:slug/:qr",route(async(req,res)=>{
 const slug=field(req.params.slug,48,"Restaurant",3),qr=field(req.params.qr,128,"QR",24);
 const entry=await qrEntry(slug,qr);
 res.json({restaurant:entry.restaurant.name,slug:entry.restaurant.slug,tableLabel:entry.table.label,
   activeVisit:!!entry.visit,policy:entry.setting.orderingPolicy==="direct_to_kitchen"?
     "direct_to_kitchen":"waiter_approval"});
}));
guestPublicRouter.post("/entry/:slug/:qr/verify",route(async(req,res)=>{
 const slug=field(req.params.slug,48,"Restaurant",3),code=field(req.params.qr,128,"QR",24);
 const body=bodyObject(req);
 const pin=field(body.pin,6,"PIN",6);
 if(!/^\d{6}$/.test(pin))fail(400,"INVALID_PIN_FORMAT","Enter exactly six digits.");
 const entry=await qrEntry(slug,code);
 if(!entry.visit)fail(409,"NO_ACTIVE_VISIT","Ask your waiter to seat this table first.");
 const result=await verifyCode(req,entry.visit,entry.qr.version,pin);
 res.json({token:result.token,expiresAt:result.expiresAt,visitId:entry.visit.id,
   restaurant:entry.restaurant.name,slug:entry.restaurant.slug,tableLabel:entry.table.label,
   policy:entry.setting.orderingPolicy==="direct_to_kitchen"?"direct_to_kitchen":"waiter_approval"});
}));
guestPublicRouter.get("/session",route(async(req,res)=>{
 const scope=await guestAccess(req);
 res.json({visitId:scope.visitId,restaurant:scope.tenantName,slug:scope.slug,
   tableLabel:scope.tableLabel,policy:scope.policy,currency:"AFN"});
}));
guestPublicRouter.get("/catalog",route(async(req,res)=>{
 const scope=await guestAccess(req);
 const categories=await db.select({id:menuCategory.id,nameFa:menuCategory.nameFa,
   namePs:menuCategory.namePs,nameEn:menuCategory.nameEn,sortOrder:menuCategory.sortOrder})
   .from(menuCategory).where(and(eq(menuCategory.tenantId,scope.tenantId),
     eq(menuCategory.locationId,scope.locationId),eq(menuCategory.published,true),
     isNull(menuCategory.archivedAt))).orderBy(asc(menuCategory.sortOrder),asc(menuCategory.nameFa));
 const items=categories.length?await db.select({id:menuItem.id,categoryId:menuItem.categoryId,
   nameFa:menuItem.nameFa,namePs:menuItem.namePs,nameEn:menuItem.nameEn,
   description:menuItem.description,allergens:menuItem.allergens,priceMinor:menuItem.priceMinor,
   imageId:menuItem.imageId,version:menuItem.version,soldOut:menuItem.soldOut,
   preparationMinutes:menuItem.preparationMinutes})
   .from(menuItem).where(and(eq(menuItem.tenantId,scope.tenantId),eq(menuItem.locationId,scope.locationId),
     eq(menuItem.published,true),eq(menuItem.soldOut,false),isNull(menuItem.archivedAt),
     inArray(menuItem.categoryId,categories.map(x=>x.id))))
   .orderBy(asc(menuItem.sortOrder),asc(menuItem.nameFa)):[];
 const links=items.length?await db.select().from(menuItemGroup)
   .where(inArray(menuItemGroup.itemId,items.map(x=>x.id))):[];
 const groupsIds=[...new Set(links.map(x=>x.groupId))];
 const groups=groupsIds.length?await db.select().from(menuModifierGroup).where(and(
   inArray(menuModifierGroup.id,groupsIds),eq(menuModifierGroup.tenantId,scope.tenantId),
   eq(menuModifierGroup.locationId,scope.locationId),isNull(menuModifierGroup.archivedAt))):[];
 const options=groups.length?await db.select().from(menuModifierOption).where(and(
   inArray(menuModifierOption.groupId,groups.map(x=>x.id)),eq(menuModifierOption.active,true)))
   .orderBy(asc(menuModifierOption.sortOrder)):[];
 res.json({currency:"AFN",categories,items:items.map(x=>({
   ...x,groupIds:links.filter(y=>y.itemId===x.id).map(y=>y.groupId)})),
   groups:groups.map(g=>({id:g.id,nameFa:g.nameFa,namePs:g.namePs,nameEn:g.nameEn,
     selectionMode:g.selectionMode,minSelections:g.minSelections,maxSelections:g.maxSelections,
     version:g.version,options:options.filter(o=>o.groupId===g.id).map(o=>({
       id:o.id,nameFa:o.nameFa,namePs:o.namePs,nameEn:o.nameEn,deltaMinor:o.deltaMinor}))}))});
}));
guestPublicRouter.get("/images/:id",route(async(req,res)=>{
 const scope=await guestAccess(req),id=field(req.params.id,100,"Photo",1);
 const [image]=await db.select({storageKey:menuImage.storageKey}).from(menuImage)
   .innerJoin(menuItem,eq(menuItem.imageId,menuImage.id))
   .innerJoin(menuCategory,eq(menuItem.categoryId,menuCategory.id))
   .where(and(eq(menuImage.id,id),eq(menuImage.tenantId,scope.tenantId),
    eq(menuImage.locationId,scope.locationId),
    eq(menuItem.tenantId,scope.tenantId),eq(menuItem.locationId,scope.locationId),
    eq(menuItem.published,true),eq(menuItem.soldOut,false),isNull(menuItem.archivedAt),
    eq(menuCategory.published,true),isNull(menuCategory.archivedAt))).limit(1);
 if(!image)fail(404,"NOT_FOUND","Image unavailable.");
 const root=path.resolve(process.env.MEDIA_LOCAL_DIR??"./.data/menu-images");
 let bytes:Buffer;
 try{bytes=await readFile(path.join(root,image.storageKey));}
 catch{fail(404,"IMAGE_NOT_FOUND","Image storage temporarily unavailable.");}
 res.setHeader("Content-Type","image/webp");
 res.setHeader("X-Content-Type-Options","nosniff");
 res.setHeader("Cache-Control","private, max-age=120");
 res.send(bytes);
}));
