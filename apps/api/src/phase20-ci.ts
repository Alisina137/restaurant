import "dotenv/config";
import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import {pool} from "./db";
if(process.env.NODE_ENV==="production"||!process.env.DEMO_PASSWORD)
 throw new Error("Phase 20 integration must run against disposable CI data.");
const root=process.env.E2E_API_URL??"http://localhost:4000";
const password=process.env.DEMO_PASSWORD;
async function request(path:string,method="GET",body?:unknown,cookie?:string){
 return fetch(root+path,{method,headers:{"Content-Type":"application/json",
  Origin:"http://localhost:3000",...(cookie?{Cookie:cookie}:{})},
  body:body===undefined?undefined:JSON.stringify(body)});
}
async function session(email:string){
 for(let attempt=0;attempt<9;attempt++){
  const response=await request("/api/auth/sign-in/email","POST",{email,password});
  if(response.status===429){await new Promise(done=>setTimeout(done,11000));continue;}
  assert.equal(response.status,200,email+": "+await response.text());
  return response.headers.getSetCookie().map(c=>c.split(";")[0]).join("; ");
 }
 throw new Error("Login remained rate limited");
}
async function expect<T>(r:Response,status=200):Promise<T>{
 const body=await r.text();
 assert.equal(r.status,status,"Unexpected status: "+body.slice(0,1200));
 return JSON.parse(body) as T;
}
type Summary={items:{total:number;published:number;draft:number;soldOut:number};
 categories:{total:number;published:number};modifierGroups:number;revision:{version:number}};
type Item={id:string;version:number;published:boolean;categoryId:string};
const categoryInput=(name:string,published:boolean)=>({
 nameFa:name,namePs:name,nameEn:name,description:"P20 production workflow test",
 sortOrder:100,published
});
async function main(){
 const owner=await session("owner-ci@example.test"),
  waiter=await session("waiter-ci@example.test"),
  cashier=await session("cashier-ci@example.test"),
  outsider=await session("new-owner-ci@example.test");
 assert.equal((await request("/api/menu/summary")).status,401);
 assert.equal((await request("/api/menu/summary","GET",undefined,waiter)).status,403);
 assert.equal((await request("/api/menu/summary","GET",undefined,cashier)).status,403);
 const before=await expect<Summary>(await request("/api/menu/summary","GET",undefined,owner));
 assert.equal(before.items.total,before.items.draft+before.items.published);
 assert.match((await request("/api/menu/summary","GET",undefined,owner)).headers.get("cache-control")??"",/no-store/);
 const categories=await expect<{total:number}>(await request("/api/menu/categories","GET",undefined,owner));
 assert.equal(before.categories.total,categories.total);
 const others=await expect<Summary>(await request("/api/menu/summary","GET",undefined,outsider));
 assert.ok(others.items.total<=before.items.total,"External restaurant has independent catalog counters");
 const suffix=randomUUID().slice(0,8),cat=categoryInput("فاز بیست "+suffix,false);
 const created=await expect<{id:string}>(await request("/api/menu/categories","POST",cat,owner),201);
 const input={categoryId:created.id,nameFa:"غذای تست "+suffix,namePs:"د ازموینې خواړه",
  nameEn:"CI Sample Meal",description:"Phase 20 audit test",sku:"",
  priceMinor:15000,imageId:null,allergens:[],preparationMinutes:12,sortOrder:0,
  published:false,groupIds:[]};
 const createdItem=await expect<{id:string}>(await request("/api/menu/items","POST",input,owner),201);
 const url="/api/menu/items/"+createdItem.id+"/publication";
 const fresh=await expect<{item:Item}>(await request("/api/menu/items/"+createdItem.id,"GET",undefined,owner));
 assert.equal(fresh.item.version,1);
 assert.equal((await request(url,"PATCH",{published:true,version:1},waiter)).status,403,
   "Staff cannot publish meals without management access");
 assert.equal((await request(url,"PATCH",{published:"true",version:1},owner)).status,400,
   "Publish operation must reject strings in place of booleans");
 assert.equal((await request(url,"PATCH",{published:true,version:1},outsider)).status,404,
   "Other restaurant cannot publish this item");
 assert.equal((await request(url,"PATCH",{published:true,version:1},owner)).status,409,
   "Publishing under draft category must be blocked");
 const afterFail=await expect<{item:Item}>(await request("/api/menu/items/"+createdItem.id,"GET",undefined,owner));
 assert.equal(afterFail.item.version,1,"Failed publish must not increment item version");
 const afterFailCat=await expect<Summary>(await request("/api/menu/summary","GET",undefined,owner));
 assert.equal(afterFailCat.items.draft,before.items.draft+1);
 assert.equal(afterFailCat.items.total,before.items.total+1);
 assert.equal(afterFailCat.categories.total,before.categories.total+1);
 assert.equal((await request("/api/menu/categories/"+created.id,"PATCH",
  {...cat,published:true,version:1},owner)).status,200);
 assert.equal((await request(url,"PATCH",{published:true,version:0},owner)).status,400);
 assert.equal((await request(url,"PATCH",{published:true,version:1},owner)).status,200);
 const live=await expect<{item:Item}>(await request("/api/menu/items/"+createdItem.id,"GET",undefined,owner));
 assert.equal(live.item.published,true);
 assert.equal(live.item.version,2);
 assert.equal((await request(url,"PATCH",{published:false,version:1},owner)).status,409,
   "Stale version must fail");
 const guest=await expect<{items:{id:string}[]}>(await request("/api/menu/catalog","GET",undefined,waiter));
 assert.ok(guest.items.some(x=>x.id===createdItem.id),"Published item is visible to staff catalog");
 assert.equal((await request("/api/menu/categories/"+created.id,"PATCH",
  {...cat,published:false,version:2},owner)).status,409,
  "Unpublishing a category containing published meals must be denied");
 const bulk=await expect<{updated:number}>(await request("/api/menu/items/availability/bulk",
   "POST",{changes:[{id:createdItem.id,version:2,soldOut:true,reason:"Fresh delivery pending"}]},owner));
 assert.equal(bulk.updated,1);
 const inventory=await expect<{items:{id:string;soldOut:boolean}[]}>(await request("/api/menu/catalog","GET",undefined,waiter));
 assert.equal(inventory.items.find(x=>x.id===createdItem.id)?.soldOut,true);
 const stock=await expect<Summary>(await request("/api/menu/summary","GET",undefined,owner));
 assert.equal(stock.items.soldOut,before.items.soldOut+1);
 assert.equal((await request(url,"PATCH",{published:false,version:3},owner)).status,200);
 assert.equal((await request("/api/menu/catalog","GET",undefined,waiter)).status,200);
 const hidden=await expect<{items:{id:string}[]}>(await request("/api/menu/catalog","GET",undefined,waiter));
 assert.equal(hidden.items.some(x=>x.id===createdItem.id),false);
 assert.equal((await request("/api/menu/categories/"+created.id,"PATCH",
  {...cat,published:false,version:2},owner)).status,200);
 assert.equal((await request("/api/menu/items/"+createdItem.id+"/archive",
  "POST",{version:4},owner)).status,200);
 assert.equal((await request("/api/menu/categories/"+created.id+"/archive",
  "POST",{version:3},owner)).status,200);
 const final=await expect<Summary>(await request("/api/menu/summary","GET",undefined,owner));
 assert.equal(final.items.total,before.items.total);
 assert.equal(final.items.published,before.items.published);
 assert.equal(final.categories.total,before.categories.total);
 assert.equal(final.items.soldOut,before.items.soldOut);
 assert.ok(final.revision.version>before.revision.version);
 console.info("PASS P20: scoped summary, publication guards, version lock, guest catalog visibility, stock, category dependencies and archive consistency.");
}
main().then(async()=>{await pool.end();}).catch(async error=>{
 console.error(error);await pool.end();process.exitCode=1;
});
