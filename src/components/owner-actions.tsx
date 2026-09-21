"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { requestJson } from "./restaurant-form";
export function SubmitReview({ id, version }: { id: string; version: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  return (
    <>
      <button
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          try {
            await requestJson(
              `/api/v1/owner/restaurants/${id}/submit`,
              "POST",
              { version },
            );
            router.refresh();
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? "Submitting…" : "Submit for review"}
      </button>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
    </>
  );
}
export function PhotoUpload({
  id,
  kind,
  enabled,
}: {
  id: string;
  kind: "cover" | "logo";
  enabled: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  return (
    <form
      className="stack"
      onSubmit={async (e) => {
        e.preventDefault();
        const form = e.currentTarget;
        const file = new FormData(form).get("photo") as File;
        if (!file?.size) return;
        setBusy(true);
        setError("");
        try {
          if (file.size > 5 * 1024 * 1024)
            throw new Error("Choose an image smaller than 5 MB.");
          const response = await fetch(
            `/api/v1/owner/restaurants/${id}/media?kind=${kind}`,
            {
              method: "POST",
              headers: { "Content-Type": file.type },
              body: file,
            },
          );
          const result = await response.json();
          if (!response.ok) throw new Error(result.error);
          form.reset();
          router.refresh();
        } catch (e) {
          setError((e as Error).message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <label>
        {kind === "cover" ? "Cover photo" : "Restaurant logo"}
        <input
          type="file"
          name="photo"
          accept="image/jpeg,image/png,image/webp"
          disabled={!enabled || busy}
          required
        />
      </label>
      <button className="secondary" disabled={!enabled || busy}>
        {busy ? "Uploading…" : `Upload ${kind}`}
      </button>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </form>
  );
}
export function StaffEditor({
  id,
  staff,
}: {
  id: string;
  staff: Contributor[];
}) {
  const router = useRouter();
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  async function run(fn: () => Promise<unknown>) {
    setBusy(true);
    setError("");
    try {
      await fn();
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="stack">
      <p className="muted small">
        Add someone with a verified account, then grant only the tools they
        need. Contributors can never change ownership or approve restaurants.
      </p>
      {staff.map((s) => (
        <ContributorEditor
          key={s.id}
          restaurantId={id}
          contributor={s}
          busy={busy}
          run={run}
        />
      ))}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const data = new FormData(e.currentTarget);
          void run(() =>
            requestJson(`/api/v1/owner/restaurants/${id}/staff`, "POST", {
              email: data.get("email"),
              preset: data.get("preset"),
              permissions: permissionForm(data),
            }),
          );
        }}
        className="stack"
      >
        <label>
          Colleague’s email
          <input name="email" type="email" required />
        </label>
        <label>
          Permission preset
          <select name="preset" defaultValue="manager">
            <option value="manager">
              Manager — operations, menu, posts and delivery
            </option>
            <option value="kitchen">
              Kitchen — orders and live availability
            </option>
            <option value="content_editor">
              Content editor — posts and menu descriptions
            </option>
            <option value="custom">Custom — use permissions below</option>
          </select>
        </label>
        <PermissionChecks />
        <button className="secondary" disabled={busy}>
          Add contributor
        </button>
      </form>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

type Contributor = {
  id: string;
  name: string;
  email: string;
  role: string;
  permissionPreset: "manager" | "kitchen" | "content_editor" | "custom" | null;
  canManageOrders: boolean;
  canManageMenu: boolean;
  canEditMenuContent: boolean;
  canManagePosts: boolean;
  canManageDelivery: boolean;
  canManageAvailability: boolean;
  canViewDeliveryAddresses: boolean;
};

function permissionForm(data: FormData) {
  return {
    orders: data.get("orders") === "on",
    menu: data.get("menu") === "on",
    menuContent: data.get("menuContent") === "on",
    posts: data.get("posts") === "on",
    delivery: data.get("delivery") === "on",
    availability: data.get("availability") === "on",
    deliveryAddresses: data.get("deliveryAddresses") === "on",
  };
}

function PermissionChecks({ contributor }: { contributor?: Contributor }) {
  const fields = [
    ["orders", "Manage orders", contributor?.canManageOrders],
    ["menu", "Manage menu and prices", contributor?.canManageMenu],
    ["menuContent", "Edit menu descriptions", contributor?.canEditMenuContent],
    ["posts", "Create daily posts", contributor?.canManagePosts],
    ["delivery", "Manage delivery areas", contributor?.canManageDelivery],
    [
      "availability",
      "Update kitchen availability",
      contributor?.canManageAvailability,
    ],
    [
      "deliveryAddresses",
      "View delivery addresses",
      contributor?.canViewDeliveryAddresses,
    ],
  ] as const;
  return (
    <fieldset className="permission-grid">
      <legend>Custom permissions</legend>
      {fields.map(([name, label, checked]) => (
        <label className="check" key={name}>
          <input name={name} type="checkbox" defaultChecked={checked} /> {label}
        </label>
      ))}
    </fieldset>
  );
}

function ContributorEditor({
  restaurantId,
  contributor,
  busy,
  run,
}: {
  restaurantId: string;
  contributor: Contributor;
  busy: boolean;
  run: (fn: () => Promise<unknown>) => Promise<void>;
}) {
  if (contributor.role === "owner")
    return (
      <div className="contributor-card owner-card">
        <div>
          <strong>{contributor.name}</strong>
          <p className="small muted">{contributor.email} · Owner</p>
        </div>
        <span className="status approved">Full control</span>
      </div>
    );
  return (
    <form
      className="contributor-card stack"
      onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        void run(() =>
          requestJson(
            `/api/v1/owner/restaurants/${restaurantId}/staff`,
            "PATCH",
            {
              membershipId: contributor.id,
              preset: data.get("preset"),
              permissions: permissionForm(data),
            },
          ),
        );
      }}
    >
      <div className="row spread wrap">
        <div>
          <strong>{contributor.name}</strong>
          <p className="small muted">{contributor.email}</p>
        </div>
        <button
          type="button"
          disabled={busy}
          className="danger-link small-button"
          onClick={() =>
            run(() =>
              requestJson(
                `/api/v1/owner/restaurants/${restaurantId}/staff`,
                "DELETE",
                { id: contributor.id },
              ),
            )
          }
        >
          Remove access
        </button>
      </div>
      <label>
        Permission preset
        <select
          name="preset"
          defaultValue={contributor.permissionPreset || "custom"}
        >
          <option value="manager">Manager</option>
          <option value="kitchen">Kitchen</option>
          <option value="content_editor">Content editor</option>
          <option value="custom">Custom</option>
        </select>
      </label>
      <PermissionChecks contributor={contributor} />
      <button className="secondary small-button" disabled={busy}>
        Update permissions
      </button>
    </form>
  );
}
export function ReviewForm({
  id,
  version,
  status,
}: {
  id: string;
  version: number;
  status: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  return (
    <form
      className="stack"
      onSubmit={async (e) => {
        e.preventDefault();
        const d = new FormData(e.currentTarget);
        setBusy(true);
        setError("");
        try {
          await requestJson(`/api/v1/admin/restaurants/${id}/review`, "POST", {
            version,
            decision: d.get("decision"),
            note: d.get("note"),
          });
          router.refresh();
        } catch (e) {
          setError((e as Error).message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <label>
        Review decision
        <select name="decision">
          {status === "approved" ? (
            <option value="suspended">Suspend page</option>
          ) : (
            <>
              <option value="approved">Approve page</option>
              <option value="changes_requested">Request changes</option>
            </>
          )}
        </select>
      </label>
      <label>
        Message to the owner
        <textarea name="note" maxLength={600} rows={3} />
      </label>
      <button disabled={busy}>
        {busy ? "Saving…" : "Save review decision"}
      </button>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
    </form>
  );
}
