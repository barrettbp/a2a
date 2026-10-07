import { describe, expect, it } from "vitest";
import { parseFragment, resolveToken, type TokenStore } from "../lib/token";

const TOKEN = "own_" + "a".repeat(43);
const OTHER = "own_" + "b".repeat(43);

function mem(failWrites = false): TokenStore & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    get: (k) => data.get(k) ?? null,
    set: (k, v) => {
      if (failWrites) return false;
      data.set(k, v);
      return true;
    },
  };
}

describe("parseFragment", () => {
  it("accepts an owner token", () => expect(parseFragment("#" + TOKEN)).toBe(TOKEN));
  it("rejects anything else", () => {
    expect(parseFragment("")).toBeNull();
    expect(parseFragment("#")).toBeNull();
    expect(parseFragment("#agt_" + "a".repeat(43))).toBeNull();
    expect(parseFragment("#own_ bad")).toBeNull();
    expect(parseFragment("#own_short")).toBeNull();
  });
});

describe("resolveToken", () => {
  it("stores a fragment token on first load and flags the banner", () => {
    const kv = mem();
    const r = resolveToken("k", "#" + TOKEN, kv);
    expect(r).toEqual({ token: TOKEN, fromFragment: true, firstOnDevice: true, persisted: true });
    expect(kv.data.get("k")).toBe(TOKEN);
  });
  it("does not flag the banner when the same token is already stored", () => {
    const kv = mem();
    kv.data.set("k", TOKEN);
    expect(resolveToken("k", "#" + TOKEN, kv)).toMatchObject({ firstOnDevice: false, persisted: true });
  });
  it("uses the stored token when there is no fragment", () => {
    const kv = mem();
    kv.data.set("k", TOKEN);
    expect(resolveToken("k", "", kv)).toMatchObject({ token: TOKEN, fromFragment: false });
  });
  it("returns null when there is nothing", () => {
    expect(resolveToken("k", "", mem()).token).toBeNull();
  });
  it("a link with a different token does NOT replace the stored token until the server accepts it", () => {
    const kv = mem();
    kv.data.set("k", OTHER);
    const r = resolveToken("k", "#" + TOKEN, kv);
    expect(r).toMatchObject({ token: TOKEN, needsVerify: true, fallback: OTHER, persisted: false });
    expect(kv.data.get("k")).toBe(OTHER);
  });
  it("a link whose token is already stored needs no check", () => {
    const kv = mem();
    kv.data.set("k", TOKEN);
    expect(resolveToken("k", "#" + TOKEN, kv).needsVerify).toBeUndefined();
  });
  it("a malformed stored token does not block a good link", () => {
    const kv = mem();
    kv.data.set("k", "junk");
    const r = resolveToken("k", "#" + TOKEN, kv);
    expect(r.needsVerify).toBeUndefined();
    expect(kv.data.get("k")).toBe(TOKEN);
  });
  it("reports persisted=false when storage fails, so the fragment stays in the URL", () => {
    const r = resolveToken("k", "#" + TOKEN, mem(true));
    expect(r.token).toBe(TOKEN);
    expect(r.persisted).toBe(false);
  });
  it("ignores a malformed stored token", () => {
    const kv = mem();
    kv.data.set("k", "junk");
    expect(resolveToken("k", "", kv).token).toBeNull();
  });
});
