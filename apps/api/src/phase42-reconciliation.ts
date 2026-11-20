/** Phase 42 — read-only, deterministic ledger-to-shift/receipt reconciliation.
 * All amounts are integer minor units (AFN ×100). A DB match is never a
 * physical drawer count, transfer-provider confirmation, or pilot sign-off.
 */
export type ShiftLedger={
 id:string;status:string;openingFloatMinor:number;closingCountMinor:number|null;
 expectedMinor:number|null;varianceMinor:number|null;supervisorId:string|null;
};
export type LedgerPayment={
 checkId:string;method:string;status:string;amountMinor:number;
 receivedMinor:number;changeMinor:number;
};
export type LedgerRefund={checkId:string;method:string;amountMinor:number};
export type LinkedCheck={
 id:string;status:string;receiptId:string|null;totalMinor:number;paidMinor:number;
};
export type LinkedReceipt={
 id:string;checkId:string;snapshot:{
  totalMinor:number;paidMinor:number;
  payments:Array<{amountMinor:number}>;
 };
};
export type ReconciliationSignal=
 "RECORDED_EXPECTED_MISMATCH"|"RECORDED_VARIANCE_MISMATCH"|
 "SETTLED_RECEIPT_MISSING"|"RECEIPT_SNAPSHOT_MISMATCH"|
 "TENDER_ARITHMETIC_MISMATCH"|"NONPOSTED_PAYMENT"|
 "SUPERVISOR_ACK_MISSING"|"VARIANCE_ABOVE_LIMIT";

export function reconcileShiftLedger(
 shift:ShiftLedger,payments:LedgerPayment[],refunds:LedgerRefund[],
 checks:LinkedCheck[],receipts:LinkedReceipt[],varianceLimitMinor:number
){
 const grossCashMinor=payments.filter(p=>p.method==="cash"&&p.status==="posted")
  .reduce((total,p)=>total+p.amountMinor,0);
 const grossTransferMinor=payments.filter(p=>p.method==="manual_transfer"&&p.status==="posted")
  .reduce((total,p)=>total+p.amountMinor,0);
 const refundedCashMinor=refunds.filter(p=>p.method==="cash")
  .reduce((total,p)=>total+p.amountMinor,0);
 const refundedTransferMinor=refunds.filter(p=>p.method==="manual_transfer")
  .reduce((total,p)=>total+p.amountMinor,0);
 const expectedDrawerMinor=shift.openingFloatMinor+grossCashMinor-refundedCashMinor;
 const varianceMinor=shift.closingCountMinor===null?null:shift.closingCountMinor-expectedDrawerMinor;
 const signals:ReconciliationSignal[]=[];
 const add=(code:ReconciliationSignal,cond:boolean)=>{if(cond)signals.push(code);};
 add("NONPOSTED_PAYMENT",payments.some(p=>p.status!=="posted"));
 add("TENDER_ARITHMETIC_MISMATCH",payments.some(p=>p.status==="posted"&&(
   p.receivedMinor-p.changeMinor!==p.amountMinor||
   (p.method==="manual_transfer"&&p.changeMinor!==0))));
 const receiptByCheck=new Map(receipts.map(r=>[r.checkId,r]));
 let settledChecks=0,receiptCount=0,missingReceipts=0,receiptMismatches=0;
 for(const check of checks){
  if(check.status!=="settled")continue;
  settledChecks++;
  const receipt=receiptByCheck.get(check.id);
  if(!receipt||!check.receiptId||receipt.id!==check.receiptId){
   missingReceipts++;continue;
  }
  receiptCount++;
  const s=receipt.snapshot;
  // Original receipts remain immutable after a later, separately posted refund.
  if(s.totalMinor!==check.totalMinor||s.paidMinor!==check.paidMinor||
    !Array.isArray(s.payments)||
    s.payments.reduce((sum,p)=>sum+p.amountMinor,0)!==s.paidMinor)
   receiptMismatches++;
 }
 add("SETTLED_RECEIPT_MISSING",missingReceipts>0);
 add("RECEIPT_SNAPSHOT_MISMATCH",receiptMismatches>0);
 if(shift.status==="closed"){
  add("RECORDED_EXPECTED_MISMATCH",shift.expectedMinor!==expectedDrawerMinor);
  add("RECORDED_VARIANCE_MISMATCH",shift.closingCountMinor===null||
   shift.varianceMinor!==varianceMinor);
  add("SUPERVISOR_ACK_MISSING",varianceMinor!==null&&
   Math.abs(varianceMinor)>varianceLimitMinor&&!shift.supervisorId);
 }
 add("VARIANCE_ABOVE_LIMIT",varianceMinor!==null&&
  Math.abs(varianceMinor)>varianceLimitMinor);
 const mismatches=signals.filter(s=>s!=="VARIANCE_ABOVE_LIMIT").length;
 return {
  checkedAt:new Date().toISOString(),shiftId:shift.id,shiftStatus:shift.status,
  evidence:"database_ledger_and_immutable_receipt_snapshots",
  currency:"AFN",pilotCertified:false as const,externalCashVerified:false as const,
  totals:{
   openingFloatMinor:shift.openingFloatMinor,
   cashMinor:grossCashMinor,transferMinor:grossTransferMinor,
   refundedCashMinor,refundedTransferMinor,
   netCollectedMinor:grossCashMinor+grossTransferMinor-refundedCashMinor-refundedTransferMinor,
   expectedDrawerMinor,closingCountMinor:shift.closingCountMinor,
   varianceMinor,recordedExpectedMinor:shift.expectedMinor,
   recordedVarianceMinor:shift.varianceMinor,
   varianceThresholdMinor:varianceLimitMinor,
   postedPayments:payments.filter(p=>p.status==="posted").length,refundCount:refunds.length
  },
  receipts:{linkedChecks:checks.length,settledChecks,receiptCount,
   missingReceipts,receiptMismatches},
  signals,requiresInvestigation:mismatches>0||
   (varianceMinor!==null&&Math.abs(varianceMinor)>varianceLimitMinor),
  status:shift.status==="open"?"open_requires_physical_count":
   mismatches>0?"investigate":Math.abs(varianceMinor??0)>varianceLimitMinor?
    "supervised_variance":"ledger_consistent",
  note:"Read-only DB totals; physical cash, bank transfers, printed receipts and any real-world release must be independently checked."
 };
}
