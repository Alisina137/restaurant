import Link from "next/link";
import { pageUser } from "@/lib/session";
import { Title } from "@/components/ui";
import { SignOut } from "@/components/auth-form";
export default async function Account() {
  const actor = await pageUser();
  return (
    <>
      <Title eyebrow="YOUR ACCOUNT" title={`Hello, ${actor.name}.`} />
      <section className="card content-card stack">
        <h2>Account details</h2>
        <dl className="details">
          <dt>Email</dt>
          <dd>{actor.email}</dd>
          <dt>Verification</dt>
          <dd>
            {actor.emailVerified ? "Email verified" : "Verification required"}
          </dd>
        </dl>
        <p className="muted">
          Your account works for both discovering restaurants and managing your
          own page.
        </p>
        <div className="row wrap">
          <Link className="button" href="/owner">
            My restaurants
          </Link>
          <Link className="button secondary" href="/forgot-password">
            Reset password
          </Link>
          <SignOut />
        </div>
      </section>
    </>
  );
}
