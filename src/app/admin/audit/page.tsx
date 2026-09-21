import { notFound } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import { pageUser } from "@/lib/session";
import { runtime } from "@/lib/runtime";
import { admin } from "@/features/restaurants/service";
import { audit, restaurant, user } from "@/db/schema";
import { Title } from "@/components/ui";

export default async function AdminAuditPage() {
  const actor = await pageUser();
  const { db } = runtime();
  if (
    !(await admin(db, actor)
      .then(() => true)
      .catch(() => false))
  )
    notFound();
  const rows = await db
    .select({
      id: audit.id,
      action: audit.action,
      detail: audit.detail,
      createdAt: audit.createdAt,
      actorName: user.name,
      restaurantName: restaurant.name,
    })
    .from(audit)
    .innerJoin(user, eq(user.id, audit.actorId))
    .innerJoin(restaurant, eq(restaurant.id, audit.restaurantId))
    .orderBy(desc(audit.createdAt))
    .limit(300);
  return (
    <>
      <Title eyebrow="AUDIT HISTORY" title="Sensitive actions, recorded.">
        <p>
          Restaurant review, contributor, content and fulfillment decisions
          appear here.
        </p>
      </Title>
      <div className="audit-list">
        {rows.map((item) => (
          <article key={item.id}>
            <time>
              {new Intl.DateTimeFormat("en-AF", {
                dateStyle: "medium",
                timeStyle: "short",
              }).format(item.createdAt)}
            </time>
            <strong>{item.action.replaceAll("_", " ")}</strong>
            <span>
              {item.restaurantName} · {item.actorName}
            </span>
            {item.detail && <small>{item.detail}</small>}
          </article>
        ))}
      </div>
    </>
  );
}
