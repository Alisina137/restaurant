import {type Locale} from "@dineflow/shared";
import {API_URL} from "./auth-client";

const copy={
 en:{
  forgot:"Forgot password?",resetTitle:"Recover account",resetHint:"Enter your email. If it belongs to a DineFlow account, a reset email will be requested.",
  send:"Request reset link",done:"If an account exists, the email has been requested. Open the link on the web to set a new password.",
  email:"Email address",back:"Back to sign in",show:"Show password",hide:"Hide password",
  unverified:"Your email must be verified before you sign in.",resend:"Resend verification",sent:"Verification email requested. Check your inbox.",
  unavailable:"Set EXPO_PUBLIC_WEB_URL in the mobile .env to the web app URL and restart Expo before requesting email links.",
  retry:"Request failed. Check your connection and retry.",profile:"Edit profile",name:"Your name",save:"Save name",
  saved:"Profile saved.",security:"Password & devices",securityHint:"Protect your account and review active sessions.",
  oldPassword:"Current password",newPassword:"New password",repeatPassword:"Confirm new password",change:"Change password",
  passwordRule:"Use a unique password of 12–128 characters.",mismatch:"Passwords do not match.",
  changed:"Password changed. Other sessions were signed out.",sessions:"Active sessions",others:"Sign out other devices",
  one:"Sign out",current:"This device",other:"Other device",sessionRemoved:"Session signed out.",
  confirm:"Confirm sign-out?",cancel:"Cancel",loadFailed:"Could not load sessions.",noSessions:"No sessions found.",
  loading:"Loading…",invalidName:"Enter a name between 2 and 80 characters.",active:"Active",error:"Operation failed. Please retry."
 },
 "fa-AF":{
  forgot:"رمز عبور را فراموش کرده‌اید؟",resetTitle:"بازیابی حساب",resetHint:"ایمیل خود را وارد کنید. اگر حساب موجود باشد، ایمیل بازیابی درخواست می‌شود.",
  send:"درخواست لینک بازیابی",done:"اگر حساب وجود داشته باشد، ایمیل درخواست شده است. لینک را در وب باز کنید و رمز جدید بسازید.",
  email:"آدرس ایمیل",back:"بازگشت به ورود",show:"نمایش رمز عبور",hide:"پنهان کردن رمز عبور",
  unverified:"پیش از ورود باید ایمیل تان تأیید شود.",resend:"ارسال دوباره تأیید",sent:"ایمیل تأیید درخواست شد. صندوق ایمیل را بررسی کنید.",
  unavailable:"در فایل env موبایل، EXPO_PUBLIC_WEB_URL را به آدرس وب تنظیم و Expo را دوباره اجرا کنید.",
  retry:"درخواست انجام نشد. اتصال را بررسی و دوباره کوشش کنید.",profile:"ویرایش پروفایل",name:"نام شما",save:"ذخیره نام",
  saved:"پروفایل ذخیره شد.",security:"رمز عبور و دستگاه‌ها",securityHint:"از حساب خود محافظت و نشست‌های فعال را بررسی کنید.",
  oldPassword:"رمز عبور فعلی",newPassword:"رمز عبور جدید",repeatPassword:"تکرار رمز جدید",change:"تغییر رمز عبور",
  passwordRule:"رمز منحصر به فرد ۱۲ تا ۱۲۸ حرفی استفاده کنید.",mismatch:"رمزهای عبور یکسان نیستند.",
  changed:"رمز تغییر کرد. نشست‌های دیگر پایان یافت.",sessions:"نشست‌های فعال",others:"خروج دستگاه‌های دیگر",
  one:"خروج",current:"این دستگاه",other:"دستگاه دیگر",sessionRemoved:"نشست پایان یافت.",
  confirm:"از دستگاه خارج شوید؟",cancel:"لغو",loadFailed:"نشست‌ها بارگذاری نشد.",noSessions:"نشستی یافت نشد.",
  loading:"بارگذاری…",invalidName:"نام باید ۲ تا ۸۰ حرف داشته باشد.",active:"فعال",error:"عملیات ناکام شد. دوباره کوشش کنید."
 },
 "ps-AF":{
  forgot:"پټنوم مو هېر شوی؟",resetTitle:"حساب بېرته ترلاسه کول",resetHint:"برېښنالیک ولیکئ. که حساب وي، د بیا ټاکلو برېښنالیک غوښتل کېږي.",
  send:"د بیا ټاکلو لینک وغواړئ",done:"که حساب وي، برېښنالیک غوښتل شوی دی. لینک په وېب کې پرانیزئ او نوی پټنوم وټاکئ.",
  email:"برېښنالیک",back:"ننوتلو ته ستنېدل",show:"پټنوم ښکاره کړئ",hide:"پټنوم پټ کړئ",
  unverified:"د ننوتلو مخکې برېښنالیک تایید کړئ.",resend:"تایید بیا ولېږئ",sent:"د تایید برېښنالیک غوښتل شوی. انباکس وګورئ.",
  unavailable:"په موبایل env کې EXPO_PUBLIC_WEB_URL د وېب پتې ته وټاکئ او Expo بیا چالان کړئ.",
  retry:"غوښتنه بشپړه نه شوه. اړیکه وګورئ او بیا هڅه وکړئ.",profile:"پروفایل سمول",name:"ستاسو نوم",save:"نوم خوندي کړئ",
  saved:"پروفایل خوندي شو.",security:"پټنوم او وسایل",securityHint:"خپل حساب خوندي کړئ او فعالې ناستې وګورئ.",
  oldPassword:"اوسنی پټنوم",newPassword:"نوی پټنوم",repeatPassword:"نوی پټنوم بیا ولیکئ",change:"پټنوم بدلول",
  passwordRule:"د ۱۲ تر ۱۲۸ تورو ځانګړی پټنوم وکاروئ.",mismatch:"پټنومونه سره نه سمون خوري.",
  changed:"پټنوم بدل شو. نورې ناستې پای ته ورسېدې.",sessions:"فعالې ناستې",others:"له نورو وسیلو وتل",
  one:"وتل",current:"دا وسیله",other:"بله وسیله",sessionRemoved:"ناسته پای ته ورسېده.",
  confirm:"له وسیلې ووځئ؟",cancel:"لغوه کول",loadFailed:"ناستې بار نه شوې.",noSessions:"ناستې ونه موندل شوې.",
  loading:"بارېږي…",invalidName:"نوم باید له ۲ تر ۸۰ تورو وي.",active:"فعال",error:"چارې بشپړې نه شوې. بیا هڅه وکړئ."
 }
} as const;
export type MobileAuthKey=keyof typeof copy.en;
export function ma(locale:Locale,key:MobileAuthKey):string{return copy[locale][key];}
/** Reset and verification email callbacks must open a trusted publicly reachable web app. */
export function webCallback(path:"/reset-password"|"/login"):string|null{
 const provided=process.env.EXPO_PUBLIC_WEB_URL?.trim();
 try{
  const base=provided?new URL(provided):new URL(API_URL);
  if(!provided){
   if(base.port!=="4000")return null;
   base.port="3000";
   if(base.hostname==="localhost"||base.hostname==="127.0.0.1")return null;
  }
  if(!["http:","https:"].includes(base.protocol)||base.username||base.password)return null;
  return new URL(path,base.origin).toString();
 }catch{return null;}
}
