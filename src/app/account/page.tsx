import Link from "next/link";
import { pageUser } from "@/lib/session";
import { Title } from "@/components/ui";
import { SignOut } from "@/components/auth-form";
import { Bookmark, Compass, MailCheck, Store } from "lucide-react";
import { runtime } from "@/lib/runtime";
import { listFeed } from "@/features/posts/service";
import { PostCard } from "@/components/post-card";
export default async function Account() {
  const actor = await pageUser();
  const saved = await listFeed(runtime().db, {
    mode: "saved",
    actorId: actor.id,
    limit: 6,
  });
  return (
    <div className="account-page">
      <Title eyebrow="YOUR ACCOUNT" title={`Hello, ${actor.name}.`} />
      <div className="account-layout">
        <aside className="account-panel">
          <span className="account-avatar">
            {actor.name.slice(0, 1).toUpperCase()}
          </span>
          <div>
            <h2>{actor.name}</h2>
            <p className="muted">Food explorer & restaurant member</p>
          </div>
          <dl className="details">
            <dt>Email</dt>
            <dd>{actor.email}</dd>
            <dt>Verification</dt>
            <dd className="verified-line">
              <MailCheck size={16} />{" "}
              {actor.emailVerified ? "Email verified" : "Verification required"}
            </dd>
          </dl>
          <nav className="account-links">
            <Link href="/explore">
              <Compass size={18} /> Explore restaurants
            </Link>
            <Link href="/?tab=following">
              <Bookmark size={18} /> Following feed
            </Link>
            <Link href="/owner">
              <Store size={18} /> My restaurants
            </Link>
            <Link href="/forgot-password">Reset password</Link>
          </nav>
          <SignOut />
        </aside>
        <section className="saved-section">
          <div className="section-title-line">
            <div>
              <p className="eyebrow">YOUR COLLECTION</p>
              <h2>Saved posts</h2>
            </div>
            <span className="muted small">{saved.items.length} shown</span>
          </div>
          {saved.items.map((post) => (
            <PostCard key={post.id} post={post} signedIn />
          ))}
          {!saved.items.length && (
            <div className="empty-inline">
              <Bookmark size={27} />
              <div>
                <h3>Nothing saved yet</h3>
                <p className="muted">
                  Save restaurant updates to find them again here.
                </p>
                <Link className="text-link" href="/">
                  Browse the feed
                </Link>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
