import {Router} from "express";
import {sql} from "drizzle-orm";
import {db} from "./db";
import {financeScope} from "./finance-core";
import {fail,route} from "./menu-helpers";
import {itemsData,reportRange,salesData,serviceData,type Range} from "./phase11-reporting";

export const dashboardRouter=Router();
type CountRow=Record<string,unknown>;
function exactNumber(value:unknown):number{
 const number=Number(value??0);
 if(!Number.isSafeInteger(number)||number<0)fail(409,"REPORT_LIMIT","Dashboard count exceeds safe precision.");
 return number;
}
async function liveMetrics(tenantId:string,locationId:string,today:string,timezone:string){
 const result=await db.execute(sql`
 SELECT
  (SELECT COUNT(*)::bigint FROM dining_visits v
    WHERE v.tenant_id=${tenantId} AND v.location_id=${locationId} AND v.status='open') AS "activeTables",
  (SELECT COUNT(DISTINCT v.id)::bigint
   FROM dining_visits v LEFT JOIN dining_checks c ON c.visit_id=v.id AND c.tenant_id=${tenantId}
   WHERE v.tenant_id=${tenantId} AND v.location_id=${locationId} AND v.status='open'
    AND ((c.id IS NOT NULL AND c.status='open' AND c.total_minor>c.paid_minor)
      OR ((c.id IS NULL OR (c.locked_at IS NULL AND c.paid_minor=0 AND c.total_minor=0))
        AND EXISTS (SELECT 1 FROM order_rounds o WHERE o.visit_id=v.id
          AND o.tenant_id=${tenantId} AND o.location_id=${locationId}
          AND o.status='accepted' AND o.total_minor>0)))) AS "unpaidChecks",
  (SELECT COUNT(*)::bigint FROM order_rounds o
    WHERE o.tenant_id=${tenantId} AND o.location_id=${locationId}
    AND o.created_at >= (${today}::date::timestamp AT TIME ZONE ${timezone})
    AND o.created_at < ((${today}::date+1)::timestamp AT TIME ZONE ${timezone})
    AND o.status<>'voided') AS "ordersToday",
  (SELECT COUNT(*)::bigint FROM kitchen_tickets k
    WHERE k.tenant_id=${tenantId} AND k.location_id=${locationId} AND k.status='new') AS "newTickets",
  (SELECT COUNT(*)::bigint FROM kitchen_tickets k
    WHERE k.tenant_id=${tenantId} AND k.location_id=${locationId} AND k.status='preparing') AS "preparingTickets",
  (SELECT COUNT(*)::bigint FROM kitchen_tickets k
    WHERE k.tenant_id=${tenantId} AND k.location_id=${locationId} AND k.status='ready') AS "readyTickets",
  (SELECT COUNT(*)::bigint FROM guest_submissions g
    WHERE g.tenant_id=${tenantId} AND g.location_id=${locationId} AND g.status='pending') AS "pendingGuestApprovals",
  (SELECT COUNT(*)::bigint FROM service_requests s
    WHERE s.tenant_id=${tenantId} AND s.location_id=${locationId} AND s.status='pending') AS "pendingServiceRequests"
 `);
 const row=((result as unknown as {rows:CountRow[]}).rows[0]??{}) as CountRow;
 return Object.fromEntries(["activeTables","unpaidChecks","ordersToday","newTickets",
  "preparingTickets","readyTickets","pendingGuestApprovals","pendingServiceRequests"]
  .map(key=>[key,exactNumber(row[key])]));
}
function priorPeriod(range:Range):Range{
 const count=range.days.length;
 const previousTo=new Date(range.from+"T00:00:00.000Z");
 previousTo.setUTCDate(previousTo.getUTCDate()-1);
 const previousFrom=new Date(previousTo);
 previousFrom.setUTCDate(previousFrom.getUTCDate()-(count-1));
 const asDate=(date:Date)=>date.toISOString().slice(0,10);
 const from=asDate(previousFrom),to=asDate(previousTo);
 return {...range,from,to,days:Array.from({length:count},(_,i)=>{
  const date=new Date(previousFrom);
  date.setUTCDate(date.getUTCDate()+i);
  return asDate(date);
 })};
}
dashboardRouter.get("/dashboard",route(async(req,res)=>{
 // Permission/tenant is enforced by the same financeScope as all management reports.
 const scope=await financeScope(req,true);
 const value=req.query.period;
 if(value!==undefined&&value!=="7"&&value!=="30")
  fail(400,"INVALID_PERIOD","Dashboard period must be 7 or 30 days.");
 if(req.query.from!==undefined||req.query.to!==undefined)
  fail(400,"INVALID_RANGE","Use the dashboard period selector to choose a date range.");
 const period=value==="30"?30:7;
 const range=await reportRange(req,scope,period);
 const prior=priorPeriod(range),today=range.days.at(-1)!;
 const [current,previous,items,service,live]=await Promise.all([
  salesData(scope,range),salesData(scope,prior),itemsData(scope,range,""),
  serviceData(scope,range),liveMetrics(scope.tenantId,scope.locationId,today,range.timezone)
 ]);
 const totals=current.totals,priorTotals=previous.totals;
 res.setHeader("Cache-Control","private, no-store, max-age=0");
 res.json({
  generatedAt:new Date().toISOString(),
  period:{days:period,from:range.from,to:range.to,previousFrom:prior.from,
   previousTo:prior.to,timezone:range.timezone,currency:"AFN",businessDate:today},
  live,
  performance:{
   current:{
    settledChecks:totals.settledChecks,
    netSalesMinor:totals.soldMinor,
    grossSalesMinor:totals.grossMinor,
    netCollectedMinor:totals.netCollectedMinor,
    paidMinor:totals.paidMinor,
    refundedMinor:totals.refundedMinor,
    tenders:totals.tenders,
    cashMinor:totals.cashMinor,
    transferMinor:totals.transferMinor
   },
   previous:{
    settledChecks:priorTotals.settledChecks,
    netSalesMinor:priorTotals.soldMinor,
    netCollectedMinor:priorTotals.netCollectedMinor,
    refundedMinor:priorTotals.refundedMinor
   },
   daily:current.daily.map(d=>({
    date:d.day,netCollectedMinor:d.netCollectedMinor,netSalesMinor:d.soldMinor,
    settledChecks:d.settledChecks,refundsMinor:d.refundedMinor
   }))
  },
  topItems:items.items.slice(0,5).map(i=>({
   itemId:i.itemId,nameFa:i.nameFa,namePs:i.namePs,nameEn:i.nameEn,
   quantity:i.quantity,netMinor:i.netMinor
  })),
  service:{
   tickets:service.metrics.tickets,prepared:service.metrics.prepared,
   served:service.metrics.served,
   prepMedianSeconds:service.metrics.prepMedianSeconds,
   prepP95Seconds:service.metrics.prepP95Seconds,
   cancelledItems:service.metrics.cancelledItems,
   cancelRatePercent:service.metrics.cancelRatePercent
  },
  accountingNote:current.accountingBasis.note
 });
}));
