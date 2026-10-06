import { describe, expect, it } from "vitest";
import { backoffMs, SseParser } from "../sse";

describe("SseParser", () => {
  it("parses a message frame", () => {
    const p = new SseParser();
    expect(p.push('id: 5\nevent: message\ndata: {"a":1}\n\n')).toEqual([{ id: "5", event: "message", data: '{"a":1}' }]);
  });

  it("handles frames split across chunks", () => {
    const p = new SseParser();
    expect(p.push("id: 7\neve")).toEqual([]);
    expect(p.push("nt: message\ndata: hel")).toEqual([]);
    expect(p.push("lo\n")).toEqual([]);
    expect(p.push("\n")).toEqual([{ id: "7", event: "message", data: "hello" }]);
  });

  it("handles CRLF, including a CRLF split between chunks", () => {
    const p = new SseParser();
    expect(p.push("event: seat\r\ndata: x\r\n\r")).toEqual([]);
    expect(p.push("\n")).toEqual([{ id: null, event: "seat", data: "x" }]);
  });

  it("ignores comments, retry-only blocks and heartbeats", () => {
    const p = new SseParser();
    expect(p.push("retry: 3000\n\n: hb\n\n")).toEqual([]);
    expect(p.push(": hb\nevent: approval\ndata: {}\n\n")).toEqual([{ id: null, event: "approval", data: "{}" }]);
  });

  it("returns several frames from one chunk and joins multi-line data", () => {
    const p = new SseParser();
    const out = p.push("data: a\ndata: b\n\nid: 2\ndata: c\n\n");
    expect(out).toEqual([
      { id: null, event: "message", data: "a\nb" },
      { id: "2", event: "message", data: "c" },
    ]);
  });

  it("keeps a colon inside the value and strips one leading space", () => {
    const p = new SseParser();
    expect(p.push("data: a: b\n\n")[0]?.data).toBe("a: b");
  });
});

describe("backoffMs", () => {
  it("doubles and caps at 10 s", () => {
    expect([0, 1, 2, 3, 4, 9].map(backoffMs)).toEqual([1000, 2000, 4000, 8000, 10000, 10000]);
  });
});
