/**
 * Phase 36 — bounded process-local HTTP performance evidence.
 *
 * Records only sanitized route categories, duration and status; never paths,
 * query strings, request/response bodies, identifiers or auth tokens.
 * The rolling 5-minute view contains at most 1024 most recently completed
 * non-health API requests and is NOT a production-wide SLA measurement.
 */
export const PERFORMANCE_WINDOW_MS = 5 * 60_000;
export const PERFORMANCE_CAPACITY = 1024;

export type HttpCategory = "/api/auth"|"/api/guest"|"/api/invitations"|"/api/onboarding"|
 "/api/platform"|"/api/finance"|"/api/subscription"|"/api/orders"|"/api/reports"|
 "/api/floor"|"/api/menu"|"/api/service"|"/api/tenant"|"/api/context"|"/api/other";
export type HttpMeasurement={at:number;route:HttpCategory;status:number;durationMs:number};
export type HttpPerformanceSnapshot={
 windowSeconds:300;sampleCapacity:1024;sampleCount:number;
 limitedToRecentSamples:boolean;sampledFrom:"completed_api_requests_on_this_instance";
 p50Ms:number|null;p95Ms:number|null;serverErrors:number;rateLimited:number;
 slowRequests:number;routeGroups:Array<{route:HttpCategory;count:number;p95Ms:number}>;
 checkedAt:string;
};
const CATEGORY_SET=new Set<HttpCategory>([
 "/api/auth","/api/guest","/api/invitations","/api/onboarding","/api/platform",
 "/api/finance","/api/subscription","/api/orders","/api/reports","/api/floor",
 "/api/menu","/api/service","/api/tenant","/api/context","/api/other"
]);
function percentile(sorted:number[],part:number):number|null{
 if(!sorted.length)return null;
 return sorted[Math.max(0,Math.ceil(sorted.length*part)-1)]!;
}
/** Caller must supply the existing sanitized category, never req.originalUrl. */
export function createHttpPerformanceMonitor(now:()=>number=Date.now){
 const entries:HttpMeasurement[]=[];
 let next=0,totalRecorded=0;
 function record(route:string,status:number,durationMs:number){
  if(!CATEGORY_SET.has(route as HttpCategory)||!Number.isInteger(status)||
     status<100||status>599||!Number.isFinite(durationMs)||durationMs<0)return;
  const entry:HttpMeasurement={at:now(),route:route as HttpCategory,
   status,durationMs:Math.min(300_000,Math.round(durationMs))};
  if(entries.length<PERFORMANCE_CAPACITY)entries.push(entry);
  else {entries[next]=entry;next=(next+1)%PERFORMANCE_CAPACITY;}
  totalRecorded++;
 }
 function snapshot(at=now()):HttpPerformanceSnapshot{
  const recent=entries.filter(x=>x.at<=at&&x.at>at-PERFORMANCE_WINDOW_MS);
  const sorted=recent.map(x=>x.durationMs).sort((a,b)=>a-b);
  const groups=new Map<HttpCategory,number[]>();
  for(const entry of recent){
   if(!groups.has(entry.route))groups.set(entry.route,[]);
   groups.get(entry.route)!.push(entry.durationMs);
  }
  const routeGroups=[...groups].map(([route,durations])=>{
   durations.sort((a,b)=>a-b);
   return {route,count:durations.length,p95Ms:percentile(durations,.95)??0};
  }).sort((a,b)=>b.p95Ms-a.p95Ms||b.count-a.count).slice(0,5);
  return {windowSeconds:300,sampleCapacity:1024,sampleCount:recent.length,
   limitedToRecentSamples:totalRecorded>PERFORMANCE_CAPACITY,
   sampledFrom:"completed_api_requests_on_this_instance",
   p50Ms:percentile(sorted,.5),p95Ms:percentile(sorted,.95),
   serverErrors:recent.filter(x=>x.status>=500).length,
   rateLimited:recent.filter(x=>x.status===429).length,
   slowRequests:recent.filter(x=>x.durationMs>1500).length,
   routeGroups,checkedAt:new Date(at).toISOString()};
 }
 return {record,snapshot};
}
export const httpPerformanceMonitor=createHttpPerformanceMonitor();

export type PoolSample={total:number;idle:number;waiting:number;maxConfigured:number};
export type AvailabilitySignal="API_P95_ELEVATED"|"API_SERVER_ERRORS"|"DB_POOL_WAITING";
export type AvailabilityAssessment={
 level:"insufficient_samples"|"observed"|"investigate";
 signals:AvailabilitySignal[];
 actualSlaCertified:false;
};

/** Informational evidence: no alerts, auto-retries, sign-offs or traffic shedding. */
export function assessAvailability(samples:HttpPerformanceSnapshot,pool:PoolSample):AvailabilityAssessment{
 const signals:AvailabilitySignal[]=[];
 // Require enough observations before issuing a latency trend conclusion.
 if(samples.sampleCount>=20&&(samples.p95Ms??0)>1500)signals.push("API_P95_ELEVATED");
 if(samples.serverErrors>=3)signals.push("API_SERVER_ERRORS");
 if(pool.waiting>=3)signals.push("DB_POOL_WAITING");
 return {level:samples.sampleCount<20?"insufficient_samples":
  signals.length?"investigate":"observed",signals,actualSlaCertified:false};
}
