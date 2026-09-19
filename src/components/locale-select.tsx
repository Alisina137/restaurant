"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
export function LocaleSelect({
  locale,
  label,
}: {
  locale: string;
  label: string;
}) {
  const router = useRouter();
  const [error, setError] = useState("");
  return (
    <div>
      <select
        aria-label={label}
        value={locale}
        onChange={async (e) => {
          try {
            const r = await fetch("/api/locale", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ locale: e.target.value }),
            });
            if (!r.ok) throw new Error();
            setError("");
            router.refresh();
          } catch {
            setError("Could not change language.");
          }
        }}
      >
        <option value="en">English</option>
        <option value="fa">دری</option>
        <option value="ps">پښتو</option>
      </select>
      {error && <span role="alert">{error}</span>}
    </div>
  );
}
