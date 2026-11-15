"use client";
import Link from "next/link";
import { ArrowUpRight, BadgeCheck, Building2, ShieldCheck, UserRound } from "lucide-react";
import { t } from "@dineflow/shared";
import { useWorkspace } from "./workspace-provider";
export function WorkspaceHome() {
  const { workspace } = useWorkspace();
  const locale = workspace.locale;
  const base = workspace.defaultRoute.split("/").slice(0, 2).join("/");
  return <div className="content-stack">
    <div className="page-heading"><div><div className="eyebrow">{t(locale, "workspace")}</div><h1>{t(locale, "welcome")}, {workspace.user.name}</h1><p>{t(locale, "readySubtitle")}</p></div><span className="status-pill"><BadgeCheck size={16} />{t(locale, "active")}</span></div>
    <div className="overview-hero">
      <span className="hero-icon"><ShieldCheck size={30} /></span>
      <div><p className="eyebrow">{t(locale, "secure")}</p><h2>{t(locale, "ready")}</h2><p>{t(locale, "secureBody")}</p></div>
      <div className="hero-art" aria-hidden="true"><span className="art-circle" /><UtensilsIcon /></div>
    </div>
    <div className="info-grid">
      <section className="info-card"><div className="info-card-icon"><Building2 size={22} /></div><h3>{t(locale, "restaurant")}</h3><p>{workspace.tenantName ?? "DineFlow platform"}</p><div className="small-metadata">ID: <bdi>{workspace.tenantId ?? "platform"}</bdi></div></section>
      <section className="info-card"><div className="info-card-icon"><UserRound size={22} /></div><h3>{t(locale, "profile")}</h3><p>{workspace.user.name}</p><Link className="text-link" href={base + "/account"}>{t(locale, "account")} <ArrowUpRight size={16} /></Link></section>
    </div>
  </div>;
}
function UtensilsIcon() { return <span className="large-brand" aria-hidden="true">DF</span>; }
