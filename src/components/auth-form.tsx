"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
export function AuthForm({
  mode,
  enabled,
  token,
}: {
  mode: "sign-in" | "sign-up" | "forgot" | "reset";
  enabled: boolean;
  token?: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const labels = {
    "sign-in": "Sign in",
    "sign-up": "Create account",
    forgot: "Send reset link",
    reset: "Save new password",
  };
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    const d = new FormData(e.currentTarget);
    const email = String(d.get("email") || "")
      .trim()
      .toLowerCase();
    const password = String(d.get("password") || "");
    try {
      let result;
      if (mode === "sign-up")
        result = await authClient.signUp.email({
          email,
          password,
          name: String(d.get("name")),
          callbackURL: "/sign-in?verified=1",
        });
      else if (mode === "sign-in")
        result = await authClient.signIn.email({ email, password });
      else if (mode === "forgot")
        result = await authClient.requestPasswordReset({
          email,
          redirectTo: "/reset-password",
        });
      else
        result = await authClient.resetPassword({
          newPassword: password,
          token: token || "",
        });
      if (result.error) {
        setError(
          mode === "sign-in"
            ? "Could not sign in. Check your details and verify your email."
            : mode === "forgot"
              ? "Unable to send right now. Please try again later."
              : result.error.message || "Please try again.",
        );
        return;
      }
      if (mode === "sign-in") {
        router.push("/owner");
        router.refresh();
        return;
      }
      setNotice(
        mode === "sign-up"
          ? "Check your email to verify your account, then sign in."
          : mode === "forgot"
            ? "If an account matches, a reset link will be sent."
            : "Password updated. You can now sign in.",
      );
    } catch {
      setError("Connection failed. Please try again.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <form onSubmit={submit} className="stack">
      {!enabled && (
        <p className="notice">
          Accounts are temporarily unavailable. Please try again later.
        </p>
      )}
      {mode === "sign-up" && (
        <label>
          Your name
          <input
            name="name"
            autoComplete="name"
            required
            minLength={2}
            maxLength={100}
          />
        </label>
      )}
      {mode !== "reset" && (
        <label>
          Email address
          <input
            name="email"
            type="email"
            autoComplete="email"
            required
            maxLength={254}
          />
        </label>
      )}
      {mode !== "forgot" && (
        <label>
          {mode === "reset" ? "New password" : "Password"}
          <input
            name="password"
            type="password"
            autoComplete={
              mode === "sign-in" ? "current-password" : "new-password"
            }
            required
            minLength={mode === "sign-in" ? 1 : 12}
            maxLength={128}
          />
          {mode !== "sign-in" && (
            <span className="help">Use at least 12 characters.</span>
          )}
        </label>
      )}
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="notice">
          {notice}
        </p>
      )}
      <button disabled={!enabled || busy || (mode === "reset" && !token)}>
        {busy ? "Please wait…" : labels[mode]}
      </button>
      {mode === "sign-in" && (
        <>
          <Link href="/forgot-password">Forgot your password?</Link>
          <p className="muted">
            New here? <Link href="/sign-up">Create an account</Link>
          </p>
        </>
      )}
      {mode !== "sign-in" && <Link href="/sign-in">Back to sign in</Link>}
    </form>
  );
}
export function SignOut() {
  const router = useRouter();
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  return (
    <>
      <button
        className="secondary"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          try {
            const r = await authClient.signOut();
            if (r.error) throw new Error();
            router.push("/");
            router.refresh();
          } catch {
            setError("Could not sign out. Try again.");
            setBusy(false);
          }
        }}
      >
        {busy ? "Signing out…" : "Sign out"}
      </button>
      {error && <p role="alert">{error}</p>}
    </>
  );
}
