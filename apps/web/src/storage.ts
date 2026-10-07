// Every storage access is wrapped: private mode, blocked cookies or a full quota must never break the page.
type Kind = "local" | "session";

function store(kind: Kind): Storage | null {
  try {
    return kind === "local" ? window.localStorage : window.sessionStorage;
  } catch {
    return null;
  }
}

export function getItem(kind: Kind, key: string): string | null {
  try {
    return store(kind)?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

/** Returns true when the value was stored and reads back. */
export function setItem(kind: Kind, key: string, value: string): boolean {
  try {
    const s = store(kind);
    if (!s) return false;
    s.setItem(key, value);
    return s.getItem(key) === value;
  } catch {
    return false;
  }
}

export function removeItem(kind: Kind, key: string): void {
  try {
    store(kind)?.removeItem(key);
  } catch {
    /* ignore */
  }
}

export const keys = {
  token: (roomId: string) => `snapwork:token:${roomId}`,
  invite: (roomId: string) => `snapwork:invite:${roomId}`,
  banner: (roomId: string) => `snapwork:banner-dismissed:${roomId}`,
  prompt: (roomId: string) => `snapwork:prompt:${roomId}`,
  mcpUrl: (roomId: string) => `snapwork:mcp-url:${roomId}`,
  tab: "snapwork:connect-tab",
};

/** "no" = show the bookmark banner, "yes" = dismissed. Absent = never shown on this device. */
export const BANNER_SHOW = "no";
export const BANNER_DISMISSED = "yes";
