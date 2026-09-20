"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CirclePlus, MapPin, Pencil, Timer, Truck } from "lucide-react";
import { requestJson } from "./restaurant-form";
import { formatMoney } from "@/features/orders/money";

type Zone = {
  id: string;
  name: string;
  feeMinor: number;
  minimumMinor: number;
  etaMin: number;
  etaMax: number;
  active: boolean;
};

export function DeliveryManager({
  restaurantId,
  zones,
}: {
  restaurantId: string;
  zones: Zone[];
}) {
  const router = useRouter();
  const [editing, setEditing] = useState<Zone | null>(null);
  const [open, setOpen] = useState(!zones.length);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <div className="delivery-layout">
      <section className="stack">
        <div className="row spread wrap">
          <div>
            <p className="eyebrow">SERVICE AREAS</p>
            <h2>Your delivery zones</h2>
          </div>
          <button
            onClick={() => {
              setEditing(null);
              setOpen(true);
            }}
          >
            <CirclePlus size={17} /> Add area
          </button>
        </div>
        <div className="zone-grid">
          {zones.map((zone) => (
            <article className="zone-card" key={zone.id}>
              <span className="zone-icon">
                <MapPin size={21} />
              </span>
              <div className="stack zone-copy">
                <div className="row spread">
                  <h3>{zone.name}</h3>
                  <span
                    className={zone.active ? "status approved" : "status draft"}
                  >
                    {zone.active ? "Active" : "Paused"}
                  </span>
                </div>
                <div className="zone-stats">
                  <span>
                    <Truck size={15} /> {formatMoney(zone.feeMinor)} fee
                  </span>
                  <span>
                    <Timer size={15} /> {zone.etaMin}–{zone.etaMax} min
                  </span>
                </div>
                <p className="small muted">
                  Minimum order {formatMoney(zone.minimumMinor)}
                </p>
                <button
                  className="secondary small-button"
                  onClick={() => {
                    setEditing(zone);
                    setOpen(true);
                  }}
                >
                  <Pencil size={15} /> Edit area
                </button>
              </div>
            </article>
          ))}
        </div>
        {!zones.length && (
          <div className="empty-inline">
            <Truck size={27} />
            <div>
              <h3>No delivery areas yet</h3>
              <p className="muted">
                Add the neighbourhoods your own drivers serve.
              </p>
            </div>
          </div>
        )}
      </section>
      <aside className="card content-card stack delivery-form-card">
        {open ? (
          <form
            className="stack"
            onSubmit={async (event) => {
              event.preventDefault();
              const data = new FormData(event.currentTarget);
              setBusy(true);
              setError("");
              try {
                await requestJson(
                  editing
                    ? `/api/v1/owner/restaurants/${restaurantId}/zones/${editing.id}`
                    : `/api/v1/owner/restaurants/${restaurantId}/zones`,
                  editing ? "PATCH" : "POST",
                  {
                    name: data.get("name"),
                    feeMinor: Math.round(Number(data.get("fee")) * 100),
                    minimumMinor: Math.round(Number(data.get("minimum")) * 100),
                    etaMin: Number(data.get("etaMin")),
                    etaMax: Number(data.get("etaMax")),
                    active: data.get("active") === "on",
                  },
                );
                setOpen(false);
                setEditing(null);
                router.refresh();
              } catch (reason) {
                setError((reason as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            <div>
              <p className="eyebrow">{editing ? "EDIT AREA" : "NEW AREA"}</p>
              <h2>{editing ? editing.name : "Add delivery coverage"}</h2>
            </div>
            <label>
              Area name
              <input
                name="name"
                defaultValue={editing?.name}
                placeholder="Karte Seh"
                minLength={2}
                maxLength={100}
                required
              />
            </label>
            <div className="form-grid">
              <label>
                Delivery fee (AFN)
                <input
                  name="fee"
                  type="number"
                  min="0"
                  defaultValue={editing ? editing.feeMinor / 100 : ""}
                  required
                />
              </label>
              <label>
                Minimum order (AFN)
                <input
                  name="minimum"
                  type="number"
                  min="0"
                  defaultValue={editing ? editing.minimumMinor / 100 : ""}
                  required
                />
              </label>
            </div>
            <div className="form-grid">
              <label>
                Fastest ETA (min)
                <input
                  name="etaMin"
                  type="number"
                  min="5"
                  max="240"
                  defaultValue={editing?.etaMin || 30}
                  required
                />
              </label>
              <label>
                Longest ETA (min)
                <input
                  name="etaMax"
                  type="number"
                  min="5"
                  max="360"
                  defaultValue={editing?.etaMax || 50}
                  required
                />
              </label>
            </div>
            <label className="check">
              <input
                name="active"
                type="checkbox"
                defaultChecked={editing?.active ?? true}
              />{" "}
              Available to customers
            </label>
            <button disabled={busy}>
              {busy ? "Saving…" : "Save delivery area"}
            </button>
            {error && (
              <p className="error" role="alert">
                {error}
              </p>
            )}
          </form>
        ) : (
          <div className="builder-empty">
            <MapPin size={31} />
            <h3>Restaurant-managed delivery</h3>
            <p>
              Your team receives the address and delivers the order. There is no
              platform driver network in this phase.
            </p>
          </div>
        )}
      </aside>
    </div>
  );
}
