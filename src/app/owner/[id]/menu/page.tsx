import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Truck } from "lucide-react";
import { pageUser } from "@/lib/session";
import { runtime } from "@/lib/runtime";
import { ownerCatalog } from "@/features/catalog/service";
import { Title } from "@/components/ui";
import { CatalogManager } from "@/components/catalog-manager";

export default async function MenuPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const actor = await pageUser();
  const { id } = await params;
  const data = await ownerCatalog(runtime().db, actor, id).catch(() => null);
  if (!data) notFound();
  return (
    <>
      <Link className="back-link" href={`/owner/${id}`}>
        <ArrowLeft size={17} /> Restaurant workspace
      </Link>
      <Title eyebrow="MENU & ORDERING" title={`${data.restaurant.name} menu`}>
        <p>Build the menu customers see, then open your kitchen for orders.</p>
      </Title>
      <div className="row wrap page-actions">
        <Link className="button secondary" href={`/owner/${id}/delivery`}>
          <Truck size={17} /> Delivery setup
        </Link>
        <Link className="button secondary" href={`/owner/${id}/orders`}>
          View orders
        </Link>
      </div>
      <CatalogManager
        restaurantId={id}
        acceptingOrders={data.restaurant.acceptingOrders}
        approved={data.restaurant.status === "approved"}
        categories={data.categories}
      />
    </>
  );
}
