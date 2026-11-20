import test from "node:test";
import assert from "node:assert/strict";
import {reconcileShiftLedger,type ShiftLedger,type LedgerPayment,
 type LedgerRefund,type LinkedCheck,type LinkedReceipt} from "./phase42-reconciliation";

function fixture(){
 const shift:ShiftLedger={id:"shift-1",status:"closed",openingFloatMinor:10000,
  closingCountMinor:22500,expectedMinor:22500,varianceMinor:0,supervisorId:null};
 const payments:LedgerPayment[]=[
  {checkId:"check-1",method:"cash",status:"posted",amountMinor:15000,
   receivedMinor:16000,changeMinor:1000},
  {checkId:"check-1",method:"manual_transfer",status:"posted",
   amountMinor:5000,receivedMinor:5000,changeMinor:0}
 ];
 const refunds:LedgerRefund[]=[{checkId:"check-1",method:"cash",amountMinor:2500}];
 const checks:LinkedCheck[]=[{id:"check-1",status:"settled",receiptId:"r-1",
  totalMinor:20000,paidMinor:20000}];
 const receipts:LinkedReceipt[]=[{id:"r-1",checkId:"check-1",snapshot:{
  totalMinor:20000,paidMinor:20000,
  payments:[{amountMinor:15000},{amountMinor:5000}]
 }}];
 return {shift,payments,refunds,checks,receipts};
}
test("reconciles cash credited, change and later refunds without rewriting receipt",()=>{
 const f=fixture(),v=reconcileShiftLedger(f.shift,f.payments,f.refunds,f.checks,f.receipts,5000);
 assert.equal(v.status,"ledger_consistent");
 assert.equal(v.requiresInvestigation,false);
 assert.deepEqual(v.signals,[]);
 assert.equal(v.totals.cashMinor,15000);
 assert.equal(v.totals.transferMinor,5000);
 assert.equal(v.totals.refundedCashMinor,2500);
 assert.equal(v.totals.netCollectedMinor,17500);
 assert.equal(v.totals.expectedDrawerMinor,22500);
 assert.equal(v.totals.varianceMinor,0);
 assert.deepEqual(v.receipts,{linkedChecks:1,settledChecks:1,receiptCount:1,
  missingReceipts:0,receiptMismatches:0});
 assert.equal(v.externalCashVerified,false);
 assert.equal(v.pilotCertified,false);
 assert.equal(v.evidence,"database_ledger_and_immutable_receipt_snapshots");
});
test("open shift is an unverified ledger snapshot rather than a physical count",()=>{
 const f=fixture();
 f.shift.status="open";f.shift.closingCountMinor=null;f.shift.expectedMinor=null;f.shift.varianceMinor=null;
 const v=reconcileShiftLedger(f.shift,f.payments,f.refunds,f.checks,f.receipts,5000);
 assert.equal(v.status,"open_requires_physical_count");
 assert.equal(v.totals.varianceMinor,null);
 assert.equal(v.signals.length,0);
 assert.equal(v.externalCashVerified,false);
});
test("requires supervisor acknowledgment when closed variance exceeds policy",()=>{
 const f=fixture();f.shift.closingCountMinor=30000;f.shift.varianceMinor=7500;
 const v=reconcileShiftLedger(f.shift,f.payments,f.refunds,f.checks,f.receipts,5000);
 assert.ok(v.signals.includes("VARIANCE_ABOVE_LIMIT"));
 assert.ok(v.signals.includes("SUPERVISOR_ACK_MISSING"));
 assert.equal(v.requiresInvestigation,true);
 f.shift.supervisorId="supervisor-1";
 const acknowledged=reconcileShiftLedger(f.shift,f.payments,f.refunds,f.checks,f.receipts,5000);
 assert.equal(acknowledged.status,"supervised_variance");
 assert.ok(!acknowledged.signals.includes("SUPERVISOR_ACK_MISSING"));
 assert.equal(acknowledged.requiresInvestigation,true,
  "A DB manager acknowledgment is not a physical drawer reconciliation");
});
test("alerts when closed shift totals disagree with immutable posted payment/refund ledger",()=>{
 const f=fixture();f.shift.expectedMinor=20000;f.shift.varianceMinor=2500;
 const v=reconcileShiftLedger(f.shift,f.payments,f.refunds,f.checks,f.receipts,5000);
 assert.ok(v.signals.includes("RECORDED_EXPECTED_MISMATCH"));
 assert.ok(v.signals.includes("RECORDED_VARIANCE_MISMATCH"));
 assert.equal(v.status,"investigate");
});
test("separately detects missing settled receipt and receipt snapshot mismatch",()=>{
 const f=fixture();
 f.receipts=[];
 const missing=reconcileShiftLedger(f.shift,f.payments,f.refunds,f.checks,f.receipts,5000);
 assert.ok(missing.signals.includes("SETTLED_RECEIPT_MISSING"));
 assert.equal(missing.receipts.missingReceipts,1);
 const changed=fixture();changed.receipts[0]!.snapshot.paidMinor=19999;
 const mismatch=reconcileShiftLedger(changed.shift,changed.payments,changed.refunds,
  changed.checks,changed.receipts,5000);
 assert.equal(mismatch.receipts.receiptMismatches,1);
 assert.ok(mismatch.signals.includes("RECEIPT_SNAPSHOT_MISMATCH"));
});
test("detects bad tender change and nonposted ledger rows, but ignores un-settled receipt absence",()=>{
 const f=fixture();
 f.payments[0]!.changeMinor=1200;
 f.payments[1]!.status="voided";
 f.shift.expectedMinor=22500;
 f.checks[0]!.status="open";
 f.receipts=[];
 const v=reconcileShiftLedger(f.shift,f.payments,f.refunds,f.checks,f.receipts,5000);
 assert.ok(v.signals.includes("TENDER_ARITHMETIC_MISMATCH"));
 assert.ok(v.signals.includes("NONPOSTED_PAYMENT"));
 assert.ok(!v.signals.includes("SETTLED_RECEIPT_MISSING"),
  "Not-yet-settled checks do not require a receipt");
 assert.equal(v.totals.transferMinor,0);
});
