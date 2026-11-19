import test from "node:test";
import assert from "node:assert/strict";
import {CHECKOUT_LOCK_TIMEOUT_MS,ORDER_RETRY_AFTER_SECONDS,
 isIdempotentOrderSubmission,isTransientOrderDatabaseFailure,
 uncertainOrderResponse} from "./phase39-order-recovery";

test("only keyed waiter and guest order POSTs can recommend original-key replay",()=>{
 const check=(method:string,baseUrl:string,path:string)=>
  isIdempotentOrderSubmission({method,baseUrl,path});
 assert.equal(check("POST","/api/orders","/visits/v-1/rounds"),true);
 assert.equal(check("POST","/api/orders","/visits/5544/rounds"),true);
 assert.equal(check("POST","/api/guest","/orders"),true);
 for(const [method,base,path] of [
  ["GET","/api/orders","/visits/v-1/rounds"],
  ["POST","/api/orders","/rounds/id/serve"],
  ["POST","/api/orders","/tickets/tid/transition"],
  ["POST","/api/finance","/payments"],
  ["POST","/api/guest","/entry"],
  ["POST","/api/guest","/orders/by-key/token"],
  ["POST","/api/menu","/items"],
  ["POST","/api/orders","/visits/v1/rounds/more"],
  ["POST","/api/orders","/visits//rounds"],
 ] as const)assert.equal(check(method,base,path),false,method+base+path);
});

test("recognizes only known transient postgres codes including wrapped and cycled causes",()=>{
 for(const code of ["55P03","40P01","40001","57014","08006","08001",
  "ECONNRESET","ECONNREFUSED","ETIMEDOUT","EPIPE","ENOTFOUND","ECONNABORTED"]){
  assert.equal(isTransientOrderDatabaseFailure({cause:{cause:{code,detail:"PRIVATE_URI"}}}),
   true,code);
 }
 for(const error of [null,"secret",new Error("secret"),
  {code:"23505"},{code:"22P02"},{code:"P0001"},
  {code:"08abc"},{code:"OTHER",cause:{code:"23503"}}]){
  assert.equal(isTransientOrderDatabaseFailure(error),false,JSON.stringify(error));
 }
 const circular:{cause?:unknown}={};
 circular.cause=circular;
 assert.equal(isTransientOrderDatabaseFailure(circular),false);
});

test("unknown commit advice is conservative, bounded, and contains no sensitive detail",()=>{
 assert.equal(CHECKOUT_LOCK_TIMEOUT_MS,8000);
 assert.equal(ORDER_RETRY_AFTER_SECONDS,3);
 assert.deepEqual(uncertainOrderResponse,{
  code:"ORDER_STATUS_UNCERTAIN",
  message:"Order status could not be confirmed. Check the same order with the original submission key; do not create a new order.",
  statusUncertain:true,retrySameKey:true
 });
 assert.equal(JSON.stringify(uncertainOrderResponse).includes("uri"),false);
});
