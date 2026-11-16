import type {Locale} from "@dineflow/shared";
export type Name={nameFa:string;namePs:string;nameEn:string};
export type MenuCategory=Name&{id:string;sortOrder:number};
export type MenuOption=Name&{id:string;deltaMinor:number};
export type MenuGroup=Name&{id:string;version:number;selectionMode:"single"|"multiple";minSelections:number;maxSelections:number;options:MenuOption[]};
export type MenuItem=Name&{id:string;categoryId:string;description:string;allergens:string[];priceMinor:number;imageId:string|null;soldOut:boolean;soldOutReason:string;version:number;preparationMinutes:number|null;groupIds:string[]};
export type MenuData={version:number;currency:"AFN";categories:MenuCategory[];items:MenuItem[];groups:MenuGroup[]};
export type CartSelection={groupId:string;version:number;optionIds:string[]};
export type CartLine={itemId:string;itemVersion:number;quantity:number;note:string;selections:CartSelection[]};
export type OrderDraft={lines:CartLine[];note:string;idempotencyKey:string};
export type OrderSummary={id:string;roundNumber:number;visitId:string;tableId:string;tableLabel:string;totalMinor:number;orderNote:string;createdAt:string;status:"new"|"preparing"|"ready"|"picked_up"|"served"|"voided";ticketId:string;ticketVersion:number;startedAt:string|null;readyAt:string|null};
export type SnapshotOption=Name&{id:string;deltaMinor:number};
export type SnapshotGroup=Name&{groupId:string;options:SnapshotOption[]};
export type SnapshotLine={id:string;itemId:string;itemNameFa:string;itemNamePs:string;itemNameEn:string;quantity:number;note:string;kitchenStatus:"new"|"preparing"|"ready"|"picked_up"|"served"|"voided";servedAt:string|null;unitPriceMinor:number;lineTotalMinor:number;modifierSnapshot:SnapshotGroup[];allergens:string[]};
export type OrderDetail={round:{id:string;visitId:string;tableId:string;roundNumber:number;totalMinor:number;subtotalMinor:number;taxMinor:number;serviceMinor:number;status:"accepted"|"voided";orderNote:string;createdAt:string;currency:string;source:string;submittedBy:string};ticket:{id:string;status:"new"|"preparing"|"ready"|"picked_up"|"served"|"voided";version:number;tableLabel:string;createdAt:string;startedAt:string|null;readyAt:string|null}|null;lines:SnapshotLine[];activity:{id:string;action:string;createdAt:string}[]};
export type Page<T>={items:T[];total:number;page:number;perPage:number};
export function nameOf(n:Name,locale:Locale){return (locale==="en"?n.nameEn:locale==="ps-AF"?n.namePs:n.nameFa)||n.nameFa;}
export function price(minor:number,locale:Locale){return new Intl.NumberFormat(locale,{minimumFractionDigits:2,maximumFractionDigits:2}).format(minor/100)+" AFN";}
export function cartPrice(line:CartLine,data:MenuData){const item=data.items.find(i=>i.id===line.itemId);if(!item)return null;
 let addons=0;for(const choice of line.selections){const group=data.groups.find(g=>g.id===choice.groupId);if(!group)return null;
 for(const id of choice.optionIds){const option=group.options.find(o=>o.id===id);if(!option)return null;addons+=option.deltaMinor;}}
 return (item.priceMinor+addons)*line.quantity;}
export function newKey(){return "k"+Date.now().toString(36)+"_"+Math.random().toString(36).slice(2)+Math.random().toString(36).slice(2);}
