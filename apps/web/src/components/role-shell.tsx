"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Building2, ChefHat, CircleUserRound, LayoutDashboard, LogOut, ReceiptText, ShieldCheck, UtensilsCrossed, UsersRound, Settings2, Building2 } from "lucide-react";
import { direction, t, webAreaFor, type Locale, type WebArea } from "@dineflow/shared";
import { authClient } from "@/lib/auth-client";
import { ApiError, getContext, type WorkspaceContext } from "@/lib/context";
import { WorkspaceProvider } from "./workspace-provider";
import { p2 } from "@/lib/phase2-copy";

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
        <Link className={"nav-link" + (pathname === page.route ? " selected" : "")} href={page.route}
          aria-current={pathname === page.route ? "page" : undefined} title={t(locale, page.label)}>
          <Icon size={20} strokeWidth={1.9} /><span>{t(locale, page.label)}</span>
        </Link>
        {area==="app"&&<>
          <Link href="/app/staff/directory" title={p2(locale,"team")}
            className={"nav-link"+(pathname.startsWith("/app/staff/")?" selected":"")}
            aria-current={pathname.startsWith("/app/staff/")?"page":undefined}>
            <UsersRound size={20} strokeWidth={1.9}/><span>{p2(locale,"team")}</span></Link>
          <Link href="/app/settings/restaurant" title={p2(locale,"settings")}
            className={"nav-link"+(pathname.startsWith("/app/settings/")?" selected":"")}
            aria-current={pathname.startsWith("/app/settings/")?"page":undefined}>
            <Settings2 size={20} strokeWidth={1.9}/><span>{p2(locale,"settings")}</span></Link>
        </>}
        {area==="platform"&&<Link href="/platform/restaurants" title={p2(locale,"businesses")}
          className={"nav-link"+(pathname.startsWith("/platform/restaurants")?" selected":"")}
          aria-current={pathname.startsWith("/platform/restaurants")?"page":undefined}>
          <Building2 size={20} strokeWidth={1.9}/><span>{p2(locale,"businesses")}</span></Link>}
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
