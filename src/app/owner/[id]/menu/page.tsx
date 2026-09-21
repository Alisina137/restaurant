import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Truck } from "lucide-react";
import { pageUser } from "@/lib/session";
import { runtime } from "@/lib/runtime";
import { ownerCatalog } from "@/features/catalog/service";
import { member } from "@/features/restaurants/service";
import { Title } from "@/components/ui";
import { CatalogManager } from "@/components/catalog-manager";
import { AvailabilityManager } from "@/components/availability-manager";
import { MenuContentManager } from "@/components/menu-content-manager";

export default async function MenuPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const actor = await pageUser();
  const { id } = await params;
  const access = await member(runtime().db, actor, id).catch(() => null);
  const data = await ownerCatalog(runtime().db, actor, id).catch(() => null);
  if (!data || !access) notFound();
  const owner = access.role === "owner";
  const canMenu = owner || access.canManageMenu;
  const canContent = owner || access.canEditMenuContent;
  const canAvailability = owner || access.canManageAvailability;
  const canOrders = owner || access.canManageOrders;
  const canDelivery = owner || access.canManageDelivery;
  if (!canMenu && !canContent && !canAvailability) notFound();
  const meals = data.categories.flatMap((category) => category.meals);
  return (
    <>
      <Link className="back-link" href={`/owner/${id}`}>
        <ArrowLeft size={17} /> Restaurant workspace
      </Link>
      <Title eyebrow="MENU & ORDERING" title={`${data.restaurant.name} menu`}>
        <p>Build the menu customers see, then open your kitchen for orders.</p>
      </Title>
      <div className="row wrap page-actions">
        {canDelivery && (
          <Link className="button secondary" href={`/owner/${id}/delivery`}>
            <Truck size={17} /> Delivery setup
          </Link>
        )}
        {canOrders && (
          <Link className="button secondary" href={`/owner/${id}/orders`}>
            View orders
          </Link>
        )}
      </div>
      {canAvailability && (
        <AvailabilityManager
          restaurantId={id}
          approved={data.restaurant.status === "approved"}
          restaurant={data.restaurant}
          meals={meals.map((meal) => ({
            id: meal.id,
            name: meal.name,
            available: meal.available,
          }))}
        />
      )}
      {canMenu && (
        <CatalogManager restaurantId={id} categories={data.categories} />
      )}
      {!canMenu && canContent && (
        <MenuContentManager
          restaurantId={id}
          meals={meals.map((meal) => ({
            id: meal.id,
            name: meal.name,
            description: meal.description,
          }))}
        />
      )}
    </>
  );
}
