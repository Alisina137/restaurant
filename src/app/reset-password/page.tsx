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
        <h1>Choose a new password.</h1>
        <p>Make it long, unique and yours.</p>
        <div className="auth-emblem" aria-hidden="true">
          RS
        </div>
      </div>
      <section className="card auth-card">
        <h2>Password recovery</h2>
        {p.verified && (
          <p className="notice">Email verified. Sign in to continue.</p>
        )}
        {p.error && (
          <p className="error" role="alert">
            This link is invalid or expired. Please request another.
          </p>
        )}
        <AuthForm mode="reset" enabled={configured()} token={p.token} />
      </section>
    </div>
  );
}
