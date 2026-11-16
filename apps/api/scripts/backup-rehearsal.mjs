#!/usr/bin/env node
/**
 * Safely rehearse PostgreSQL backup recovery into a separate, explicitly named
 * rehearsal database. This never overwrites the source and erases its temp dump.
 * REQUIREMENTS: pg_dump, pg_restore; an existing empty or disposable rehearsal DB.
 */
import "dotenv/config";
import {spawn} from "node:child_process";
import {mkdtemp,rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import path from "node:path";
import pg from "pg";

function connection(raw,label){
 if(!raw)throw new Error(label+" is required.");
 const url=new URL(raw);
 if(url.protocol!=="postgresql:"&&url.protocol!=="postgres:")
  throw new Error(label+" must be a PostgreSQL URL.");
 const database=decodeURIComponent(url.pathname.slice(1));
 if(!database)throw new Error(label+" must name a database.");
 const env={
  PGHOST:url.hostname,PGPORT:url.port||"5432",
  PGUSER:decodeURIComponent(url.username),PGPASSWORD:decodeURIComponent(url.password),
  PGDATABASE:database,PGCONNECT_TIMEOUT:"10",
  PGSSLMODE:url.searchParams.get("sslmode")||"prefer"
 };
 return {database,host:url.hostname,env};
}
function command(bin,args,env){
 return new Promise((resolve,reject)=>{
  const child=spawn(bin,args,{env:{...process.env,...env},stdio:["ignore","ignore","pipe"]});
  let errorText="";
  child.stderr?.on("data",chunk=>{errorText+=(String(chunk)).slice(0,2000);});
  child.on("error",()=>reject(new Error(bin+" is not available. Install PostgreSQL client tools.")));
  child.on("close",code=>code===0?resolve(undefined):
   reject(new Error(bin+" failed (exit "+code+"). Inspect PostgreSQL permissions and tool versions.")));
 });
}
async function counts(raw){
 const pool=new pg.Pool({connectionString:raw,max:1});
 const tables=["tenants","tenant_memberships","dining_visits","order_rounds","order_lines",
  "kitchen_tickets","order_outbox","dining_checks","check_payments","finance_refunds",
  "subscription_invoices","invoice_proofs","audit_events"];
 try{
  const values={};
  for(const table of tables){
   const result=await pool.query("SELECT count(*)::integer AS n FROM "+table);
   values[table]=result.rows[0].n;
  }
  return values;
 }finally{await pool.end();}
}
async function main(){
 if(process.env.REHEARSAL_CONFIRM!=="RESTORE_NONPRODUCTION_ONLY")
  throw new Error("Set REHEARSAL_CONFIRM=RESTORE_NONPRODUCTION_ONLY to acknowledge target data will be replaced.");
 const source=connection(process.env.DATABASE_URL,"DATABASE_URL");
 const target=connection(process.env.REHEARSAL_DATABASE_URL,"REHEARSAL_DATABASE_URL");
 if(!/(^|[-_])rehearsal($|[-_])/.test(target.database.toLowerCase()))
  throw new Error("Target database name must contain the separate token 'rehearsal'.");
 if(source.host===target.host&&source.database===target.database)
  throw new Error("Refusing to restore into source database.");
 if(process.env.NODE_ENV==="production" &&
   !/(localhost|127[.]0[.]0[.]1|staging|test|ci|rehearsal)/i.test(target.host))
  throw new Error("Production invocation requires an explicitly non-production rehearsal host.");
 const temp=await mkdtemp(path.join(tmpdir(),"dineflow-rehearsal-"));
 const archive=path.join(temp,"db-backup.dump");
 try{
  const before=await counts(process.env.DATABASE_URL);
  await command("pg_dump",["--format=custom","--no-owner","--no-privileges",
   "--lock-wait-timeout=15s","--file",archive],source.env);
  await command("pg_restore",["--list",archive],target.env);
  await command("pg_restore",["--clean","--if-exists","--no-owner","--no-privileges",
   "--exit-on-error","--dbname",target.database,archive],target.env);
  const after=await counts(process.env.REHEARSAL_DATABASE_URL);
  const mismatches=Object.keys(before).filter(key=>before[key]!==after[key]);
  if(mismatches.length)throw new Error("Restore count mismatch for: "+mismatches.join(", "));
  console.info("PASS: isolated restore rehearsal validated counts for "+Object.keys(before).length+
   " critical tables. No live data or archive content printed.");
 }finally{
  // Dumps include financial and personal data. Never leave plaintext archives on disk.
  await rm(temp,{recursive:true,force:true});
 }
}
main().catch(error=>{console.error(error instanceof Error?error.message:"Rehearsal failed");process.exitCode=1;});
