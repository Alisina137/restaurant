import type {Locale} from "@dineflow/shared";
const en={
 section:"Kitchen display visibility",explain:"First foreground queue render reported by a kitchen browser. This is not proof a person saw the ticket or a verified network SLA.",
 observed:"Render receipts",median:"Median render delay",p95:"95th-percentile render delay",
 coverage:"Observed from accepted orders",noSample:"No client render samples in this period",
 missing:"Active tickets without a render receipt",oldest:"Oldest missing report",
 signal:"Client-reported signal",seconds:"seconds",refresh:"Refresh measurements",
 error:"Visibility measurements unavailable; the dashboard is not reporting a successful result.",
 deliveryError:"This display could not report its visible tickets. Other devices may still work.",
 historical:"Historical tickets predating this feature can lack a receipt. Missing is not proof unseen.",
 measurement:"Time from accepted order to first reported foreground display, among observed orders.",
 scoped:"Only this restaurant and location; no staff/customer identities are recorded.",
 retries:"Delivery reports are idempotent and cannot change order preparation, service or money.",
};
const fa:typeof en={
 section:"قابلیت مشاهده در آشپزخانه",explain:"اولین نمایش صف که مرورگر آشپزخانه هنگام فعال‌بودن گزارش می‌کند. به معنی دیدن توسط شخص یا تأیید سرعت شبکه نیست.",
 observed:"گزارش‌های نمایش",median:"میانه تأخیر نمایش",p95:"صدک ۹۵ تأخیر نمایش",
 coverage:"نمایش‌های گزارش‌شده از سفارش‌های پذیرفته‌شده",noSample:"در این بازه گزارش نمایش وجود ندارد",
 missing:"تیکت‌های فعال بدون گزارش نمایش",oldest:"قدیمی‌ترین گزارش ثبت‌نشده",
 signal:"گزارش مرورگر",seconds:"ثانیه",refresh:"تازه‌سازی اندازه‌گیری‌ها",
 error:"اندازه‌گیری نمایش در دسترس نیست؛ نتیجه موفقیت‌آمیز نشان داده نمی‌شود.",
 deliveryError:"این نمایشگر نتوانست تیکت‌های قابل‌مشاهده را گزارش کند. دستگاه‌های دیگر ممکن است کار کنند.",
 historical:"ممکن است تیکت‌های قدیمی پیش از این قابلیت گزارش نداشته باشند. نبود گزارش به معنی دیده‌نشدن نیست.",
 measurement:"فاصله پذیرش سفارش تا اولین نمایش گزارش‌شده در مرورگر فعال، فقط برای سفارش‌های گزارش‌شده.",
 scoped:"فقط این رستورانت و مکان؛ هویت کارمند یا مشتری ثبت نمی‌شود.",
 retries:"گزارش نمایش تکرار امن دارد و آماده‌سازی، سرو یا پول را تغییر نمی‌دهد.",
};
const ps:typeof en={
 section:"د پخلنځي د ښودنې څارنه",explain:"د پخلنځي په فعال براوزر کې د کتار لومړۍ راپور شوې ښودنه. دا د انسان د لیدلو یا د شبکې د سرعت د تایید ثبوت نه دی.",
 observed:"د ښودنې راپورونه",median:"د ښودنې منځنی ځنډ",p95:"د ښودنې ۹۵مه سلنه ځنډ",
 coverage:"له منل شوو فرمایشونو څخه راپور شوې ښودنې",noSample:"په دې موده کې د ښودنې راپور نشته",
 missing:"فعال ټکټونه بې له ښودنې راپور",oldest:"تر ټولو پخوانی بې راپور ټکټ",
 signal:"د براوزر راپور",seconds:"ثانیې",refresh:"شمېرې تازه کړئ",
 error:"د ښودنې شمېرې نشته؛ بریالی حالت نه ښودل کېږي.",
 deliveryError:"دې سکرین ونه شو کړای خپل ښکاره ټکټونه راپور کړي. ښايي نورې وسیلې کار وکړي.",
 historical:"له دې ځانګړنې مخکې ټکټونه راپور نه لري. د راپور نه شتون د نه لیدلو ثبوت نه دی.",
 measurement:"د فرمایش له منلو تر فعال براوزر لومړۍ راپور شوې ښودنې پورې وخت، یوازې د راپور لرونکو لپاره.",
 scoped:"یوازې همدا رستورانت او ځای؛ د کارکوونکي یا پېرودونکي پېژندنه نه ثبتېږي.",
 retries:"د ښودنې راپور په خوندي ډول بیا لېږل کېږي او چمتو کول، سرو یا پیسې نه بدلوي.",
};
export type Kitchen30Key=keyof typeof en;
export function k30(locale:Locale,key:Kitchen30Key):string{
 return (locale==="fa-AF"?fa:locale==="ps-AF"?ps:en)[key];
}
