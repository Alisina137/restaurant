import { notFound } from "next/navigation";
import { MapPin, Phone, Clock, Store } from "lucide-react";
import { getPublic } from "@/features/restaurants/service";
import { isOpen } from "@/features/restaurants/hours";
import { runtime } from "@/lib/runtime";
import { configured } from "@/lib/env";
export default async function PublicRestaurant({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  if (!configured()) notFound();
  const r = await getPublic(runtime().db, (await params).slug);
  if (!r) notFound();
  const cover = r.images.find((i) => i.kind === "cover");
  const logo = r.images.find((i) => i.kind === "logo");
  return (
    <article className="public-profile">
      <div className="profile-cover">
        {cover ? (
          <img src={`/api/media/${cover.id}`} alt={`${r.name} restaurant`} />
        ) : (
          <Store size={70} />
        )}
      </div>
      <section className="profile-header card">
        <div className="profile-logo">
          {logo ? (
            <img src={`/api/media/${logo.id}`} alt={`${r.name} logo`} />
          ) : (
            <Store size={31} />
          )}
        </div>
        <p className="eyebrow">
          {r.cuisine} · {r.city}
        </p>
        <h1>{r.name}</h1>
        <p className="location muted">
          <MapPin size={17} />
          {r.area}, {r.city}
        </p>
        <div className="row wrap">
          <span
            className={"status " + (isOpen(r.hours) ? "approved" : "draft")}
          >
            {isOpen(r.hours) ? "Open now" : "Closed now"}
          </span>
          <span className="small muted">Online ordering is not available</span>
        </div>
      </section>
      <div className="two-column section-heading">
        <section className="card content-card stack">
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
        <section className="card content-card stack">
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
      </div>
    </article>
  );
}
