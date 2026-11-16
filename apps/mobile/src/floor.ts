import type {Locale} from "@dineflow/shared";
export type Status="available"|"occupied"|"cleaning"|"disabled";
export type Table={id:string;label:string;sectionName:string;sectionId:string;seats:number;status:Status;
 assignedWaiterId:string|null;assignedWaiterName:string|null;visitId:string|null;
 visitPartySize:number|null;visitOpenedAt:string|null;version:number;notes:string};
export type Section={id:string;name:string;sortOrder:number};
export type Board={tables:Table[];sections:Section[];actorId:string;role:string;locationId:string};
export const words={
 en:{
 tables:"Tables",all:"All",mine:"Mine",attention:"Needs attention",title:"Dining floor",search:"Table or section",
 available:"Available",occupied:"Occupied",cleaning:"Cleaning",disabled:"Disabled",unassigned:"Unassigned",
 seats:"seats",guests:"guests",waiter:"Waiter",status:"Status",section:"Section",details:"Table details",
 empty:"No tables created yet.",noneMine:"No tables assigned to you. Contact your manager.",
 attentionEmpty:"Service and ready-food alerts begin with ordering in Phases 5–8.",
 retry:"Try again",refresh:"Refresh",loading:"Updating tables…",offline:"Connection lost. Check the API.",
 back:"Back",open:"Seat guests",party:"Party size",confirm:"Open visit",
 markReady:"Mark available",confirmClean:"Confirm the table is cleaned?",
 visit:"Current visit",noVisit:"No active visit",started:"Seated at",
 onlyAssigned:"Only your assigned tables can be opened.",needsWaiter:"Ask the manager to assign a waiter.",
 capacity:"Table capacity",oversize:"Larger groups need manager approval.",pilot:"Ordering starts in Phase 5.",
 myActive:"My active tables",openTables:"Open tables",live:"Live status",noService:"No live service requests yet."
 },
 "fa-AF":{
 tables:"میزها",all:"همه",mine:"میزهای من",attention:"نیاز به رسیدگی",title:"سالن رستورانت",search:"میز یا بخش",
 available:"آزاد",occupied:"مصروف",cleaning:"نظافت",disabled:"غیرفعال",unassigned:"تعیین نشده",
 seats:"چوکی",guests:"مشتری",waiter:"گارسون",status:"وضعیت",section:"بخش",details:"معلومات میز",
 empty:"هنوز میز ثبت نشده است.",noneMine:"میزی به شما سپرده نشده، با مدیر تماس بگیرید.",
 attentionEmpty:"درخواست‌های خدمات و غذای آماده در فازهای ۵ تا ۸ فعال می‌شوند.",
 retry:"تلاش دوباره",refresh:"تازه‌سازی",loading:"در حال تازه‌سازی…",offline:"اتصال برقرار نشد؛ سرور را بررسی کنید.",
 back:"بازگشت",open:"نشاندن مشتری",party:"تعداد مشتری",confirm:"باز کردن نشست",
 markReady:"میز آزاد شد",confirmClean:"نظافت میز تکمیل شده است؟",
 visit:"نشست فعلی",noVisit:"نشست فعال نیست",started:"زمان نشستن",
 onlyAssigned:"فقط میزهایی را که به شما سپرده شده می‌توانید باز کنید.",needsWaiter:"از مدیر بخواهید گارسون تعیین کند.",
 capacity:"ظرفیت میز",oversize:"برای ظرفیت بیشتر تأیید مدیر لازم است.",pilot:"سفارش‌گیری از فاز ۵ آغاز می‌شود.",
 myActive:"میزهای مصروف من",openTables:"دیدن میزها",live:"وضعیت زنده",noService:"درخواست خدمات فعلاً وجود ندارد."
 },
 "ps-AF":{
 tables:"مېزونه",all:"ټول",mine:"زما مېزونه",attention:"پاملرنې ته اړتیا",title:"د رستورانت تالار",search:"مېز یا برخه",
 available:"خالي",occupied:"ډک",cleaning:"پاکول",disabled:"غیرفعال",unassigned:"نه دی ټاکل شوی",
 seats:"څوکۍ",guests:"مېلمانه",waiter:"ګارسون",status:"حالت",section:"برخه",details:"د مېز تفصیل",
 empty:"تراوسه مېز نشته.",noneMine:"تاسو ته مېز نه دی سپارل شوی؛ له مدیر سره خبرې وکړئ.",
 attentionEmpty:"د خدمت غوښتنې او چمتو خواړو خبرتیاوې په ۵ تر ۸ پړاوونو کې راځي.",
 retry:"بیا هڅه",refresh:"تازه کول",loading:"مېزونه تازه کېږي…",offline:"له سرور سره اړیکه نشته.",
 back:"بېرته",open:"مېلمانه کېنول",party:"د مېلمنو شمېر",confirm:"ناسته پرانیستل",
 markReady:"مېز خالي کړئ",confirmClean:"مېز پاک شوی دی؟",
 visit:"اوسنۍ ناسته",noVisit:"ناسته نشته",started:"د ناستې پیل",
 onlyAssigned:"یوازې خپل ټاکل شوي مېزونه پرانیستلای شئ.",needsWaiter:"لومړی له مدیر څخه ګارسون وغواړئ.",
 capacity:"د مېز ظرفیت",oversize:"له ظرفیت زیات مېلمانه د مدیر اجازې ته اړتیا لري.",pilot:"فرمایشونه په پنځم پړاو کې پیلېږي.",
 myActive:"زما ډک مېزونه",openTables:"مېزونه وګورئ",live:"ژوندی حالت",noService:"تراوسه د خدمت غوښتنه نشته."
 }
} as const;
export type FloorWord=keyof typeof words.en;
export function f(locale:Locale,key:FloorWord){return words[locale][key]??words.en[key];}
export function since(value:string|null,locale:Locale){if(!value)return "—";return new Date(value).toLocaleTimeString(locale,{hour:"2-digit",minute:"2-digit"});}
