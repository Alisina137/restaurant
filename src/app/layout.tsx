import type { Metadata } from "next";
import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import {
  BadgeCheck,
  BookOpenText,
  ClipboardList,
  Heart,
  Home,
  LayoutDashboard,
  MapPinned,
  Menu as MenuIcon,
  MessageSquareText,
  MoreHorizontal,
  ReceiptText,
  Search,
  Settings2,
  ShieldCheck,
  Store,
  Truck,
  UserRound,
  UsersRound,
  UtensilsCrossed,
} from "lucide-react";
import { currentUser } from "@/lib/session";
import { getLocale, messages } from "@/lib/i18n";
import { getLowData } from "@/lib/preferences";
import { runtime } from "@/lib/runtime";
import { workspaceContext } from "@/features/workspaces/service";
import { LocaleSelect } from "@/components/locale-select";
import {
  LowDataToggle,
  WorkspaceSwitcher,
} from "@/components/workspace-controls";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Restaurant Social", template: "%s · Restaurant Social" },
  description:
    "Discover local restaurants in Afghanistan and connect with their kitchens.",
};
export const dynamic = "force-dynamic";

type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  badge?: number;
};

function Navigation({
  items,
  mobile = false,
  moreLabel = "More",
}: {
  items: NavItem[];
  mobile?: boolean;
  moreLabel?: string;
}) {
  const visible = mobile ? items.slice(0, 4) : items;
  const more = mobile ? items.slice(4) : [];
  return (
    <nav aria-label={mobile ? "Mobile navigation" : "Main navigation"}>
      {visible.map((item) => (
        <Link href={item.href} key={`${item.href}-${item.label}`}>
          <item.icon size={mobile ? 20 : 21} />
          <span>{item.label}</span>
          {Boolean(item.badge) && <b className="nav-badge">{item.badge}</b>}
        </Link>
      ))}
      {more.length > 0 && (
        <details className="mobile-more">
          <summary>
            <MoreHorizontal size={20} />
            <span>{moreLabel}</span>
          </summary>
          <div>
            {more.map((item) => (
              <Link href={item.href} key={`${item.href}-${item.label}`}>
                <item.icon size={19} />
                <span>{item.label}</span>
                {Boolean(item.badge) && (
                  <b className="nav-badge">{item.badge}</b>
                )}
              </Link>
            ))}
          </div>
        </details>
      )}
    </nav>
  );
}

export default async function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [locale, actor, lowData] = await Promise.all([
    getLocale(),
    currentUser().catch(() => null),
    getLowData(),
  ]);
  const t = messages[locale];
  const context = actor
    ? await workspaceContext(runtime().db, actor)
    : {
        active: {
          kind: "personal" as const,
          key: "personal" as const,
          name: "Guest",
        },
        workspaces: [],
        badges: { personal: 0, restaurant: 0, admin: 0 },
      };
  let items: NavItem[];
  if (!actor) {
    items = [
      { href: "/", label: t.discover, icon: Home },
      { href: "/explore", label: t.explore, icon: Search },
      { href: "/explore", label: t.restaurants, icon: Store },
      { href: "/sign-in", label: t.signIn, icon: UserRound },
      { href: "/sign-up", label: t.join, icon: BadgeCheck },
      { href: "/owner/onboarding", label: t.registerRestaurant, icon: Store },
    ];
  } else if (context.active.kind === "restaurant") {
    const id = context.active.restaurantId;
    const p = context.active.permissions;
    items = [
      { href: `/owner/${id}`, label: t.overview, icon: LayoutDashboard },
      ...(p.orders
        ? [
            {
              href: `/owner/${id}/orders`,
              label: t.liveOrders,
              icon: ReceiptText,
              badge: context.badges.restaurant,
            },
          ]
        : []),
      ...(p.menu || p.menuContent || p.availability
        ? [{ href: `/owner/${id}/menu`, label: t.menu, icon: MenuIcon }]
        : []),
      ...(p.posts
        ? [
            {
              href: `/owner/${id}/posts`,
              label: t.posts,
              icon: MessageSquareText,
            },
          ]
        : []),
      ...(p.delivery
        ? [
            {
              href: `/owner/${id}/delivery`,
              label: t.deliveryAreas,
              icon: Truck,
            },
          ]
        : []),
      ...(context.active.role === "owner"
        ? [
            { href: `/owner/${id}/edit`, label: t.profile, icon: Settings2 },
            { href: `/owner/${id}#team`, label: t.team, icon: UsersRound },
          ]
        : []),
    ];
  } else if (context.active.kind === "admin") {
    items = [
      {
        href: "/admin",
        label: t.admin,
        icon: ShieldCheck,
        badge: context.badges.admin,
      },
      { href: "/admin#restaurants", label: t.approvals, icon: BadgeCheck },
      { href: "/admin/restaurants", label: t.restaurants, icon: Store },
      { href: "/admin/users", label: t.users, icon: UsersRound },
      { href: "/admin#reports", label: t.reports, icon: ClipboardList },
      { href: "/admin/orders", label: t.orderSupport, icon: ReceiptText },
      { href: "/admin/audit", label: t.audit, icon: BookOpenText },
    ];
  } else {
    items = [
      { href: "/", label: t.discover, icon: Home },
      { href: "/explore", label: t.explore, icon: Search },
      { href: "/?tab=following", label: t.following, icon: Store },
      { href: "/saved", label: t.saved, icon: Heart },
      {
        href: "/orders",
        label: t.orders,
        icon: ReceiptText,
        badge: context.badges.personal,
      },
      { href: "/addresses", label: t.addresses, icon: MapPinned },
      { href: "/account", label: t.account, icon: UserRound },
      { href: "/owner/onboarding", label: t.registerRestaurant, icon: Store },
    ];
  }
  const options = actor
    ? [
        { key: "personal", label: t.personal, target: "/dashboard" },
        ...context.workspaces.map((item) => ({
          key: item.key,
          label: `${item.role === "owner" ? "Owner" : "Contributor"}: ${item.name}`,
          target: `/owner/${item.restaurantId}`,
        })),
        ...(actor.isAdmin
          ? [{ key: "admin", label: t.admin, target: "/admin" }]
          : []),
      ]
    : [];
  return (
    <html lang={locale} dir={locale === "en" ? "ltr" : "rtl"}>
      <body className={lowData ? "low-data" : ""}>
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
          {actor && (
            <WorkspaceSwitcher
              active={context.active.key}
              options={options}
              label={t.switchWorkspace}
            />
          )}
          <div className="top-actions">
            <LowDataToggle enabled={lowData} label={t.lowData} />
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
            <p className="nav-caption">
              {!actor
                ? t.explore
                : context.active.kind === "restaurant"
                  ? context.active.name
                  : context.active.kind === "admin"
                    ? t.admin
                    : t.personal}
            </p>
            <Navigation items={items} moreLabel={t.more} />
            <div className="sidebar-note">
              {context.active.kind === "restaurant" ? (
                <UtensilsCrossed size={24} />
              ) : (
                <Store size={24} />
              )}
              <h3>
                {context.active.kind === "restaurant"
                  ? context.active.role === "owner"
                    ? "Your restaurant workspace"
                    : "Contributor workspace"
                  : "Food from local kitchens"}
              </h3>
              <p>
                {context.active.kind === "restaurant"
                  ? "Only tools granted to this workspace are shown here."
                  : "Restaurants receive and deliver every order themselves."}
              </p>
            </div>
            <p className="sidebar-foot">
              Made for local food.
              <br />
              Afghanistan · AFN
            </p>
          </aside>
          <main id="main">{children}</main>
        </div>
        <div className="mobile-nav">
          <Navigation items={items} mobile moreLabel={t.more} />
        </div>
      </body>
    </html>
  );
}
