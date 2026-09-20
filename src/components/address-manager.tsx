"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MapPin, Pencil, Plus, Trash2 } from "lucide-react";
import { requestJson } from "./restaurant-form";

type Address = {
  id: string;
  label: string;
  recipient: string;
  phone: string;
  city: string;
  area: string;
  address: string;
  instructions: string;
  isDefault: boolean;
  version: number;
};

export function AddressManager({ addresses }: { addresses: Address[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<Address | null>(null);
  const [open, setOpen] = useState(!addresses.length);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function remove(id: string) {
    setBusy(true);
    setError("");
    try {
      await requestJson(`/api/v1/addresses/${id}`, "DELETE");
      router.refresh();
    } catch (reason) {
      setError((reason as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="address-layout">
      <section className="address-grid">
        {addresses.map((item) => (
          <article className="address-card" key={item.id}>
            <div className="row spread wrap">
              <span className="address-icon">
                <MapPin size={19} />
              </span>
              {item.isDefault && (
                <span className="status approved">Default</span>
              )}
            </div>
            <h2>{item.label}</h2>
            <p>
              <strong>{item.recipient}</strong> · <bdi>{item.phone}</bdi>
            </p>
            <p className="muted">
              {item.address}, {item.area}, {item.city}
            </p>
            {item.instructions && <p className="small">{item.instructions}</p>}
            <div className="row wrap">
              <button
                className="secondary small-button"
                onClick={() => {
                  setEditing(item);
                  setOpen(true);
                }}
              >
                <Pencil size={15} /> Edit
              </button>
              <button
                className="danger-link small-button"
                disabled={busy}
                onClick={() => remove(item.id)}
              >
                <Trash2 size={15} /> Remove
              </button>
            </div>
          </article>
        ))}
        <button
          className="add-address-card"
          onClick={() => {
            setEditing(null);
            setOpen(true);
          }}
        >
          <Plus size={24} /> Add address
        </button>
      </section>
      {open && (
        <form
          className="card content-card stack address-form"
          onSubmit={async (event) => {
            event.preventDefault();
            const data = new FormData(event.currentTarget);
            setBusy(true);
            setError("");
            try {
              await requestJson(
                editing
                  ? `/api/v1/addresses/${editing.id}`
                  : "/api/v1/addresses",
                editing ? "PATCH" : "POST",
                {
                  label: data.get("label"),
                  recipient: data.get("recipient"),
                  phone: data.get("phone"),
                  city: data.get("city"),
                  area: data.get("area"),
                  address: data.get("address"),
                  instructions: data.get("instructions"),
                  isDefault: data.get("isDefault") === "on",
                  version: editing?.version,
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
            <p className="eyebrow">DELIVERY ADDRESS</p>
            <h2>{editing ? "Update address" : "Add an address"}</h2>
          </div>
          <div className="form-grid">
            <label>
              Label
              <input
                name="label"
                defaultValue={editing?.label}
                placeholder="Home"
                required
              />
            </label>
            <label>
              Recipient
              <input
                name="recipient"
                defaultValue={editing?.recipient}
                required
              />
            </label>
          </div>
          <label>
            Afghan phone number
            <input
              name="phone"
              defaultValue={editing?.phone}
              placeholder="+93700123456"
              required
            />
          </label>
          <div className="form-grid">
            <label>
              City
              <input
                name="city"
                defaultValue={editing?.city || "Kabul"}
                required
              />
            </label>
            <label>
              Area
              <input name="area" defaultValue={editing?.area} required />
            </label>
          </div>
          <label>
            Full address
            <textarea
              name="address"
              rows={3}
              defaultValue={editing?.address}
              required
            />
          </label>
          <label>
            Delivery instructions
            <textarea
              name="instructions"
              rows={2}
              defaultValue={editing?.instructions}
            />
          </label>
          <label className="check">
            <input
              type="checkbox"
              name="isDefault"
              defaultChecked={editing?.isDefault}
            />{" "}
            Use as default
          </label>
          <div className="row wrap">
            <button disabled={busy}>{busy ? "Saving…" : "Save address"}</button>
            <button
              type="button"
              className="secondary"
              onClick={() => setOpen(false)}
            >
              Cancel
            </button>
          </div>
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
        </form>
      )}
    </div>
  );
}
