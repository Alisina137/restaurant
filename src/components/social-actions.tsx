"use client";

import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Bookmark, Flag, Heart, UserCheck, UserPlus, X } from "lucide-react";
import { requestJson } from "./restaurant-form";

function useSignInGuard(signedIn: boolean) {
  const router = useRouter();
  const pathname = usePathname();
  return () => {
    if (signedIn) return true;
    router.push(`/sign-in?next=${encodeURIComponent(pathname)}`);
    return false;
  };
}

export function FollowButton({
  restaurantId,
  initial,
  count,
  signedIn,
  compact = false,
}: {
  restaurantId: string;
  initial: boolean;
  count?: number;
  signedIn: boolean;
  compact?: boolean;
}) {
  const [active, setActive] = useState(initial);
  const [total, setTotal] = useState(count);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const allow = useSignInGuard(signedIn);
  async function toggle() {
    if (!allow() || busy) return;
    const next = !active;
    setActive(next);
    if (total !== undefined) setTotal(Math.max(0, total + (next ? 1 : -1)));
    setBusy(true);
    setError("");
    try {
      const result = await requestJson(
        `/api/v1/follows/${restaurantId}`,
        "POST",
        { active: next },
      );
      setActive(result.active);
      if (total !== undefined) setTotal(result.count);
    } catch (e) {
      setActive(!next);
      if (total !== undefined) setTotal(Math.max(0, total + (next ? -1 : 1)));
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="inline-action-wrap">
      <button
        type="button"
        className={`follow-button ${compact ? "compact" : ""} ${active ? "active" : ""}`}
        aria-pressed={active}
        disabled={busy}
        onClick={toggle}
      >
        {active ? <UserCheck size={17} /> : <UserPlus size={17} />}
        {active ? "Following" : "Follow"}
        {total !== undefined && <span>{total}</span>}
      </button>
      {error && <span className="inline-error">{error}</span>}
    </div>
  );
}

export function PostActions({
  postId,
  initialLiked,
  initialSaved,
  initialLikeCount,
  signedIn,
}: {
  postId: string;
  initialLiked: boolean;
  initialSaved: boolean;
  initialLikeCount: number;
  signedIn: boolean;
}) {
  const [liked, setLiked] = useState(initialLiked);
  const [saved, setSaved] = useState(initialSaved);
  const [likeCount, setLikeCount] = useState(initialLikeCount);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [reporting, setReporting] = useState(false);
  const [reported, setReported] = useState(false);
  const allow = useSignInGuard(signedIn);

  async function toggle(kind: "like" | "save") {
    if (!allow() || busy) return;
    const current = kind === "like" ? liked : saved;
    const next = !current;
    if (kind === "like") {
      setLiked(next);
      setLikeCount((value) => Math.max(0, value + (next ? 1 : -1)));
    } else setSaved(next);
    setBusy(kind);
    setError("");
    try {
      const result = await requestJson(
        `/api/v1/posts/${postId}/${kind}`,
        "POST",
        { active: next },
      );
      if (kind === "like") {
        setLiked(result.active);
        setLikeCount(result.count);
      } else setSaved(result.active);
    } catch (e) {
      if (kind === "like") {
        setLiked(current);
        setLikeCount((value) => Math.max(0, value + (next ? -1 : 1)));
      } else setSaved(current);
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  }

  async function submitReport(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!allow() || busy) return;
    const data = new FormData(e.currentTarget);
    setBusy("report");
    setError("");
    try {
      await requestJson("/api/v1/reports", "POST", {
        postId,
        reason: data.get("reason"),
        detail: data.get("detail"),
      });
      setReported(true);
      setReporting(false);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  }

  return (
    <>
      <div className="post-actions">
        <button
          type="button"
          className={liked ? "social-button active" : "social-button"}
          aria-pressed={liked}
          disabled={Boolean(busy)}
          onClick={() => toggle("like")}
        >
          <Heart size={20} fill={liked ? "currentColor" : "none"} />
          <span>{likeCount ? `${likeCount} likes` : "Like"}</span>
        </button>
        <button
          type="button"
          className={saved ? "social-button active" : "social-button"}
          aria-pressed={saved}
          disabled={Boolean(busy)}
          onClick={() => toggle("save")}
        >
          <Bookmark size={20} fill={saved ? "currentColor" : "none"} />
          <span>{saved ? "Saved" : "Save"}</span>
        </button>
        <button
          type="button"
          className="social-button report-trigger"
          disabled={reported || Boolean(busy)}
          onClick={() => (allow() ? setReporting(true) : undefined)}
        >
          <Flag size={19} />
          <span>{reported ? "Reported" : "Report"}</span>
        </button>
      </div>
      {error && <p className="inline-error action-error">{error}</p>}
      {reporting && (
        <div className="modal-backdrop">
          <form
            aria-labelledby="report-dialog-title"
            aria-modal="true"
            className="report-dialog"
            onSubmit={submitReport}
            role="dialog"
          >
            <div className="row spread">
              <div>
                <p className="eyebrow">COMMUNITY SAFETY</p>
                <h2 id="report-dialog-title">Report this post</h2>
              </div>
              <button
                type="button"
                className="icon-button"
                aria-label="Close report dialog"
                onClick={() => setReporting(false)}
              >
                <X size={20} />
              </button>
            </div>
            <label>
              What is wrong?
              <select name="reason" defaultValue="spam">
                <option value="spam">Spam</option>
                <option value="misleading">Misleading information</option>
                <option value="inappropriate">Inappropriate content</option>
                <option value="other">Something else</option>
              </select>
            </label>
            <label>
              Additional details (optional)
              <textarea name="detail" rows={3} maxLength={500} />
            </label>
            <div className="row dialog-actions">
              <button
                type="button"
                className="secondary"
                onClick={() => setReporting(false)}
              >
                Cancel
              </button>
              <button disabled={busy === "report"}>
                {busy === "report" ? "Sending…" : "Submit report"}
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
