import type { Metadata } from "next";
import Link from "next/link";
import {
  Store,
  Search,
  Home,
  LayoutDashboard,
  UserRound,
  ShieldCheck,
  UtensilsCrossed,
  ReceiptText,
} from "lucide-react";
import { currentUser } from "@/lib/session";
import { getLocale, messages } from "@/lib/i18n";
import { LocaleSelect } from "@/components/locale-select";
import "./globals.css";
export const metadata: Metadata = {
  title: { default: "Restaurant Social", template: "%s · Restaurant Social" },
  description:
    "Discover local restaurants in Afghanistan and connect with their kitchens.",
};
export const dynamic = "force-dynamic";
export default async function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  const locale = await getLocale();
  const t = messages[locale];
  const actor = await currentUser().catch(() => null);
  return (
    <html lang={locale} dir={locale === "en" ? "ltr" : "rtl"}>
      <body>
        <a className="skip" href="#main">
          Skip to content
        </a>
        <header className="topbar">
          <Link href="/" className="brand">
            <span className="brand-mark">
              <UtensilsCrossed size={23} />
            </span>
            <span>
              Restaurant<span className="brand-light"> Social</span>
              <small>Afghanistan’s food feed</small>
            </span>
          </Link>
          <div className="top-actions">
            <LocaleSelect locale={locale} label={t.language} />
            <Link
              className="button small-button secondary"
              href={actor ? "/account" : "/sign-in"}
            >
              {actor ? actor.name : t.signIn}
            </Link>
          </div>
        </header>
        <div className="app-shell">
          <aside className="sidebar">
            <p className="nav-caption">YOUR NEIGHBOURHOOD</p>
            <nav aria-label="Main navigation">
              <Link href="/">
                <Home size={21} />
                {t.discover}
              </Link>
              <Link href="/explore">
                <Search size={21} />
                Explore
              </Link>
              <Link href="/owner">
                <LayoutDashboard size={21} />
                {t.workspace}
              </Link>
              <Link href="/account">
                <UserRound size={21} />
                {t.account}
              </Link>
              {actor && (
                <Link href="/orders">
                  <ReceiptText size={21} />
                  Orders
                </Link>
              )}
              {actor?.isAdmin && (
                <Link href="/admin">
                  <ShieldCheck size={21} />
                  {t.admin}
                </Link>
              )}
            </nav>
            <div className="sidebar-note">
              <Store size={24} />
              <h3>A place for your kitchen.</h3>
              <p>
                Create your restaurant page and introduce your food to the
                neighbourhood.
              </p>
              <Link href="/owner/onboarding">
                Add your restaurant <span aria-hidden>→</span>
              </Link>
            </div>
            <p className="sidebar-foot">
              Made for local food.
              <br />
              Afghanistan · AFN
            </p>
          </aside>
          <main id="main">{children}</main>
        </div>
        <nav className="mobile-nav" aria-label="Mobile navigation">
          <Link href="/">
            <Home size={21} />
            {t.discover}
          </Link>
          <Link href="/explore">
            <Search size={21} />
            Explore
          </Link>
          <Link href="/owner">
            <LayoutDashboard size={21} />
            {t.workspace}
          </Link>
          <Link href="/account">
            <UserRound size={21} />
            {t.account}
          </Link>
          {actor && (
            <Link href="/orders">
              <ReceiptText size={21} />
              Orders
            </Link>
          )}
          {actor?.isAdmin && (
            <Link href="/admin">
              <ShieldCheck size={21} />
              {t.admin}
            </Link>
          )}
        </nav>
      </body>
    </html>
  );
}
