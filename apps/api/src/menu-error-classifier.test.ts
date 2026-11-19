import {test} from "node:test";
import assert from "node:assert/strict";
import {classifyMenuDbError} from "./menu-error-classifier";

test("menu PostgreSQL unique category error returns safe conflict, not 503",()=>{
 const error={cause:{code:"23505",constraint:"menu_category_active_name_unique",
  detail:"Key (...)=(secret-guest-info) already exists"}};
 assert.deepEqual(classifyMenuDbError(error),{
  status:409,code:"DUPLICATE_CATEGORY",
  message:"A category with this Dari name already exists. Choose a different name."
 });
});
test("menu SKU duplicate and generic collisions are distinct",()=>{
 assert.equal(classifyMenuDbError({cause:{code:"23505",constraint:"menu_item_active_sku_unique"}}).code,"DUPLICATE_SKU");
 assert.equal(classifyMenuDbError({cause:{code:"23505",constraint:"other_unique"}}).code,"DUPLICATE");
});
test("missing migrations are actionable locally but not revealed in production",()=>{
 assert.match(classifyMenuDbError({cause:{code:"42P01"}},false).message,/pnpm db:migrate/);
 assert.equal(classifyMenuDbError({cause:{code:"42703"}},true).code,"MENU_SCHEMA_OUTDATED");
 assert.doesNotMatch(classifyMenuDbError({cause:{code:"42703"}},true).message,/migrate|column|table/i);
});
test("disconnects do not expose DB URL and classify as retryable",()=>{
 for(const code of ["08006","ECONNRESET","ETIMEDOUT","ENOTFOUND","ECONNREFUSED"]){
  const result=classifyMenuDbError({cause:{cause:{code,message:"postgres://username:secret@database"}}});
  assert.equal(result.status,503);
  assert.equal(result.code,"DATABASE_UNAVAILABLE");
  assert.doesNotMatch(result.message,/secret|postgres:/);
 }
});
test("unexpected menu failures remain sanitized",()=>{
 const result=classifyMenuDbError(new Error("Password=do-not-leak"));
 assert.equal(result.status,503);
 assert.equal(result.code,"SERVICE_UNAVAILABLE");
 assert.doesNotMatch(result.message,/Password|leak/i);
});
