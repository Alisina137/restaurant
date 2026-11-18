import type {Locale} from "@dineflow/shared";
const en={
 confirmPickup:"Confirm receipt from kitchen?",
 pickup:"Confirm kitchen pickup",acknowledged:"Pickup receipt recorded for this order.",
 already:"This food pickup was already acknowledged.",
 pickupHint:"Kitchen marked this order handed off. Confirm only after you actually receive it.",
 pickupDone:"You confirmed receipt from the kitchen.",serveSeparate:"Serving to guests is a separate step.",
 pickupPending:"Kitchen handoff is recorded, but pickup has not been confirmed by you.",
 pickupError:"Couldn't confirm receipt. The operation may have succeeded. Refresh before trying again.",
 conflict:"This ticket changed. Refresh to verify the latest status.",
};
const fa:typeof en={
 confirmPickup:"دریافت غذا از آشپزخانه را تأیید می‌کنید؟",
 pickup:"تأیید دریافت غذا",acknowledged:"دریافت غذا برای این سفارش ثبت شد.",
 already:"دریافت این غذا قبلاً تأیید شده است.",
 pickupHint:"آشپزخانه تحویل را ثبت کرده است. فقط پس از دریافت واقعی غذا تأیید کنید.",
 pickupDone:"شما دریافت غذا از آشپزخانه را تأیید کرده‌اید.",serveSeparate:"سرو غذا برای مشتریان مرحله جداگانه است.",
 pickupPending:"تحویل آشپزخانه ثبت شده؛ اما دریافت توسط شما هنوز تأیید نشده است.",
 pickupError:"تأیید دریافت کامل نشد. ممکن است عملیات ثبت شده باشد. پیش از تلاش دوباره تازه‌سازی کنید.",
 conflict:"تیکت تغییر کرده است. وضعیت جدید را بررسی کنید.",
};
const ps:typeof en={
 confirmPickup:"د پخلنځي څخه د خوړو اخستل تاییدوئ؟",
 pickup:"د خوړو اخستل تایید کړئ",acknowledged:"د دې فرمایش اخستل ثبت شول.",
 already:"د دې خوړو اخستل مخکې تایید شوي دي.",
 pickupHint:"پخلنځي سپارل ثبت کړي؛ یوازې له رښتیني اخستلو وروسته تایید وکړئ.",
 pickupDone:"تاسو له پخلنځي د خوړو اخستل تایید کړل.",serveSeparate:"مېلمنو ته سرو کول بېله مرحله ده.",
 pickupPending:"پخلنځي سپارل ثبت کړي خو تاسو اخستل نه دي تایید کړي.",
 pickupError:"د اخستلو تایید بشپړ نه شو. ښايي ثبت شوی وي. تر بیا هڅې مخکې تازه کړئ.",
 conflict:"ټکټ بدل شوی دی. نوی حالت وګورئ.",
};
export type Mobile28Key=keyof typeof en;
export function m28(locale:Locale,key:Mobile28Key):string{
 return (locale==="fa-AF"?fa:locale==="ps-AF"?ps:en)[key];
}
