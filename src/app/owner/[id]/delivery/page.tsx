import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { pageUser } from "@/lib/session";
import { runtime } from "@/lib/runtime";
import { ownerCatalog } from "@/features/catalog/service";
import { Title } from "@/components/ui";
import { DeliveryManager } from "@/components/delivery-manager";

export default async function DeliveryPage({
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
      <Link className="back-link" href={`/owner/${id}/menu`}>
        <ArrowLeft size={17} /> Menu & ordering
      </Link>
      <Title eyebrow="DELIVERY SETUP" title="Define where your team delivers.">
        <p>Set a fee, minimum order and honest time range for every area.</p>
      </Title>
      {!data.restaurant.deliveryAvailable && (
        <p className="notice">
          Delivery is not enabled on your approved profile. Add zones now, then
          enable delivery through a reviewed profile update.
        </p>
      )}
      <DeliveryManager restaurantId={id} zones={data.zones} />
    </>
  );
}
