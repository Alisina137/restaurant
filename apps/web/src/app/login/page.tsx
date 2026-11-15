"use client";
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, LockKeyhole, UtensilsCrossed } from "lucide-react";
import { direction, isLocale, t, type Locale } from "@dineflow/shared";
import { authClient } from "@/lib/auth-client";
import { getContext } from "@/lib/context";

export default function LoginPage() {
  const router = useRouter();
  const [locale, setLocale] = useState<Locale>("fa-AF");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    const value = localStorage.getItem("dineflow-locale");
    if (isLocale(value)) setLocale(value);
  }, []);
  useEffect(() => {
    document.documentElement.dir = direction(locale);
    document.documentElement.lang = locale;
    localStorage.setItem("dineflow-locale", locale);
  }, [locale]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); setBusy(true);
    try {
      const result = await authClient.signIn.email({ email: email.trim().toLowerCase(), password });
      if (result.error) { setError(t(locale, "invalidLogin")); return; }
      const context = await getContext();
      router.replace(context.defaultRoute);
    } catch { setError(t(locale, "offline")); }
    finally { setBusy(false); }
  }
  const arrow = direction(locale) === "rtl" ? <ArrowLeft size={18} /> : <ArrowRight size={18} />;
  return <main className="auth-layout" dir={direction(locale)}>
    <section className="auth-intro">
      <div className="auth-brand"><span className="brand-mark"><UtensilsCrossed size={25} /></span><span>DineFlow</span></div>
      <div className="auth-copy">
        <span className="eyebrow">RESTAURANT OPERATIONS</span>
        <h1>{t(locale, "welcome")}<span className="accent-dot">.</span></h1>
        <p>{t(locale, "signInHelp")}</p>
        <div className="auth-benefit"><LockKeyhole size={18} /><span>{t(locale, "secureBody")}</span></div>
      </div>
      <div className="auth-decoration" aria-hidden="true"><span className="orbit orbit-one" /><span className="orbit orbit-two" /><UtensilsCrossed size={72} /></div>
    </section>
    <section className="auth-form-panel">
      <div className="auth-form-top">
        <label className="sr-only" htmlFor="signin-language">{t(locale, "language")}</label>
        <select id="signin-language" className="language-select" value={locale} onChange={(e) => setLocale(e.target.value as Locale)}>
          <option value="fa-AF">دری</option><option value="ps-AF">پښتو</option><option value="en">English</option>
        </select>
      </div>
      <form onSubmit={submit} className="auth-card">
        <span className="auth-card-icon"><LockKeyhole size={22} /></span>
        <h2>{t(locale, "signIn")}</h2>
        <p className="muted">{t(locale, "signInHelp")}</p>
        <div className="field">
          <label htmlFor="signin-email">{t(locale, "email")}</label>
          <input id="signin-email" name="email" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="staff@example.com" dir="ltr" />
        </div>
        <div className="field">
          <label htmlFor="signin-password">{t(locale, "password")}</label>
          <input id="signin-password" name="password" type="password" autoComplete="current-password" minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} required />
        </div>
        {error && <p className="form-error" role="alert">{error}</p>}
        <button className="button button-primary button-wide" disabled={busy} type="submit">
          <span>{busy ? t(locale, "loading") : t(locale, "signIn")}</span>{busy ? <span className="button-spinner" /> : arrow}
        </button>
        <p className="auth-note">{t(locale, "support")}</p>
      </form>
    </section>
  </main>;
}
