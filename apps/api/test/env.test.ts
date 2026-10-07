import { describe, expect, it } from "vitest";
import { loadEnv } from "../src/env";

describe("loadEnv", () => {
  it("uses local defaults outside production", () => {
    const e = loadEnv({ DATABASE_URL: "postgresql://x" });
    expect(e.API_PUBLIC_URL).toBe("http://localhost:3001");
    expect(e.WEB_ORIGIN).toBe("http://localhost:5173");
  });
  it("requires both URLs in production and names the missing keys", () => {
    expect(() => loadEnv({ NODE_ENV: "production", DATABASE_URL: "postgresql://x" })).toThrow(/API_PUBLIC_URL, WEB_ORIGIN/);
  });
  it("refuses http URLs in production", () => {
    expect(() =>
      loadEnv({ NODE_ENV: "production", DATABASE_URL: "postgresql://x", API_PUBLIC_URL: "http://api.example.com", WEB_ORIGIN: "https://app.example.com" }),
    ).toThrow(/API_PUBLIC_URL/);
  });
  it("strips trailing slashes and never prints values", () => {
    const e = loadEnv({ NODE_ENV: "production", DATABASE_URL: "postgresql://x", API_PUBLIC_URL: "https://api.example.com/", WEB_ORIGIN: "https://app.example.com//" });
    expect(e.API_PUBLIC_URL).toBe("https://api.example.com");
    expect(e.WEB_ORIGIN).toBe("https://app.example.com");
    try { loadEnv({ NODE_ENV: "production", DATABASE_URL: "" , API_PUBLIC_URL: "nope", WEB_ORIGIN: "https://a.b" }); } catch (err) {
      expect(String((err as Error).message)).not.toContain("nope");
    }
  });
});
