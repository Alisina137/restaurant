import type {Locale} from "@dineflow/shared";
export type WebRow={id:string;roundNumber:number;visitId:string;tableId:string;tableLabel:string;totalMinor:number;orderNote:string;createdAt:string;status:"new"|"preparing"|"ready"|"picked_up"|"served"|"voided";ticketId:string;ticketVersion:number;startedAt:string|null;readyAt:string|null;submittedBy:string};
export type WebPage={items:WebRow[];total:number;page:number;perPage:number};
export type SnapshotOption={id:string;nameFa:string;namePs:string;nameEn:string;deltaMinor:number};
export type SnapshotGroup={groupId:string;nameFa:string;namePs:string;nameEn:string;options:SnapshotOption[]};
export type SnapshotLine={id:string;itemNameFa:string;itemNamePs:string;itemNameEn:string;quantity:number;note:string;kitchenStatus:"new"|"preparing"|"ready"|"picked_up"|"served"|"voided";unitPriceMinor:number;lineTotalMinor:number;modifierSnapshot:SnapshotGroup[]};
export type WebDetail={round:{id:string;tableId:string;visitId:string;roundNumber:number;submittedBy:string;
 totalMinor:number;subtotalMinor:number;orderNote:string;createdAt:string};ticket:{id:string;version:number;status:string;tableLabel:string;readyAt:string|null;pickedUpAt:string|null;pickupAcknowledgedAt:string|null;servedAt:string|null;lastNotifiedAt:string|null;notifyCount:number}|null;
 lines:SnapshotLine[];activity:{id:string;action:string;createdAt:string}[]};
export const name=(x:{nameFa:string;namePs:string;nameEn:string},locale:Locale)=>(locale==="en"?x.nameEn:locale==="ps-AF"?x.namePs:x.nameFa)||x.nameFa;
export const amount=(cents:number,locale:Locale)=>new Intl.NumberFormat(locale,{minimumFractionDigits:2,maximumFractionDigits:2}).format(cents/100)+" AFN";

/** P29: one bounded kitchen page request contains the cooked item snapshots. */
export type KitchenCardDetail={
 round:Pick<WebDetail["round"],"orderNote"|"totalMinor">;
 ticket:Pick<NonNullable<WebDetail["ticket"]>,"version"|"pickupAcknowledgedAt">;
 lines:SnapshotLine[];
};
export type KitchenCardPage=WebPage&{
 detailsByRound:Record<string,KitchenCardDetail>;
 serverMs:number;
};
export type KitchenPulse={
 minutes:60|180|360;from:string;checkedAt:string;completed:number;
 prepMedianMinutes:number|null;prepP95Minutes:number|null;
 pendingReceipt:number;oldestPendingReceiptAt:string|null;
};
