import type {Request,RequestHandler} from "express";
import {randomUUID} from "node:crypto";
import {performance} from "node:perf_hooks";

/** Fail closed on unsafe deployment configuration, without affecting local Expo/Next development. */
export function validateProductionEnvironment(env:NodeJS.ProcessEnv=process.env):void{
 if(env.NODE_ENV!=="production")return;
 const missing=["DATABASE_URL","BETTER_AUTH_SECRET","BETTER_AUTH_URL","PUBLIC_WEB_URL",
  "TRUSTED_ORIGINS","RESEND_API_KEY","MAIL_FROM","MEDIA_LOCAL_DIR"].filter(key=>!env[key]?.trim());
 if(missing.length)throw new Error("Production configuration missing: "+missing.join(", "));
 if((env.BETTER_AUTH_SECRET??"").length<32)throw new Error("Production auth secret is too short.");
 if(env.DEV_EMAIL_DELIVERY==="console")throw new Error("Development email delivery cannot run in production.");
 for(const [label,value] of [["BETTER_AUTH_URL",env.BETTER_AUTH_URL!],["PUBLIC_WEB_URL",env.PUBLIC_WEB_URL!],
  ...env.TRUSTED_ORIGINS!.split(",").map(origin=>["TRUSTED_ORIGINS",origin.trim()])]){
  let parsed:URL;
  try{parsed=new URL(value);}catch{throw new Error(label+" must be a valid HTTPS URL.");}
  if(parsed.protocol!=="https:"||parsed.username||parsed.password||parsed.hostname==="localhost"||
    parsed.hostname==="127.0.0.1"||parsed.hostname==="0.0.0.0"||value.includes("*"))
   throw new Error(label+" must use a public HTTPS origin without wildcards or credentials.");
 }
 if(env.TRUST_PROXY_HOPS && !/^[1-3]$/.test(env.TRUST_PROXY_HOPS))
  throw new Error("TRUST_PROXY_HOPS must be 1–3, configured only behind a trusted proxy.");
}

type Window={count:number;expiresAt:number};
export function createWindowLimiter(max:number,windowMs:number,now:()=>number=Date.now,maxKeys=20000){
 if(!Number.isInteger(max)||max<=0||!Number.isInteger(windowMs)||windowMs<=0)
  throw new Error("Invalid rate limit configuration.");
 const buckets=new Map<string,Window>();let calls=0;
 return (key:string):{allowed:boolean;retryAfter:number}=>{
  const time=now();
  if(++calls%256===0||buckets.size>=maxKeys){
   for(const [id,bucket] of buckets)if(bucket.expiresAt<=time)buckets.delete(id);
  }
  const previous=buckets.get(key);
  if(!previous||previous.expiresAt<=time){
   // Fail closed when a bot floods us with distinct client keys.
   if(!previous&&buckets.size>=maxKeys)return {allowed:false,retryAfter:Math.ceil(windowMs/1000)};
   buckets.set(key,{count:1,expiresAt:time+windowMs});
   return {allowed:true,retryAfter:0};
  }
  if(previous.count>=max)return {allowed:false,retryAfter:Math.max(1,Math.ceil((previous.expiresAt-time)/1000))};
  previous.count++;
  return {allowed:true,retryAfter:0};
 };
}

/** Per-instance pressure relief; durable guest PIN attempt limits live in PostgreSQL. */
export function createIpRateLimiter(max:number,windowMs=60_000):RequestHandler{
 const attempt=createWindowLimiter(max,windowMs);
 return (req,res,next)=>{
  const client=req.ip??req.socket.remoteAddress??"unknown";
  const state=attempt(client);
  if(!state.allowed){
   res.setHeader("Retry-After",String(state.retryAfter));
   res.status(429).json({code:"RATE_LIMITED",message:"Too many requests. Try again shortly."});return;
  }
  next();
 };
}

function safeRouteCategory(req:Request):string{
 const path=req.path;
 // Never log raw URL segments: they can contain QR codes, visit IDs or secret references.
 for(const prefix of ["/api/auth","/api/guest","/api/invitations","/api/onboarding","/api/platform",
  "/api/finance","/api/subscription","/api/orders","/api/reports","/api/floor",
  "/api/menu","/api/service","/api/tenant","/api/context","/api/health"]){
  if(path===prefix||path.startsWith(prefix+"/"))return prefix;
 }
 return "/api/other";
}
export const hardenedHeadersAndLogs:RequestHandler=(req,res,next)=>{
 const clientId=req.header("x-request-id");
 const id=clientId&&/^[A-Za-z0-9_-]{8,64}$/.test(clientId)?clientId:randomUUID();
 res.setHeader("X-Request-ID",id);
 res.setHeader("X-Content-Type-Options","nosniff");
 res.setHeader("Referrer-Policy","no-referrer");
 res.setHeader("X-Frame-Options","DENY");
 res.setHeader("Cache-Control","no-store");
 res.setHeader("Permissions-Policy","camera=(), microphone=(), geolocation=()");
 if(process.env.NODE_ENV==="production")res.setHeader("Strict-Transport-Security","max-age=31536000");
 const started=performance.now();
 res.on("finish",()=>{
  if(req.path.startsWith("/api/health")&&res.statusCode<400)return;
  console.info(JSON.stringify({kind:"http",requestId:id,route:safeRouteCategory(req),
   method:req.method,status:res.statusCode,durationMs:Math.round(performance.now()-started)}));
 });
 next();
};
