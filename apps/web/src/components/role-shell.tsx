"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Building2, ChefHat, CircleUserRound, LayoutDashboard, LogOut, ReceiptText, ShieldCheck, UtensilsCrossed, UsersRound, Settings2, BookOpenText, Armchair, ClipboardList, Timer, CheckCircle2, History, Wallet, Clock3, Percent, Bell, RotateCcw, BarChart3, CreditCard, LifeBuoy, Activity } from "lucide-react";
import { direction, t, webAreaFor, type Locale, type WebArea } from "@dineflow/shared";
import { authClient } from "@/lib/auth-client";
import { ApiError, getContext, type WorkspaceContext } from "@/lib/context";
import { WorkspaceProvider } from "./workspace-provider";
import { p2 } from "@/lib/phase2-copy";
import { m3 } from "@/lib/menu-copy";
import { f4 } from "@/lib/floor-copy";
import { ow } from "@/lib/order-web-copy";
import { k6 } from "@/lib/kitchen-copy";
import {f9} from "@/lib/finance-copy";
import {sr8} from "@/lib/staff-service-copy";

const rootPages: Record<WebArea, { route: string; label: "overview" | "live" | "openChecks"; icon: typeof LayoutDashboard }> = {
  app: { route: "/app/overview", label: "overview", icon: LayoutDashboard },
  kitchen: { route: "/kitchen/live", label: "live", icon: ChefHat },
  cashier: { route: "/cashier/checks", label: "openChecks", icon: ReceiptText },
  platform: { route: "/platform/overview", label: "overview", icon: ShieldCheck }
};
export function RoleShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const area = pathname.split("/")[1] as WebArea;
  const page = rootPages[area];
  const [workspace, setWorkspace] = useState<WorkspaceContext | null>(null);
  const [loadError, setLoadError] = useState("");
  const [pending, setPending] = useState(true);
  const refresh = useCallback(async () => {
    setLoadError("");
    try {
      const result = await getContext();
      if (webAreaFor(result.role) !== area) {
        router.replace(result.defaultRoute);
        return;
      }
      setWorkspace(result);
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) router.replace("/login?expired=1");
      else if (error instanceof ApiError && error.status === 403) setLoadError("NO_MEMBERSHIP");
      else setLoadError("CONNECTION");
    } finally { setPending(false); }
  }, [area, router]);
  useEffect(() => { void refresh(); }, [refresh]);
  const locale: Locale = workspace?.locale ?? "fa-AF";
  useEffect(() => {
    document.documentElement.dir = direction(locale);
    document.documentElement.lang = locale;
    localStorage.setItem("dineflow-locale", locale);
  }, [locale]);
  async function signOut() {
    await authClient.signOut();
    router.replace("/login");
  }
  if (!page) return <div className="center-viewport">Invalid workspace.</div>;
  const Icon = page.icon;
  return <div className="workspace-layout" dir={direction(locale)}>
    <aside className="sidebar" aria-label="Workspace navigation">
      <Link className="sidebar-brand" href={page.route}><span className="brand-mark"><UtensilsCrossed size={20} /></span><strong>DineFlow</strong></Link>
      <div className="sidebar-caption">{t(locale, "workspace")}</div>
      <nav className="sidebar-nav">
        <Link className={"nav-link" + ((pathname === page.route || area==="cashier"&&pathname.startsWith("/cashier/checks/")) ? " selected" : "")} href={page.route}
          aria-current={pathname === page.route ? "page" : undefined} title={t(locale, page.label)}>
          <Icon size={20} strokeWidth={1.9} /><span>{t(locale, page.label)}</span>
        </Link>
        {area==="kitchen"&&<>
          <Link href="/kitchen/preparing" title={ow(locale,"preparing")}
            className={"nav-link"+(pathname==="/kitchen/preparing"?" selected":"")}
            aria-current={pathname==="/kitchen/preparing"?"page":undefined}>
            <Timer size={20}/><span>{ow(locale,"preparing")}</span></Link>
          <Link href="/kitchen/ready" title={ow(locale,"ready")}
            className={"nav-link"+(pathname==="/kitchen/ready"?" selected":"")}
            aria-current={pathname==="/kitchen/ready"?"page":undefined}>
            <CheckCircle2 size={20}/><span>{ow(locale,"ready")}</span></Link>
          <Link href="/kitchen/history" title={k6(locale,"history")}
            className={"nav-link"+(pathname==="/kitchen/history"?" selected":"")}
            aria-current={pathname==="/kitchen/history"?"page":undefined}>
            <History size={20}/><span>{k6(locale,"history")}</span></Link>
        </>}
        {area==="cashier"&&<>
          <Link href="/cashier/adjustments" className={"nav-link"+(pathname.startsWith("/cashier/adjustments")?" selected":"")}>
            <RotateCcw size={20}/><span>{locale==="en"?"Adjustments":locale==="ps-AF"?"سمونونه":"اصلاحات"}</span></Link>
          <Link href="/cashier/transactions" title={f9(locale,"transactions")}
            className={"nav-link"+(pathname.startsWith("/cashier/transactions")?" selected":"")}
            aria-current={pathname.startsWith("/cashier/transactions")?"page":undefined}>
            <Wallet size={20}/><span>{f9(locale,"transactions")}</span></Link>
          <Link href="/cashier/shifts" title={f9(locale,"shifts")}
            className={"nav-link"+(pathname.startsWith("/cashier/shifts")?" selected":"")}
            aria-current={pathname.startsWith("/cashier/shifts")?"page":undefined}>
            <Clock3 size={20}/><span>{f9(locale,"shifts")}</span></Link>
          <Link href="/cashier/receipts" title={f9(locale,"receipts")}
            className={"nav-link"+(pathname.startsWith("/cashier/receipts")?" selected":"")}
            aria-current={pathname.startsWith("/cashier/receipts")?"page":undefined}>
            <ReceiptText size={20}/><span>{f9(locale,"receipts")}</span></Link>
        </>}
        {area==="app"&&<>
          <Link href="/app/subscription/plan" className={"nav-link"+(pathname.startsWith("/app/subscription")?" selected":"")}>
            <CreditCard size={20}/><span>{locale==="en"?"Subscription":locale==="ps-AF"?"ګډون":"اشتراک"}</span></Link>
          <Link href="/app/support/tickets" className={"nav-link"+(pathname.startsWith("/app/support")?" selected":"")}>
            <LifeBuoy size={20}/><span>{locale==="en"?"Support":locale==="ps-AF"?"ملاتړ":"پشتیبانی"}</span></Link>
          <Link href="/app/reports" className={"nav-link"+(pathname.startsWith("/app/reports")?" selected":"")}
            aria-current={pathname.startsWith("/app/reports")?"page":undefined}>
            <BarChart3 size={20} strokeWidth={1.9}/>
            <span>{locale==="en"?"Reports & insights":locale==="ps-AF"?"راپورونه او شننې":"گزارش‌ها و تحلیل‌ها"}</span>
          </Link>
          <Link href="/app/billing/adjustments" className={"nav-link"+(pathname.startsWith("/app/billing/adjustments")?" selected":"")}>
            <RotateCcw size={20}/><span>{locale==="en"?"Adjustments & refunds":locale==="ps-AF"?"سمونونه او بېرته ورکړې":"اصلاحات و بازپرداخت"}</span></Link>
          <Link href="/app/service/requests" title={sr8(locale,"requests")}
            className={"nav-link"+(pathname.startsWith("/app/service/")?" selected":"")}
            aria-current={pathname.startsWith("/app/service/")?"page":undefined}>
            <Bell size={20}/><span>{sr8(locale,"requests")}</span></Link>
          <Link href="/app/orders/live" title={ow(locale,"orders")}
            className={"nav-link"+(pathname.startsWith("/app/orders/")?" selected":"")}
            aria-current={pathname.startsWith("/app/orders/")?"page":undefined}>
            <ClipboardList size={20} strokeWidth={1.9}/><span>{ow(locale,"orders")}</span></Link>
          <Link href="/app/menu/items" title={m3(locale,"menu")}
            className={"nav-link"+(pathname.startsWith("/app/menu/")?" selected":"")}
            aria-current={pathname.startsWith("/app/menu/")?"page":undefined}>
            <BookOpenText size={20} strokeWidth={1.9}/><span>{m3(locale,"menu")}</span></Link>
          <Link href="/app/tables/board" title={f4(locale,"tables")}
            className={"nav-link"+(pathname.startsWith("/app/tables/")?" selected":"")}
            aria-current={pathname.startsWith("/app/tables/")?"page":undefined}>
            <Armchair size={20} strokeWidth={1.9}/><span>{f4(locale,"tables")}</span></Link>
          <Link href="/app/billing/checks" title={f9(locale,"billing")}
            className={"nav-link"+(pathname.startsWith("/app/billing/")?" selected":"")}
            aria-current={pathname.startsWith("/app/billing/")?"page":undefined}>
            <Wallet size={20}/><span>{f9(locale,"billing")}</span></Link>
          <Link href="/app/staff/directory" title={p2(locale,"team")}
            className={"nav-link"+(pathname.startsWith("/app/staff/")?" selected":"")}
            aria-current={pathname.startsWith("/app/staff/")?"page":undefined}>
            <UsersRound size={20} strokeWidth={1.9}/><span>{p2(locale,"team")}</span></Link>
          <Link href="/app/settings/restaurant" title={p2(locale,"settings")}
            className={"nav-link"+(pathname.startsWith("/app/settings/")?" selected":"")}
            aria-current={pathname.startsWith("/app/settings/")?"page":undefined}>
            <Settings2 size={20} strokeWidth={1.9}/><span>{p2(locale,"settings")}</span></Link>
        </>}
        {area==="platform"&&<>
          <Link href="/platform/restaurants" className={"nav-link"+(pathname.startsWith("/platform/restaurants")?" selected":"")}>
            <Building2 size={20}/><span>{p2(locale,"businesses")}</span></Link>
          <Link href="/platform/subscriptions/plans" className={"nav-link"+(pathname.startsWith("/platform/subscriptions")?" selected":"")}>
            <CreditCard size={20}/><span>{locale==="en"?"Subscriptions":locale==="ps-AF"?"ګډونونه":"اشتراک‌ها"}</span></Link>
          <Link href="/platform/support/tickets" className={"nav-link"+(pathname.startsWith("/platform/support")?" selected":"")}>
            <LifeBuoy size={20}/><span>{locale==="en"?"Support":locale==="ps-AF"?"ملاتړ":"پشتیبانی"}</span></Link>
          <Link href="/platform/audit" className={"nav-link"+(pathname==="/platform/audit"?" selected":"")}>
            <Activity size={20}/><span>{locale==="en"?"Platform audit":locale==="ps-AF"?"د فعالیت تاریخ":"تاریخچه پلتفرم"}</span></Link>
          <Link href="/platform/settings" className={"nav-link"+(pathname==="/platform/settings"?" selected":"")}>
            <Settings2 size={20}/><span>{p2(locale,"settings")}</span></Link>
        </>}
      </nav>
      <div className="sidebar-bottom">
        <Link className={"nav-link" + (pathname.endsWith("/account") ? " selected" : "")} href={"/" + area + "/account"}>
          <CircleUserRound size={20} /><span>{t(locale, "account")}</span>
        </Link>
        <button className="nav-link nav-action" type="button" onClick={() => void signOut()}><LogOut size={20} /><span>{t(locale, "signOut")}</span></button>
      </div>
    </aside>
    <div className="workspace-column">
      <header className="workspace-header">
        <div className="header-heading"><span className="header-label">{t(locale, "workspace")}</span><strong>{workspace?.tenantName ?? "DineFlow"}</strong></div>
        <div className="header-actions"><span className="online-indicator" /><span className="desktop-only">{workspace?.user.name ?? ""}</span><Link className="avatar-button" href={"/" + area + "/account"} aria-label={t(locale, "account")}><CircleUserRound size={24} /></Link></div>
      </header>
      <main className="workspace-main" id="main-content">
        {pending ? <div className="shell-loading" aria-live="polite"><span className="spinner" />{t(locale, "loading")}</div> :
          loadError ? <section className="error-panel" role="alert"><h2>{t(locale, loadError === "NO_MEMBERSHIP" ? "noMembership" : "offline")}</h2><button className="button button-primary" onClick={() => { setPending(true); void refresh(); }}>{t(locale, "retry")}</button></section> :
          workspace ? <WorkspaceProvider.Provider value={{ workspace, setWorkspace }}>{children}</WorkspaceProvider.Provider> : null}
      </main>
    </div>
  </div>;
}
