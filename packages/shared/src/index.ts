export const LOCALES = ["fa-AF", "ps-AF", "en"] as const;
export type Locale = (typeof LOCALES)[number];
export type StaffRole = "owner" | "manager" | "waiter" | "kitchen" | "cashier";
export type Role = StaffRole | "platform_admin";
export type WebArea = "app" | "kitchen" | "cashier" | "platform";

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && LOCALES.some((locale) => locale === value);
}
export function isStaffRole(value: unknown): value is StaffRole {
  return value === "owner" || value === "manager" || value === "waiter" || value === "kitchen" || value === "cashier";
}
export function direction(locale: Locale): "rtl" | "ltr" {
  return locale === "en" ? "ltr" : "rtl";
}
export function webAreaFor(role: Role): WebArea | null {
  const areas: Record<Role, WebArea | null> = {
    owner: "app", manager: "app", kitchen: "kitchen",
    cashier: "cashier", waiter: null, platform_admin: "platform"
  };
  return areas[role];
}
export function landingFor(role: Role, platform: "web" | "mobile"): string {
  if (platform === "mobile") return role === "waiter" ? "/home" : "/access-denied";
  const area = webAreaFor(role);
  if (area === "app") return "/app/overview";
  if (area === "kitchen") return "/kitchen/live";
  if (area === "cashier") return "/cashier/checks";
  if (area === "platform") return "/platform/overview";
  return "/mobile-access";
}
export function mayAccessTenantRole(role: StaffRole, action: "view" | "manageStaff" | "managePlatform") {
  if (action === "view") return true;
  if (action === "manageStaff") return role === "owner" || role === "manager";
  return false;
}
export function mayViewTenant(userId: string, tenantId: string, activeMemberships: readonly { userId: string; tenantId: string; status: "active" | "disabled" }[]): boolean {
  return activeMemberships.some((m) => m.userId === userId && m.tenantId === tenantId && m.status === "active");
}

const dictionary = {
  en: {
    brand: "DineFlow", signIn: "Sign in", welcome: "Welcome back",
    signInHelp: "Use your restaurant staff account to continue.", email: "Email address",
    password: "Password", signOut: "Sign out", invalidLogin: "Email or password is incorrect.",
    loading: "Loading your workspace…", retry: "Try again", offline: "Could not connect to the server.",
    account: "My account", language: "Language", workspace: "Workspace",
    overview: "Overview", live: "Live", openChecks: "Open checks", home: "Home",
    more: "More", profile: "Profile", restaurant: "Restaurant",
    accessDenied: "You do not have access to this workspace.",
    backHome: "Return to my workspace", mobileOnly: "Waiter access is available in the mobile app.",
    ready: "Signed in and ready", readySubtitle: "Your secure workspace is prepared for restaurant setup.",
    languageSaved: "Language updated", saving: "Saving…", status: "Account status",
    active: "Active", switchRestaurant: "Restaurant", selectRestaurant: "Choose a restaurant",
    secure: "Secure account", secureBody: "Your access is limited to the locations and roles assigned to you.",
    noMembership: "No active restaurant membership. Contact your restaurant owner.",
    sessionExpired: "Your session ended. Please sign in again.", support: "Need access? Ask your restaurant owner."
  },
  "fa-AF": {
    brand: "داین‌فلو", signIn: "ورود", welcome: "خوش آمدید",
    signInHelp: "برای ادامه وارد حساب کاربری رستورانت شوید.", email: "آدرس ایمیل",
    password: "رمز عبور", signOut: "خروج", invalidLogin: "ایمیل یا رمز عبور درست نیست.",
    loading: "فضای کاری بارگذاری می‌شود…", retry: "تلاش دوباره", offline: "اتصال با سرور برقرار نشد.",
    account: "حساب من", language: "زبان", workspace: "فضای کاری",
    overview: "نمای کلی", live: "سفارش‌های زنده", openChecks: "حساب‌های باز", home: "خانه",
    more: "بیشتر", profile: "پروفایل", restaurant: "رستورانت",
    accessDenied: "شما به این بخش دسترسی ندارید.",
    backHome: "بازگشت به فضای کاری", mobileOnly: "بخش گارسون در اپلیکیشن موبایل قابل دسترس است.",
    ready: "ورود شما موفق بود", readySubtitle: "فضای کاری امن شما برای راه‌اندازی رستورانت آماده است.",
    languageSaved: "زبان تغییر کرد", saving: "در حال ذخیره…", status: "وضعیت حساب",
    active: "فعال", switchRestaurant: "رستورانت", selectRestaurant: "انتخاب رستورانت",
    secure: "حساب امن", secureBody: "دسترسی شما محدود به رستورانت‌ها و نقش‌های اختصاص‌یافته است.",
    noMembership: "شما عضویت فعال ندارید. با مالک رستورانت تماس بگیرید.",
    sessionExpired: "جلسه شما پایان یافت. دوباره وارد شوید.", support: "برای دریافت دسترسی با مالک رستورانت صحبت کنید."
  },
  "ps-AF": {
    brand: "ډاین‌فلو", signIn: "ننوتل", welcome: "ښه راغلاست",
    signInHelp: "د دوام لپاره د رستورانت کارکوونکي حساب ته ننوځئ.", email: "برېښنالیک",
    password: "پټنوم", signOut: "وتل", invalidLogin: "برېښنالیک یا پټنوم سم نه دی.",
    loading: "کاري ځای پرانیستل کېږي…", retry: "بیا هڅه وکړئ", offline: "له سرور سره اړیکه ټینګه نه شوه.",
    account: "زما حساب", language: "ژبه", workspace: "کاري ځای",
    overview: "عمومي کتنه", live: "ژوندۍ سپارښتنې", openChecks: "خلاص حسابونه", home: "کور",
    more: "نور", profile: "پروفایل", restaurant: "رستورانت",
    accessDenied: "تاسو دې برخې ته اجازه نه لرئ.",
    backHome: "کاري ځای ته ستنېدل", mobileOnly: "د ګارسون برخه په موبایل اپلیکیشن کې ده.",
    ready: "تاسو ننوتلي یاست", readySubtitle: "ستاسو خوندي کاري ځای د رستورانت د جوړولو لپاره چمتو دی.",
    languageSaved: "ژبه بدله شوه", saving: "خوندي کېږي…", status: "د حساب حالت",
    active: "فعال", switchRestaurant: "رستورانت", selectRestaurant: "رستورانت وټاکئ",
    secure: "خوندي حساب", secureBody: "ستاسو لاسرسی یوازې ټاکل شویو رستورانتونو او رولونو ته محدود دی.",
    noMembership: "تاسو فعال غړیتوب نه لرئ. له مالک سره اړیکه ونیسئ.",
    sessionExpired: "ستاسو ناسته پای ته ورسېده. بیا ننوځئ.", support: "د لاسرسي لپاره له مالک سره خبرې وکړئ."
  }
} as const;

export type TranslationKey = keyof (typeof dictionary)["en"];
export function t(locale: Locale, key: TranslationKey): string {
  return (dictionary[locale] as Record<string, string>)[key] ?? dictionary.en[key];
}
