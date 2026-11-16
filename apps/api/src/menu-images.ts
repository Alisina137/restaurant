import { Router, raw } from "express";
import { and, eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { db } from "./db";
import { menuImage } from "./schema";
import { changed, fail, route, scopeFor } from "./menu-helpers";

export const imageRouter=Router();
function imageDirectory() {
  if (process.env.NODE_ENV==="production" && !process.env.MEDIA_LOCAL_DIR)
    fail(503,"MEDIA_STORAGE_NOT_CONFIGURED","Configure a persistent MEDIA_LOCAL_DIR volume to upload images.");
  return path.resolve(process.env.MEDIA_LOCAL_DIR??"./.data/menu-images");
}
imageRouter.post("/",raw({type:["image/jpeg","image/png","image/webp"],limit:"6mb"}),route(async(req,res)=>{
  const scope=await scopeFor(req,true);
  const mime=req.headers["content-type"]?.split(";")[0]?.trim();
  if(!["image/jpeg","image/png","image/webp"].includes(mime??"") || !Buffer.isBuffer(req.body) || req.body.length<50)
    fail(415,"INVALID_IMAGE_TYPE","Upload a JPG, PNG or WebP file.");
  if(req.body.length>5*1024*1024)fail(413,"IMAGE_TOO_LARGE","Image must be at most 5 MB.");
  let bytes:Buffer;
  try {
    const input=sharp(req.body,{limitInputPixels:24_000_000,failOn:"error"});
    const meta=await input.metadata();
    const expected=mime==="image/jpeg"?"jpeg":mime==="image/png"?"png":"webp";
    if(meta.format!==expected || !meta.width || !meta.height || meta.width<80 || meta.height<80)
      fail(400,"INVALID_IMAGE","Choose a genuine image at least 80×80 pixels.");
    bytes=await input.rotate().resize(1280,1280,{fit:"inside",withoutEnlargement:true})
      .webp({quality:81,effort:4}).toBuffer();
    if(bytes.length>3*1024*1024)fail(413,"IMAGE_TOO_LARGE","Optimized image exceeds 3 MB.");
  }catch(err){
    if(err instanceof Error && "status" in err)throw err;
    fail(400,"INVALID_IMAGE","Could not decode the image. Try another photo.");
  }
  const id=randomUUID(), key=id+".webp",target=path.join(imageDirectory(),key);
  await mkdir(imageDirectory(),{recursive:true});
  await writeFile(target,bytes,{flag:"wx"});
  try{
    await db.transaction(async tx=>{
      await tx.insert(menuImage).values({id,tenantId:scope.tenantId,locationId:scope.locationId,
        storageKey:key,contentType:"image/webp",byteLength:bytes.length});
      await changed(tx,scope,"menu.image_uploaded",{imageId:id,bytes:bytes.length});
    });
  }catch(err){await unlink(target).catch(()=>undefined);throw err;}
  res.status(201).json({id,url:"/api/menu/images/"+id,bytes:bytes.length,contentType:"image/webp"});
}));
imageRouter.get("/:id",route(async(req,res)=>{
  const scope=await scopeFor(req,false),id=req.params.id;
  if(typeof id!=="string"||id.length>100)fail(404,"NOT_FOUND","Photo not found.");
  const [image]=await db.select().from(menuImage).where(and(eq(menuImage.id,id),
    eq(menuImage.tenantId,scope.tenantId),eq(menuImage.locationId,scope.locationId))).limit(1);
  if(!image)fail(404,"NOT_FOUND","Photo not found.");
  let bytes:Buffer;
  try {bytes=await readFile(path.join(imageDirectory(),image.storageKey));}
  catch {fail(404,"IMAGE_NOT_FOUND","Photo storage is unavailable. Check MEDIA_LOCAL_DIR.");}
  res.setHeader("Content-Type","image/webp");
  res.setHeader("Cache-Control","private, max-age=300");
  res.setHeader("X-Content-Type-Options","nosniff");
  res.send(bytes);
}));
