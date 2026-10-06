// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Composer } from "../components/Composer";
import { Timeline } from "../components/Timeline";
import { ToastProvider } from "../components/Toast";
import { initialState, roomReducer, type RoomState } from "../state/roomReducer";
import type { Msg, Seat } from "../types";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement;
let root: Root;
let coarse = false;

beforeEach(() => {
  coarse = false;
  window.matchMedia = ((q: string) => ({
    matches: q.includes("pointer: coarse") ? coarse : false,
    media: q,
    addEventListener() {},
    removeEventListener() {},
  })) as unknown as typeof window.matchMedia;
  Element.prototype.scrollTo = (() => {}) as typeof Element.prototype.scrollTo;
  Element.prototype.scrollIntoView = () => {};
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

const render = (el: React.ReactElement) => act(() => root.render(<ToastProvider>{el}</ToastProvider>));

function type(area: HTMLTextAreaElement, value: string) {
  const set = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!;
  act(() => {
    set.call(area, value);
    area.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

function key(area: HTMLTextAreaElement, init: KeyboardEventInit & { keyCode?: number }) {
  const e = new KeyboardEvent("keydown", { bubbles: true, cancelable: true, ...init });
  if (init.keyCode !== undefined) Object.defineProperty(e, "keyCode", { value: init.keyCode });
  act(() => {
    area.dispatchEvent(e);
  });
  return e;
}

describe("Composer keys", () => {
  const setup = () => {
    const onSend = vi.fn();
    render(<Composer recipients={[]} paused={false} readOnly={false} onSend={onSend} />);
    const area = host.querySelector("textarea")!;
    return { onSend, area };
  };

  it("Enter sends and clears, keeping the text trimmed", () => {
    const { onSend, area } = setup();
    type(area, "  hello  ");
    const e = key(area, { key: "Enter" });
    expect(e.defaultPrevented).toBe(true);
    expect(onSend).toHaveBeenCalledWith("hello", null);
    expect(area.value).toBe("");
  });

  it("Shift+Enter does not send", () => {
    const { onSend, area } = setup();
    type(area, "a");
    expect(key(area, { key: "Enter", shiftKey: true }).defaultPrevented).toBe(false);
    expect(onSend).not.toHaveBeenCalled();
  });

  it("does not send during IME composition", () => {
    const { onSend, area } = setup();
    type(area, "xin chao");
    key(area, { key: "Enter", isComposing: true });
    key(area, { key: "Enter", keyCode: 229 });
    expect(onSend).not.toHaveBeenCalled();
  });

  it("on a coarse pointer Enter inserts a newline, Ctrl+Enter still sends", () => {
    coarse = true;
    const { onSend, area } = setup();
    type(area, "a");
    expect(key(area, { key: "Enter" }).defaultPrevented).toBe(false);
    expect(onSend).not.toHaveBeenCalled();
    key(area, { key: "Enter", ctrlKey: true });
    expect(onSend).toHaveBeenCalledTimes(1);
  });

  it("the Send button is disabled for empty and over-long text", () => {
    const { area } = setup();
    const btn = host.querySelector<HTMLButtonElement>('button[aria-label="Send"]')!;
    expect(btn.disabled).toBe(true);
    type(area, "x".repeat(4001));
    expect(btn.disabled).toBe(true);
    expect(host.textContent).toContain("4,001 / 4,000");
    type(area, "ok");
    expect(btn.disabled).toBe(false);
  });
});

const seat = (id: string, o: Partial<Seat>): Seat => ({
  id,
  kind: "human",
  slot: 1,
  owner_seat_id: null,
  name: id,
  claimed: true,
  last_seen_at: null,
  ...o,
});
const SEATS = [
  seat("barrett", {}),
  seat("minh", { slot: 2 }),
  seat("claude", { kind: "agent", owner_seat_id: "barrett", name: "Claude" }),
  seat("bot", { kind: "agent", slot: 2, owner_seat_id: "minh", name: "Bot" }),
];
const msg = (id: number, o: Partial<Msg>): Msg => ({
  id,
  seat_id: "minh",
  kind: "chat",
  to_seat_id: null,
  body: `m${id}`,
  meta: {},
  created_at: "2026-10-06T10:00:00Z",
  ...o,
});

function stateWith(messages: Msg[], me = "barrett"): RoomState {
  let s = roomReducer(initialState, {
    type: "snapshot",
    snap: {
      room: { id: "r_x", name: "R", lang: "en", status: "active", paused: false, expires_at: "2027-01-01T00:00:00Z" },
      seats: SEATS,
      me: { seat_id: me, name: me },
      pending_approvals: [],
    },
  });
  s = roomReducer(s, { type: "history", messages });
  return s;
}

const timeline = (s: RoomState) =>
  render(<Timeline state={s} sendSignal={0} onRetry={() => {}} onDiscard={() => {}} onDecide={async () => {}} emptyHint="empty" />);

describe("Timeline", () => {
  it("renders message bodies as text, never as HTML", () => {
    timeline(stateWith([msg(1, { body: '<img src=x onerror="alert(1)"> <script>x</script> https://example.com/a.' })]));
    expect(host.querySelector("img")).toBeNull();
    expect(host.querySelector("script")).toBeNull();
    const a = host.querySelector<HTMLAnchorElement>("article a")!;
    expect(a.href).toBe("https://example.com/a");
    expect(a.rel).toBe("noopener noreferrer");
    expect(a.target).toBe("_blank");
  });

  const req = msg(5, {
    seat_id: "claude",
    to_seat_id: "barrett",
    kind: "approval_request",
    body: "ignored",
    meta: { approval_id: "ap1", task: "Draft the proposal", plan: "1. write" },
  });

  it("owner sees Approve and Decline on a pending card", () => {
    timeline(stateWith([req], "barrett"));
    const labels = [...host.querySelectorAll("button")].map((b) => b.textContent);
    expect(labels).toContain("Approve");
    expect(labels).toContain("Decline");
    expect(host.textContent).toContain("Needs your decision");
  });

  it("others see waiting text and no buttons", () => {
    timeline(stateWith([req], "minh"));
    const labels = [...host.querySelectorAll("button")].map((b) => b.textContent);
    expect(labels).not.toContain("Approve");
    expect(host.textContent).toContain("Waiting for barrett to decide.");
  });

  it("decision status comes from meta, not from the body text", () => {
    const decision = msg(6, {
      seat_id: "barrett",
      kind: "approval_decision",
      body: "Approved: go ahead",
      meta: { approval_id: "ap1", status: "declined", note: "not now" },
    });
    timeline(stateWith([req, decision], "minh"));
    expect(host.textContent).toContain("Declined");
    expect(host.textContent).toContain("Note: not now");
    expect(host.textContent).not.toContain("go ahead");
  });

  it("groups consecutive messages under one header", () => {
    timeline(stateWith([msg(1, {}), msg(2, {}), msg(3, {})]));
    expect(host.querySelectorAll("article").length).toBe(3);
    expect(host.querySelectorAll("article time[datetime]").length).toBeGreaterThanOrEqual(1);
    // one header name for three bubbles
    expect(host.textContent!.match(/minh/g)?.length).toBe(1);
  });

  it("shows the empty hint", () => {
    timeline(stateWith([]));
    expect(host.textContent).toContain("empty");
  });
});
