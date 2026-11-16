import {Router,type Request} from "express";
import {sql,eq,and,desc,count,like} from "drizzle-orm";
import {randomUUID} from "node:crypto";
import {db} from "./db";
import {financeScope,type FinanceScope} from "./finance-core";
import {auditEvent,restaurantSetting,diningVisit,diningCheck,menuCategory} from "./schema";
import {fail,route} from "./menu-helpers";

export const reportingRouter=Router();
type Range={from:string;to:string;timezone:string;days:string[]};
type DbRow=Record<string,unknown>;
function num(x:unknown):number{
 const n=Number(x??0);
 if(!Number.isSafeInteger(n))fail(409,"REPORT_LIMIT","Report monetary totals exceed safe precision.");
 return n;
}
function dateOnly(x:string){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(x))fail(400,"INVALID_DATE","Use a valid ISO YYYY-MM-DD date.");
 const d=new Date(x+"T00:00:00.000Z");
 if(!Number.isFinite(d.getTime())||d.toISOString().slice(0,10)!==x)
  fail(400,"INVALID_DATE","This calendar date does not exist.");
 return d;
}
const dateString=(date:Date)=>date.toISOString().slice(0,10);
function businessToday(timezone:string){
 try{
  const parts=new Intl.DateTimeFormat("en-US",{timeZone:timezone,year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(new Date());
  const get=(type:string)=>parts.find(p=>p.type===type)?.value;
  const value=get("year")+"-"+get("month")+"-"+get("day");
  dateOnly(value);return value;
 }catch{return fail(409,"INVALID_TIMEZONE","Restaurant timezone must be a valid IANA zone.");}
}
async function reportRange(req:Request,scope:FinanceScope):Promise<Range>{
 const [setting]=await db.select({timezone:restaurantSetting.timezone}).from(restaurantSetting)
  .where(eq(restaurantSetting.tenantId,scope.tenantId)).limit(1);
 const timezone=setting?.timezone??"Asia/Kabul";
 const today=businessToday(timezone),end=typeof req.query.to==="string"?req.query.to:today;
 const todayDate=dateOnly(today),endDate=dateOnly(end);
 const startDefault=new Date(endDate);startDefault.setUTCDate(startDefault.getUTCDate()-6);
 const from=typeof req.query.from==="string"?req.query.from:dateString(startDefault);
 const fromDate=dateOnly(from);
 const span=Math.round((endDate.getTime()-fromDate.getTime())/86400000);
 if(span<0||span>=90||endDate>todayDate)fail(400,"INVALID_RANGE",
  "Reports allow up to 90 completed/current restaurant business days ending no later than today.");
 const days=Array.from({length:span+1},(_,n)=>dateString(new Date(fromDate.getTime()+n*86400000)));
 return {from,to:end,timezone,days};
}
async function rows<T extends DbRow>(query:ReturnType<typeof sql>):Promise<T[]>{
 const result=await db.execute(query);
 return (result as unknown as {rows:T[]}).rows;
}
const sum=(values:number[])=>values.reduce((a,b)=>a+b,0);
const n=(r:DbRow,key:string)=>num(r[key]);
async function salesData(scope:FinanceScope,range:Range){
 const {tenantId:t,locationId:l}=scope,{from,to,timezone:tz,days}=range;
 const [settled,tenders,refunds]=await Promise.all([
  rows(sql`
   SELECT (c.settled_at AT TIME ZONE ${tz})::date::text AS day,
    COUNT(*)::bigint AS checks,
    SUM(c.subtotal_minor)::bigint AS gross_minor,
    SUM(c.discount_minor)::bigint AS discounts_minor,
    SUM(c.tax_minor)::bigint AS tax_minor,
    SUM(c.service_minor)::bigint AS service_minor,
    SUM(c.total_minor)::bigint AS sold_minor
   FROM dining_checks c
   WHERE c.tenant_id=${t} AND c.location_id=${l} AND c.status='settled'
    AND c.settled_at >= (${from}::date::timestamp AT TIME ZONE ${tz})
    AND c.settled_at < ((${to}::date+1)::timestamp AT TIME ZONE ${tz})
   GROUP BY day ORDER BY day`),
  rows(sql`
   SELECT (p.created_at AT TIME ZONE ${tz})::date::text AS day,
    COALESCE(SUM(CASE WHEN p.method='cash' THEN p.amount_minor ELSE 0 END),0)::bigint AS cash_minor,
    COALESCE(SUM(CASE WHEN p.method='manual_transfer' THEN p.amount_minor ELSE 0 END),0)::bigint AS transfer_minor,
    COUNT(*)::bigint AS tenders
   FROM check_payments p
   WHERE p.tenant_id=${t} AND p.location_id=${l} AND p.status='posted'
    AND p.created_at >= (${from}::date::timestamp AT TIME ZONE ${tz})
    AND p.created_at < ((${to}::date+1)::timestamp AT TIME ZONE ${tz})
   GROUP BY day ORDER BY day`),
  rows(sql`
   SELECT (r.posted_at AT TIME ZONE ${tz})::date::text AS day,
    COALESCE(SUM(CASE WHEN r.method='cash' THEN r.amount_minor ELSE 0 END),0)::bigint AS cash_minor,
    COALESCE(SUM(CASE WHEN r.method='manual_transfer' THEN r.amount_minor ELSE 0 END),0)::bigint AS transfer_minor,
    COUNT(*)::bigint AS refunds
   FROM finance_refunds r
   WHERE r.tenant_id=${t} AND r.location_id=${l}
    AND r.posted_at >= (${from}::date::timestamp AT TIME ZONE ${tz})
    AND r.posted_at < ((${to}::date+1)::timestamp AT TIME ZONE ${tz})
   GROUP BY day ORDER BY day`)
 ]);
 const by=(arr:DbRow[])=>new Map(arr.map(x=>[String(x.day),x]));
 const s=by(settled),p=by(tenders),r=by(refunds);
 const daily=days.map(day=>{
  const a=s.get(day)??{},b=p.get(day)??{},c=r.get(day)??{};
  const cashMinor=n(b,"cash_minor"),transferMinor=n(b,"transfer_minor");
  const refundedCashMinor=n(c,"cash_minor"),refundedTransferMinor=n(c,"transfer_minor");
  return {day,settledChecks:n(a,"checks"),grossMinor:n(a,"gross_minor"),
   discountsMinor:n(a,"discounts_minor"),taxMinor:n(a,"tax_minor"),
   serviceMinor:n(a,"service_minor"),soldMinor:n(a,"sold_minor"),
   cashMinor,transferMinor,tenders:n(b,"tenders"),
   refundedCashMinor,refundedTransferMinor,refunds:n(c,"refunds"),
   paidMinor:cashMinor+transferMinor,refundedMinor:refundedCashMinor+refundedTransferMinor,
   netCollectedMinor:cashMinor+transferMinor-refundedCashMinor-refundedTransferMinor};
 });
 const metrics=["settledChecks","grossMinor","discountsMinor","taxMinor","serviceMinor","soldMinor",
  "cashMinor","transferMinor","tenders","refundedCashMinor","refundedTransferMinor",
  "refunds","paidMinor","refundedMinor","netCollectedMinor"] as const;
 const totals=Object.fromEntries(metrics.map(k=>[k,sum(daily.map(row=>row[k]))]));
 return {...range,daily,totals,currency:"AFN",accountingBasis:{
  sales:"Settled checks, attributed to settlement business date; check totals snapshot after discounts.",
  collections:"Posted payment and refund ledger, attributed to each posting business date.",
  note:"Sales and collections may differ because a tender, settlement and refund can occur on different dates. Never add sales and collections together."}};
}
async function itemsData(scope:FinanceScope,range:Range,category:string){
 const {tenantId:t,locationId:l}=scope,{from,to,timezone:tz}=range;
 if(category.length>100)fail(400,"INVALID_CATEGORY","Invalid category filter.");
 const result=await rows(sql`
 WITH eligible AS (
   SELECT ln.id,ln.item_id,ln.item_name_fa,ln.item_name_ps,ln.item_name_en,
      ln.quantity,ln.line_total_minor,mi.category_id,
      c.id AS check_id,c.subtotal_minor,c.discount_minor,
      COALESCE(FLOOR(ln.line_total_minor::numeric*c.discount_minor/NULLIF(c.subtotal_minor,0)),0)::bigint AS share,
      COALESCE(ln.line_total_minor::numeric*c.discount_minor/NULLIF(c.subtotal_minor,0),0) AS exact_share
   FROM order_lines ln
   INNER JOIN order_rounds o ON o.id=ln.round_id AND o.tenant_id=${t} AND o.location_id=${l}
   INNER JOIN dining_checks c ON c.visit_id=o.visit_id AND c.tenant_id=${t}
     AND c.location_id=${l} AND c.status='settled'
   INNER JOIN menu_items mi ON mi.id=ln.item_id AND mi.tenant_id=${t}
   WHERE ln.tenant_id=${t} AND ln.location_id=${l} AND o.status <> 'voided'
     AND c.settled_at >= (${from}::date::timestamp AT TIME ZONE ${tz})
     AND c.settled_at < ((${to}::date+1)::timestamp AT TIME ZONE ${tz})
 ),
 allocated AS (
  SELECT *,
    share + CASE WHEN ROW_NUMBER() OVER(
       PARTITION BY check_id ORDER BY exact_share-share DESC,id)
       <= discount_minor-SUM(share) OVER(PARTITION BY check_id) THEN 1 ELSE 0 END
      AS allocated_discount
  FROM eligible
 )
 SELECT item_id AS "itemId",item_name_fa AS "nameFa",item_name_ps AS "namePs",
   item_name_en AS "nameEn",category_id AS "categoryId",
   SUM(quantity)::bigint AS quantity,
   SUM(line_total_minor)::bigint AS "grossMinor",
   SUM(allocated_discount)::bigint AS "discountMinor",
   SUM(line_total_minor-allocated_discount)::bigint AS "netMinor",
   COUNT(*)::bigint AS lines
 FROM allocated
 WHERE ${category}='' OR category_id=${category}
 GROUP BY item_id,item_name_fa,item_name_ps,item_name_en,category_id
 ORDER BY "netMinor" DESC,quantity DESC,item_id
 LIMIT 5001`);
 if(result.length>5000)fail(413,"REPORT_LIMIT","More than 5000 product rows. Narrow the date range.");
 return {...range,currency:"AFN",items:result.map(x=>({
  itemId:String(x.itemId),nameFa:String(x.nameFa),namePs:String(x.namePs),nameEn:String(x.nameEn),
  categoryId:String(x.categoryId),quantity:n(x,"quantity"),grossMinor:n(x,"grossMinor"),
  discountMinor:n(x,"discountMinor"),netMinor:n(x,"netMinor"),lines:n(x,"lines") })),
 note:"Includes items on settled, non-voided rounds. Discounts allocated across line snapshots using deterministic largest-remainder rounding. Category refers to current catalog classification; historical item names are snapshots."};
}
async function serviceData(scope:FinanceScope,range:Range){
 const {tenantId:t,locationId:l}=scope,{from,to,timezone:tz}=range;
 const [tickets,approvals,lines]=await Promise.all([
  rows(sql`
   SELECT COUNT(*)::bigint AS tickets,
     COUNT(*) FILTER (WHERE k.status='voided')::bigint AS cancelled_tickets,
     COUNT(*) FILTER (WHERE k.ready_at IS NOT NULL AND k.started_at IS NOT NULL)::bigint AS prepared,
     COUNT(*) FILTER (WHERE k.served_at IS NOT NULL AND k.ready_at IS NOT NULL)::bigint AS served,
     percentile_cont(0.5) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM k.ready_at-k.started_at))
       FILTER (WHERE k.ready_at IS NOT NULL AND k.started_at IS NOT NULL) AS "prepMedianSeconds",
     percentile_cont(0.95) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM k.ready_at-k.started_at))
       FILTER (WHERE k.ready_at IS NOT NULL AND k.started_at IS NOT NULL) AS "prepP95Seconds",
     percentile_cont(0.5) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM k.served_at-k.ready_at))
       FILTER (WHERE k.served_at IS NOT NULL AND k.ready_at IS NOT NULL) AS "handoffMedianSeconds"
   FROM kitchen_tickets k
   WHERE k.tenant_id=${t} AND k.location_id=${l}
    AND k.created_at >= (${from}::date::timestamp AT TIME ZONE ${tz})
    AND k.created_at < ((${to}::date+1)::timestamp AT TIME ZONE ${tz})`),
  rows(sql`
   SELECT COUNT(*) FILTER (WHERE status IN ('approved','rejected'))::bigint AS reviewed,
     percentile_cont(0.5) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM decided_at-created_at))
       FILTER (WHERE decided_at IS NOT NULL) AS "approvalMedianSeconds",
     percentile_cont(0.95) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM decided_at-created_at))
       FILTER (WHERE decided_at IS NOT NULL) AS "approvalP95Seconds"
   FROM guest_submissions
   WHERE tenant_id=${t} AND location_id=${l}
    AND created_at >= (${from}::date::timestamp AT TIME ZONE ${tz})
    AND created_at < ((${to}::date+1)::timestamp AT TIME ZONE ${tz})`),
  rows(sql`
   SELECT COALESCE(SUM(ln.quantity),0)::bigint AS items,
    COALESCE(SUM(ln.quantity) FILTER (WHERE o.status='voided'),0)::bigint AS cancelled
   FROM order_lines ln
   INNER JOIN order_rounds o ON o.id=ln.round_id AND o.tenant_id=${t} AND o.location_id=${l}
   WHERE ln.tenant_id=${t} AND ln.location_id=${l}
     AND o.created_at >= (${from}::date::timestamp AT TIME ZONE ${tz})
     AND o.created_at < ((${to}::date+1)::timestamp AT TIME ZONE ${tz})`)
 ]);
 const ticket=tickets[0]??{},approval=approvals[0]??{},item=lines[0]??{};
 const duration=(x:unknown,samples:number)=>samples>=3&&x!==null&&x!==undefined?
  Math.round(Number(x)):null;
 const prepared=n(ticket,"prepared"),served=n(ticket,"served"),reviewed=n(approval,"reviewed");
 const items=n(item,"items"),cancelledItems=n(item,"cancelled");
 return {...range,metrics:{
  tickets:n(ticket,"tickets"),cancelledTickets:n(ticket,"cancelled_tickets"),prepared,served,reviewed,
  prepMedianSeconds:duration(ticket.prepMedianSeconds,prepared),
  prepP95Seconds:duration(ticket.prepP95Seconds,prepared),
  handoffMedianSeconds:duration(ticket.handoffMedianSeconds,served),
  approvalMedianSeconds:duration(approval.approvalMedianSeconds,reviewed),
  approvalP95Seconds:duration(approval.approvalP95Seconds,reviewed),
  items,cancelledItems,cancelRatePercent:items?Math.round(10000*cancelledItems/items)/100:null},
 note:"Ticket/approval cohorts are grouped by creation business day. Timings require three observations; no values are fabricated when data is insufficient."};
}
async function auditData(scope:FinanceScope,range:Range,page:number,action:string){
 const {tenantId:t}=scope,{from,to,timezone:tz}=range;
 const data=await rows(sql`
 SELECT id,user_id AS "actorId",action,created_at AS "createdAt",
    CASE WHEN details ? 'checkId' THEN details->>'checkId' ELSE NULL END AS "checkId"
 FROM audit_events
 WHERE tenant_id=${t}
   AND created_at >= (${from}::date::timestamp AT TIME ZONE ${tz})
   AND created_at < ((${to}::date+1)::timestamp AT TIME ZONE ${tz})
   AND (${action}='' OR action ILIKE ${"%"+action+"%"})
 ORDER BY created_at DESC,id DESC
 LIMIT 20 OFFSET ${(page-1)*20}`);
 const total=await rows(sql`
 SELECT COUNT(*)::bigint AS n FROM audit_events
 WHERE tenant_id=${t}
  AND created_at >= (${from}::date::timestamp AT TIME ZONE ${tz})
  AND created_at < ((${to}::date+1)::timestamp AT TIME ZONE ${tz})
  AND (${action}='' OR action ILIKE ${"%"+action+"%"})`);
 return {...range,items:data.map(row=>({id:String(row.id),actorId:row.actorId===null?null:String(row.actorId),
  action:String(row.action),createdAt:row.createdAt,checkId:row.checkId===null?null:String(row.checkId)})),
  total:n(total[0]??{},"n"),page,perPage:20};
}
function csvCell(value:unknown):string{
 const raw=String(value??"");
 // Defend against spreadsheet formula injection even if a user-controlled name starts with whitespace.
 const safe=/^-?\d+(\.\d+)?$/.test(raw)?raw:/^\s*[=+@\-\t\r]/.test(raw)?"'"+raw:raw;
 return '"'+safe.replaceAll('"','""')+'"';
}
function csv(header:string[],data:unknown[][]){
 return "\uFEFF"+[header,...data].map(row=>row.map(csvCell).join(",")).join("\r\n")+"\r\n";
}
async function logExport(scope:FinanceScope,kind:string,range:Range,rowCount:number){
 await db.insert(auditEvent).values({id:randomUUID(),userId:scope.actorId,
  tenantId:scope.tenantId,action:"report.exported",
  details:{kind,from:range.from,to:range.to,rowCount,locationId:scope.locationId}});
}
function download(res:import("express").Response,kind:string,range:Range,content:string){
 res.setHeader("Cache-Control","private, no-store, max-age=0");
 res.setHeader("Content-Type","text/csv; charset=utf-8");
 res.setHeader("Content-Disposition",'attachment; filename="dineflow-'+kind+'-'+range.from+'_'+range.to+'.csv"');
 res.setHeader("X-Content-Type-Options","nosniff");
 res.setHeader("Access-Control-Expose-Headers","Content-Disposition");
 res.send(content);
}
reportingRouter.get("/sales",route(async(req,res)=>{
 const scope=await financeScope(req,true),range=await reportRange(req,scope);
 res.setHeader("Cache-Control","no-store");
 res.json(await salesData(scope,range));
}));
reportingRouter.get("/categories",route(async(req,res)=>{
 const scope=await financeScope(req,true);
 const items=await db.select({id:menuCategory.id,nameFa:menuCategory.nameFa,
   namePs:menuCategory.namePs,nameEn:menuCategory.nameEn})
  .from(menuCategory).where(and(eq(menuCategory.tenantId,scope.tenantId),
   eq(menuCategory.locationId,scope.locationId)))
  .orderBy(menuCategory.sortOrder,menuCategory.id).limit(200);
 res.setHeader("Cache-Control","no-store");res.json({items});
}));
reportingRouter.get("/items",route(async(req,res)=>{
 const scope=await financeScope(req,true),range=await reportRange(req,scope);
 const category=typeof req.query.category==="string"?req.query.category:"";
 res.setHeader("Cache-Control","no-store");
 res.json(await itemsData(scope,range,category));
}));
reportingRouter.get("/service",route(async(req,res)=>{
 const scope=await financeScope(req,true),range=await reportRange(req,scope);
 res.setHeader("Cache-Control","no-store");
 res.json(await serviceData(scope,range));
}));
reportingRouter.get("/audit",route(async(req,res)=>{
 const scope=await financeScope(req,true),range=await reportRange(req,scope);
 const raw=typeof req.query.page==="string"?Number(req.query.page):1;
 const page=Number.isSafeInteger(raw)&&raw>0&&raw<=10000?raw:1;
 const action=typeof req.query.action==="string"?req.query.action.trim():"";
 if(action.length>70)fail(400,"INVALID_FILTER","Action filter is too long.");
 res.setHeader("Cache-Control","no-store");
 res.json(await auditData(scope,range,page,action));
}));
reportingRouter.get("/overview",route(async(req,res)=>{
 const scope=await financeScope(req,true),range=await reportRange(req,scope);
 const today=range.days.at(-1)!;
 const day={...range,from:today,to:today,days:[today]};
 const [sales,active,unpaid,orders]=await Promise.all([
  salesData(scope,day),
  db.select({n:count()}).from(diningVisit).where(and(eq(diningVisit.tenantId,scope.tenantId),
   eq(diningVisit.locationId,scope.locationId),eq(diningVisit.status,"open"))),
  db.select({n:count()}).from(diningCheck).where(and(eq(diningCheck.tenantId,scope.tenantId),
   eq(diningCheck.locationId,scope.locationId),eq(diningCheck.status,"open"),
   sql`${diningCheck.totalMinor}>${diningCheck.paidMinor}`)),
  rows(sql`SELECT COUNT(*)::bigint AS n FROM order_rounds
   WHERE tenant_id=${scope.tenantId} AND location_id=${scope.locationId}
   AND created_at >= (${today}::date::timestamp AT TIME ZONE ${range.timezone})
   AND created_at < ((${today}::date+1)::timestamp AT TIME ZONE ${range.timezone})
   AND status<>'voided'`)
 ]);
 res.setHeader("Cache-Control","no-store");
 res.json({businessDate:today,timezone:range.timezone,activeTables:active[0]?.n??0,
  unpaidChecks:unpaid[0]?.n??0,ordersToday:n(orders[0]??{},"n"),
  netCollectedTodayMinor:sales.totals.netCollectedMinor,
  cashTodayMinor:sales.totals.cashMinor,refundsTodayMinor:sales.totals.refundedMinor});
}));
reportingRouter.get("/export",route(async(req,res)=>{
 const scope=await financeScope(req,true),range=await reportRange(req,scope);
 const kind=typeof req.query.kind==="string"?req.query.kind:"";
 if(!["sales","items","service","transactions","audit"].includes(kind))
  fail(400,"INVALID_EXPORT","Unsupported export type.");
 let content="",rowCount=0;
 if(kind==="sales"){
  const report=await salesData(scope,range);rowCount=report.daily.length;
  const keys=["day","settledChecks","grossMinor","discountsMinor","taxMinor","serviceMinor",
    "soldMinor","cashMinor","transferMinor","paidMinor","refundedCashMinor",
    "refundedTransferMinor","refundedMinor","netCollectedMinor"] as const;
  content=csv([...keys],report.daily.map(d=>keys.map(k=>d[k])));
 }else if(kind==="items"){
  const report=await itemsData(scope,range,typeof req.query.category==="string"?req.query.category:"");
  rowCount=report.items.length;
  const keys=["itemId","nameFa","namePs","nameEn","categoryId","quantity","grossMinor","discountMinor","netMinor"] as const;
  content=csv([...keys],report.items.map(item=>keys.map(k=>item[k])));
 }else if(kind==="service"){
  const report=await serviceData(scope,range);rowCount=1;
  content=csv(["metric","value"],Object.entries(report.metrics));
 }else if(kind==="audit"){
  // Cap exports and fail instead of silently delivering incomplete auditing evidence.
  const {tenantId:t}=scope,{from,to,timezone:tz}=range;
  const action=typeof req.query.action==="string"?req.query.action.trim():"";
  if(action.length>70)fail(400,"INVALID_FILTER","Action filter is too long.");
  const data=await rows(sql`SELECT id,user_id AS "actorId",action,created_at AS "createdAt"
    FROM audit_events WHERE tenant_id=${t}
     AND created_at >= (${from}::date::timestamp AT TIME ZONE ${tz})
     AND created_at < ((${to}::date+1)::timestamp AT TIME ZONE ${tz})
     AND (${action}='' OR action ILIKE ${"%"+action+"%"})
    ORDER BY created_at DESC,id DESC LIMIT 5001`);
  if(data.length>5000)fail(413,"EXPORT_LIMIT","More than 5000 rows. Narrow the date range.");
  rowCount=data.length;
  content=csv(["id","actorId","action","createdAt"],data.map(d=>[d.id,d.actorId,d.action,
   new Date(String(d.createdAt)).toISOString()]));
 }else{
  const {tenantId:t,locationId:l}=scope,{from,to,timezone:tz}=range;
  const method=typeof req.query.method==="string"?req.query.method:"all";
  if(!["all","cash","manual_transfer"].includes(method))fail(400,"INVALID_FILTER","Invalid payment method.");
  const entries=await rows(sql`
   SELECT x.id,x.check_id AS "checkId",x.cashier_id AS "cashierId",
     x.method,x.amount_minor AS "amountMinor",x.posted_at AS "postedAt",x.type
   FROM (
    SELECT id,check_id,cashier_id,method,amount_minor,created_at AS posted_at,'payment' AS type
     FROM check_payments
     WHERE tenant_id=${t} AND location_id=${l} AND status='posted'
      AND (${method}='all' OR method=${method})
      AND created_at >= (${from}::date::timestamp AT TIME ZONE ${tz})
      AND created_at < ((${to}::date+1)::timestamp AT TIME ZONE ${tz})
    UNION ALL
    SELECT id,check_id,cashier_id,method,-amount_minor AS amount_minor,posted_at,'refund' AS type
     FROM finance_refunds
     WHERE tenant_id=${t} AND location_id=${l}
      AND (${method}='all' OR method=${method})
      AND posted_at >= (${from}::date::timestamp AT TIME ZONE ${tz})
      AND posted_at < ((${to}::date+1)::timestamp AT TIME ZONE ${tz})
   ) x ORDER BY x.posted_at DESC,x.id DESC LIMIT 5001`);
  if(entries.length>5000)fail(413,"EXPORT_LIMIT","More than 5000 rows. Narrow the date range.");
  rowCount=entries.length;
  content=csv(["id","checkId","cashierId","type","method","amountMinor","postedAt"],
   entries.map(x=>[x.id,x.checkId,x.cashierId,x.type,x.method,n(x,"amountMinor"),
    new Date(String(x.postedAt)).toISOString()]));
 }
 await logExport(scope,kind,range,rowCount);
 download(res,kind,range,content);
}));
