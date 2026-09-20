"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type WorkspaceOption = {
  key: string;
  label: string;
  target: string;
};

export function WorkspaceSwitcher({
  active,
  options,
  label,
}: {
  active: string;
  options: WorkspaceOption[];
  label: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <label className="workspace-switcher">
      <span>{label}</span>
      <select
        value={active}
        disabled={busy}
        onChange={async (event) => {
          const selected = options.find(
            (item) => item.key === event.target.value,
          );
          if (!selected) return;
          setBusy(true);
          try {
            const response = await fetch("/api/preferences", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ workspace: selected.key }),
            });
            if (!response.ok) throw new Error();
            router.push(selected.target);
            router.refresh();
          } finally {
            setBusy(false);
          }
        }}
      >
        {options.map((option) => (
          <option value={option.key} key={option.key}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export function LowDataToggle({
  enabled,
  label,
}: {
  enabled: boolean;
  label: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      className={`low-data-toggle ${enabled ? "active" : ""}`}
      disabled={busy}
      aria-pressed={enabled}
      onClick={async () => {
        setBusy(true);
        try {
          const response = await fetch("/api/preferences", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ lowData: !enabled }),
          });
          if (!response.ok) throw new Error();
          router.refresh();
        } finally {
          setBusy(false);
        }
      }}
    >
      {label}: {enabled ? "On" : "Off"}
    </button>
  );
}
