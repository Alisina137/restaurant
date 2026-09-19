import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { pageUser } from "@/lib/session";
import { runtime } from "@/lib/runtime";
import { member } from "@/features/restaurants/service";
import { restaurant } from "@/db/schema";
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
  if (!(await member(db, actor, id, true).catch(() => null))) notFound();
  const [r] = await db.select().from(restaurant).where(eq(restaurant.id, id));
  if (!r || r.status === "suspended") notFound();
  return (
    <div className="narrow">
      <Title title="Edit your restaurant." />
      <RestaurantForm initial={r} />
    </div>
  );
}
