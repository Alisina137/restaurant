"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { requestJson } from "./restaurant-form";

export function CancelOrder({ id }: { id: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <div className="stack">
      <button
        className="secondary small-button"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setError("");
          try {
            await requestJson(`/api/v1/orders/${id}/cancel`, "POST", {});
            router.refresh();
          } catch (reason) {
            setError((reason as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? "Cancelling…" : "Cancel order"}
      </button>
      {error && (
        <p className="error small" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

const next: Record<string, { value: string; label: string }[]> = {
  awaiting_acceptance: [
    { value: "accepted", label: "Accept order" },
    { value: "rejected", label: "Reject" },
  ],
  accepted: [{ value: "preparing", label: "Start preparing" }],
  preparing_delivery: [
    { value: "out_for_delivery", label: "Out for delivery" },
  ],
  preparing_pickup: [{ value: "ready_for_pickup", label: "Ready for pickup" }],
  out_for_delivery: [{ value: "delivered", label: "Mark delivered" }],
  ready_for_pickup: [{ value: "collected", label: "Mark collected" }],
};

export function OwnerOrderAction({
  restaurantId,
  id,
  status,
  fulfillment,
  version,
}: {
  restaurantId: string;
  id: string;
  status: string;
  fulfillment: string;
  version: number;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const key = status === "preparing" ? `${status}_${fulfillment}` : status;
  const options = next[key] || [];
  if (!options.length) return null;
  return (
    <div className="stack">
      <div className="row wrap">
        {options.map((option) => (
          <button
            className={
              option.value === "rejected"
                ? "secondary small-button"
                : "small-button"
            }
            disabled={busy}
            key={option.value}
            onClick={async () => {
              setBusy(true);
              setError("");
              try {
                await requestJson(
                  `/api/v1/owner/restaurants/${restaurantId}/orders/${id}/status`,
                  "POST",
                  { status: option.value, version, note: "" },
                );
                router.refresh();
              } catch (reason) {
                setError((reason as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy ? "Saving…" : option.label}
          </button>
        ))}
      </div>
      {error && (
        <p className="error small" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
