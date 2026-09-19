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
  staff: { id: string; name: string; email: string; role: string }[];
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
        Add a colleague who already has a verified account. Staff can view this
        workspace; only owners can change the profile or team.
      </p>
      {staff.map((s) => (
        <div className="row spread wrap" key={s.id}>
          <div>
            <strong>{s.name}</strong>
            <p className="small muted">
              {s.email} · {s.role}
            </p>
          </div>
          {s.role === "staff" && (
            <button
              disabled={busy}
              className="secondary small-button"
              onClick={() =>
                run(() =>
                  requestJson(
                    `/api/v1/owner/restaurants/${id}/staff`,
                    "DELETE",
                    { id: s.id },
                  ),
                )
              }
            >
              Remove access
            </button>
          )}
        </div>
      ))}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const email = new FormData(e.currentTarget).get("email");
          void run(() =>
            requestJson(`/api/v1/owner/restaurants/${id}/staff`, "POST", {
              email,
            }),
          );
        }}
        className="stack"
      >
        <label>
          Colleague’s email
          <input name="email" type="email" required />
        </label>
        <button className="secondary" disabled={busy}>
          Add staff member
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
