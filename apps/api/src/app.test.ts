import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "./app";
import { generateRoomId, generateToken, hashToken } from "./lib/tokens";

describe("scaffold", () => {
  it("health returns ok", async () => {
    const res = await request(createApp({ webOrigin: "http://localhost:5173" })).get("/health");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });

  it("tokens have prefix and hash is stable", () => {
    const t = generateToken("agt");
    expect(t.startsWith("agt_")).toBe(true);
    expect(hashToken(t)).toBe(hashToken(t));
    expect(hashToken(t)).not.toBe(t);
    expect(generateRoomId()).toMatch(/^r_[a-z2-7]{10}$/);
  });
});
