import type {Locale} from "@dineflow/shared";
export type FloorStatus="available"|"occupied"|"cleaning"|"disabled";
export type Section={id:string;name:string;sortOrder:number;active:boolean;version:number;archivedAt:string|null;createdAt:string};
export type Waiter={id:string;name:string};
export type DiningTable={id:string;sectionId:string;sectionName:string;label:string;seats:number;notes:string;sortOrder:number;
 active:boolean;cleaning:boolean;assignedWaiterId:string|null;assignedWaiterName:string|null;version:number;
 archivedAt?:string|null;status:FloorStatus;visitId:string|null;visitPartySize:number|null;visitOpenedAt:string|null;visitWaiterId:string|null};
export type FloorBoard={locationId:string;actorId:string;role:"owner"|"manager"|"waiter";sections:Section[];tables:DiningTable[]};
export type Page<T>={items:T[];total:number;page:number;perPage:number};
export type Visit={id:string;tenantId:string;locationId:string;tableId:string;waiterId:string;partySize:number;
 status:"open"|"closed";openedAt:string;closedAt:string|null;closedReason:string|null};
export function elapsed(iso:string|null,locale:Locale){if(!iso)return "—";
 const mins=Math.max(0,Math.floor((Date.now()-new Date(iso).getTime())/60000));
 return mins<60?new Intl.NumberFormat(locale).format(mins)+"m":
 new Intl.NumberFormat(locale).format(Math.floor(mins/60))+"h "+new Intl.NumberFormat(locale).format(mins%60)+"m";}
