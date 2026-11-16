import type { Request, Response } from "express";
import { fromNodeHeaders } from "better-auth/node";
import { and, eq, sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { auth } from "./auth";
import { db } from "./db";
import { contextFor } from "./context";
import { auditEvent, floorRevision, location } from "./schema";
import { MenuError, fail, route, bodyObject, field, int, bool, version, paging } from "./menu-helpers";

export { fail, route, bodyObject, field, int, bool, version, paging };
export type FloorScope={ tenantId:string; locationId:string; actorId:string; role:"owner"|"manager"|"waiter" };
export async function floorScope(req:Request,manage=false):Promise<FloorScope>{
  const session=await auth.api.getSession({headers:fromNodeHeaders(req.headers)});
  if(!session)fail(401,"UNAUTHENTICATED","Please sign in.");
  const context=await contextFor({id:session.user.id,name:session.user.name,email:session.user.email});
  if(!context || !context.tenantId || !["owner","manager","waiter"].includes(context.role))
    fail(403,"ACCESS_DENIED","Only restaurant managers and waiters may access the floor.");
  if(manage && context.role==="waiter")fail(403,"ACCESS_DENIED","Only managers or owners can make this change.");
  const [branch]=await db.select({id:location.id}).from(location)
    .where(eq(location.tenantId,context.tenantId)).limit(1);
  if(!branch)fail(409,"NO_LOCATION","Configure a restaurant location.");
  return {actorId:session.user.id,tenantId:context.tenantId,locationId:branch.id,
    role:context.role as FloorScope["role"]};
}
export function recordId(value:unknown):string {
  if(typeof value!=="string"||value.length>100||value.length<1)fail(404,"NOT_FOUND","Record unavailable.");
  return value;
}
export function isManager(scope:FloorScope){return scope.role==="owner"||scope.role==="manager";}
export function ensureAssigned(scope:FloorScope,assigned:string|null){
  if(!isManager(scope)&&assigned!==scope.actorId)fail(403,"NOT_ASSIGNED","Your manager must assign this table to you.");
}
export async function bump(tx: Pick<typeof db,"insert">, scope: FloorScope, action:string, details:Record<string,unknown>){
  await tx.insert(floorRevision).values({tenantId:scope.tenantId,locationId:scope.locationId})
    .onConflictDoUpdate({target:floorRevision.locationId,
      set:{version:sql`${floorRevision.version} + 1`,changedAt:new Date()}});
  await tx.insert(auditEvent).values({id:randomUUID(),userId:scope.actorId,
    tenantId:scope.tenantId,action,details});
}
export function conflict(error:unknown):string|null{
  const e=error as {code?:string;constraint?:string;cause?:{code?:string;constraint?:string}};
  if(e.code!=="23505"&&e.cause?.code!=="23505")return null;
  const c=e.constraint??e.cause?.constraint??"";
  return c.includes("one_open_visit")?"ACTIVE_VISIT_EXISTS":
    c.includes("table_label")?"DUPLICATE_TABLE":
    c.includes("section_label")?"DUPLICATE_SECTION":"DUPLICATE";
}
export function floorRoute(handler:(req:Request,res:Response)=>Promise<void>){
  return (req:Request,res:Response)=>{
    void handler(req,res).catch((error:unknown)=>{
      if(res.headersSent){console.error("Floor stream error",error);return;}
      if(error instanceof MenuError){res.status(error.status).json({code:error.code,message:error.message});return;}
      const unique=conflict(error);
      if(unique){res.status(409).json({code:unique,message:unique==="DUPLICATE_TABLE"?"Table label is already used.":
        unique==="DUPLICATE_SECTION"?"Section name is already used.":"Record already exists."});return;}
      console.error("Floor operation failed",error);
      res.status(503).json({code:"SERVICE_UNAVAILABLE",message:"Unable to update floor. Retry."});
    });
  };
}
