import { describe, expect, it } from "vitest";
import { groupFlags, type GroupInput } from "../lib/group";

const m = (seat: string | null, ts: number, o: Partial<GroupInput> = {}): GroupInput => ({
  kind: "chat",
  seat_id: seat,
  to_seat_id: null,
  ts,
  ...o,
});

describe("groupFlags", () => {
  it("groups same sender within 5 minutes", () => {
    const f = groupFlags([m("a", 0), m("a", 60_000), m("a", 120_000)]);
    expect(f.map((x) => x.continues)).toEqual([false, true, true]);
    expect(f.map((x) => x.endsGroup)).toEqual([false, false, true]);
  });
  it("breaks on a different sender, addressee or a 5 minute gap", () => {
    expect(groupFlags([m("a", 0), m("b", 1000)]).map((x) => x.continues)).toEqual([false, false]);
    expect(groupFlags([m("a", 0), m("a", 1000, { to_seat_id: "x" })]).map((x) => x.continues)).toEqual([false, false]);
    expect(groupFlags([m("a", 0), m("a", 300_000)]).map((x) => x.continues)).toEqual([false, false]);
  });
  it("breaks when something else sits between", () => {
    const f = groupFlags([m("a", 0), m(null, 1000, { kind: "system" }), m("a", 2000)]);
    expect(f.map((x) => x.continues)).toEqual([false, false, false]);
  });
  it("never groups approval cards or system messages", () => {
    const f = groupFlags([m("a", 0, { kind: "approval_request" }), m("a", 1000, { kind: "approval_request" })]);
    expect(f.map((x) => x.continues)).toEqual([false, false]);
  });
});
