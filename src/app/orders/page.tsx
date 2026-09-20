import Link from "next/link";
import { CheckCircle2, Clock3, ReceiptText } from "lucide-react";
import { pageUser } from "@/lib/session";
import { runtime } from "@/lib/runtime";
import { customerOrders } from "@/features/orders/service";
import { formatMoney } from "@/features/orders/money";
import { Title, Status, Empty } from "@/components/ui";
import { CancelOrder } from "@/components/order-actions";

export default async function Orders({
  searchParams,
}: {
  searchParams: Promise<{ placed?: string }>;
}) {
  const actor = await pageUser();
  const rows = await customerOrders(runtime().db, actor);
  const placed = (await searchParams).placed === "1";
  return (
    <>
      <Title
        eyebrow="YOUR ORDERS"
        title="Follow every meal from kitchen to door."
      >
        <p>Restaurants accept and deliver their own orders.</p>
      </Title>
      {placed && (
        <div className="order-success">
          <CheckCircle2 size={24} />
          <div>
            <h3>Your order was sent to the restaurant.</h3>
            <p>
              Payment is due directly to the restaurant on delivery or pickup.
            </p>
          </div>
        </div>
      )}
      {!rows.length ? (
        <Empty title="No orders yet.">
          <p>Explore local menus and place your first order.</p>
          <Link className="button" href="/explore">
            Find food
          </Link>
        </Empty>
      ) : (
        <div className="customer-order-list">
          {rows.map(({ order, restaurantName, restaurantSlug }) => (
            <article className="order-card" key={order.id}>
              <div className="order-card-head">
                <div>
                  <p className="eyebrow">{order.code}</p>
                  <Link href={`/restaurants/${restaurantSlug}`}>
                    <h2>{restaurantName}</h2>
                  </Link>
                  <p className="small muted">
                    <Clock3 size={14} />{" "}
                    {new Intl.DateTimeFormat("en-AF", {
                      dateStyle: "medium",
                      timeStyle: "short",
                    }).format(order.createdAt)}
                  </p>
                </div>
                <Status value={order.status} />
              </div>
              <div className="order-items">
                {order.items.map((item, index) => (
                  <div className="row spread" key={`${item.mealId}-${index}`}>
                    <span>
                      <strong>{item.quantity}×</strong> {item.name}
                      {item.variantName && <small> · {item.variantName}</small>}
                    </span>
                    <strong>{formatMoney(item.lineTotalMinor)}</strong>
                  </div>
                ))}
              </div>
              <div className="order-total-line">
                <span>
                  {order.fulfillment === "delivery"
                    ? "Restaurant delivery"
                    : "Customer pickup"}
                </span>
                <strong>{formatMoney(order.totalMinor)}</strong>
              </div>
              <div className="payment-state">
                <ReceiptText size={17} />
                <span>
                  <strong>Payment: {order.paymentStatus}</strong>
                  <small>
                    Online HesabPay payment is not enabled until Phase 5.
                  </small>
                </span>
              </div>
              {order.status === "awaiting_acceptance" && (
                <CancelOrder id={order.id} />
              )}
            </article>
          ))}
        </div>
      )}
    </>
  );
}
