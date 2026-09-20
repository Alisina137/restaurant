import { notFound } from "next/navigation";
import { pageUser } from "@/lib/session";
import { runtime } from "@/lib/runtime";
import { managementProfile } from "@/features/restaurants/service";
import { Title } from "@/components/ui";
import { RestaurantForm } from "@/components/restaurant-form";
export default async function Edit({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const actor = await pageUser();
  const { id } = await params;
  const { db } = runtime();
  const result = await managementProfile(db, actor, id, true).catch(() => null);
  if (!result || result.restaurant.status === "suspended") notFound();
  const r = { ...result.profile, id: result.restaurant.id };
  return (
    <div className="narrow">
      <Title title="Edit your restaurant." />
      {result.published && (
        <p className="notice">
          Your current page stays public while these changes are reviewed.
        </p>
      )}
      <RestaurantForm initial={r} />
    </div>
  );
}
