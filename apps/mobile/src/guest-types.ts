import type {Locale} from "@dineflow/shared";
export type GuestPreview={nameFa:string;namePs:string;nameEn:string;quantity:number;unitPriceMinor:number;
 lineTotalMinor:number;note:string;modifierSummary:string[]};
export type PendingGuest={id:string;status:"pending"|"approved"|"rejected";version:number;policy:string;
 orderNote:string;preview:GuestPreview[];estimatedMinor:number;rejectionReason:string|null;roundId:string|null;
 tableId:string;tableLabel:string;visitId:string;createdAt:string;decidedAt:string|null};
export type GuestApprovalPage={items:PendingGuest[];total:number;page:number;perPage:number};
export type GuestPin={visitId:string;tableId:string;tableLabel:string;pin:string;version:number;rotatedAt:string};
export function guestName(v:GuestPreview,locale:Locale){return (locale==="en"?v.nameEn:locale==="ps-AF"?v.namePs:v.nameFa)||v.nameFa;}
