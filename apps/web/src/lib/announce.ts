import { truncate } from "./time";
import type { Msg, Seat } from "../types";

/** Text for the screen reader live region. Built from structured fields; approvals never from body text. */
export function announceText(m: Msg, seats: Seat[], meSeatId: string): string {
  const name = (id: string | null | undefined) => seats.find((s) => s.id === id)?.name ?? "Someone";
  switch (m.kind) {
    case "chat":
      return `${name(m.seat_id)}: ${truncate(m.body, 140)}`;
    case "system":
      return truncate(m.body, 140);
    case "approval_request": {
      const task = typeof m.meta.task === "string" ? m.meta.task : "a task";
      const prefix = m.to_seat_id === meSeatId ? "Needs your decision. " : "";
      return `${prefix}${name(m.seat_id)} asks ${name(m.to_seat_id)} for approval: ${truncate(task, 140)}`;
    }
    case "approval_decision": {
      const verb = m.meta.status === "declined" ? "declined" : "approved";
      return `${name(m.seat_id)} ${verb} a request.`;
    }
    case "result":
      return `${name(m.seat_id)} reported a result.`;
  }
}

/** At most one announcement per `gapMs`; bursts collapse into "n new messages." */
export function createThrottle(say: (text: string) => void, gapMs = 1000) {
  let last = 0;
  let queue: string[] = [];
  let timer: ReturnType<typeof setTimeout> | undefined;
  const flush = () => {
    timer = undefined;
    if (queue.length === 0) return;
    say(queue.length === 1 ? queue[0]! : `${queue.length} new messages.`);
    queue = [];
    last = Date.now();
  };
  return {
    push(text: string) {
      queue.push(text);
      if (timer) return;
      const wait = Math.max(0, last + gapMs - Date.now());
      timer = setTimeout(flush, wait);
    },
    stop() {
      clearTimeout(timer);
      timer = undefined;
      queue = [];
    },
  };
}
