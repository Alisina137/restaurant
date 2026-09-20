"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { requestJson } from "./restaurant-form";

export function MenuContentManager({
  restaurantId,
  meals,
}: {
  restaurantId: string;
  meals: { id: string; name: string; description: string }[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  return (
    <section className="stack content-editor-menu">
      <div>
        <p className="eyebrow">MENU CONTENT</p>
        <h2>Meal names and descriptions</h2>
        <p className="muted">
          Your content permission does not allow price, variant, availability,
          or category changes.
        </p>
      </div>
      {meals.map((meal) => (
        <form
          className="card content-card stack"
          key={meal.id}
          onSubmit={async (event) => {
            event.preventDefault();
            const data = new FormData(event.currentTarget);
            setBusy(meal.id);
            setError("");
            try {
              await requestJson(
                `/api/v1/owner/restaurants/${restaurantId}/meals/${meal.id}/content`,
                "PATCH",
                {
                  name: data.get("name"),
                  description: data.get("description"),
                },
              );
              router.refresh();
            } catch (reason) {
              setError((reason as Error).message);
            } finally {
              setBusy("");
            }
          }}
        >
          <label>
            Meal name
            <input name="name" defaultValue={meal.name} required />
          </label>
          <label>
            Description
            <textarea
              name="description"
              rows={3}
              maxLength={800}
              defaultValue={meal.description}
            />
          </label>
          <button className="secondary" disabled={Boolean(busy)}>
            {busy === meal.id ? "Saving…" : "Save content"}
          </button>
        </form>
      ))}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
