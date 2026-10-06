import { memo, useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent } from "react";
import { Button } from "./Button";
import { ArrowUpIcon, ChevronDownIcon } from "./Icons";

export interface Recipient {
  id: string;
  label: string;
}

interface Props {
  recipients: Recipient[];
  paused: boolean;
  readOnly: boolean;
  onSend: (body: string, toSeatId: string | null) => void;
}

const MAX = 4000;
const COUNTER_FROM = 3500;
const fmt = (n: number) => n.toLocaleString("en-US");

/** Owns its own text state so SSE updates elsewhere never re-render it. */
export const Composer = memo(function Composer({ recipients, paused, readOnly, onSend }: Props) {
  const [text, setText] = useState("");
  const [to, setTo] = useState("");
  const area = useRef<HTMLTextAreaElement>(null);

  // Selection is sticky, but resets when the chosen seat disappears.
  useEffect(() => {
    if (to && !recipients.some((r) => r.id === to)) setTo("");
  }, [recipients, to]);

  useEffect(() => {
    if (window.matchMedia("(min-width: 1024px) and (pointer: fine)").matches) area.current?.focus();
  }, []);

  useLayoutEffect(() => {
    const el = area.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [text]);

  const trimmed = text.trim();
  const over = text.length > MAX;
  const canSend = trimmed.length > 0 && !over && !readOnly;

  function send() {
    if (!canSend) return;
    onSend(trimmed, to || null);
    setText("");
    area.current?.focus();
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key !== "Enter") return;
    // Never send while an IME composition is active (Vietnamese Telex and VNI rely on this).
    if (e.nativeEvent.isComposing || e.keyCode === 229) return;
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      send();
      return;
    }
    if (e.shiftKey || window.matchMedia("(pointer: coarse)").matches) return;
    e.preventDefault();
    send();
  }

  if (readOnly) {
    return (
      <div className="flex min-h-14 items-center justify-center border-t border-line bg-sunken px-4 text-center text-caption text-ink-2">
        This room reached its 2,000-message limit and is read-only.
      </div>
    );
  }

  const picked = to !== "";
  return (
    <div className="border-t border-line bg-surface px-4 pb-[calc(8px+env(safe-area-inset-bottom))] pt-2 lg:px-6 lg:pb-3 lg:pt-3">
      <div className="mx-auto w-full max-w-[720px]">
        {paused && (
          <p className="mb-2 rounded-sm border border-warning-soft-line bg-warning-soft px-3 py-2 text-caption text-warning-ink">
            Paused: your message will resume the agents.
          </p>
        )}
        <div className="mb-1 flex items-center justify-between gap-2">
          <div className="relative">
            <select
              aria-label="Send to"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className={`h-11 max-w-[260px] cursor-pointer appearance-none truncate rounded-sm border py-0 pl-3 pr-8 text-label font-medium ${
                picked
                  ? "border-accent-soft-line bg-accent-soft text-accent-ink"
                  : "border-transparent bg-transparent text-ink-2 hover:bg-sunken"
              }`}
            >
              <option value="">To: Everyone</option>
              {recipients.map((r) => (
                <option key={r.id} value={r.id}>
                  To: {r.label}
                </option>
              ))}
            </select>
            <ChevronDownIcon size={16} className="pointer-events-none absolute right-2.5 top-3.5" />
          </div>
          {text.length >= COUNTER_FROM && (
            <span className={`text-micro tabular-nums ${over ? "text-danger" : "text-ink-3"}`} aria-live="polite">
              {fmt(text.length)} / {fmt(MAX)}
              {over && ". Shorten the message to send it."}
            </span>
          )}
        </div>
        <div className="flex items-end gap-2">
          <textarea
            id="message-box"
            ref={area}
            aria-label="Message"
            placeholder="Write a message"
            rows={1}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={onKeyDown}
            className="field block max-h-40 min-h-11 resize-none overflow-y-auto py-2.5 lg:max-h-60"
            style={{ height: 44 }}
          />
          <Button variant="primary" icon aria-label="Send" disabled={!canSend} onClick={send} onMouseDown={(e) => e.preventDefault()}>
            <ArrowUpIcon />
          </Button>
        </div>
      </div>
    </div>
  );
});
