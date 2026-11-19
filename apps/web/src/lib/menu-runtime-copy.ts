import type {Locale} from "@dineflow/shared";
const messages={
 en:{
  duplicate:"A menu category with this Dari name already exists. Choose another name.",
  schema:"The database is missing menu tables/columns. Run pnpm db:migrate in the restaurant folder, then restart pnpm dev:api.",
  offline:"The restaurant database is unavailable. Check your API terminal and database connection, then retry."
 },
 "fa-AF":{
  duplicate:"دسته‌بندی با این نام دری از قبل وجود دارد. نام دیگری انتخاب کنید.",
  schema:"جدول‌های منو در دیتابیس تکمیل نیست. در پوشه restaurant دستور pnpm db:migrate را اجرا و سپس pnpm dev:api را دوباره شروع کنید.",
  offline:"اتصال به دیتابیس برقرار نیست. ترمینال API و اتصال دیتابیس را بررسی کرده دوباره تلاش کنید."
 },
 "ps-AF":{
  duplicate:"په دې دري نوم کټګوري مخکې ثبت شوې. بل نوم وټاکئ.",
  schema:"په ډیټابېس کې د مینو جدولونه نیمګړي دي. په restaurant فولډر کې pnpm db:migrate وچلوئ او بیا pnpm dev:api پیل کړئ.",
  offline:"د رستورانت ډیټابېس ته اړیکه نشته. د API ترمینل او د ډیټابېس اړیکه وګورئ او بیا هڅه وکړئ."
 }
} as const;
export function menuRuntimeError(locale:Locale,code:string):string|null{
 const key=code==="DUPLICATE_CATEGORY"?"duplicate":
  code==="MENU_SCHEMA_OUTDATED"?"schema":
  code==="DATABASE_UNAVAILABLE"?"offline":null;
 return key?messages[locale][key]:null;
}
