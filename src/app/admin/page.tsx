import Link from "next/link";
import { notFound } from "next/navigation";
import { desc, inArray } from "drizzle-orm";
import { pageUser } from "@/lib/session";
import { runtime } from "@/lib/runtime";
import { admin } from "@/features/restaurants/service";
import { restaurant } from "@/db/schema";
import { Title, Status, Empty } from "@/components/ui";
export default async function Admin() {
  const actor = await pageUser();
  const { db } = runtime();
  try {
    await admin(db, actor);
  } catch {
    notFound();
  }
  const rows = await db
    .select()
    .from(restaurant)
    .where(
      inArray(restaurant.status, ["pending_review", "approved", "suspended"]),
    )
    .orderBy(desc(restaurant.updatedAt));
  return (
    <>
      <Title eyebrow="ADMINISTRATION" title="Restaurant review.">
        <p>Check the restaurant’s details before making its page public.</p>
      </Title>
      {rows.length ? (
        <div className="stack">
          {rows.map((r) => (
            <Link
              className="card content-card row spread wrap"
              href={`/admin/restaurants/${r.id}`}
              key={r.id}
            >
              <div>
                <h2>{r.name}</h2>
                <p className="muted">
                  {r.area}, {r.city}
                </p>
              </div>
              <Status value={r.status} />
            </Link>
          ))}
        </div>
      ) : (
        <Empty title="You’re all caught up.">
          <p>Submitted restaurants will appear here for review.</p>
        </Empty>
      )}
    </>
  );
}
