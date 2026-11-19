import {test} from "node:test";
import assert from "node:assert/strict";
import {pool} from "./db";

test("an idle pg connection error is handled without throwing or leaking credentials",()=>{
 assert.ok(pool.listenerCount("error")>0,"Pool error listener prevents uncaught EventEmitter errors");
 const log:string[]=[];
 const old=console.error;
 console.error=(...parts:unknown[])=>{log.push(parts.map(String).join(" "));};
 try{
  // pg Pool emits this outside Express request handlers when an idle
  // Neon/Postgres socket disconnects. Without an error listener this
  // EventEmitter 'error' throws and terminates the Node API process.
  assert.doesNotThrow(()=>{
   pool.emit("error",Object.assign(new Error("postgres://user:password@private-host"),{code:"ECONNRESET"}));
  });
 }finally{console.error=old;}
 assert.equal(log.length,1);
 const message=log[0]??"";
 assert.match(message,/postgres_idle_connection_error/);
 assert.match(message,/ECONNRESET/);
 assert.doesNotMatch(message,/password|private-host|postgres:\/\//);
});
