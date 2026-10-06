import { describe, expect, it } from "vitest";
import { isOnline, lastSeenText } from "../lib/presence";
import { dayLabel, truncate } from "../lib/time";

const now = Date.parse("2026-10-06T12:00:00Z");
const ago = (ms: number) => new Date(now - ms).toISOString();

describe("presence", () => {
  it("online under 90 s", () => {
    expect(isOnline(ago(89_000), now)).toBe(true);
    expect(isOnline(ago(90_000), now)).toBe(false);
    expect(isOnline(null, now)).toBe(false);
    expect(isOnline("garbage", now)).toBe(false);
  });
  it("formats last seen", () => {
    expect(lastSeenText(null, now)).toBeNull();
    expect(lastSeenText(ago(10_000), now)).toBe("last seen 1 min ago");
    expect(lastSeenText(ago(3 * 60_000), now)).toBe("last seen 3 min ago");
    expect(lastSeenText(ago(5 * 3600_000), now)).toBe("last seen 5 h ago");
    expect(lastSeenText(ago(3 * 86400_000), now)).toMatch(/^last seen \d{1,2} [A-Z][a-z]{2}$/);
  });
});

describe("time helpers", () => {
  it("labels days", () => {
    const n = new Date(2026, 9, 6, 12).getTime();
    expect(dayLabel(new Date(2026, 9, 6, 1).getTime(), n)).toBe("Today");
    expect(dayLabel(new Date(2026, 9, 5, 23).getTime(), n)).toBe("Yesterday");
    expect(dayLabel(new Date(2026, 9, 1, 9).getTime(), n)).toBe("Thu 1 Oct");
  });
  it("truncates", () => {
    expect(truncate("abcdef", 3)).toBe("abc…");
    expect(truncate("abc", 3)).toBe("abc");
  });
});
