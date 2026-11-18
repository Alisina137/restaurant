import type {Locale} from "@dineflow/shared";
const en={
 title:"Display receipt gaps",subtitle:"Oldest active tickets without a foreground browser render report. Investigate connectivity and devices; a missing report does not prove food was unseen.",
 toggle:"Review missing reports",close:"Hide diagnostics",minimumAge:"Minimum age",immediate:"All ages",
 age30:"30+ seconds",age60:"1+ minute",age180:"3+ minutes",age300:"5+ minutes",
 noResults:"No active tickets match this filter.",retry:"Retry",refresh:"Refresh diagnostics",
 failed:"Could not verify display receipt gaps. Last results are not current.",
 ticket:"Ticket",table:"Table",state:"Kitchen stage",age:"Waiting for report",details:"View ticket",
 oldest:"Oldest filtered ticket",total:"Matching tickets",measured:"Verified at",
 diagnosis:"Browser report missing — not a kitchen workflow failure or proof nobody saw this order.",
 aging:"Check display connectivity",early:"Awaiting client report",
 next:"Next",previous:"Previous",of:"of",page:"Page",
 disclaimer:"Read-only investigation. Opening ticket details does not confirm kitchen display, acknowledge pickup, or mark food served.",
};
const fa:typeof en={
 title:"گزارش‌های نمایش ثبت‌نشده",subtitle:"قدیمی‌ترین تیکت‌های فعال بدون گزارش نمایش مرورگر آشپزخانه. اتصال و دستگاه‌ها را بررسی کنید؛ نبود گزارش به معنی دیده‌نشدن غذا نیست.",
 toggle:"بررسی گزارش‌های ثبت‌نشده",close:"بستن بررسی",minimumAge:"حداقل مدت",immediate:"همه مدت‌ها",
 age30:"۳۰+ ثانیه",age60:"۱+ دقیقه",age180:"۳+ دقیقه",age300:"۵+ دقیقه",
 noResults:"برای این فیلتر تیکت فعالی یافت نشد.",retry:"تلاش مجدد",refresh:"تازه‌سازی بررسی",
 failed:"گزارش‌های نمایش تأیید نشد. نتایج قبلی تازه نیستند.",
 ticket:"تیکت",table:"میز",state:"مرحله آشپزخانه",age:"انتظار برای گزارش",details:"جزئیات تیکت",
 oldest:"قدیمی‌ترین تیکت فیلترشده",total:"تیکت‌های مطابق",measured:"بررسی‌شده در",
 diagnosis:"گزارش مرورگر ثبت نشده — به معنی خرابی آشپزخانه یا دیده‌نشدن سفارش نیست.",
 aging:"اتصال نمایشگر را بررسی کنید",early:"در انتظار گزارش مرورگر",
 next:"بعدی",previous:"قبلی",of:"از",page:"صفحه",
 disclaimer:"فقط برای بررسی. بازکردن جزئیات به معنی تأیید نمایش، دریافت غذا یا سرو نیست.",
};
const ps:typeof en={
 title:"د ښودنې ناثبت راپورونه",subtitle:"هغه پخواني فعال ټکټونه چې د پخلنځي براوزر د ښودنې راپور نه لري. شبکه او وسیلې وګورئ؛ د راپور نشتوالی د نه لیدلو ثبوت نه دی.",
 toggle:"د ناثبت راپورونو پلټنه",close:"پلټنه پټه کړئ",minimumAge:"تر لږه موده",immediate:"ټولې مودې",
 age30:"۳۰+ ثانیې",age60:"۱+ دقیقه",age180:"۳+ دقیقې",age300:"۵+ دقیقې",
 noResults:"د دې فلټر لپاره فعال ټکټ نشته.",retry:"بیا هڅه",refresh:"پلټنه تازه کړئ",
 failed:"د ښودنې تشې ونه تایید شوې. پخوانۍ پایلې تازه نه دي.",
 ticket:"ټکټ",table:"میز",state:"د پخلنځي پړاو",age:"د راپور انتظار",details:"د ټکټ جزییات",
 oldest:"تر ټولو پخوانی ټکټ",total:"اړوند ټکټونه",measured:"کتل شوي په",
 diagnosis:"د براوزر راپور نشته — د پخلنځي د خرابۍ یا د نه لیدلو ثبوت نه دی.",
 aging:"د سکرین شبکه وګورئ",early:"د براوزر راپور ته انتظار",
 next:"راتلونکی",previous:"مخکینی",of:"له",page:"پاڼه",
 disclaimer:"یوازې پلټنه ده. د جزییاتو خلاصول د ښودنې، اخیستلو یا سرو تایید نه دی.",
};
export type Kitchen31Key=keyof typeof en;
export function k31(locale:Locale,key:Kitchen31Key):string{
 return (locale==="fa-AF"?fa:locale==="ps-AF"?ps:en)[key];
}
