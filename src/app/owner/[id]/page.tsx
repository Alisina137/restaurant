import Link from "next/link";
import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { pageUser } from "@/lib/session";
import { runtime } from "@/lib/runtime";
import { managementProfile } from "@/features/restaurants/service";
import { media, membership, user } from "@/db/schema";
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
  const result = await managementProfile(db, actor, id).catch(() => null);
  if (!result) notFound();
  const { restaurant: published, revision, profile: r } = result;
  const m = await db
    .select()
    .from(membership)
    .where(
      and(eq(membership.restaurantId, id), eq(membership.userId, actor.id)),
    )
    .then((rows) => rows[0]);
  if (!m) notFound();
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
  const state = revision?.status || published.status;
  return (
    <>
      <Title eyebrow="RESTAURANT WORKSPACE" title={r.name}>
        <p>
          {r.area}, {r.city}
        </p>
      </Title>
      <div className="card content-card stack">
        <div className="row spread wrap">
          <Status value={state} />
          <span className="small muted">
            {owner ? "Owner" : "Staff"} access
          </span>
        </div>
        {r.reviewNote && (
          <p className="notice">Review message: {r.reviewNote}</p>
        )}
        {revision && (
          <p className="notice success-notice">
            Your approved restaurant remains public with its current details
            while this update is reviewed. Rejected changes will not alter the
            public page.
          </p>
        )}
        <p className="muted">
          {state === "draft"
            ? result.published
              ? "Your update is saved as a draft. Submit it when it is ready."
              : "Your page is private. Add any photos, then submit it for review."
            : state === "pending_review"
              ? result.published
                ? "Your update is being reviewed; the approved page is still public."
                : "Your page is being reviewed. You’ll see the decision here."
              : state === "approved"
                ? "Your page is public and ready for a menu."
                : state === "suspended"
                  ? "This page is suspended. Contact your administrator."
                  : "Update your details using the review message, then submit again."}
        </p>
        <div className="row wrap">
          {published.status === "approved" && (
            <Link className="button" href={`/owner/${id}/menu`}>
              Manage menu & orders
            </Link>
          )}
          {state !== "suspended" && (
            <Link className="button" href={`/owner/${id}/posts`}>
              Manage posts
            </Link>
          )}
          {owner && state !== "suspended" && state !== "pending_review" && (
            <Link className="button secondary" href={`/owner/${id}/edit`}>
              Edit restaurant details
            </Link>
          )}
          {owner && ["draft", "changes_requested"].includes(state) && (
            <SubmitReview id={id} version={r.version} />
          )}{" "}
          {published.status === "approved" && (
            <Link className="button" href={`/restaurants/${published.slug}`}>
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
              src={`/api/media/${p.id}?draft=1`}
              alt={`${r.name} ${p.kind}`}
              key={p.id}
            />
          ))}
          {owner && state !== "suspended" && state !== "pending_review" && (
            <>
              {!storageConfigured() && (
                <p className="notice">
                  Photo uploads are not available yet. Your restaurant details
                  can still be reviewed.
                </p>
              )}
              <p className="small muted">
                JPEG, PNG or WebP, up to 5 MB. New photos stay private until the
                update is approved.
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
