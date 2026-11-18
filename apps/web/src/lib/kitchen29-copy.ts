import type {Locale} from "@dineflow/shared";
const en={
 pulse:"Kitchen performance",pulseNote:"Recorded kitchen activity — not an SLA or estimated completion.",
 sample:"Prepared tickets",median:"Median prep time",p95:"95th percentile prep",
 pending:"Pickup confirmations pending",oldestPending:"Oldest handoff pending",
 window:"Reporting window",lastHour:"Last hour",lastThree:"Last 3 hours",lastSix:"Last 6 hours",
 minutes:"min",noSample:"No prepared tickets in this window",notAvailable:"No measured data",
 serverTime:"Server query",oneRequest:"Batch-loaded ticket details",lastCheck:"Measured",
 standard:"Standard",large:"Large display",displayMode:"Display size",
 largeHint:"Larger type and spacing for shared kitchen screens.",
 failed:"Kitchen performance could not be refreshed. The last result may be outdated.",
 retry:"Retry performance",manyTickets:"All ticket details loaded as one bounded page.",
 uncertainStill:"Unverified kitchen actions remain blocked until individually confirmed from the server.",
 readOnly:"Kitchen status needs a fresh successful server fetch before changes.",
};
const fa:typeof en={
 pulse:"کارایی آشپزخانه",pulseNote:"فعالیت واقعی ثبت‌شده؛ نه تضمین زمان آماده‌سازی.",
 sample:"تیکت‌های آماده‌شده",median:"میانه زمان آماده‌سازی",p95:"صدک ۹۵ زمان آماده‌سازی",
 pending:"تأییدهای دریافت در انتظار",oldestPending:"قدیمی‌ترین تحویل تأییدنشده",
 window:"بازه گزارش",lastHour:"یک ساعت اخیر",lastThree:"۳ ساعت اخیر",lastSix:"۶ ساعت اخیر",
 minutes:"دقیقه",noSample:"در این بازه تیکت آماده‌شده وجود ندارد",notAvailable:"داده اندازه‌گیری‌شده موجود نیست",
 serverTime:"زمان پاسخ سرور",oneRequest:"جزئیات تیکت‌ها یک‌جا بارگیری شد",lastCheck:"اندازه‌گیری‌شده",
 standard:"معمولی",large:"نمای بزرگ",displayMode:"اندازه نمایش",
 largeHint:"متن و فاصله بزرگ‌تر برای صفحه‌های مشترک آشپزخانه.",
 failed:"کارایی آشپزخانه تازه نشد. داده قبلی ممکن است قدیمی باشد.",
 retry:"تلاش دوباره برای گزارش",manyTickets:"جزئیات همه تیکت‌های این صفحه با یک درخواست دریافت شد.",
 uncertainStill:"اقدامات تأییدنشده تا بررسی جداگانه سرور مسدود می‌مانند.",
 readOnly:"پیش از تغییر، اطلاعات آشپزخانه باید از سرور تازه شود.",
};
const ps:typeof en={
 pulse:"د پخلنځي کړنې",pulseNote:"ثبت شوې رښتینې کړنې؛ د چمتو کولو د وخت ضمانت نه دی.",
 sample:"چمتو شوي ټکټونه",median:"د چمتو کولو منځنی وخت",p95:"د چمتو کولو ۹۵مه سلنه",
 pending:"د اخستلو تایید ته انتظار",oldestPending:"تر ټولو پخوانی ناتایید شوی سپارل",
 window:"د راپور موده",lastHour:"وروستی ساعت",lastThree:"وروستي ۳ ساعتونه",lastSix:"وروستي ۶ ساعتونه",
 minutes:"دقیقې",noSample:"په دې موده کې چمتو شوی ټکټ نشته",notAvailable:"اندازه شوې شمېره نشته",
 serverTime:"د سرور ځواب",oneRequest:"د ټکټ معلومات په یوه غوښتنه کې راغلل",lastCheck:"اندازه شوې",
 standard:"عادي",large:"لوی نمایش",displayMode:"د نمایش اندازه",
 largeHint:"د پخلنځي ګډ سکرین لپاره لوی لیک او واټن.",
 failed:"د پخلنځي د کړنو راپور تازه نشو. پخوانۍ شمېرې ښايي زړې وي.",
 retry:"راپور بیا تازه کړئ",manyTickets:"د دې پاڼې ټول ټکټونه په یوه غوښتنه کې راغلل.",
 uncertainStill:"ناتایید شوې کړنې د سرور تر جلا کتنې پورې بندې پاتې کېږي.",
 readOnly:"تر بدلون مخکې د پخلنځي حالت باید له سرور تازه شي.",
};
export type Kitchen29Key=keyof typeof en;
export function k29(locale:Locale,key:Kitchen29Key):string{
 return (locale==="fa-AF"?fa:locale==="ps-AF"?ps:en)[key];
}
