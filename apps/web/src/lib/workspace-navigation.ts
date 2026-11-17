import {
  Armchair, BarChart3, Bell, BookOpenText, Building2, ChefHat, CheckCircle2,
  ClipboardCheck, ClipboardList, Clock3, CreditCard, FileSearch, Headphones,
  History, LayoutDashboard, MailPlus, ReceiptText, RotateCcw, Settings2,
  ShieldCheck, SlidersHorizontal, Timer, UsersRound, UtensilsCrossed, Wallet,
  Languages, LockKeyhole, BadgePercent, CalendarClock, type LucideIcon
} from "lucide-react";
import { t, type Locale, type WebArea } from "@dineflow/shared";
import { p2 } from "@/lib/phase2-copy";
import { m3 } from "@/lib/menu-copy";
import { f4 } from "@/lib/floor-copy";
import { ow } from "@/lib/order-web-copy";
import { k6 } from "@/lib/kitchen-copy";
import { f9 } from "@/lib/finance-copy";
import { sr8 } from "@/lib/staff-service-copy";
import { p12 } from "@/lib/phase12-copy";

export type WorkspaceNavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
};
export type WorkspaceNavGroup = {
  id: string;
  label: string;
  icon: LucideIcon;
  items: WorkspaceNavItem[];
};
const L = (locale: Locale, en: string, fa: string, ps: string) =>
  locale === "en" ? en : locale === "ps-AF" ? ps : fa;

/** Single navigation source of truth. Every link targets an existing implemented page. */
export function getWorkspaceNavigation(area: WebArea, locale: Locale): WorkspaceNavGroup[] {
  if (area === "app") return [
    {id:"overview",label:L(locale,"Workspace","فضای کاری","کاري ځای"),icon:LayoutDashboard,items:[
      {href:"/app/overview",label:t(locale,"overview"),icon:LayoutDashboard}
    ]},
    {id:"operations",label:L(locale,"Operations","عملیات","چارې"),icon:ClipboardList,items:[
      {href:"/app/tables/board",label:f4(locale,"tables"),icon:Armchair},
      {href:"/app/tables/manage",label:L(locale,"Manage tables","مدیریت میزها","د مېزونو اداره"),icon:Building2},
      {href:"/app/orders/live",label:ow(locale,"orders"),icon:ClipboardList},
      {href:"/app/orders/history",label:k6(locale,"history"),icon:History},
      {href:"/app/service/requests",label:sr8(locale,"requests"),icon:Bell}
    ]},
    {id:"menu",label:m3(locale,"menu"),icon:BookOpenText,items:[
      {href:"/app/menu/items",label:L(locale,"Items","غذاها","خواړه"),icon:UtensilsCrossed},
      {href:"/app/menu/categories",label:L(locale,"Categories","دسته‌ها","کټګورۍ"),icon:BookOpenText},
      {href:"/app/menu/modifiers",label:L(locale,"Modifiers","انتخاب‌های غذا","د خوړو انتخابونه"),icon:SlidersHorizontal},
      {href:"/app/menu/availability",label:L(locale,"Availability","موجودی","شتون"),icon:CheckCircle2}
    ]},
    {id:"finance",label:f9(locale,"billing"),icon:Wallet,items:[
      {href:"/app/billing/checks",label:f9(locale,"checks"),icon:ReceiptText},
      {href:"/app/billing/transactions",label:f9(locale,"transactions"),icon:Wallet},
      {href:"/app/billing/shifts",label:f9(locale,"shifts"),icon:Clock3},
      {href:"/app/billing/adjustments",label:L(locale,"Adjustments & refunds","اصلاحات و بازپرداخت","سمونونه او بېرته ورکړې"),icon:RotateCcw},
      {href:"/app/billing/receipts",label:f9(locale,"receipts"),icon:ReceiptText}
    ]},
    {id:"staff",label:p2(locale,"team"),icon:UsersRound,items:[
      {href:"/app/staff/directory",label:L(locale,"Staff directory","فهرست کارمندان","د کارکوونکو نوملړ"),icon:UsersRound},
      {href:"/app/staff/invitations",label:L(locale,"Invitations","دعوت‌ها","بلنلیکونه"),icon:MailPlus},
      {href:"/app/staff/permissions",label:L(locale,"Permissions","دسترسی‌ها","اجازې"),icon:ShieldCheck}
    ]},
    {id:"insights",label:L(locale,"Insights","تحلیل‌ها","شننې"),icon:BarChart3,items:[
      {href:"/app/reports",label:L(locale,"Reports & analytics","گزارش‌ها و تحلیل‌ها","راپورونه او شننې"),icon:BarChart3}
    ]},
    {id:"business",label:L(locale,"Business","مدیریت رستورانت","د رستورانت اداره"),icon:Settings2,items:[
      {href:"/app/settings/restaurant",label:p2(locale,"settings"),icon:Settings2},
      {href:"/app/settings/localization",label:L(locale,"Language & location","زبان و موقعیت","ژبه او ځای"),icon:Languages},
      {href:"/app/settings/security",label:L(locale,"Security","امنیت","امنیت"),icon:LockKeyhole},
      {href:"/app/settings/ordering",label:L(locale,"Guest ordering","سفارش مهمان","د مېلمه سپارښتنې"),icon:ClipboardCheck},
      {href:"/app/settings/charges",label:L(locale,"Charges","هزینه‌ها","لګښتونه"),icon:BadgePercent},
      {href:"/app/subscription",label:p12(locale,"subscription"),icon:CreditCard},
      {href:"/app/support",label:p12(locale,"support"),icon:Headphones}
    ]},
    {id:"readiness",label:L(locale,"Readiness","آمادگی","چمتووالی"),icon:ClipboardCheck,items:[
      {href:"/app/pilot",label:L(locale,"Pilot readiness","آمادگی آزمایش عملی","د ازمایښتي پړاو چمتووالی"),icon:ClipboardCheck}
    ]}
  ];
  if (area === "kitchen") return [
    {id:"kitchen",label:L(locale,"Kitchen board","صف آشپزخانه","د پخلنځي لړ"),icon:ChefHat,items:[
      {href:"/kitchen/live",label:t(locale,"live"),icon:ChefHat},
      {href:"/kitchen/preparing",label:ow(locale,"preparing"),icon:Timer},
      {href:"/kitchen/ready",label:ow(locale,"ready"),icon:CheckCircle2},
      {href:"/kitchen/history",label:k6(locale,"history"),icon:History}
    ]}
  ];
  if (area === "cashier") return [
    {id:"checkout",label:L(locale,"Checkout","پرداخت","تادیه"),icon:ReceiptText,items:[
      {href:"/cashier/checks",label:f9(locale,"checks"),icon:ReceiptText},
      {href:"/cashier/adjustments",label:L(locale,"Adjustments","اصلاحات","سمونونه"),icon:RotateCcw}
    ]},
    {id:"records",label:L(locale,"Financial records","سوابق مالی","مالي ریکارډونه"),icon:Wallet,items:[
      {href:"/cashier/transactions",label:f9(locale,"transactions"),icon:Wallet},
      {href:"/cashier/shifts",label:f9(locale,"shifts"),icon:Clock3},
      {href:"/cashier/receipts",label:f9(locale,"receipts"),icon:ReceiptText}
    ]}
  ];
  return [
    {id:"platform",label:L(locale,"Platform","پلتفرم","پلېټفارم"),icon:LayoutDashboard,items:[
      {href:"/platform/overview",label:t(locale,"overview"),icon:LayoutDashboard},
      {href:"/platform/restaurants",label:p2(locale,"businesses"),icon:Building2}
    ]},
    {id:"commercial",label:L(locale,"Subscriptions","اشتراک‌ها","ګډونونه"),icon:CreditCard,items:[
      {href:"/platform/subscriptions",label:p12(locale,"subscription"),icon:CreditCard}
    ]},
    {id:"operations",label:L(locale,"Operations","عملیات","چارې"),icon:ClipboardCheck,items:[
      {href:"/platform/pilots",label:L(locale,"Pilot approvals","تأیید آزمایش عملی","ازمایښتي تاییدونه"),icon:ClipboardCheck},
      {href:"/platform/support",label:p12(locale,"support"),icon:Headphones},
      {href:"/platform/audit",label:p12(locale,"audit"),icon:FileSearch}
    ]},
    {id:"configuration",label:L(locale,"Configuration","تنظیمات","تنظیمات"),icon:Settings2,items:[
      {href:"/platform/settings",label:p12(locale,"settings"),icon:Settings2}
    ]}
  ];
}

export function navItemMatches(pathname: string, item: WorkspaceNavItem): boolean {
  return pathname === item.href || pathname.startsWith(item.href + "/");
}
export function activeNavLocation(pathname: string, groups: WorkspaceNavGroup[]): {
  group: WorkspaceNavGroup; item: WorkspaceNavItem;
} | null {
  for (const group of groups) {
    for (const item of group.items) {
      if (navItemMatches(pathname,item)) return {group,item};
    }
  }
  return null;
}
