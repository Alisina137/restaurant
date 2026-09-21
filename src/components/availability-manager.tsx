"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Clock3, Power, ShoppingBag, Truck } from "lucide-react";
import { requestJson } from "./restaurant-form";

type MealAvailability = { id: string; name: string; available: boolean };

export function AvailabilityManager({
  restaurantId,
  approved,
  restaurant,
  meals,
}: {
  restaurantId: string;
  approved: boolean;
  restaurant: {
    acceptingOrders: boolean;
    kitchenState: "open" | "busy" | "paused";
    deliveryAvailable: boolean;
    pickupAvailable: boolean;
    deliveryOrdersEnabled: boolean;
    pickupOrdersEnabled: boolean;
    prepTimeMin: number;
    prepTimeMax: number;
    availabilityNote: string;
    availabilityUpdatedAt: Date;
  };
  meals: MealAvailability[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function run(work: () => Promise<unknown>) {
    setBusy(true);
    setError("");
    try {
      await work();
      router.refresh();
    } catch (reason) {
      setError((reason as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="availability-manager">
      <form
        className="ordering-switch-card availability-form"
        onSubmit={(event) => {
          event.preventDefault();
          const data = new FormData(event.currentTarget);
          const kitchenState = String(data.get("kitchenState"));
          void run(() =>
            requestJson(
              `/api/v1/owner/restaurants/${restaurantId}/ordering`,
              "PATCH",
              {
                acceptingOrders: kitchenState !== "paused",
                kitchenState,
                deliveryOrdersEnabled:
                  data.get("deliveryOrdersEnabled") === "on",
                pickupOrdersEnabled: data.get("pickupOrdersEnabled") === "on",
                prepTimeMin: Number(data.get("prepTimeMin")),
                prepTimeMax: Number(data.get("prepTimeMax")),
                availabilityNote: data.get("availabilityNote"),
              },
            ),
          );
        }}
      >
        <div className="stack availability-copy">
          <p className="eyebrow">LIVE KITCHEN STATUS</p>
          <h2>
            {restaurant.kitchenState === "paused"
              ? "Ordering is paused"
              : restaurant.kitchenState === "busy"
                ? "Kitchen is busy"
                : "Kitchen is taking orders"}
          </h2>
          <p className="small muted">
            Customers see this state, the honest prep estimate, and when it was
            last updated.
          </p>
          <label>
            Kitchen state
            <select name="kitchenState" defaultValue={restaurant.kitchenState}>
              <option value="open">Accepting orders</option>
              <option value="busy">Busy — longer preparation</option>
              <option value="paused">Temporarily paused</option>
            </select>
          </label>
          <div className="form-grid">
            <label>
              <Clock3 size={15} /> Minimum prep (min)
              <input
                name="prepTimeMin"
                type="number"
                min="5"
                max="240"
                defaultValue={restaurant.prepTimeMin}
                required
              />
            </label>
            <label>
              <Clock3 size={15} /> Maximum prep (min)
              <input
                name="prepTimeMax"
                type="number"
                min="5"
                max="360"
                defaultValue={restaurant.prepTimeMax}
                required
              />
            </label>
          </div>
          <label>
            Customer note
            <input
              name="availabilityNote"
              maxLength={240}
              defaultValue={restaurant.availabilityNote}
              placeholder="Large orders may take a little longer today."
            />
          </label>
          <div className="inline-checks">
            <label className="check">
              <input
                name="deliveryOrdersEnabled"
                type="checkbox"
                defaultChecked={restaurant.deliveryOrdersEnabled}
                disabled={!restaurant.deliveryAvailable}
              />{" "}
              <Truck size={15} /> Restaurant delivery
            </label>
            <label className="check">
              <input
                name="pickupOrdersEnabled"
                type="checkbox"
                defaultChecked={restaurant.pickupOrdersEnabled}
                disabled={!restaurant.pickupAvailable}
              />{" "}
              <ShoppingBag size={15} /> Customer pickup
            </label>
          </div>
        </div>
        <button disabled={!approved || busy}>
          <Power size={17} /> {busy ? "Updating…" : "Update availability"}
        </button>
      </form>
      <div className="card content-card stack sold-out-panel">
        <div>
          <p className="eyebrow">TODAY’S MENU</p>
          <h2>Mark sold-out meals</h2>
        </div>
        <div className="meal-availability-list">
          {meals.map((meal) => (
            <div className="row spread wrap" key={meal.id}>
              <span>
                <strong>{meal.name}</strong>
                <small>{meal.available ? "Available" : "Sold out today"}</small>
              </span>
              <button
                type="button"
                className={
                  meal.available ? "secondary small-button" : "small-button"
                }
                disabled={busy}
                onClick={() =>
                  run(() =>
                    requestJson(
                      `/api/v1/owner/restaurants/${restaurantId}/meals/${meal.id}/availability`,
                      "PATCH",
                      { available: !meal.available },
                    ),
                  )
                }
              >
                {meal.available ? "Mark sold out" : "Make available"}
              </button>
            </div>
          ))}
        </div>
        {!meals.length && (
          <p className="muted">
            Create menu items before managing live availability.
          </p>
        )}
      </div>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
