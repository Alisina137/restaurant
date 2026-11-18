import type {Locale} from "@dineflow/shared";
const en={
 uncertain:"Outcome not confirmed. The request might have succeeded. Do not repeat it before verifying the server.",
 verify:"Verify ticket state",verifying:"Verifying…",verified:"Ticket checked against the server. Review its latest stage before doing anything else.",
 changed:"Another device updated this ticket. Review the refreshed stage and version.",
 connection:"The kitchen connection is interrupted. Previous data may be stale.",
 receipt:"Waiter receipt",receiptPending:"Awaiting explicit waiter pickup confirmation",
 receiptConfirmed:"Pickup confirmed by waiter",kitchenHandoff:"Kitchen marked food handed off",
 waiterAlert:"Ready alert",alertSent:"Sent to assigned waiter",alertSeen:"Opened by waiter",
 alertUnread:"Not yet opened",alertNone:"No ready alert recorded",
 actionsLocked:"Further changes are blocked until this ticket is verified.",
 receiptNotRequired:"Serving is still handled separately by the waiter.",
 replay:"Recovering missed changes",replayRecovered:"Live history synchronized",
 replayFallback:"Full board refresh used. Detailed change history may be incomplete.",
 syncIssue:"Updates could not be reconciled; the board may be stale.",
 resync:"Recheck changes",statusNew:"Current ticket stage",
 retryAfterVerify:"Only retry an action after checking the server and confirming again.",
 version:"Current version",noAutoRetry:"Kitchen writes are never automatically replayed.",
};
const fa:typeof en={
 uncertain:"نتیجه عملیات تأیید نشد. ممکن است درخواست ثبت شده باشد. پیش از بررسی سرور، دوباره نفرستید.",
 verify:"بررسی وضعیت تیکت",verifying:"در حال بررسی…",verified:"تیکت با سرور بررسی شد. پیش از هر عملیات وضعیت جدید آن را ببینید.",
 changed:"این تیکت در دستگاه دیگری تغییر کرده است. وضعیت و نسخه جدید را بررسی کنید.",
 connection:"اتصال آشپزخانه قطع شده است. اطلاعات پیشین ممکن است تازه نباشد.",
 receipt:"تأیید دریافت گارسون",receiptPending:"در انتظار تأیید دریافت غذا توسط گارسون",
 receiptConfirmed:"گارسون دریافت غذا را تأیید کرد",kitchenHandoff:"تحویل غذا توسط آشپزخانه ثبت شد",
 waiterAlert:"اعلان آماده‌بودن",alertSent:"به گارسون مسئول ارسال شد",alertSeen:"گارسون اعلان را دیده است",
 alertUnread:"هنوز دیده نشده",alertNone:"اعلان آماده‌بودن ثبت نشده است",
 actionsLocked:"تا بررسی سرور، تغییرات بعدی این تیکت غیرفعال است.",
 receiptNotRequired:"ثبت سرو غذا همچنان جداگانه توسط گارسون انجام می‌شود.",
 replay:"بازیابی تغییرات ازدست‌رفته",replayRecovered:"سابقه تغییرات همگام شد",
 replayFallback:"صف به‌طور کامل تازه شد. ممکن است سابقه جزیی تغییرات ناقص باشد.",
 syncIssue:"تغییرات همگام نشد؛ ممکن است صف تازه نباشد.",
 resync:"بررسی دوباره تغییرات",statusNew:"وضعیت فعلی تیکت",
 retryAfterVerify:"فقط پس از بررسی سرور و تأیید دوباره عملیات را تکرار کنید.",
 version:"نسخه فعلی",noAutoRetry:"عملیات آشپزخانه هرگز خودکار دوباره اجرا نمی‌شوند.",
};
const ps:typeof en={
 uncertain:"د کړنې پایله نه ده تایید شوې. ښايي غوښتنه بشپړه شوې وي. تر سرور کتنې مخکې یې بیا مه لېږئ.",
 verify:"د ټکټ حالت وڅېړئ",verifying:"څېړل کېږي…",verified:"ټکټ له سرور سره وکتل شو. له بل کار مخکې نوی حالت وګورئ.",
 changed:"دا ټکټ په بله وسیله بدل شوی دی. نوی حالت او نسخه وګورئ.",
 connection:"د پخلنځي اړیکه پرې شوې ده. معلومات ښايي زاړه وي.",
 receipt:"د ګارسون د اخستلو تایید",receiptPending:"د ګارسون له خوا د اخستلو تایید ته انتظار",
 receiptConfirmed:"ګارسون اخستل تایید کړل",kitchenHandoff:"پخلنځي سپارل ثبت کړل",
 waiterAlert:"د چمتووالي خبرتیا",alertSent:"مسئول ګارسون ته ولېږل شوه",alertSeen:"ګارسون خبرتیا لیدلې ده",
 alertUnread:"تر اوسه نه ده لیدل شوې",alertNone:"د چمتووالي خبرتیا نشته",
 actionsLocked:"تر سرور کتنې مخکې د ټکټ نور بدلونونه بند دي.",
 receiptNotRequired:"د سرو ثبتول بیا هم ګارسون جلا کوي.",
 replay:"ورک شوي بدلونونه راوستل",replayRecovered:"بدلونونه همغږي شول",
 replayFallback:"ټول کتار تازه شو. د بدلونونو جزوي تاریخ ښايي نیمګړی وي.",
 syncIssue:"بدلونونه نه همغږي کېږي؛ کتار ښايي زوړ وي.",
 resync:"بدلونونه بیا وګورئ",statusNew:"د ټکټ اوسنی حالت",
 retryAfterVerify:"یوازې د سرور له کتنې او نوي تایید وروسته کړنه تکرار کړئ.",
 version:"اوسنۍ نسخه",noAutoRetry:"د پخلنځي کړنې هېڅکله پخپله بیا نه ترسره کېږي.",
};
export type Kitchen28Key=keyof typeof en;
export function k28(locale:Locale,key:Kitchen28Key):string{
 return (locale==="fa-AF"?fa:locale==="ps-AF"?ps:en)[key];
}
