import type {Locale} from "@dineflow/shared";
const en={
 title:"Adjustments & Refunds",subtitle:"Every correction is reviewed and recorded. Original receipts and tender records stay unchanged.",
 pending:"Awaiting review",approved:"Approved — ready to refund",rejected:"Rejected",applied:"Completed",
 kind:"Correction type",discount:"Discount",void:"Void unprepared round",refund:"Refund",
 request:"Request correction",reason:"Reason (required)",amount:"Amount (AFN)",round:"Order round",
 review:"Manager review",reviewNote:"Review note",approve:"Approve",reject:"Reject",
 execute:"Record refund",method:"Refund method",cash:"Cash returned",manual_transfer:"Manual bank transfer",
 externalReference:"External reference",verified:"I verified the external refund was completed",
 note:"Cashier note",refresh:"Refresh",reviewHint:"Approval must come from a different manager. Refund payout requires a separate cashier and an open shift.",
 voidHint:"Only an entire order round that kitchen has not started may be voided.",
 discountHint:"Discounts and voids work only before payment or splitting a bill.",
 refundHint:"Refunds apply only to settled checks. Maximum reimbursement equals actual recorded payment less prior refunds.",
 queue:"Correction queue",noRequests:"No corrections match this filter.",error:"Could not complete request.",
 ready:"Ready",all:"All",openCheck:"Open check",check:"Check",checkId:"Check ID",
 amountDue:"Total / paid",alreadyRefunded:"Already returned",submit:"Submit for approval",confirm:"Confirm this permanent financial action?",
 noCheck:"Open a check to request corrections, or enter its ID here.",load:"Load check",status:"Status",
 requestedBy:"Requested by",approvedBy:"Approved by",posted:"Posted",work:"Approval & payout workflow",
 key:"Request ID",new:"New request",version:"Version",submitSuccess:"Request created",
 decisionSuccess:"Decision saved",refundSuccess:"Refund recorded",stale:"The record changed; reload.",
 noShift:"An active cashier shift is required to record a refund.",back:"Back to checks"
};
const fa={
 title:"اصلاحات و بازپرداخت‌ها",subtitle:"هر اصلاح با بررسی و ثبت تاریخچه انجام می‌شود. رسید و پرداخت اصلی تغییر نمی‌کند.",
 pending:"در انتظار بررسی",approved:"تأیید شد — آماده بازپرداخت",rejected:"رد شده",applied:"تکمیل‌شده",
 kind:"نوع اصلاح",discount:"تخفیف",void:"لغو سفارش آماده‌نشده",refund:"بازپرداخت",
 request:"درخواست اصلاح",reason:"دلیل (ضروری)",amount:"مبلغ (افغانی)",round:"دور سفارش",
 review:"بررسی مدیر",reviewNote:"یادداشت بررسی",approve:"تأیید",reject:"رد",
 execute:"ثبت بازپرداخت",method:"روش بازپرداخت",cash:"نقد بازگردانده شد",manual_transfer:"انتقال بانکی دستی",
 externalReference:"شماره مرجع",verified:"بازپرداخت بیرونی را بررسی و تأیید کرده‌ام",
 note:"یادداشت صندوقدار",refresh:"تازه‌سازی",reviewHint:"مدیری متفاوت باید تأیید کند. بازپرداخت را صندوقدار دیگری با شیفت فعال انجام می‌دهد.",
 voidHint:"تنها دور کامل سفارشی که آشپزخانه هنوز شروع نکرده قابل لغو است.",
 discountHint:"تخفیف و لغو فقط پیش از تقسیم یا پرداخت حساب مجاز است.",
 refundHint:"بازپرداخت فقط برای حساب تسویه‌شده است و از مبلغ دریافتی و بازپرداخت‌شده بیشتر نمی‌شود.",
 queue:"صف اصلاحات",noRequests:"درخواستی برای این فیلتر موجود نیست.",error:"عملیات انجام نشد.",
 ready:"آماده",all:"همه",openCheck:"باز کردن حساب",check:"حساب",checkId:"شناسه حساب",
 amountDue:"مجموع / پرداخت‌شده",alreadyRefunded:"بازگردانده‌شده",submit:"ارسال برای تأیید",confirm:"این اقدام مالی دائمی را تأیید می‌کنید؟",
 noCheck:"یک حساب را باز کنید یا شناسه آن را وارد کنید.",load:"بارگذاری حساب",status:"وضعیت",
 requestedBy:"درخواست‌کننده",approvedBy:"تأییدکننده",posted:"ثبت‌شده",work:"گردش تأیید و پرداخت",
 key:"شناسه درخواست",new:"درخواست جدید",version:"نسخه",submitSuccess:"درخواست ثبت شد",
 decisionSuccess:"نتیجه بررسی ثبت شد",refundSuccess:"بازپرداخت ثبت شد",stale:"اطلاعات تغییر کرده؛ تازه‌سازی کنید.",
 noShift:"برای ثبت بازپرداخت شیفت فعال صندوقدار نیاز است.",back:"بازگشت به حساب‌ها"
};
const ps={
 title:"سمونونه او پیسې بېرته ورکول",subtitle:"هر سمون ارزول او ثبتېږي. اصلي رسید او تادیه نه بدلېږي.",
 pending:"د کتنې په تمه",approved:"تایید شو — بېرته ورکولو ته چمتو",rejected:"رد شو",applied:"بشپړ شو",
 kind:"د سمون ډول",discount:"تخفیف",void:"ناپیل شوی فرمایش لغوه",refund:"پیسې بېرته ورکول",
 request:"د سمون غوښتنه",reason:"دلیل (اړین)",amount:"مبلغ (افغانۍ)",round:"د فرمایش پړاو",
 review:"د مدیر کتنه",reviewNote:"د کتنې یادښت",approve:"تایید",reject:"رد",
 execute:"بېرته ورکړه ثبت کړئ",method:"د بېرته ورکړې لاره",cash:"نغدې ورکړل شوې",manual_transfer:"لاسي بانکي انتقال",
 externalReference:"د انتقال شمېره",verified:"له اپ بهر بېرته ورکړه مې تایید کړه",
 note:"د صندوقدار یادښت",refresh:"تازه کول",reviewHint:"بل مدیر باید غوښتنه تایید کړي. بل صندوقدار د پرانیستي شیفت په ترڅ کې پیسې بېرته ورکوي.",
 voidHint:"یوازې د پخلنځي له پیل مخکې بشپړ فرمایش لغوه کېدای شي.",
 discountHint:"تخفیف او لغوه کول له تادیې او وېش مخکې ممکن دي.",
 refundHint:"بېرته ورکړه یوازې د تصفیه شوي حساب لپاره ده؛ له ورکړل شوو او پاتې پیسو زیاته نه شي کېدای.",
 queue:"د سمون غوښتنې",noRequests:"هیڅ غوښتنه نشته.",error:"عملیات ناکام شو.",
 ready:"چمتو",all:"ټول",openCheck:"حساب پرانیزئ",check:"حساب",checkId:"د حساب پېژند",
 amountDue:"مجموع / ورکړل شوي",alreadyRefunded:"بېرته ورکړل شوي",submit:"د تایید لپاره لېږل",confirm:"دا دایمي مالي کار تاییدوئ؟",
 noCheck:"حساب پرانیزئ یا پېژند یې ولیکئ.",load:"حساب ولټوئ",status:"حالت",
 requestedBy:"غوښتونکی",approvedBy:"تاییدوونکی",posted:"ثبت شو",work:"د تایید او بېرته ورکړې بهیر",
 key:"د غوښتنې پېژند",new:"نوې غوښتنه",version:"نسخه",submitSuccess:"غوښتنه ثبت شوه",
 decisionSuccess:"د کتنې پایله ثبت شوه",refundSuccess:"پیسې بېرته ورکړل شوې",stale:"معلومات بدل شول؛ تازه یې کړئ.",
 noShift:"د بېرته ورکړې لپاره فعال صندوقدار شیفت اړین دی.",back:"حسابونو ته بېرته"
};
export type P10Word=keyof typeof en;
export function p10(locale:Locale,k:P10Word):string{
 const words=locale==="en"?en:locale==="ps-AF"?ps:fa;
 return words[k]??en[k];
}
