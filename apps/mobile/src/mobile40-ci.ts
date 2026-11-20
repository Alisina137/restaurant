import assert from "node:assert/strict";
import {reconcilePendingOrder} from "./mobile40-recovery";

const id="1d44219d-d22a-4dba-b77d-29b7e0b53b81";
const other="58dc9fe2-f13c-4c84-8ffd-c6603197e2fd";
const missing={status:404,code:"NOT_FOUND"};
const verifiedNotFound=(e:unknown)=>!!e&&typeof e==="object"&&
 (e as {status?:number;code?:string}).status===404&&
 (e as {status?:number;code?:string}).code==="NOT_FOUND";

async function main(){
 let postCalls=0,lookupCalls=0;
 const found=await reconcilePendingOrder(
  async()=>{lookupCalls++;return {status:"accepted",roundId:id};},
  async()=>{postCalls++;return {created:true,round:{id:other}};},
  verifiedNotFound
 );
 assert.equal(lookupCalls,1);
 assert.equal(postCalls,0,"Existing receipt means NEVER send another order");
 assert.deepEqual(found,{created:false,round:{id},source:"receipt"});

 const replay=await reconcilePendingOrder(
  async()=>{throw missing;},
  async()=>{postCalls++;return {created:true,round:{id:other}};},
  verifiedNotFound
 );
 assert.deepEqual(replay,{created:true,round:{id:other},source:"original_key_replay"});
 assert.equal(postCalls,1,"Only a verified NOT_FOUND permits user-triggered original-key replay");

 for(const err of [
  {status:404,code:"UNAVAILABLE"},
  {status:401,code:"UNAUTHENTICATED"},
  {status:403,code:"NOT_ASSIGNED"},
  {status:503,code:"ORDER_STATUS_UNCERTAIN"},
  new TypeError("Network request failed")
 ]){
  const before:number=postCalls;
  await assert.rejects(()=>reconcilePendingOrder(
   async()=>{throw err;},
   async()=>{postCalls++;return {created:true,round:{id:other}};},
   verifiedNotFound
  ));
  assert.equal(postCalls,before,"Never POST after an unverified missing receipt");
 }
 await assert.rejects(()=>reconcilePendingOrder(
  async()=>({status:"accepted",roundId:"not-a-valid-id"}),
  async()=>{postCalls++;return {created:true,round:{id:other}};},
  verifiedNotFound
 ));
 assert.equal(postCalls,1,"Malformed accepted response must fail closed");
 await assert.rejects(()=>reconcilePendingOrder(
  async()=>{throw missing;},
  async()=>{postCalls++;throw {status:503,code:"ORDER_STATUS_UNCERTAIN"};},
  verifiedNotFound
 ));
 assert.equal(postCalls,2,"An uncertain replay is attempted at most once");
 console.info("PASS P40 mobile receipt-first recovery: resolved no POST, missing original-key replay once, all other failures keep pending.");
}
main().catch(error=>{console.error(error);process.exitCode=1;});
