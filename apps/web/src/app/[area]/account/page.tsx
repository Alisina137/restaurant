"use client";
import { useState } from "react";
import { BadgeCheck, Languages, LockKeyhole, UserRound } from "lucide-react";
import { direction, t, type Locale } from "@dineflow/shared";
import { api, getContext } from "@/lib/context";
import { useWorkspace } from "@/components/workspace-provider";

export default function AccountPage() {
  const { workspace, setWorkspace } = useWorkspace();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const locale = workspace.locale;
  async function changeLocale(next: Locale) {
    setBusy(true); setError(""); setSuccess("");
    try {
      await api("/api/preferences/locale", { method: "PUT", body: JSON.stringify({ locale: next }) });
      setWorkspace({ ...workspace, locale: next });
      setSuccess(t(next, "languageSaved"));
    } catch { setError(t(locale, "offline")); }
    finally { setBusy(false); }
  }
  async function switchTenant(tenantId: string) {
    setBusy(true); setError(""); setSuccess("");
    try {
      await api("/api/context/tenant", { method: "PUT", body: JSON.stringify({ tenantId }) });
      const next = await getContext();
      window.location.assign(next.defaultRoute);
    } catch { setError(t(locale, "accessDenied")); setBusy(false); }
  }
  return <div className="content-stack">
    <div className="page-heading"><div><div className="eyebrow">{t(locale, "workspace")}</div><h1>{t(locale, "account")}</h1></div><span className="status-pill"><BadgeCheck size={16} />{t(locale, "active")}</span></div>
    <div className="settings-grid">
      <section className="settings-card"><div className="settings-heading"><span className="settings-icon"><UserRound size={21} /></span><div><h2>{t(locale, "profile")}</h2><p>{t(locale, "secureBody")}</p></div></div>
        <dl className="profile-list"><div><dt>{t(locale, "profile")}</dt><dd>{workspace.user.name}</dd></div><div><dt>{t(locale, "email")}</dt><dd dir="ltr"><bdi>{workspace.user.email}</bdi></dd></div><div><dt>{t(locale, "status")}</dt><dd><span className="badge-green">{t(locale, "active")}</span></dd></div></dl>
      </section>
      <section className="settings-card"><div className="settings-heading"><span className="settings-icon"><Languages size={21} /></span><div><h2>{t(locale, "language")}</h2><p>{t(locale, "workspace")}</p></div></div>
        <div className="field"><label htmlFor="profile-language">{t(locale, "language")}</label><select id="profile-language" value={locale} disabled={busy} onChange={(e) => void changeLocale(e.target.value as Locale)}><option value="fa-AF">دری</option><option value="ps-AF">پښتو</option><option value="en">English</option></select></div>
        {workspace.memberships.length > 1 && workspace.role !== "platform_admin" && <div className="field"><label htmlFor="tenant-selection">{t(locale, "selectRestaurant")}</label><select id="tenant-selection" disabled={busy} value={workspace.tenantId ?? ""} onChange={(e) => void switchTenant(e.target.value)}>{workspace.memberships.map((membership) => <option key={membership.tenantId} value={membership.tenantId}>{membership.tenantName}</option>)}</select></div>}
        {error && <p className="form-error" role="alert">{error}</p>}{success && <p className="success-text" role="status">{success}</p>}
      </section>
      <section className="settings-card"><div className="settings-heading"><span className="settings-icon"><LockKeyhole size={21} /></span><div><h2>{t(locale, "secure")}</h2><p>{t(locale, "secureBody")}</p></div></div><p className="muted">{t(locale, "support")}</p></section>
    </div>
  </div>;
}
