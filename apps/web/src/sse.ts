// Server-Sent Events over fetch. The browser EventSource cannot send an Authorization header.

export interface SseFrame {
  id: string | null;
  event: string;
  data: string;
}

/** Incremental SSE parser. Feed it text chunks of any size; it returns the frames completed so far. */
export class SseParser {
  private buf = "";

  push(chunk: string): SseFrame[] {
    this.buf += chunk;
    // A trailing CR may be the first half of a CRLF split across chunks: hold it back.
    let hold = "";
    if (this.buf.endsWith("\r")) {
      hold = "\r";
      this.buf = this.buf.slice(0, -1);
    }
    const text = this.buf.replace(/\r\n|\r/g, "\n");
    const blocks = text.split("\n\n");
    this.buf = (blocks.pop() ?? "") + hold;
    const frames: SseFrame[] = [];
    for (const block of blocks) {
      const f = parseBlock(block);
      if (f) frames.push(f);
    }
    return frames;
  }
}

function parseBlock(block: string): SseFrame | null {
  let id: string | null = null;
  let event = "message";
  const data: string[] = [];
  let hasData = false;
  for (const line of block.split("\n")) {
    if (line === "" || line.startsWith(":")) continue;
    const i = line.indexOf(":");
    const field = i === -1 ? line : line.slice(0, i);
    let value = i === -1 ? "" : line.slice(i + 1);
    if (value.startsWith(" ")) value = value.slice(1);
    if (field === "id") id = value;
    else if (field === "event") event = value;
    else if (field === "data") {
      data.push(value);
      hasData = true;
    }
  }
  return hasData ? { id, event, data: data.join("\n") } : null;
}

export type StreamStatus = "connecting" | "live" | "reconnecting";

export interface StreamOptions {
  url: string;
  token: string;
  /** read at every (re)connect */
  getLastId: () => number;
  onFrame: (f: SseFrame) => void;
  onStatus: (s: StreamStatus, info: { reconnect: boolean }) => void;
  /** 401, 403, 404, 410: retrying will not help */
  onFatal: (status: number) => void;
  /** no bytes for this long means the connection is dead */
  idleMs?: number;
}

export function backoffMs(attempt: number): number {
  return Math.min(1000 * 2 ** attempt, 10_000);
}

export function connectStream(o: StreamOptions) {
  const idleMs = o.idleMs ?? 45_000;
  let closed = false;
  let attempt = 0;
  let everOpen = false;
  let live = false;
  let ctrl: AbortController | null = null;
  let wake: (() => void) | null = null;

  const sleep = (ms: number) =>
    new Promise<void>((resolve) => {
      const t = setTimeout(done, ms);
      function done() {
        clearTimeout(t);
        wake = null;
        resolve();
      }
      wake = done;
    });

  async function once(): Promise<void> {
    ctrl = new AbortController();
    const mine = ctrl;
    let watchdog: ReturnType<typeof setTimeout> | undefined;
    const arm = () => {
      clearTimeout(watchdog);
      watchdog = setTimeout(() => mine.abort(), idleMs);
    };
    try {
      const headers: Record<string, string> = { Authorization: `Bearer ${o.token}`, Accept: "text/event-stream" };
      const last = o.getLastId();
      if (last > 0) headers["Last-Event-ID"] = String(last);
      arm();
      const res = await fetch(o.url, { headers, signal: mine.signal, cache: "no-store" });
      if ([401, 403, 404, 410].includes(res.status)) {
        closed = true;
        o.onFatal(res.status);
        return;
      }
      if (!res.ok || !res.body) return;
      live = true;
      o.onStatus("live", { reconnect: everOpen });
      everOpen = true;
      attempt = 0;
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      const parser = new SseParser();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) return;
        arm();
        for (const f of parser.push(decoder.decode(value, { stream: true }))) o.onFrame(f);
      }
    } catch {
      /* aborted or network error: fall through to retry */
    } finally {
      clearTimeout(watchdog);
    }
  }

  async function loop() {
    o.onStatus("connecting", { reconnect: false });
    while (!closed) {
      await once();
      live = false;
      if (closed) break;
      o.onStatus("reconnecting", { reconnect: true });
      await sleep(backoffMs(attempt++));
    }
  }

  const retryNow = () => {
    if (closed) return;
    attempt = 0;
    if (wake) wake();
    else if (!live) ctrl?.abort();
  };
  const onOnline = () => retryNow();
  const onVisible = () => {
    if (document.visibilityState === "visible") retryNow();
  };
  window.addEventListener("online", onOnline);
  document.addEventListener("visibilitychange", onVisible);
  void loop();

  return {
    retryNow,
    close() {
      closed = true;
      ctrl?.abort();
      wake?.();
      window.removeEventListener("online", onOnline);
      document.removeEventListener("visibilitychange", onVisible);
    },
  };
}
