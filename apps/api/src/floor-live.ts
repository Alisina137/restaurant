import {Router} from "express";
import {eq} from "drizzle-orm";
import {db} from "./db";
import {floorRevision} from "./schema";
import {floorScope,floorRoute} from "./floor-helpers";

export const floorLiveRouter=Router();
async function readRevision(locationId:string){
  const [revision]=await db.select({version:floorRevision.version,changedAt:floorRevision.changedAt})
    .from(floorRevision).where(eq(floorRevision.locationId,locationId)).limit(1);
  return revision??{version:0,changedAt:null};
}
floorLiveRouter.get("/revision",floorRoute(async(req,res)=>{
  const scope=await floorScope(req);
  res.setHeader("Cache-Control","no-store");
  res.json(await readRevision(scope.locationId));
}));
floorLiveRouter.get("/events",floorRoute(async(req,res)=>{
  const scope=await floorScope(req);
  res.status(200).setHeader("Content-Type","text/event-stream");
  res.setHeader("Cache-Control","no-cache, no-transform");
  res.setHeader("Connection","keep-alive");
  res.flushHeaders();
  let closed=false,running=false,last=-1;
  async function send(){
    if(closed||running)return;
    running=true;
    try{
      // Membership must remain valid while the stream is open.
      const current=await floorScope(req);
      if(current.tenantId!==scope.tenantId||current.locationId!==scope.locationId){
        closed=true;res.end();return;
      }
      const next=await readRevision(scope.locationId);
      if(next.version!==last){
        last=next.version;
        res.write("event: floor\ndata: "+JSON.stringify(next)+"\n\n");
      }else res.write(": keepalive\n\n");
    }catch{closed=true;res.end();}
    finally{running=false;}
  }
  const timer=setInterval(()=>{void send();},4000);
  res.on("close",()=>{closed=true;clearInterval(timer);});
  await send();
}));
