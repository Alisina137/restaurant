"use client";
import { type FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle2, CircleUserRound, UtensilsCrossed } from "lucide-react";
import { direction, isLocale, type Locale } from "@dineflow/shared";
import { authClient } from "@/lib/auth-client";
import { p2 } from "@/lib/phase2-copy";

export default function RegisterPage() {
  const router = useRouter();
  const [locale,setLocale] = useState<Locale>("fa-AF");
  const [name,setName] = useState(""), [email,setEmail] = useState(""), [password,setPassword] = useState("");
  const [busy,setBusy] = useState(false), [done,setDone] = useState(false), [error,setError] = useState("");
  useEffect(() => { const saved = localStorage.getItem("dineflow-locale"); if (isLocale(saved)) setLocale(saved); }, []);
  useEffect(() => { document.documentElement.dir = direction(locale); document.documentElement.lang = locale;
    localStorage.setItem("dineflow-locale",locale); }, [locale]);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError("");
    try {
      const result = await authClient.signUp.email({
        name: name.trim(), email: email.trim().toLowerCase(), password,
        callbackURL: window.location.origin + "/onboarding/restaurant"
      });
      if (result.error) { setError(result.error.message ?? p2(locale,"error")); return; }
      setDone(true);
    } catch { setError(p2(locale,"emailError")); }
    finally { setBusy(false); }
  }
  return <main className="auth-layout" dir={direction(locale)}>
    <section className="auth-intro">
      <div className="auth-brand"><span className="brand-mark"><UtensilsCrossed size={24}/></span>DineFlow</div>
      <div className="auth-copy"><div className="eyebrow">RESTAURANT OPERATIONS</div>
        <h1>{p2(locale,"createRestaurant")}<span className="accent-dot">.</span></h1>
        <p>{p2(locale,"createAccountHelp")}</p></div>
    </section>
    <section className="auth-form-panel">
      <div className="auth-form-top"><label className="sr-only" htmlFor="register-lang">Language</label>
        <select id="register-lang" className="language-select" value={locale} onChange={e=>setLocale(e.target.value as Locale)}>
          <option value="fa-AF">دری</option><option value="ps-AF">پښتو</option><option value="en">English</option>
        </select></div>
      <div className="auth-card">
        <span className="auth-card-icon">{done ? <CheckCircle2/> : <CircleUserRound/>}</span>
        <h2>{done ? p2(locale,"checkEmail") : p2(locale,"createAccount")}</h2>
        {done ? <div className="content-stack"><p className="muted" dir="ltr">{email}</p>
          <Link className="button button-primary button-wide" href="/login">{p2(locale,"goLogin")}</Link>
          <button type="button" className="button" onClick={()=>router.push("/onboarding/restaurant")}>
            {p2(locale,"continue")}</button></div> :
          <form onSubmit={submit}>
            <div className="field"><label htmlFor="owner-name">{p2(locale,"fullName")}</label>
              <input id="owner-name" autoComplete="name" minLength={2} maxLength={80} required value={name} onChange={e=>setName(e.target.value)} /></div>
            <div className="field"><label htmlFor="owner-email">{p2(locale,"email")}</label>
              <input id="owner-email" dir="ltr" type="email" autoComplete="email" required value={email} onChange={e=>setEmail(e.target.value)} /></div>
            <div className="field"><label htmlFor="owner-password">{p2(locale,"password")}</label>
              <input id="owner-password" type="password" autoComplete="new-password" required minLength={12} value={password} onChange={e=>setPassword(e.target.value)} />
              <small className="muted">{p2(locale,"passwordHelp")}</small></div>
            {error && <p className="form-error" role="alert">{error}</p>}
            <button className="button button-primary button-wide" type="submit" disabled={busy}>
              {busy ? p2(locale,"loading") : p2(locale,"signUp")}</button>
            <p className="auth-note">{p2(locale,"alreadyAccount")} <Link className="text-link" href="/login">{p2(locale,"goLogin")}</Link></p>
          </form>}
      </div>
    </section>
  </main>;
}
