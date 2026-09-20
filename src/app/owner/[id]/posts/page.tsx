import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { ArrowLeft } from "lucide-react";
import { pageUser } from "@/lib/session";
import { runtime } from "@/lib/runtime";
import { member } from "@/features/restaurants/service";
import { listOwnedPosts } from "@/features/posts/service";
import { restaurant } from "@/db/schema";
import { storageConfigured } from "@/lib/storage";
import { PostEditor } from "@/components/post-editor";
import { Title } from "@/components/ui";

export default async function RestaurantPosts({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const actor = await pageUser();
  const { id } = await params;
  const { db } = runtime();
  if (!(await member(db, actor, id).catch(() => null))) notFound();
  const [r] = await db.select().from(restaurant).where(eq(restaurant.id, id));
  if (!r) notFound();
  const posts = await listOwnedPosts(db, actor, id);
  return (
    <div className="owner-posts-page">
      <Link className="back-link" href={`/owner/${id}`}>
        <ArrowLeft size={17} /> Restaurant workspace
      </Link>
      <Title eyebrow="PUBLISHING STUDIO" title={`Stories from ${r.name}`}>
        <p>Create polished updates for the Discover and Following feeds.</p>
      </Title>
      <PostEditor
        restaurantId={id}
        posts={posts}
        approved={r.status === "approved"}
        storageEnabled={storageConfigured()}
      />
    </div>
  );
}
