import type {Locale} from "@dineflow/shared";
export type CheckRow={id:string|null;visitId:string;tableId:string;tableLabel:string;waiterId:string;
 openedAt:string;status:"open"|"settled";amountMinor:number;paidMinor:number;dueMinor:number;
 partial:boolean;requested:boolean;version:number;splitMode:"single"|"equal"|"items"};
export type CheckPage={items:CheckRow[];total:number;page:number;perPage:number;requestedAvailable:boolean};
export type FinancePolicy={taxRateBps:number;taxInclusive:boolean;serviceRateBps:number;
 serviceFixedMinor:number;receiptFooter:string};
export type FinanceCheck={id:string;visitId:string;tableId:string;number:number;version:number;
 status:"open"|"settled";splitMode:"single"|"equal"|"items";splitCount:number;
 chargePolicy:FinancePolicy;subtotalMinor:number;taxMinor:number;serviceMinor:number;
 totalMinor:number;paidMinor:number;lockedAt:string|null;settledAt:string|null;
 receiptId:string|null;createdAt:string};
export type SnapshotLine={id:string;roundId:string;quantity:number;unitPriceMinor:number;
 lineTotalMinor:number;itemNameFa:string;itemNamePs:string;itemNameEn:string;
 kitchenStatus:string;modifierSnapshot:Array<{nameFa:string;namePs:string;nameEn:string;
 options:Array<{nameFa:string;namePs:string;nameEn:string;deltaMinor:number}>}>};
export type CheckShare={id:string;shareIndex:number;label:string;amountMinor:number;paidMinor:number};
export type Payment={id:string;checkId:string;shareId:string;method:"cash"|"manual_transfer";
 amountMinor:number;receivedMinor:number;changeMinor:number;cashierId:string;
 externalReference:string|null;note:string;createdAt:string};
export type CheckActivity={id:string;action:string;createdAt:string;actorId:string;details:Record<string,unknown>};
export type CheckDetails={check:FinanceCheck;visit:{id:string;status:string;waiterId:string;openedAt:string};
 tableLabel:string;rounds:{id:string;roundNumber:number;createdAt:string;totalMinor:number}[];
 lines:SnapshotLine[];shares:CheckShare[];payments:Payment[];
 activities:CheckActivity[];allocations:Array<{lineId:string;shareId:string;quantity:number;lineAmountMinor:number}>;
 receipt:{id:string}|null;dueMinor:number;timezone:string;currency:"AFN"};
export type Shift={id:string;status:"open"|"closed";cashierId:string;openingFloatMinor:number;
 closingCountMinor:number|null;expectedMinor:number|null;varianceMinor:number|null;
 supervisorId:string|null;openedAt:string;closedAt:string|null};
export type ShiftCurrent={shift:Shift|null;transactions:number;cashMinor:number;transferMinor:number;expectedMinor:number};
export type FinanceTransaction={id:string;checkId:string;checkNumber:number;tableLabel:string;
 amountMinor:number;receivedMinor:number;changeMinor:number;method:string;
 externalReference:string|null;status:string;cashierId:string;createdAt:string};
export type TransactionPage={items:FinanceTransaction[];total:number;page:number;perPage:number;timezone:string};
export type ReceiptEntry={id:string;checkId:string;number:string;tableLabel:string;
 totalMinor:number;reprintCount:number;createdAt:string};
export type ReceiptSnapshot={receiptNumber:string;checkNumber:number;restaurant:string;
 tableLabel:string;issuedAt:string;currency:string;subtotalMinor:number;taxMinor:number;serviceMinor:number;
 totalMinor:number;paidMinor:number;footer:string;
 lines:Array<{nameFa:string;namePs:string;nameEn:string;quantity:number;unitPriceMinor:number;lineTotalMinor:number}>;
 payments:Array<{method:string;amountMinor:number;receivedMinor:number;changeMinor:number;createdAt:string;
 externalReference:string|null}>};
export type ReceiptDetails={id:string;checkId:string;number:string;createdAt:string;reprintCount:number;
 snapshot:ReceiptSnapshot};
export function money(v:number,locale:Locale){
 return new Intl.NumberFormat(locale,{minimumFractionDigits:2,maximumFractionDigits:2}).format(v/100)+" AFN";
}
export const titleName=(x:{itemNameFa:string;itemNamePs:string;itemNameEn:string},locale:Locale)=>
 (locale==="en"?x.itemNameEn:locale==="ps-AF"?x.itemNamePs:x.itemNameFa)||x.itemNameFa;
export const receiptName=(x:{nameFa:string;namePs:string;nameEn:string},locale:Locale)=>
 (locale==="en"?x.nameEn:locale==="ps-AF"?x.namePs:x.nameFa)||x.nameFa;
export function isoTime(x:string|null,locale:Locale){
 if(!x)return "—";return new Date(x).toLocaleString(locale,{year:"numeric",month:"short",day:"numeric",
 hour:"2-digit",minute:"2-digit"});
}
export function parseAFN(raw:string):number|null{
 const normal=raw.trim().replace(/[۰-۹]/g,c=>String(c.charCodeAt(0)-1776))
 .replace(/[٠-٩]/g,c=>String(c.charCodeAt(0)-1632)).replaceAll(",","");
 if(!/^(0|[1-9]\d{0,8})(\.\d{1,2})?$/.test(normal))return null;
 const [whole,dec=""]=normal.split("."),minor=Number(whole)*100+Number(dec.padEnd(2,"0"));
 return Number.isSafeInteger(minor)&&minor<=2_000_000_000?minor:null;
}
export const afnInput=(minor:number)=>String(minor/100);
