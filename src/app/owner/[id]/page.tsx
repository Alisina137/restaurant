import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { pageUser } from "@/lib/session";
import { runtime } from "@/lib/runtime";
import { member } from "@/features/restaurants/service";
import { restaurant, media, membership, user } from "@/db/schema";
import { Title, Status } from "@/components/ui";
import {
  SubmitReview,
  PhotoUpload,
  StaffEditor,
} from "@/components/owner-actions";
import { storageConfigured } from "@/lib/storage";
export default async function Workspace({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const actor = await pageUser();
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) notFound();
  const { db } = runtime();
  const m = await member(db, actor, id).catch(() => null);
  if (!m) notFound();
  const [r] = await db.select().from(restaurant).where(eq(restaurant.id, id));
  if (!r) notFound();
  const photos = await db
    .select()
    .from(media)
    .where(eq(media.restaurantId, id));
  const staff = await db
    .select({
      id: membership.id,
      name: user.name,
      email: user.email,
      role: membership.role,
    })
    .from(membership)
    .innerJoin(user, eq(user.id, membership.userId))
    .where(eq(membership.restaurantId, id));
  const owner = m.role === "owner";
  return (
    <>
      <Title eyebrow="RESTAURANT WORKSPACE" title={r.name}>
        <p>
          {r.area}, {r.city}
        </p>
      </Title>
      <div className="card content-card stack">
        <div className="row spread wrap">
          <Status value={r.status} />
          <span className="small muted">
            {owner ? "Owner" : "Staff"} access
          </span>
        </div>
        {r.reviewNote && (
          <p className="notice">Review message: {r.reviewNote}</p>
        )}
        <p className="muted">
          {r.status === "draft"
            ? "Your page is private. Add any photos, then submit it for review."
            : r.status === "pending_review"
              ? "Your page is being reviewed. You’ll see the decision here."
              : r.status === "approved"
                ? "Your page is public. Online ordering is not available yet."
                : r.status === "suspended"
                  ? "This page is suspended. Contact your administrator."
                  : "Update your details using the review message, then submit again."}
        </p>
        <div className="row wrap">
          {owner && r.status !== "suspended" && (
            <Link className="button secondary" href={`/owner/${id}/edit`}>
              Edit restaurant details
            </Link>
          )}
          {owner && ["draft", "changes_requested"].includes(r.status) && (
            <SubmitReview id={id} version={r.version} />
          )}{" "}
          {r.status === "approved" && (
            <Link className="button" href={`/restaurants/${r.slug}`}>
              View public page
            </Link>
          )}
        </div>
      </div>
      <div className="two-column section-heading">
        <section className="card content-card stack">
          <h2>Restaurant photos</h2>
          {photos.map((p) => (
            <img
              className="preview-photo"
              src={`/api/media/${p.id}`}
              alt={`${r.name} ${p.kind}`}
              key={p.id}
            />
          ))}
          {owner && r.status !== "suspended" && (
            <>
              {!storageConfigured() && (
                <p className="notice">
                  Photo uploads are not available yet. Your restaurant details
                  can still be reviewed.
                </p>
              )}
              <p className="small muted">
                JPEG, PNG or WebP, up to 5 MB. Uploading a new photo returns the
                page to draft for review.
              </p>
              <PhotoUpload id={id} kind="cover" enabled={storageConfigured()} />
              <PhotoUpload id={id} kind="logo" enabled={storageConfigured()} />
            </>
          )}
          {!photos.length && <p className="muted">No photos added yet.</p>}
        </section>
        <section className="card content-card stack">
          <h2>Your team</h2>
          {owner ? (
            <StaffEditor id={id} staff={staff} />
          ) : (
            <p className="muted">Only the owner can manage team access.</p>
          )}
        </section>
      </div>
    </>
  );
}
