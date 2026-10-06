const pad = (n: number) => String(n).padStart(2, "0");

export function hhmm(ts: number): string {
  const d = new Date(ts);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function fullDate(ts: number): string {
  return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" }).format(new Date(ts));
}

const dayKey = (ts: number) => {
  const d = new Date(ts);
  return d.getFullYear() * 10000 + d.getMonth() * 100 + d.getDate();
};

export function sameDay(a: number, b: number): boolean {
  return dayKey(a) === dayKey(b);
}

/** "Today", "Yesterday", otherwise "Mon 5 Oct". */
export function dayLabel(ts: number, now: number): string {
  if (sameDay(ts, now)) return "Today";
  const y = new Date(now);
  y.setDate(y.getDate() - 1);
  if (sameDay(ts, y.getTime())) return "Yesterday";
  const f = new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short" }).formatToParts(new Date(ts));
  const get = (t: string) => f.find((p) => p.type === t)?.value ?? "";
  return `${get("weekday")} ${get("day")} ${get("month")}`;
}

export function truncate(s: string, max: number): string {
  return s.length <= max ? s : `${s.slice(0, max).trimEnd()}…`;
}
