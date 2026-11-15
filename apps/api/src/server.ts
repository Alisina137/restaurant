import "dotenv/config";
import Fastify from "fastify";
import cors from "@fastify/cors";
import {toNodeHandler,fromNodeHeaders} from "better-auth/node";
import {auth,pool} from "./auth.js";
import {accessFor,authorized} from "./access.js";
const app=Fastify({logger:true,trustProxy:true});
await app.register(cors,{origin:(origin,cb)=>cb(null,!origin||origin===(process.env.WEB_ORIGIN??"http://localhost:3000")),credentials:true});
app.get("/health",async()=>({ok:true,service:"dineflow-api"}));
const authHandler=toNodeHandler(auth);
app.all("/api/auth/*",async(req,reply)=>{
 if(process.env.NODE_ENV==="production"&&req.url.includes("/sign-up/"))return reply.code(403).send({error:{code:"SIGNUP_DISABLED",message:"Registration opens in Phase 2."}});
 reply.hijack();await authHandler(req.raw,reply.raw);
});
app.get("/api/context",async(req,reply)=>{
 const session=await auth.api.getSession({headers:fromNodeHeaders(req.headers)});
 if(!session)return reply.code(401).send({error:{code:"UNAUTHENTICATED",message:"Sign in to continue."}});
 const access=await accessFor(session.user.id);
 return {user:{id:session.user.id,name:session.user.name,email:session.user.email},access};
});
app.get("/api/restaurants/:restaurantId/context",async(req,reply)=>{
 const session=await auth.api.getSession({headers:fromNodeHeaders(req.headers)});
 if(!session)return reply.code(401).send({error:{code:"UNAUTHENTICATED",message:"Sign in to continue."}});
 const id=(req.params as {restaurantId:string}).restaurantId;
 if(!authorized(await accessFor(session.user.id),id,["OWNER","MANAGER","WAITER","KITCHEN","CASHIER"]))return reply.code(403).send({error:{code:"FORBIDDEN",message:"No access to this restaurant."}});
 const found=await pool.query("SELECT id,name FROM restaurants WHERE id=$1",[id]);
 if(!found.rowCount)return reply.code(404).send({error:{code:"NOT_FOUND",message:"Restaurant not found."}});
 return {restaurant:found.rows[0]};
});
app.setErrorHandler((err,req,reply)=>{req.log.error(err);return reply.code(500).send({error:{code:"INTERNAL_ERROR",message:"Unexpected error. Please retry."}})});
await app.listen({host:"0.0.0.0",port:Number(process.env.PORT??4000)});
process.on("SIGTERM",async()=>{await app.close();await pool.end()});
