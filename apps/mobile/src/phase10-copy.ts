import type {Locale} from "@dineflow/shared";
const en={
 cancelOrder:"Request order cancellation",cancelExplain:"Before kitchen preparation, you can request cancellation of this entire order round. A restaurant manager must review it. Prepared or paid items cannot be removed.",
 reason:"Reason for cancellation (minimum 8 characters)",send:"Send for manager review",waiting:"Awaiting manager review",
 approved:"Cancellation applied",rejected:"Request rejected",status:"Correction status",
 sent:"The manager received your request.",confirm:"Send cancellation request?",retry:"Review and retry",busy:"Sending…"
};
const fa={
 cancelOrder:"درخواست لغو سفارش",cancelExplain:"تا پیش از آغاز آماده‌سازی آشپزخانه می‌توانید لغو تمام این دور سفارش را درخواست کنید. مدیر باید بررسی کند؛ غذای آماده یا پرداخت‌شده حذف نمی‌شود.",
 reason:"دلیل لغو (حداقل ۸ حرف)",send:"ارسال برای بررسی مدیر",waiting:"در انتظار بررسی مدیر",
 approved:"لغو اجرا شد",rejected:"درخواست رد شد",status:"وضعیت اصلاح",
 sent:"درخواست به مدیر رسید.",confirm:"درخواست لغو ارسال شود؟",retry:"بررسی و دوباره تلاش کنید",busy:"در حال ارسال…"
};
const ps={
 cancelOrder:"د فرمایش د لغوه کولو غوښتنه",cancelExplain:"د پخلنځي تر چمتووالي مخکې د بشپړ فرمایش لغوه کېدل غوښتلی شئ. مدیر یې ارزوي؛ تیار یا ورکړل شوي توکي نه ړنګېږي.",
 reason:"د لغوه کولو دلیل (لږ تر لږه ۸ توري)",send:"د مدیر کتنې ته لېږل",waiting:"د مدیر د کتنې په تمه",
 approved:"لغوه کول ترسره شول",rejected:"غوښتنه رد شوه",status:"د سمون حالت",
 sent:"غوښتنه مدیر ته ورسېده.",confirm:"د لغوه کولو غوښتنه ولېږل شي؟",retry:"بیا کتنه او هڅه وکړئ",busy:"لېږل کېږي…"
};
export type P10MobileWord=keyof typeof en;
export function p10m(locale:Locale,key:P10MobileWord){return (locale==="en"?en:locale==="ps-AF"?ps:fa)[key]??en[key];}
