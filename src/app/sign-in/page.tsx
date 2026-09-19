import { AuthForm } from "@/components/auth-form";
import { configured } from "@/lib/env";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; verified?: string; error?: string }>;
}) {
  const p = await searchParams;
  return (
    <div className="auth-layout">
      <div className="auth-aside">
        <p className="eyebrow">RESTAURANT SOCIAL</p>
        <h1>Welcome back.</h1>
        <p>Your neighbourhood is waiting.</p>
        <div className="auth-emblem" aria-hidden="true">
          RS
        </div>
      </div>
      <section className="card auth-card">
        <h2>Sign in</h2>
        {p.verified && (
          <p className="notice">Email verified. Sign in to continue.</p>
        )}
        {p.error && (
          <p className="error" role="alert">
            This link is invalid or expired. Please request another.
          </p>
        )}
        <AuthForm mode="sign-in" enabled={configured()} token={p.token} />
      </section>
    </div>
  );
}
