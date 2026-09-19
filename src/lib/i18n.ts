import { cookies } from "next/headers";
export const messages = {
  en: {
    discover: "Restaurants",
    workspace: "My restaurants",
    account: "Account",
    signIn: "Sign in",
    join: "Create account",
    admin: "Review queue",
    language: "Navigation language",
  },
  fa: {
    discover: "رستورانت‌ها",
    workspace: "رستورانت‌های من",
    account: "حساب من",
    signIn: "ورود",
    join: "ایجاد حساب",
    admin: "بررسی رستورانت‌ها",
    language: "زبان پیمایش",
  },
  ps: {
    discover: "رستورانتونه",
    workspace: "زما رستورانتونه",
    account: "حساب",
    signIn: "ننوتل",
    join: "حساب جوړول",
    admin: "د کتنې لړ",
    language: "د لټون ژبه",
  },
};
export async function getLocale() {
  const v = (await cookies()).get("locale")?.value;
  return v === "fa" || v === "ps" ? v : "en";
}
