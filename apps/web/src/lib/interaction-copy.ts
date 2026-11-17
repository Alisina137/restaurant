import type {Locale} from "@dineflow/shared";

const words={
  en:{previous:"Previous",next:"Next",page:"Page",of:"of",clearSearch:"Clear search",
    confirm:"Confirm",cancel:"Cancel",retry:"Try again",search:"Search",sort:"Sort by"},
  "fa-AF":{previous:"قبلی",next:"بعدی",page:"صفحه",of:"از",clearSearch:"پاک‌کردن جستجو",
    confirm:"تأیید",cancel:"لغو",retry:"تلاش دوباره",search:"جستجو",sort:"مرتب‌سازی"},
  "ps-AF":{previous:"مخکې",next:"بل",page:"پاڼه",of:"له",clearSearch:"لټون پاکول",
    confirm:"تایید",cancel:"لغوه کول",retry:"بیا هڅه",search:"لټون",sort:"ترتیب"}
} as const;
export type InteractionCopyKey=keyof typeof words.en;
export function ux(locale:Locale,key:InteractionCopyKey):string{
  return words[locale][key];
}
