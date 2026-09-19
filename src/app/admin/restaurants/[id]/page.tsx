import { notFound } from "next/navigation";
import { eq, desc } from "drizzle-orm";
import { z } from "zod";
import { pageUser } from "@/lib/session";
import { runtime } from "@/lib/runtime";
import { admin } from "@/features/restaurants/service";
import { restaurant, media, audit } from "@/db/schema";
import { Title, Status } from "@/components/ui";
import { ReviewForm } from "@/components/owner-actions";
export default async function Review({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const actor = await pageUser();
  const { db } = runtime();
  try {
    await admin(db, actor);
  } catch {
    notFound();
  }
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) notFound();
  const [r] = await db.select().from(restaurant).where(eq(restaurant.id, id));
  if (!r) notFound();
  const photos = await db
    .select()
    .from(media)
    .where(eq(media.restaurantId, id));
  const history = await db
    .select()
    .from(audit)
    .where(eq(audit.restaurantId, id))
    .orderBy(desc(audit.createdAt))
    .limit(20);
  return (
    <>
      <Title eyebrow="RESTAURANT REVIEW" title={r.name} />
      <div className="two-column">
        <section className="card content-card stack">
          <Status value={r.status} />
          <p>{r.description}</p>
          <dl className="details">
            <dt>Location</dt>
            <dd>
              {r.address}, {r.area}, {r.city}
            </dd>
            <dt>Phone</dt>
            <dd>{r.phone}</dd>
            <dt>Cuisine</dt>
            <dd>{r.cuisine}</dd>
            <dt>Public address</dt>
            <dd>/restaurants/{r.slug}</dd>
          </dl>
          <h3>Opening hours</h3>
          {r.hours.map((h) => (
            <p className="small" key={h.day}>
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][h.day]}:{" "}
              {h.closed ? "Closed" : `${h.opens} – ${h.closes}`}
            </p>
          ))}
          {photos.map((p) => (
            <img
              key={p.id}
              className="preview-photo"
              src={`/api/media/${p.id}`}
              alt={`${r.name} ${p.kind}`}
            />
          ))}
        </section>
        <section className="card content-card stack">
          <h2>Review decision</h2>
          {["pending_review", "approved", "suspended"].includes(r.status) ? (
            <ReviewForm id={id} version={r.version} status={r.status} />
          ) : (
            <p>This restaurant has not submitted its current draft.</p>
          )}
          <hr />
          <h3>Recent history</h3>
          {history.map((h) => (
            <div key={h.id}>
              <p className="small">{h.action.replaceAll("_", " ")}</p>
              <p className="small muted">
                {h.createdAt.toISOString().slice(0, 16).replace("T", " ")} UTC
              </p>
              {h.detail && <p className="small">{h.detail}</p>}
            </div>
          ))}
        </section>
      </div>
    </>
  );
}
