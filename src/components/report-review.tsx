"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Ban, CheckCircle2 } from "lucide-react";
import { requestJson } from "./restaurant-form";

export function ReportReview({ id }: { id: string }) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  async function decide(action: "dismiss" | "remove") {
    setBusy(action);
    setError("");
    try {
      await requestJson(`/api/v1/admin/reports/${id}`, "POST", {
        action,
        note,
      });
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  }
  return (
    <div className="report-review-actions">
      <label>
        Moderation note
        <textarea
          rows={2}
          minLength={5}
          maxLength={600}
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder="Record why this decision was made…"
        />
      </label>
      <div className="row wrap">
        <button
          className="secondary"
          disabled={Boolean(busy) || note.trim().length < 5}
          onClick={() => decide("dismiss")}
        >
          <CheckCircle2 size={17} />{" "}
          {busy === "dismiss" ? "Saving…" : "Dismiss report"}
        </button>
        <button
          className="danger-button"
          disabled={Boolean(busy) || note.trim().length < 5}
          onClick={() => decide("remove")}
        >
          <Ban size={17} /> {busy === "remove" ? "Removing…" : "Remove post"}
        </button>
      </div>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
