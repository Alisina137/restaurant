"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type WorkspaceOption = {
  key: string;
  label: string;
  target: string;
};

async function updatePreferences(body: {
  workspace?: string;
  lowData?: boolean;
}) {
  const response = await fetch("/api/preferences", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const result = (await response.json().catch(() => null)) as {
    error?: string;
  } | null;
  if (!response.ok)
    throw new Error(result?.error || "Could not update this preference.");
}

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
  const [error, setError] = useState("");
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
          setError("");
          try {
            await updatePreferences({ workspace: selected.key });
            router.push(selected.target);
            router.refresh();
          } catch (reason) {
            setError(
              reason instanceof Error
                ? reason.message
                : "Could not switch workspace.",
            );
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
      {error && (
        <small className="preference-error" role="alert">
          {error}
        </small>
      )}
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
  const [error, setError] = useState("");
  return (
    <span className="preference-action">
      <button
        type="button"
        className={`low-data-toggle ${enabled ? "active" : ""}`}
        disabled={busy}
        aria-pressed={enabled}
        onClick={async () => {
          setBusy(true);
          setError("");
          try {
            await updatePreferences({ lowData: !enabled });
            router.refresh();
          } catch (reason) {
            setError(
              reason instanceof Error
                ? reason.message
                : "Could not update low-data mode.",
            );
          } finally {
            setBusy(false);
          }
        }}
      >
        {label}: {enabled ? "On" : "Off"}
      </button>
      {error && (
        <small className="preference-error" role="alert">
          {error}
        </small>
      )}
    </span>
  );
}
