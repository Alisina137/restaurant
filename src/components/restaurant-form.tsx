"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { OpeningDay } from "@/db/schema";
const defaultHours: OpeningDay[] = Array.from({ length: 7 }, (_, day) => ({
  day,
  closed: false,
  opens: "09:00",
  closes: "22:00",
}));
type Profile = {
  id: string;
  name: string;
  slug: string;
  description: string;
  city: string;
  area: string;
  address: string;
  phone: string;
  cuisine: string;
  hours: OpeningDay[];
  version: number;
};
export async function requestJson(url: string, method: string, body: unknown) {
  const response = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || "Please try again.");
  return result.data;
}
export function RestaurantForm({ initial }: { initial?: Profile }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const [hours, setHours] = useState(
    initial?.hours.length === 7 ? initial.hours : defaultHours,
  );
  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const d = new FormData(e.currentTarget);
    try {
      const data = Object.fromEntries(d);
      const r = await requestJson(
        initial
          ? `/api/v1/owner/restaurants/${initial.id}`
          : "/api/v1/owner/restaurants",
        initial ? "PATCH" : "POST",
        { ...data, hours, version: initial?.version },
      );
      router.push(`/owner/${r.id}`);
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <form className="stack" onSubmit={save}>
      <section className="card content-card stack">
        <p className="eyebrow">01 / YOUR RESTAURANT</p>
        <h2>Start with the essentials.</h2>
        <div className="form-grid">
          <label>
            Restaurant name
            <input
              name="name"
              required
              minLength={2}
              maxLength={90}
              defaultValue={initial?.name}
            />
          </label>
          <label>
            Page address
            <input
              name="slug"
              dir="ltr"
              required
              minLength={3}
              maxLength={70}
              pattern="[a-z0-9]+(-[a-z0-9]+)*"
              placeholder="your-restaurant"
              defaultValue={initial?.slug}
            />
            <span className="help">
              Lowercase letters, numbers and hyphens.
            </span>
          </label>
        </div>
        <label>
          Your story
          <textarea
            name="description"
            required
            minLength={20}
            maxLength={1200}
            rows={4}
            placeholder="Tell people about your food and your kitchen…"
            defaultValue={initial?.description}
          />
        </label>
        <label>
          Cuisine
          <select name="cuisine" defaultValue={initial?.cuisine || "Afghan"}>
            {["Afghan", "Pizza", "Burgers", "Cafe", "Asian", "Other"].map(
              (v) => (
                <option key={v}>{v}</option>
              ),
            )}
          </select>
        </label>
      </section>
      <section className="card content-card stack">
        <p className="eyebrow">02 / FIND YOUR KITCHEN</p>
        <h2>Location & contact</h2>
        <div className="form-grid">
          <label>
            City
            <select name="city" defaultValue={initial?.city || "Kabul"}>
              {[
                "Kabul",
                "Herat",
                "Mazar-i-Sharif",
                "Kandahar",
                "Jalalabad",
              ].map((v) => (
                <option key={v}>{v}</option>
              ))}
            </select>
          </label>
          <label>
            Area
            <input
              name="area"
              required
              minLength={2}
              maxLength={100}
              defaultValue={initial?.area}
            />
          </label>
        </div>
        <label>
          Street and landmark
          <input
            name="address"
            required
            minLength={5}
            maxLength={300}
            defaultValue={initial?.address}
          />
        </label>
        <label>
          Public restaurant phone
          <input
            name="phone"
            type="tel"
            dir="ltr"
            required
            pattern="\+93[2-7][0-9]{8}"
            placeholder="+93700123456"
            defaultValue={initial?.phone}
          />
          <span className="help">
            Customers will see this number on your page.
          </span>
        </label>
      </section>
      <section className="card content-card stack">
        <p className="eyebrow">03 / OPENING HOURS</p>
        <h2>When can people visit?</h2>
        <p className="muted small">
          All times are in Afghanistan time. A closing time earlier than opening
          means the next day.
        </p>
        {hours.map((day, i) => (
          <div key={day.day} className="hours-row">
            <label className="check">
              <input
                type="checkbox"
                checked={!day.closed}
                onChange={(e) =>
                  setHours(
                    hours.map((h, j) =>
                      j === i ? { ...h, closed: !e.target.checked } : h,
                    ),
                  )
                }
              />
              {
                [
                  "Sunday",
                  "Monday",
                  "Tuesday",
                  "Wednesday",
                  "Thursday",
                  "Friday",
                  "Saturday",
                ][day.day]
              }
            </label>
            <div className="time-fields">
              <input
                type="time"
                aria-label={`Opening time ${day.day}`}
                value={day.opens}
                disabled={day.closed}
                onChange={(e) =>
                  setHours(
                    hours.map((h, j) =>
                      j === i ? { ...h, opens: e.target.value } : h,
                    ),
                  )
                }
              />
              <span>to</span>
              <input
                type="time"
                aria-label={`Closing time ${day.day}`}
                value={day.closes}
                disabled={day.closed}
                onChange={(e) =>
                  setHours(
                    hours.map((h, j) =>
                      j === i ? { ...h, closes: e.target.value } : h,
                    ),
                  )
                }
              />
            </div>
          </div>
        ))}
      </section>
      {initial && (
        <p className="notice">
          Saving changes returns your page to draft. Submit it again when you’re
          ready for review.
        </p>
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <button disabled={busy}>
        {busy ? "Saving…" : initial ? "Save changes" : "Save restaurant draft"}
      </button>
      <p className="small muted">
        You can add photos after saving. Your page stays private until approved.
      </p>
    </form>
  );
}
