import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  Bike,
  Clock,
  MapPin,
  Phone,
  ShoppingBag,
  Store,
} from "lucide-react";
import { getPublic } from "@/features/restaurants/service";
import { isOpen } from "@/features/restaurants/hours";
import { listFeed } from "@/features/posts/service";
import { restaurantSocial } from "@/features/discovery/service";
import { runtime } from "@/lib/runtime";
import { configured } from "@/lib/env";
import { currentUser } from "@/lib/session";
import { FollowButton } from "@/components/social-actions";
import { PostCard } from "@/components/post-card";
import { publicMenu } from "@/features/catalog/service";
import { OrderMenu } from "@/components/order-menu";
export default async function PublicRestaurant({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  if (!configured()) notFound();
  const { db } = runtime();
  const r = await getPublic(db, (await params).slug);
  if (!r) notFound();
  const actor = await currentUser().catch(() => null);
  const [social, feed, menu] = await Promise.all([
    restaurantSocial(db, r.id, actor?.id),
    listFeed(db, { restaurantId: r.id, actorId: actor?.id, limit: 8 }),
    publicMenu(db, r.id),
  ]);
  const cover = r.images.find((i) => i.kind === "cover");
  const logo = r.images.find((i) => i.kind === "logo");
  const open = isOpen(r.hours);
  return (
    <article className="public-profile">
      <Link className="back-link" href="/explore">
        <ArrowLeft size={17} /> Explore restaurants
      </Link>
      <div className="profile-cover">
        {cover ? (
          <img src={`/api/media/${cover.id}`} alt={`${r.name} restaurant`} />
        ) : (
          <span className="profile-cover-empty">
            <Store size={56} />
            <small>{r.cuisine} restaurant</small>
          </span>
        )}
        <span className="cover-shade" />
      </div>
      <section className="profile-header">
        <div className="profile-logo">
          {logo ? (
            <img src={`/api/media/${logo.id}`} alt={`${r.name} logo`} />
          ) : (
            <Store size={31} />
          )}
        </div>
        <div className="profile-heading-copy">
          <p className="eyebrow">
            {r.cuisine} · {r.city}
          </p>
          <h1>{r.name}</h1>
          <p className="location muted">
            <MapPin size={17} />
            {r.area}, {r.city}
          </p>
          <div className="service-pills profile-services">
            <span className={open ? "available" : "unavailable"}>
              <Clock size={14} /> {open ? "Open now" : "Closed now"}
            </span>
            {r.deliveryAvailable && (
              <span className="available">
                <Bike size={14} /> Delivery
              </span>
            )}
            {r.pickupAvailable && (
              <span className="available">
                <ShoppingBag size={14} /> Pickup
              </span>
            )}
          </div>
        </div>
        <FollowButton
          restaurantId={r.id}
          initial={social.following}
          count={social.followerCount}
          signedIn={Boolean(actor)}
        />
      </section>

      <nav className="profile-tabs" aria-label="Restaurant page sections">
        <a href="#menu">
          Menu{" "}
          <span>
            {menu.categories.reduce(
              (total, category) => total + category.meals.length,
              0,
            )}
          </span>
        </a>
        <a href="#updates">
          Updates <span>{feed.items.length}</span>
        </a>
        <a href="#about">About</a>
        <a href="#hours">Hours</a>
      </nav>

      <OrderMenu
        restaurant={menu.restaurant}
        categories={menu.categories}
        zones={menu.zones}
        signedIn={Boolean(actor)}
        customerName={actor?.name}
      />

      <div className="restaurant-content-grid">
        <section id="updates" className="restaurant-updates">
          <div className="section-title-line">
            <div>
              <p className="eyebrow">LATEST</p>
              <h2>From the kitchen</h2>
            </div>
            <span className="muted small">Newest first</span>
          </div>
          {feed.items.map((item) => (
            <PostCard key={item.id} post={item} signedIn={Boolean(actor)} />
          ))}
          {!feed.items.length && (
            <div className="empty-inline">
              <Store size={27} />
              <div>
                <h3>No updates published yet</h3>
                <p className="muted">
                  Follow this restaurant to catch its first post.
                </p>
              </div>
            </div>
          )}
        </section>
        <aside className="restaurant-info-rail">
          <section id="about" className="card content-card stack">
            <h2>About {r.name}</h2>
            <p className="preserve">{r.description}</p>
            <hr />
            <h3>Find us</h3>
            <p className="location">
              <MapPin size={18} />
              {r.address}, {r.area}, {r.city}
            </p>
            <a className="location" href={`tel:${r.phone}`}>
              <Phone size={18} />
              <bdi>{r.phone}</bdi>
            </a>
          </section>
          <section id="hours" className="card content-card stack">
            <h2 className="location">
              <Clock size={22} />
              Opening hours
            </h2>
            <p className="small muted">Afghanistan time</p>
            {[...r.hours]
              .sort((a, b) => a.day - b.day)
              .map((h) => (
                <div className="row spread" key={h.day}>
                  <span>
                    {
                      [
                        "Sunday",
                        "Monday",
                        "Tuesday",
                        "Wednesday",
                        "Thursday",
                        "Friday",
                        "Saturday",
                      ][h.day]
                    }
                  </span>
                  <span className="small">
                    {h.closed ? "Closed" : `${h.opens} – ${h.closes}`}
                  </span>
                </div>
              ))}
          </section>
        </aside>
      </div>
    </article>
  );
}
