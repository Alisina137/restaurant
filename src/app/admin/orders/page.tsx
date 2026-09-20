import { notFound } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import { pageUser } from "@/lib/session";
import { runtime } from "@/lib/runtime";
import { admin } from "@/features/restaurants/service";
import { order, restaurant, user } from "@/db/schema";
import { formatMoney } from "@/features/orders/money";
import { Status, Title } from "@/components/ui";

export default async function AdminOrdersPage() {
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
      order,
      restaurantName: restaurant.name,
      customerName: user.name,
      customerEmail: user.email,
    })
    .from(order)
    .innerJoin(restaurant, eq(restaurant.id, order.restaurantId))
    .innerJoin(user, eq(user.id, order.customerId))
    .orderBy(desc(order.updatedAt))
    .limit(200);
  return (
    <>
      <Title eyebrow="ORDER SUPPORT" title="Marketplace order history.">
        <p>
          Read-only support visibility. Restaurants still own fulfillment
          decisions.
        </p>
      </Title>
      <div className="admin-list">
        {rows.map((row) => (
          <article className="admin-list-item" key={row.order.id}>
            <div>
              <p className="eyebrow">{row.order.code}</p>
              <h2>{row.restaurantName}</h2>
              <p className="muted">
                {row.customerName} · {row.customerEmail}
              </p>
            </div>
            <div className="stack align-end">
              <Status value={row.order.status} />
              <strong>{formatMoney(row.order.totalMinor)}</strong>
            </div>
          </article>
        ))}
      </div>
    </>
  );
}
