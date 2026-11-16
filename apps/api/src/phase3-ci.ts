import "dotenv/config";
import assert from "node:assert/strict";
import sharp from "sharp";
import { pool } from "./db";

if(process.env.NODE_ENV==="production"||!process.env.DEMO_PASSWORD)
  throw new Error("Phase 03 integration uses development-only credentials.");
const URL=process.env.E2E_API_URL??"http://localhost:4000";
const password=process.env.DEMO_PASSWORD;
async function call(path:string,options?:{method?:string;body?:unknown;cookie?:string;raw?:Buffer;mime?:string}){
  return fetch(URL+path,{method:options?.method??"GET",
    headers:{Origin:"http://localhost:3000",...(options?.cookie?{Cookie:options.cookie}:{}),
      "Content-Type":options?.mime??"application/json"},
    body:options?.raw?new Uint8Array(options.raw):(options?.body===undefined?undefined:JSON.stringify(options.body))});
}
async function signIn(email:string):Promise<string>{
  for(let tries=0;tries<5;tries++){
    const response=await call("/api/auth/sign-in/email",{method:"POST",body:{email,password}});
    if(response.status===429){await new Promise(resolve=>setTimeout(resolve,11_000));continue;}
    assert.equal(response.status,200,email+" must sign in: "+await response.text());
    return response.headers.getSetCookie().map(c=>c.split(";")[0]).join("; ");
  }
  throw new Error("Rate limit did not clear");
}
async function expect<T>(response:Response,status:number):Promise<T>{
  const body=await response.json() as T;
  assert.equal(response.status,status,"Unexpected status "+JSON.stringify(body));
  return body;
}
function cat(name:string,published=false){return {nameFa:name,namePs:"",nameEn:name,description:"",sortOrder:0,published};}
function grp(valid=true){return {nameFa:"اندازه",namePs:"اندازه",nameEn:"Size",selectionMode:"single",
  minSelections:1,maxSelections:valid?1:2,options:[
    {nameFa:"کوچک",namePs:"کوچنی",nameEn:"Small",deltaMinor:0,active:true,sortOrder:0},
    {nameFa:"بزرگ",namePs:"لوی",nameEn:"Large",deltaMinor:2500,active:true,sortOrder:1}]};}
function meal(categoryId:string,groupIds:string[],imageId:string|null=null){
  return {categoryId,nameFa:"برگر مخصوص",namePs:"برګر",nameEn:"Special Burger",description:"Beef and bread",
    sku:"BURGER-001",priceMinor:35000,imageId,allergens:["wheat"],preparationMinutes:15,sortOrder:0,
    published:true,groupIds};
}
async function main(){
  const owner=await signIn("owner-ci@example.test");
  const kitchen=await signIn("kitchen-ci@example.test");
  const other=await signIn("new-owner-ci@example.test");
  const platform=await signIn("platform-ci@example.test");
  const noAuth=await call("/api/menu/catalog");
  assert.equal(noAuth.status,401,"catalog requires membership");
  assert.equal((await call("/api/menu/editor",{cookie:kitchen})).status,403,"kitchen cannot edit menu");
  assert.equal((await call("/api/menu/catalog",{cookie:platform})).status,403,"platform cannot read private menu");
  const revisionBefore=await expect<{version:number}>(await call("/api/menu/revision",{cookie:owner}),200);
  const streamController=new AbortController();
  try{
    const stream=await fetch(URL+"/api/menu/events",{headers:{Origin:"http://localhost:3000",Cookie:owner},
      signal:streamController.signal});
    assert.equal(stream.status,200,"authenticated catalog revision stream");
    assert.match(stream.headers.get("content-type")??"",/text\\/event-stream/);
    const first=await Promise.race([
      stream.body!.getReader().read(),
      new Promise<never>((_resolve,reject)=>setTimeout(()=>reject(new Error("SSE first revision timed out")),6000))
    ]);
    assert.match(new TextDecoder().decode(first.value),/event: catalog/,"SSE emits initial revision");
  } finally {streamController.abort();}

  const c1=await expect<{id:string}>(await call("/api/menu/categories",{cookie:owner,method:"POST",body:cat("غذاهای گرم")}),201);
  const c2=await expect<{id:string}>(await call("/api/menu/categories",{cookie:owner,method:"POST",body:cat("نوشابه‌ها",true)}),201);
  assert.equal((await call("/api/menu/categories",{cookie:owner,method:"POST",body:cat("غذاهای گرم")})).status,409,"duplicate active name rejected");
  const bad=await call("/api/menu/groups",{cookie:owner,method:"POST",body:grp(false)});
  assert.equal(bad.status,400,"single-choice group max selection must be valid");
  const group=await expect<{id:string}>(await call("/api/menu/groups",{cookie:owner,method:"POST",body:grp()}),201);
  const options=await expect<{groups:{id:string;options:{id:string}[]}[]}>(await call("/api/menu/editor",{cookie:owner}),200);
  assert.equal(options.groups.find(g=>g.id===group.id)?.options.length,2);
  const premature=await call("/api/menu/items",{method:"POST",cookie:owner,body:meal(c1.id,[group.id])});
  assert.equal(premature.status,409,"cannot publish under draft category");
  assert.equal((await call("/api/menu/categories/"+c1.id,{cookie:owner,method:"PATCH",body:{...cat("غذاهای گرم",true),version:1}})).status,200);
  const sample=await sharp({create:{width:96,height:96,channels:3,background:"#d3a36c"}}).jpeg().toBuffer();
  const upload=await expect<{id:string;contentType:string}>(await call("/api/menu/images",{
    method:"POST",cookie:owner,mime:"image/jpeg",raw:sample}),201);
  assert.equal(upload.contentType,"image/webp","server optimizes images");
  const image=await call("/api/menu/images/"+upload.id,{cookie:owner});
  assert.equal(image.status,200);assert.equal(image.headers.get("content-type"),"image/webp");
  assert.equal((await call("/api/menu/images/"+upload.id,{cookie:other})).status,404,"images scoped to tenant");
  const badPicture=await call("/api/menu/images",{method:"POST",cookie:owner,mime:"image/png",raw:Buffer.from("hello!")});
  assert.notEqual(badPicture.status,201,"invalid images never accepted");
  const id=await expect<{id:string}>(await call("/api/menu/items",{cookie:owner,method:"POST",body:meal(c1.id,[group.id],upload.id)}),201);
  assert.equal((await call("/api/menu/items",{cookie:owner,method:"POST",body:meal(c1.id,[group.id])})).status,409,"SKU unique per location");
  assert.equal((await call("/api/menu/items/"+id.id,{cookie:other})).status,404,"cross-tenant item read denied");
  assert.equal((await call("/api/menu/groups/"+group.id+"/archive",{cookie:owner,method:"POST",body:{version:1}})).status,409,"published attached group cannot archive");
  assert.equal((await call("/api/menu/categories/"+c1.id+"/archive",{cookie:owner,method:"POST",body:{version:2}})).status,409,"category with active meals cannot archive");
  const menu=await expect<{items:{id:string;priceMinor:number;groupIds:string[]}[];groups:{id:string;options:{deltaMinor:number}[]}[];version:number}>(
    await call("/api/menu/catalog",{cookie:kitchen}),200);
  assert.ok(menu.items.some(i=>i.id===id.id),"staff see only published menu items");
  assert.equal(menu.items.find(i=>i.id===id.id)?.priceMinor,35000);
  assert.deepEqual(menu.items.find(i=>i.id===id.id)?.groupIds,[group.id]);
  assert.equal(menu.groups.find(g=>g.id===group.id)?.options.length,2);
  const update={...meal(c1.id,[group.id],upload.id),priceMinor:40000,version:1};
  assert.equal((await call("/api/menu/items/"+id.id,{cookie:owner,method:"PATCH",body:update})).status,200,"price updated under version lock");
  assert.equal((await call("/api/menu/items/"+id.id,{cookie:owner,method:"PATCH",body:update})).status,409,"stale item edit fails");
  const duplicate=await expect<{id:string}>(await call("/api/menu/items/"+id.id+"/duplicate",{cookie:owner,method:"POST",body:{}}),201);
  const duplicateRow=await expect<{item:{sku:string|null;published:boolean}}>(await call("/api/menu/items/"+duplicate.id,{cookie:owner}),200);
  assert.equal(duplicateRow.item.sku,null,"duplicate SKU cleared");
  assert.equal(duplicateRow.item.published,false,"duplicates always start drafts");
  assert.equal((await call("/api/menu/items/availability/bulk",{cookie:owner,method:"POST",
    body:{changes:[{id:id.id,version:1,soldOut:true,reason:"No stock"}]}})).status,409,"stale availability rejected");
  assert.equal((await call("/api/menu/items/availability/bulk",{cookie:owner,method:"POST",
    body:{changes:[{id:id.id,version:2,soldOut:true,reason:"No stock"}]}})).status,200);
  const later=await expect<{items:{id:string;soldOut:boolean;priceMinor:number}[]}>(
    await call("/api/menu/catalog",{cookie:kitchen}),200);
  assert.equal(later.items.find(i=>i.id===id.id)?.priceMinor,40000,"latest price in staff catalog");
  assert.equal(later.items.find(i=>i.id===id.id)?.soldOut,true,"sold-out flag immediately visible");
  const newRev=await expect<{version:number}>(await call("/api/menu/revision",{cookie:kitchen}),200);
  assert.ok(newRev.version>revisionBefore.version,"catalog version increases on menu changes");
  assert.equal((await call("/api/menu/items/"+id.id+"/archive",{cookie:owner,method:"POST",body:{version:3}})).status,200);
  assert.equal((await call("/api/menu/items/"+duplicate.id+"/archive",{cookie:owner,method:"POST",body:{version:1}})).status,200);
  const archived=await expect<{items:{id:string}[]}>(await call("/api/menu/items?archive=1",{cookie:owner}),200);
  assert.ok(archived.items.some(i=>i.id===id.id),"soft archived item still accessible for history");
  const afterArchive=await expect<{items:{id:string}[]}>(await call("/api/menu/catalog",{cookie:kitchen}),200);
  assert.equal(afterArchive.items.some(i=>i.id===id.id),false,"archived item hidden from published catalog");
  assert.equal((await call("/api/menu/groups/"+group.id+"/archive",{cookie:owner,method:"POST",body:{version:1}})).status,200);
  assert.equal((await call("/api/menu/categories/"+c1.id+"/archive",{cookie:owner,method:"POST",body:{version:2}})).status,200);
  const cats=await expect<{items:{id:string}[]}>(await call("/api/menu/categories?archive=1",{cookie:owner}),200);
  assert.ok(cats.items.some(x=>x.id===c1.id),"archived category retained");
  const untouched=await expect<{categories:{id:string}[]}>(await call("/api/menu/catalog",{cookie:kitchen}),200);
  assert.ok(untouched.categories.some(x=>x.id===c2.id),"unaffected category remains published");
  console.info("PASS P03: tenant isolation, image optimization, categories, group validation, SKU/version conflicts, publishing, revision, bulk stock, duplication, archive/history.");
}
main().then(async()=>{await pool.end();}).catch(async e=>{console.error(e);await pool.end();process.exitCode=1;});
