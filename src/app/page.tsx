import Link from "next/link";
import {
  ArrowRight,
  Compass,
  MapPin,
  Search,
  Sparkles,
  Store,
} from "lucide-react";
import { Empty } from "@/components/ui";
import { PostCard } from "@/components/post-card";
import { listFeed } from "@/features/posts/service";
import { searchRestaurants } from "@/features/discovery/service";
import { runtime } from "@/lib/runtime";
import { configured } from "@/lib/env";
import { currentUser } from "@/lib/session";
import { getLowData } from "@/lib/preferences";

const cities = ["Kabul", "Herat", "Mazar-i-Sharif", "Kandahar", "Jalalabad"];

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; city?: string; cursor?: string }>;
}) {
  const query = await searchParams;
  const ready = configured();
  const actor = ready ? await currentUser().catch(() => null) : null;
  const lowData = await getLowData();
  const mode = query.tab === "following" ? "following" : "discover";
  const city = cities.includes(query.city || "") ? query.city : undefined;
  const feed = ready
    ? await listFeed(runtime().db, {
        mode,
        city,
        cursor: query.cursor,
        actorId: actor?.id,
      })
    : { items: [], nextCursor: null };
  const suggestions = ready
    ? (
        await searchRestaurants(runtime().db, {
          city,
          actorId: actor?.id,
        })
      ).slice(0, 4)
    : [];
  const base = new URLSearchParams();
  if (mode === "following") base.set("tab", "following");
  if (city) base.set("city", city);

  return (
    <div className="feed-page">
      <header className="feed-intro">
        <div>
          <p className="eyebrow">
            <Sparkles size={14} /> FRESH FROM LOCAL KITCHENS
          </p>
          <h1>What’s cooking today?</h1>
          <p className="muted">
            Real updates from approved restaurants across your city.
          </p>
        </div>
        <Link className="explore-search" href="/explore">
          <Search size={19} /> Search restaurants
        </Link>
      </header>

      <section className="feed-controls" aria-label="Feed controls">
        <div className="feed-tabs">
          <Link
            className={mode === "discover" ? "active" : ""}
            href={city ? `/?city=${city}` : "/"}
          >
            <Compass size={18} /> Discover
          </Link>
          <Link
            className={mode === "following" ? "active" : ""}
            href={`/?tab=following${city ? `&city=${city}` : ""}`}
          >
            Following
          </Link>
        </div>
        <details className="city-picker">
          <summary>
            <MapPin size={17} /> {city || "All cities"}
          </summary>
          <div className="city-menu">
            <Link href={mode === "following" ? "/?tab=following" : "/"}>
              All cities
            </Link>
            {cities.map((name) => (
              <Link
                key={name}
                href={`/?${mode === "following" ? "tab=following&" : ""}city=${encodeURIComponent(name)}`}
              >
                {name}
              </Link>
            ))}
          </div>
        </details>
      </section>

      <div className="feed-layout">
        <section className="feed-stream" aria-label={`${mode} posts`}>
          {mode === "following" && !actor ? (
            <Empty title="Your personal food feed starts after sign in.">
              <p>Follow restaurants to see their newest updates together.</p>
              <Link className="button" href="/sign-in">
                Sign in to continue
              </Link>
            </Empty>
          ) : feed.items.length ? (
            <>
              {feed.items.map((post) => (
                <PostCard
                  key={post.id}
                  post={post}
                  signedIn={Boolean(actor)}
                  lowData={lowData}
                />
              ))}
              {feed.nextCursor && (
                <Link
                  className="button secondary load-more"
                  href={`/?${base.toString()}${base.size ? "&" : ""}cursor=${encodeURIComponent(feed.nextCursor)}`}
                >
                  Load older posts <ArrowRight size={17} />
                </Link>
              )}
            </>
          ) : (
            <Empty
              title={
                mode === "following"
                  ? "Nothing from your follows yet."
                  : "The feed is ready for its first story."
              }
            >
              <p>
                {mode === "following"
                  ? "Discover local restaurants and follow the kitchens you enjoy."
                  : "Approved restaurants can now publish daily updates here."}
              </p>
              <Link
                className="button"
                href={mode === "following" ? "/explore" : "/owner"}
              >
                {mode === "following"
                  ? "Find restaurants"
                  : "Open restaurant workspace"}
              </Link>
            </Empty>
          )}
        </section>

        <aside className="feed-rail">
          <section className="rail-card">
            <div className="row spread">
              <div>
                <p className="eyebrow">DISCOVER</p>
                <h2>Local kitchens</h2>
              </div>
              <Link
                className="round-link"
                href="/explore"
                aria-label="Explore all restaurants"
              >
                <ArrowRight size={18} />
              </Link>
            </div>
            <div className="suggestion-list">
              {suggestions.map((item) => {
                const logo = item.images.find((image) => image.kind === "logo");
                return (
                  <Link href={`/restaurants/${item.slug}`} key={item.id}>
                    <span className="suggestion-logo">
                      {logo && !lowData ? (
                        <img src={`/api/media/${logo.id}`} alt="" />
                      ) : (
                        <Store size={19} />
                      )}
                    </span>
                    <span>
                      <strong>{item.name}</strong>
                      <small>
                        {item.cuisine} · {item.area}
                      </small>
                    </span>
                    <ArrowRight size={16} />
                  </Link>
                );
              })}
              {!suggestions.length && (
                <p className="muted small">
                  Approved restaurants will appear here.
                </p>
              )}
            </div>
          </section>
          <section className="owner-rail-card">
            <span className="owner-rail-icon">
              <Store size={23} />
            </span>
            <p className="eyebrow">FOR RESTAURANTS</p>
            <h2>Turn today’s special into tomorrow’s regular.</h2>
            <p>
              Build your page and publish directly to the neighbourhood feed.
            </p>
            <Link href="/owner">
              Open your workspace <ArrowRight size={16} />
            </Link>
          </section>
        </aside>
      </div>
    </div>
  );
}
