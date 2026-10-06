export const ONLINE_MS = 90_000;

export function isOnline(lastSeenAt: string | null, now: number): boolean {
  if (!lastSeenAt) return false;
  const t = Date.parse(lastSeenAt);
  return Number.isFinite(t) && now - t < ONLINE_MS;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "last seen 3 min ago", "last seen 2 h ago", "last seen 5 Oct". Null when never seen. */
export function lastSeenText(lastSeenAt: string | null, now: number): string | null {
  if (!lastSeenAt) return null;
  const t = Date.parse(lastSeenAt);
  if (!Number.isFinite(t)) return null;
  const mins = Math.max(1, Math.floor((now - t) / 60_000));
  if (mins < 60) return `last seen ${mins} min ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `last seen ${hours} h ago`;
  const d = new Date(t);
  return `last seen ${d.getDate()} ${MONTHS[d.getMonth()]}`;
}
