"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Archive, ImagePlus, PencilLine, Send, Upload, X } from "lucide-react";
import { requestJson } from "./restaurant-form";

type ManagedPost = {
  id: string;
  caption: string;
  status: "draft" | "published" | "archived" | "removed";
  version: number;
  publishedAt: Date | null;
  images: { id: string; position: number }[];
  linkedMealId: string | null;
};

export function PostEditor({
  restaurantId,
  posts,
  approved,
  storageEnabled,
  meals,
}: {
  restaurantId: string;
  posts: ManagedPost[];
  approved: boolean;
  storageEnabled: boolean;
  meals: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  async function create(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    setCreating(true);
    setError("");
    try {
      await requestJson(
        `/api/v1/owner/restaurants/${restaurantId}/posts`,
        "POST",
        {
          caption: new FormData(form).get("caption"),
          linkedMealId: new FormData(form).get("linkedMealId") || null,
        },
      );
      form.reset();
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="owner-post-layout">
      <form className="composer-card" onSubmit={create}>
        <div className="composer-heading">
          <span className="composer-icon">
            <PencilLine size={21} />
          </span>
          <div>
            <p className="eyebrow">NEW UPDATE</p>
            <h2>What is fresh today?</h2>
          </div>
        </div>
        <label>
          <span className="sr-only">Post caption</span>
          <textarea
            name="caption"
            required
            minLength={3}
            maxLength={1200}
            rows={5}
            placeholder="Share today’s special, a kitchen moment, or an announcement…"
          />
        </label>
        <label>
          Link a menu item <span className="help">Optional</span>
          <select name="linkedMealId">
            <option value="">No linked meal</option>
            {meals.map((meal) => (
              <option value={meal.id} key={meal.id}>
                {meal.name}
              </option>
            ))}
          </select>
        </label>
        <div className="row spread wrap">
          <p className="small muted">
            Create the draft first, then add up to four photos.
          </p>
          <button disabled={creating}>
            {creating ? "Creating…" : "Create draft"} <Send size={17} />
          </button>
        </div>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
      </form>
      {!approved && (
        <p className="notice">
          You can prepare drafts now. Publishing unlocks when the restaurant is
          approved.
        </p>
      )}
      {!storageEnabled && (
        <p className="notice">
          Photo storage is not configured. Text posts still work; configure the
          private S3 bucket to add photos.
        </p>
      )}
      <div className="managed-post-list">
        {posts.map((post) => (
          <ManagedPostCard
            key={post.id}
            restaurantId={restaurantId}
            post={post}
            approved={approved}
            storageEnabled={storageEnabled}
            meals={meals}
          />
        ))}
        {!posts.length && (
          <div className="empty-inline">
            <ImagePlus size={28} />
            <div>
              <h3>No posts yet</h3>
              <p className="muted">
                Create the first update for your future followers.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ManagedPostCard({
  restaurantId,
  post,
  approved,
  storageEnabled,
  meals,
}: {
  restaurantId: string;
  post: ManagedPost;
  approved: boolean;
  storageEnabled: boolean;
  meals: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [caption, setCaption] = useState(post.caption);
  const [linkedMealId, setLinkedMealId] = useState(post.linkedMealId || "");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const base = `/api/v1/owner/restaurants/${restaurantId}/posts/${post.id}`;

  async function save() {
    setBusy("save");
    setError("");
    try {
      await requestJson(base, "PATCH", {
        caption,
        linkedMealId: linkedMealId || null,
        version: post.version,
      });
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  }

  async function action(value: "publish" | "unpublish" | "archive") {
    setBusy(value);
    setError("");
    try {
      await requestJson(base, "POST", { action: value, version: post.version });
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  }

  async function upload(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const file = new FormData(form).get("photo") as File;
    if (!file?.size) return;
    if (file.size > 5 * 1024 * 1024) {
      setError("Choose an image smaller than 5 MB.");
      return;
    }
    setBusy("upload");
    setError("");
    try {
      const response = await fetch(`${base}/media`, {
        method: "POST",
        headers: { "Content-Type": file.type },
        body: file,
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Upload failed.");
      form.reset();
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  }

  async function removePhoto(mediaId: string) {
    setBusy(mediaId);
    setError("");
    try {
      const response = await fetch(`${base}/media?mediaId=${mediaId}`, {
        method: "DELETE",
      });
      const result = await response.json();
      if (!response.ok)
        throw new Error(result.error || "Could not remove photo.");
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  }

  return (
    <article className="managed-post-card">
      <div className="row spread wrap">
        <span className={`status ${post.status}`}>{post.status}</span>
        <span className="small muted">
          {post.publishedAt
            ? `Published ${new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(new Date(post.publishedAt))}`
            : "Not public"}
        </span>
      </div>
      {post.images.length > 0 && (
        <div className="managed-media-strip">
          {post.images.map((image) => (
            <div key={image.id}>
              <img src={`/api/post-media/${image.id}`} alt="Post upload" />
              <button
                type="button"
                className="media-remove"
                aria-label="Remove photo"
                disabled={Boolean(busy)}
                onClick={() => removePhoto(image.id)}
              >
                <X size={16} />
              </button>
            </div>
          ))}
        </div>
      )}
      <label>
        Caption
        <textarea
          rows={4}
          maxLength={1200}
          value={caption}
          onChange={(event) => setCaption(event.target.value)}
        />
      </label>
      <label>
        Linked menu item
        <select
          value={linkedMealId}
          onChange={(event) => setLinkedMealId(event.target.value)}
        >
          <option value="">No linked meal</option>
          {meals.map((meal) => (
            <option value={meal.id} key={meal.id}>
              {meal.name}
            </option>
          ))}
        </select>
      </label>
      <div className="post-manager-actions">
        <button
          type="button"
          className="secondary"
          disabled={
            Boolean(busy) ||
            (caption === post.caption &&
              linkedMealId === (post.linkedMealId || ""))
          }
          onClick={save}
        >
          {busy === "save" ? "Saving…" : "Save caption"}
        </button>
        {post.status === "published" ? (
          <button
            type="button"
            className="secondary"
            disabled={Boolean(busy)}
            onClick={() => action("unpublish")}
          >
            Unpublish
          </button>
        ) : (
          post.status !== "removed" && (
            <button
              type="button"
              disabled={!approved || Boolean(busy)}
              onClick={() => action("publish")}
            >
              {busy === "publish" ? "Publishing…" : "Publish"}{" "}
              <Send size={16} />
            </button>
          )
        )}
        {post.status !== "archived" && post.status !== "removed" && (
          <button
            type="button"
            className="quiet-button"
            disabled={Boolean(busy)}
            onClick={() => action("archive")}
          >
            <Archive size={16} /> Archive
          </button>
        )}
      </div>
      {post.images.length < 4 && post.status !== "removed" && (
        <form className="media-uploader" onSubmit={upload}>
          <label>
            Add photo
            <input
              name="photo"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              required
              disabled={!storageEnabled || Boolean(busy)}
            />
          </label>
          <button
            className="secondary"
            disabled={!storageEnabled || Boolean(busy)}
          >
            <Upload size={16} /> {busy === "upload" ? "Uploading…" : "Upload"}
          </button>
        </form>
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </article>
  );
}
