import Link from "next/link";
import { notFound } from "next/navigation";
import { desc } from "drizzle-orm";
import { pageUser } from "@/lib/session";
import { runtime } from "@/lib/runtime";
import { admin } from "@/features/restaurants/service";
import { restaurant } from "@/db/schema";
import { Status, Title } from "@/components/ui";

export default async function AdminRestaurantsPage() {
  const actor = await pageUser();
  const { db } = runtime();
  if (
    !(await admin(db, actor)
      .then(() => true)
      .catch(() => false))
  )
    notFound();
  const rows = await db
    .select()
    .from(restaurant)
    .orderBy(desc(restaurant.updatedAt));
  return (
    <>
      <Title eyebrow="PLATFORM RESTAURANTS" title="Every restaurant page.">
        <p>
          Review real status, ownership boundaries and operational availability.
        </p>
      </Title>
      <div className="admin-list">
        {rows.map((item) => (
          <Link
            className="admin-list-item"
            href={`/admin/restaurants/${item.id}`}
            key={item.id}
          >
            <div>
              <h2>{item.name}</h2>
              <p className="muted">
                {item.cuisine} · {item.area}, {item.city}
              </p>
              <small>
                {item.kitchenState} · updated{" "}
                {new Intl.DateTimeFormat("en-AF", {
                  dateStyle: "medium",
                }).format(item.updatedAt)}
              </small>
            </div>
            <Status value={item.status} />
          </Link>
        ))}
      </div>
    </>
  );
}
