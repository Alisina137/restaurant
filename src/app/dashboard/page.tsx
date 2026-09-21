import Link from "next/link";
import { redirect } from "next/navigation";
import { Clock3, Heart, ReceiptText, Sparkles, Store } from "lucide-react";
import { pageUser } from "@/lib/session";
import { runtime } from "@/lib/runtime";
import { workspaceContext } from "@/features/workspaces/service";
import { customerOrders } from "@/features/orders/service";
import { listFeed } from "@/features/posts/service";
import { formatMoney } from "@/features/orders/money";
import { Empty, Status, Title } from "@/components/ui";

export default async function DashboardPage() {
  const actor = await pageUser();
  const { db } = runtime();
  const context = await workspaceContext(db, actor);
  if (context.active.kind === "admin") redirect("/admin");
  if (context.active.kind === "restaurant")
    redirect(`/owner/${context.active.restaurantId}`);
  const [orders, feed] = await Promise.all([
    customerOrders(db, actor),
    listFeed(db, { actorId: actor.id, limit: 12 }),
  ]);
  const active = orders.find(({ order }) =>
    [
      "awaiting_acceptance",
      "accepted",
      "preparing",
      "out_for_delivery",
      "ready_for_pickup",
    ].includes(order.status),
  );
  const fresh = feed.items.filter((item) => item.freshToday).slice(0, 4);
  const recent = [
    ...new Map(orders.map((row) => [row.restaurantSlug, row])).values(),
  ].slice(0, 4);
  return (
    <>
      <Title
        eyebrow="PERSONAL DASHBOARD"
        title={`Welcome back, ${actor.name}.`}
      >
        <p>
          Your active order, local Fresh Today offers, and recent kitchens in
          one place.
        </p>
      </Title>
      <div className="dashboard-grid">
        <section className="dashboard-feature-card">
          <div className="row spread">
            <span className="dashboard-icon">
              <ReceiptText size={21} />
            </span>
            <Link href="/orders">All orders →</Link>
          </div>
          <p className="eyebrow">ACTIVE ORDER</p>
          {active ? (
            <>
              <h2>{active.restaurantName}</h2>
              <Status value={active.order.status} />
              <strong>{formatMoney(active.order.totalMinor)}</strong>
              <p className="muted">Delivered by the restaurant.</p>
            </>
          ) : (
            <>
              <h2>No active order</h2>
              <p className="muted">Your next local meal is a few taps away.</p>
              <Link className="button" href="/explore">
                Find food
              </Link>
            </>
          )}
        </section>
        <section className="dashboard-feature-card warm">
          <span className="dashboard-icon">
            <Heart size={21} />
          </span>
          <p className="eyebrow">QUICK LINKS</p>
          <h2>Return to your favorites.</h2>
          <p className="muted">
            Saved restaurants, meals and delivery addresses stay close.
          </p>
          <div className="row wrap">
            <Link className="button secondary" href="/saved">
              View saved
            </Link>
            <Link className="button secondary" href="/addresses">
              Addresses
            </Link>
          </div>
        </section>
      </div>
      <section className="dashboard-section">
        <div className="section-title-line">
          <div>
            <p className="eyebrow">LIMITED AVAILABILITY</p>
            <h2>Fresh Today</h2>
          </div>
          <Sparkles size={22} />
        </div>
        {fresh.length ? (
          <div className="fresh-dashboard-grid">
            {fresh.map((item) => (
              <Link
                href={`/restaurants/${item.restaurantSlug}#menu`}
                key={item.id}
              >
                <strong>{item.linkedMeal?.name}</strong>
                <span>{item.restaurantName}</span>
                <b>{item.freshToday!.stockRemaining} left</b>
              </Link>
            ))}
          </div>
        ) : (
          <Empty title="No live Fresh Today offers.">
            <p>
              Restaurants will appear here when they publish real limited stock.
            </p>
          </Empty>
        )}
      </section>
      <section className="dashboard-section">
        <div className="section-title-line">
          <div>
            <p className="eyebrow">ORDER HISTORY</p>
            <h2>Recent restaurants</h2>
          </div>
          <Clock3 size={22} />
        </div>
        <div className="recent-place-row">
          {recent.map((row) => (
            <Link
              href={`/restaurants/${row.restaurantSlug}`}
              key={row.restaurantSlug}
            >
              <Store size={20} />
              <span>
                <strong>{row.restaurantName}</strong>
                <small>Order again from the current menu</small>
              </span>
            </Link>
          ))}
        </div>
      </section>
    </>
  );
}
