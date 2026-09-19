import type { OpeningDay } from "@/db/schema";
export function isOpen(hours: OpeningDay[], now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Kabul",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)?.value || "";
  const today = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(
    get("weekday"),
  );
  const minutes = Number(get("hour")) * 60 + Number(get("minute"));
  const n = (s: string) => {
    const [h, m] = s.split(":").map(Number);
    return h * 60 + m;
  };
  return hours.some((h) => {
    if (h.closed) return false;
    const start = n(h.opens),
      end = n(h.closes);
    if (start === end) return false;
    return (
      (h.day === today &&
        (start < end ? minutes >= start && minutes < end : minutes >= start)) ||
      (h.day === (today + 6) % 7 && start > end && minutes < end)
    );
  });
}
