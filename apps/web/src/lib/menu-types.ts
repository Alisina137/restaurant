import type {Locale} from "@dineflow/shared";
export type Page<T>={items:T[];total:number;page:number;perPage:number};
export type LocalNames={nameFa:string;namePs:string;nameEn:string};
export type Category=LocalNames&{id:string;description:string;sortOrder:number;published:boolean;version:number;archivedAt:string|null};
export type Option=LocalNames&{id:string;groupId:string;deltaMinor:number;active:boolean;sortOrder:number};
export type Group=LocalNames&{id:string;selectionMode:"single"|"multiple";minSelections:number;maxSelections:number;
  version:number;archivedAt:string|null;options:Option[]};
export type ItemRow=LocalNames&{id:string;categoryId:string;categoryName:string;description:string;sku:string|null;
  priceMinor:number;imageId:string|null;published:boolean;soldOut:boolean;soldOutReason:string;
  version:number;createdAt:string;updatedAt:string};
export type ItemDetail=ItemRow&{groupIds:string[];allergens:string[];preparationMinutes:number|null;sortOrder:number;archivedAt:string|null};
export type EditorData={categories:Category[];groups:Group[];revision:{version:number}};
export type Catalog={version:number;currency:string;categories:Category[];
  items:(ItemDetail&{groupIds:string[]})[];groups:Group[]};
export const allergens=["milk","eggs","fish","shellfish","tree-nuts","peanuts","wheat","soy","sesame"] as const;
export function money(minor:number,locale:Locale) {
  const major=(minor/100).toFixed(2);
  return new Intl.NumberFormat(locale,{minimumFractionDigits:2,maximumFractionDigits:2}).format(Number(major))+" AFN";
}
export function moneyInput(minor:number){return (minor/100).toFixed(2);}
export function parseMoney(input:string):number|null {
  if(!/^(0|[1-9]\d{0,6})(\.\d{1,2})?$/.test(input))return null;
  const [whole,fraction=""]=input.split(".");
  const result=Number(whole)*100+Number(fraction.padEnd(2,"0"));
  return Number.isSafeInteger(result)&&result<=1_000_000_000?result:null;
}
export function nameFor(x:LocalNames,locale:Locale){
  return (locale==="en"?x.nameEn:locale==="ps-AF"?x.namePs:x.nameFa)||x.nameFa;
}
