import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Bike, MapPin, ShoppingBag } from "lucide-react";
import { pageUser } from "@/lib/session";
import { runtime } from "@/lib/runtime";
import { member } from "@/features/restaurants/service";
import { restaurantOrders } from "@/features/orders/service";
import { formatMoney } from "@/features/orders/money";
import { Title, Status, Empty } from "@/components/ui";
import { OwnerOrderAction } from "@/components/order-actions";

export default async function OwnerOrders({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const actor = await pageUser();
  const { id } = await params;
  if (!(await member(runtime().db, actor, id).catch(() => null))) notFound();
  const rows = await restaurantOrders(runtime().db, actor, id);
  return (
    <>
      <Link className="back-link" href={`/owner/${id}/menu`}>
        <ArrowLeft size={17} /> Menu & ordering
      </Link>
      <Title eyebrow="KITCHEN ORDERS" title="Receive, prepare and hand off.">
        <p>
          New orders wait for your acceptance. Keep each status accurate for the
          customer.
        </p>
      </Title>
      {!rows.length ? (
        <Empty title="No orders have arrived yet.">
          <p>
            Open ordering from your menu workspace when the kitchen is ready.
          </p>
        </Empty>
      ) : (
        <div className="kitchen-orders">
          {rows.map((order) => (
            <article className="kitchen-order-card" key={order.id}>
              <header>
                <div>
                  <p className="eyebrow">{order.code}</p>
                  <h2>
                    {order.fulfillment === "delivery" ? (
                      <>
                        <Bike size={20} /> Delivery order
                      </>
                    ) : (
                      <>
                        <ShoppingBag size={20} /> Pickup order
                      </>
                    )}
                  </h2>
                </div>
                <Status value={order.status} />
              </header>
              <div className="kitchen-ticket">
                {order.items.map((item, index) => (
                  <div key={`${item.mealId}-${index}`}>
                    <span className="ticket-quantity">{item.quantity}×</span>
                    <span>
                      <strong>{item.name}</strong>
                      {item.variantName && <small>{item.variantName}</small>}
                      {item.extras.length > 0 && (
                        <small>
                          {item.extras.map((extra) => extra.name).join(", ")}
                        </small>
                      )}
                    </span>
                    <strong>{formatMoney(item.lineTotalMinor)}</strong>
                  </div>
                ))}
              </div>
              {order.address && (
                <div className="delivery-address">
                  <MapPin size={18} />
                  <span>
                    <strong>
                      {order.address.recipient} · {order.address.phone}
                    </strong>
                    <small>
                      {order.address.address}, {order.address.area},{" "}
                      {order.address.city}
                    </small>
                    {order.address.instructions && (
                      <small>Note: {order.address.instructions}</small>
                    )}
                  </span>
                </div>
              )}
              {order.customerNote && (
                <p className="notice">Kitchen note: {order.customerNote}</p>
              )}
              <footer>
                <div>
                  <span className="muted small">
                    Total · payment {order.paymentStatus}
                  </span>
                  <strong>{formatMoney(order.totalMinor)}</strong>
                </div>
                <OwnerOrderAction
                  restaurantId={id}
                  id={order.id}
                  status={order.status}
                  fulfillment={order.fulfillment}
                  version={order.version}
                />
              </footer>
            </article>
          ))}
        </div>
      )}
    </>
  );
}
