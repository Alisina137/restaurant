"use client";
import {useEffect,useState} from "react";
import type {Locale} from "@dineflow/shared";
import {AlertTriangle,CheckCircle2,ChevronDown,ChevronUp,RefreshCw,ShieldAlert,Wallet} from "lucide-react";
import {jsonRequest} from "@/lib/phase2-api";
import {money} from "@/lib/finance-types";

export type ShiftAudit42={
 shiftId:string;shiftStatus:string;checkedAt:string;evidence:string;currency:"AFN";
 pilotCertified:false;externalCashVerified:false;
 status:"open_requires_physical_count"|"ledger_consistent"|"investigate"|"supervised_variance";
 requiresInvestigation:boolean;
 signals:Array<"RECORDED_EXPECTED_MISMATCH"|"RECORDED_VARIANCE_MISMATCH"|
  "SETTLED_RECEIPT_MISSING"|"RECEIPT_SNAPSHOT_MISMATCH"|
  "TENDER_ARITHMETIC_MISMATCH"|"NONPOSTED_PAYMENT"|
  "SUPERVISOR_ACK_MISSING"|"VARIANCE_ABOVE_LIMIT">;
 totals:{openingFloatMinor:number;cashMinor:number;transferMinor:number;
  refundedCashMinor:number;refundedTransferMinor:number;netCollectedMinor:number;
  expectedDrawerMinor:number;closingCountMinor:number|null;varianceMinor:number|null;
  recordedExpectedMinor:number|null;recordedVarianceMinor:number|null;
  varianceThresholdMinor:number;postedPayments:number;refundCount:number};
 receipts:{linkedChecks:number;settledChecks:number;receiptCount:number;
  missingReceipts:number;receiptMismatches:number};
 note:string;
};
const words={
 en:{
  title:"Reconcile this shift",subtitle:"Compare saved payments, refunds and immutable receipts",
  refresh:"Check again",loading:"Checking ledger evidence…",error:"Reconciliation unavailable. Do not assume this drawer is balanced.",
  view:"Review settlement evidence",hide:"Hide evidence",
  consistent:"Database ledger matches saved close",open:"Open shift — physical count required",
  investigate:"Mismatch found — investigate",supervised:"Supervisor variance — physically verify",
  cash:"Cash credited",transfer:"Transfer credited",refund:"Cash refunds",transferRefund:"Transfer refunds",
  expected:"Expected drawer",counted:"Counted drawer",variance:"Difference",
  paid:"Posted payments",refunds:"Refund records",receipts:"Receipts found",
  missing:"Missing settled receipts",mismatch:"Receipt discrepancies",limit:"Variance threshold",
  warning:"A matching database does not verify cash in hand, bank transfer evidence or receipt printing. Independent human verification is required.",
  RECORDED_EXPECTED_MISMATCH:"Saved shift expected cash does not match posted cash/refunds.",
  RECORDED_VARIANCE_MISMATCH:"Saved shift variance differs from posted cash and counted drawer.",
  SETTLED_RECEIPT_MISSING:"Some settled checks do not have their immutable receipt.",
  RECEIPT_SNAPSHOT_MISMATCH:"An immutable receipt differs from its settled check/payment totals.",
  TENDER_ARITHMETIC_MISMATCH:"A posted tender has inconsistent received/credited/change amounts.",
  NONPOSTED_PAYMENT:"The shift contains non-posted tender entries; investigate.",
  SUPERVISOR_ACK_MISSING:"Large variance closed without a supervisor acknowledgment.",
  VARIANCE_ABOVE_LIMIT:"The cash discrepancy exceeds the management threshold."
 },
 "fa-AF":{
  title:"تطبیق حساب شیفت",subtitle:"مقایسه پرداخت‌ها، بازپرداخت‌ها و رسیدهای ثبت‌شده",
  refresh:"بررسی دوباره",loading:"در حال بررسی حساب‌ها…",error:"تطبیق حساب در دسترس نیست؛ صندوق را تصفیه‌شده فرض نکنید.",
  view:"بررسی شواهد حساب",hide:"پنهان‌کردن شواهد",
  consistent:"حساب دیتابیس با بستن شیفت مطابقت دارد",open:"شیفت باز است — شمارش واقعی لازم است",
  investigate:"اختلاف یافت شد — بررسی کنید",supervised:"اختلاف ثبت‌شده توسط ناظر — شمارش واقعی لازم است",
  cash:"پول نقد ثبت‌شده",transfer:"انتقال ثبت‌شده",refund:"بازپرداخت نقدی",transferRefund:"بازپرداخت انتقالی",
  expected:"صندوق مورد انتظار",counted:"مبلغ شمرده‌شده",variance:"تفاوت",
  paid:"پرداخت‌های ثبت‌شده",refunds:"موارد بازپرداخت",receipts:"رسیدهای ثبت‌شده",
  missing:"رسیدهای تسویه‌شده ناموجود",mismatch:"اختلاف رسیدها",limit:"حد مجاز اختلاف",
  warning:"تطبیق دیتابیس، وجود پول نقد، صحت انتقال بانکی یا چاپ رسید را تصدیق نمی‌کند. بررسی مستقل انسانی لازم است.",
  RECORDED_EXPECTED_MISMATCH:"مبلغ مورد انتظار ثبت‌شده با پرداخت‌ها و بازپرداخت‌ها یکسان نیست.",
  RECORDED_VARIANCE_MISMATCH:"اختلاف ثبت‌شده با پول نقد و مبلغ شمارش‌شده یکسان نیست.",
  SETTLED_RECEIPT_MISSING:"برخی حساب‌های تسویه‌شده رسید محفوظ ندارند.",
  RECEIPT_SNAPSHOT_MISMATCH:"رسید محفوظ با مبلغ حساب یا پرداخت‌ها یکسان نیست.",
  TENDER_ARITHMETIC_MISMATCH:"پول دریافت‌شده، اعتبار و باقی‌پول یکی از پرداخت‌ها تطبیق نمی‌کند.",
  NONPOSTED_PAYMENT:"پرداخت ثبت‌نشده در شیفت وجود دارد؛ بررسی کنید.",
  SUPERVISOR_ACK_MISSING:"اختلاف بزرگ بدون تأیید ناظر بسته شده است.",
  VARIANCE_ABOVE_LIMIT:"اختلاف صندوق از حد تعیین‌شده بیشتر است."
 },
 "ps-AF":{
  title:"د شیفت حساب پخلا کول",subtitle:"ثبت شوې پیسې، بېرته ورکړې او رسيدونه پرتله کړئ",
  refresh:"بیا وګورئ",loading:"د حساب شواهد کتل کېږي…",error:"د حساب پرتله نشته؛ صندوق برابر مه ګڼئ.",
  view:"د حساب شواهد وګورئ",hide:"شواهد پټ کړئ",
  consistent:"د ډیټابېس حساب له تړل شوي شیفت سره برابر دی",open:"شیفت خلاص دی — رښتینې شمېرنې ته اړتیا ده",
  investigate:"توپیر وموندل شو — وڅېړئ",supervised:"د څارونکي توپیر — د پیسو رښتینې شمېرنه وکړئ",
  cash:"ثبت شوې نغدې",transfer:"ثبت شوې لېږدونه",refund:"نغدې بېرته ورکړې",transferRefund:"د لېږد بېرته ورکړې",
  expected:"اټکل شوې نغدې",counted:"شمېرل شوې نغدې",variance:"توپیر",
  paid:"ثبت شوي ورکړې",refunds:"بېرته ورکړې",receipts:"موندل شوي رسیدونه",
  missing:"د تصفیه شويو حسابونو ورک رسیدونه",mismatch:"د رسید توپیرونه",limit:"د توپیر حد",
  warning:"د ډیټابېس برابر حساب د نغدو شتون، بانکي لېږد یا چاپ شوي رسید ثبوت نه دی. خپلواکه انساني کتنه اړینه ده.",
  RECORDED_EXPECTED_MISMATCH:"د شیفت ثبت شوې اټکل شوې نغدې له حساب سره نه برابرېږي.",
  RECORDED_VARIANCE_MISMATCH:"ثبت شوی توپیر له شمېرل شويو نغدو سره نه برابرېږي.",
  SETTLED_RECEIPT_MISSING:"ځینې تصفیه شوي حسابونه خوندي رسید نه لري.",
  RECEIPT_SNAPSHOT_MISMATCH:"خوندي رسید د حساب یا ورکړو له ارزښت سره توپیر لري.",
  TENDER_ARITHMETIC_MISMATCH:"د ورکړې ټول مبلغ، ترلاسه شوې او پاتې پیسې سمې نه دي.",
  NONPOSTED_PAYMENT:"په شیفت کې ناتایید شوې ورکړې شته.",
  SUPERVISOR_ACK_MISSING:"لوړ توپیر د څارونکي له تایید پرته تړل شوی.",
  VARIANCE_ABOVE_LIMIT:"د صندوق توپیر له ټاکلي حد څخه لوړ دی."
 }
} as const;

export function FinanceShiftReconciliation({shiftId,locale}:{shiftId:string;locale:Locale}){
 const w=words[locale]??words.en;
 const [open,setOpen]=useState(false),[revision,setRevision]=useState(0);
 const [data,setData]=useState<ShiftAudit42|null>(null),[loading,setLoading]=useState(false),
  [error,setError]=useState(false);
 useEffect(()=>{
  if(!open){setData(null);setError(false);return;}
  let active=true;setData(null);setError(false);setLoading(true);
  void jsonRequest<ShiftAudit42>("/api/finance/shifts/"+encodeURIComponent(shiftId)+"/reconciliation")
   .then(value=>{
    if(!active)return;
    if(value.pilotCertified!==false||value.externalCashVerified!==false||
     value.evidence!=="database_ledger_and_immutable_receipt_snapshots")
     throw Error("Invalid reconciliation scope");
    setData(value);
   })
   .catch(()=>{if(active){setData(null);setError(true);}})
   .finally(()=>{if(active)setLoading(false);});
  return()=>{active=false;};
 },[open,revision,shiftId]);
 const status=data?.status??"open_requires_physical_count";
 const statusLabel=status==="ledger_consistent"?w.consistent:status==="open_requires_physical_count"?w.open:
  status==="supervised_variance"?w.supervised:w.investigate;
 return <section className="f42-widget">
  <button className="f42-toggle" type="button" aria-expanded={open}
   onClick={()=>setOpen(v=>!v)}><Wallet size={17} aria-hidden="true"/>
   {open?w.hide:w.view}{open?<ChevronUp size={16} aria-hidden="true"/>:
    <ChevronDown size={16} aria-hidden="true"/>}</button>
  {open&&<div className="f42-body">
   <header className="f42-head"><div><h3>{w.title}</h3><p>{w.subtitle}</p></div>
    <button type="button" className="button button-small" disabled={loading}
     onClick={()=>setRevision(n=>n+1)}><RefreshCw size={15} aria-hidden="true"/>{w.refresh}</button>
   </header>
   {loading&&<p role="status">{w.loading}</p>}
   {error&&<p className="form-error" role="alert">{w.error}</p>}
   {data&&!loading&&!error&&<>
    <p className={"f42-status "+(data.requiresInvestigation?"f42-alert":"")} role="status">
     {data.requiresInvestigation?<AlertTriangle size={18} aria-hidden="true"/>:
      <CheckCircle2 size={18} aria-hidden="true"/>}{statusLabel}</p>
    <div className="f42-metrics">
     {([
      [w.cash,money(data.totals.cashMinor,locale)],
      [w.transfer,money(data.totals.transferMinor,locale)],
      [w.refund,money(data.totals.refundedCashMinor,locale)],
      [w.transferRefund,money(data.totals.refundedTransferMinor,locale)],
      [w.expected,money(data.totals.expectedDrawerMinor,locale)],
      [w.counted,data.totals.closingCountMinor===null?"—":money(data.totals.closingCountMinor,locale)],
      [w.variance,data.totals.varianceMinor===null?"—":money(data.totals.varianceMinor,locale)],
      [w.limit,money(data.totals.varianceThresholdMinor,locale)],
      [w.paid,String(data.totals.postedPayments)],
      [w.refunds,String(data.totals.refundCount)],
      [w.receipts,String(data.receipts.receiptCount)],
      [w.missing,String(data.receipts.missingReceipts)],
      [w.mismatch,String(data.receipts.receiptMismatches)]
     ] as Array<[string,string]>).map(([label,value])=>
      <div className="f42-metric" key={label}><span>{label}</span><strong>{value}</strong></div>)}
    </div>
    {data.signals.length>0&&<div className="f42-signals" role="status">
     {data.signals.map(signal=><p key={signal}><ShieldAlert size={16} aria-hidden="true"/>{w[signal]}</p>)}
    </div>}
    <p className="f42-warning"><ShieldAlert size={16} aria-hidden="true"/>{w.warning}</p>
   </>}
  </div>}
 </section>;
}
