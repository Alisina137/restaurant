import "dotenv/config";
import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import {pool} from "./db";

/**
 * Reproduces Menu > Categories (second submenu) create, duplicate-name
 * requests and subsequent menu requests against a running, seeded, disposable
 * development/CI API. Test data is isolated by a unique suffix.
 */
if(process.env.NODE_ENV==="production"||!process.env.DEMO_PASSWORD)
 throw new Error("Menu stability rehearsal requires disposable development credentials.");
const origin=process.env.E2E_API_URL??"http://localhost:4000";
const password=process.env.DEMO_PASSWORD;
async function request(path:string,options?:{method?:string;body?:unknown;cookie?:string}){
 const controller=new AbortController();
 const timer=setTimeout(()=>controller.abort(),12000);
 try{
  return await fetch(origin+path,{
   method:options?.method??"GET",signal:controller.signal,
   headers:{Origin:"http://localhost:3000","Content-Type":"application/json",
    ...(options?.cookie?{Cookie:options.cookie}:{})},
   body:options?.body===undefined?undefined:JSON.stringify(options.body)});
 }finally{clearTimeout(timer);}
}
async function login(email:string){
 for(let tries=0;tries<9;tries++){
  const response=await request("/api/auth/sign-in/email",{method:"POST",body:{email,password}});
  if(response.status===429){await new Promise(r=>setTimeout(r,11000));continue;}
  assert.equal(response.status,200,email+" sign-in failed: "+await response.text());
  return response.headers.getSetCookie().map(c=>c.split(";")[0]).join("; ");
 }
 throw Error("Development login rate limit did not clear.");
}
async function response<T>(r:Response,status:number):Promise<T>{
 const json=await r.json() as T;
 assert.equal(r.status,status,JSON.stringify(json));
 return json;
}
const category=(name:string,published=false)=>({
 nameFa:name,namePs:"",nameEn:"CI Category",description:"Menu stability integration",
 published,sortOrder:24
});
async function ready(message:string){
 const r=await request("/api/health/ready");
 await response<{status:"ready"}>(r,200);
 assert.equal(r.status,200,"API died after "+message);
}
async function main(){
 await ready("boot");
 const owner=await login("owner-ci@example.test");
 const waiter=await login("waiter-ci@example.test");
 const outsider=await login("new-owner-ci@example.test");
 const initial=await response<{total:number}>(
  await request("/api/menu/categories",{cookie:owner}),200);
 const name="د کتګوری ازموینه "+randomUUID().slice(0,12);
 const bad=await response<{code:string}>(await request("/api/menu/categories",{
  method:"POST",body:category(" "),cookie:owner}),400);
 assert.equal(bad.code,"INVALID_FIELD");
 await ready("invalid category");

 const attempts=await Promise.all(Array.from({length:6},()=>
  request("/api/menu/categories",{method:"POST",body:category(name),cookie:owner})));
 assert.equal(attempts.filter(x=>x.status===201).length,1,"One category creation wins the race");
 assert.equal(attempts.filter(x=>x.status===409).length,5,"Duplicate names reject without crash");
 const created=await response<{id:string}>(attempts.find(x=>x.status===201)!,201);
 for(const loser of attempts.filter(x=>x.status===409)){
  const body=await loser.json() as {code:string};
  assert.equal(body.code,"DUPLICATE_CATEGORY");
 }
 await ready("six concurrent same-name category writes");

 const second=await response<{id:string}>(await request("/api/menu/categories",{
  method:"POST",body:category("د مینو بله برخه "+randomUUID().slice(0,9),true),cookie:owner}),201);
 await ready("second category");
 const categories=await response<{items:{id:string}[];total:number}>(
  await request("/api/menu/categories",{cookie:owner}),200);
 assert.equal(categories.total,initial.total+2,"Only two new categories survive duplicate race");
 assert.equal((await request("/api/menu/categories",{cookie:waiter})).status,403,
  "Waiter cannot modify/read management category UI");
 assert.equal((await request("/api/menu/categories/"+created.id,{
  method:"PATCH",body:{...category(name,true),version:1},cookie:outsider})).status,404,
  "Other restaurant cannot change this category");
 const updated=await response<{saved:boolean}>(await request("/api/menu/categories/"+created.id,{
  method:"PATCH",body:{...category(name,true),version:1},cookie:owner}),200);
 assert.equal(updated.saved,true);
 await ready("published category");

 const newGroup={nameFa:"چاشنی "+randomUUID().slice(0,9),namePs:"",nameEn:"Options",
  selectionMode:"single",minSelections:0,maxSelections:1,
  options:[{nameFa:"انتخاب عادی",namePs:"",nameEn:"Standard",
   deltaMinor:0,active:true,sortOrder:0}]};
 const group=await response<{id:string}>(await request("/api/menu/groups",{
  method:"POST",body:newGroup,cookie:owner}),201);
 assert.ok(group.id);
 await ready("modifier group creation after category changes");
 const editor=await response<{categories:{id:string}[]}>(
  await request("/api/menu/editor",{cookie:owner}),200);
 assert.ok(editor.categories.some(x=>x.id===created.id));
 assert.ok(editor.categories.some(x=>x.id===second.id));
 console.info("PASS menu stability: category validation, six-way duplicate race, safe 409, tenant isolation, publishing, modifier save, and API readiness after each write.");
}
main().then(async()=>{await pool.end();}).catch(async error=>{
 console.error(error);await pool.end();process.exitCode=1;
});
