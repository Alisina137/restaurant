"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Heart, RefreshCw, Star } from "lucide-react";
import { requestJson } from "./restaurant-form";
import { formatMoney } from "@/features/orders/money";

export function FavoriteButton({
  restaurantId,
  initial,
  signedIn,
}: {
  restaurantId: string;
  initial: boolean;
  signedIn: boolean;
}) {
  const router = useRouter();
  const [active, setActive] = useState(initial);
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      className={`favorite-button ${active ? "active" : ""}`}
      disabled={busy}
      aria-pressed={active}
      onClick={async () => {
        if (!signedIn) return router.push("/sign-in");
        setBusy(true);
        try {
          await requestJson(`/api/v1/favorites/${restaurantId}`, "PUT", {
            active: !active,
          });
          setActive(!active);
        } finally {
          setBusy(false);
        }
      }}
    >
      <Star size={17} fill={active ? "currentColor" : "none"} />
      {active ? "Favorited" : "Favorite"}
    </button>
  );
}

export function SavedMealButton({
  mealId,
  initial,
  signedIn,
  compact = false,
}: {
  mealId: string;
  initial: boolean;
  signedIn: boolean;
  compact?: boolean;
}) {
  const router = useRouter();
  const [active, setActive] = useState(initial);
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      className={`save-meal-button ${active ? "active" : ""}`}
      disabled={busy}
      aria-label={active ? "Remove saved meal" : "Save meal"}
      aria-pressed={active}
      onClick={async (event) => {
        event.stopPropagation();
        if (!signedIn) return router.push("/sign-in");
        setBusy(true);
        try {
          await requestJson(`/api/v1/saved-meals/${mealId}`, "PUT", {
            active: !active,
          });
          setActive(!active);
        } finally {
          setBusy(false);
        }
      }}
    >
      <Heart size={compact ? 16 : 18} fill={active ? "currentColor" : "none"} />
      {!compact && (active ? "Saved" : "Save meal")}
    </button>
  );
}

type ReorderPreview = {
  available: boolean;
  quote: { id: string; totalMinor: number; expiresAt: string } | null;
  issues: string[];
};

export function ReorderButton({ orderId }: { orderId: string }) {
  const router = useRouter();
  const [preview, setPreview] = useState<ReorderPreview | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function check() {
    setBusy(true);
    setError("");
    try {
      const result = await requestJson<ReorderPreview>(
        `/api/v1/orders/${orderId}/reorder`,
        "POST",
      );
      setPreview(result);
    } catch (reason) {
      setError((reason as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function confirm() {
    if (!preview?.quote) return;
    setBusy(true);
    setError("");
    try {
      await requestJson("/api/v1/orders", "POST", {
        quoteId: preview.quote.id,
        idempotencyKey: crypto.randomUUID(),
      });
      setPreview(null);
      router.push("/orders?placed=1");
      router.refresh();
    } catch (reason) {
      setError((reason as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="reorder-control">
      {!preview ? (
        <button
          type="button"
          className="secondary"
          disabled={busy}
          onClick={check}
        >
          <RefreshCw size={16} />{" "}
          {busy ? "Checking current menu…" : "Order again"}
        </button>
      ) : (
        <div className="reorder-preview" role="status">
          <strong>
            {preview.available ? "Current order quote" : "Cannot reorder yet"}
          </strong>
          {preview.issues.map((issue) => (
            <p key={issue}>{issue}</p>
          ))}
          {preview.quote && (
            <p>
              New total: <b>{formatMoney(preview.quote.totalMinor)}</b>
            </p>
          )}
          <div className="row wrap">
            {preview.quote && (
              <button type="button" disabled={busy} onClick={confirm}>
                {busy ? "Placing…" : "Confirm new order"}
              </button>
            )}
            <button
              type="button"
              className="secondary"
              onClick={() => setPreview(null)}
            >
              Close
            </button>
          </div>
        </div>
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
