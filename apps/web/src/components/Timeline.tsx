import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { groupFlags } from "../lib/group";
import { prefersReducedMotion } from "../lib/hooks";
import { dayLabel, fullDate, hhmm, sameDay, truncate } from "../lib/time";
import {
  deriveApproval,
  indexApprovalMessages,
  type ApprovalIndex,
  type Pending,
  type RoomState,
} from "../state/roomReducer";
import type { Msg, MessageKind, Seat } from "../types";
import { ApprovalCard } from "./ApprovalCard";
import { AlertCircleIcon, ArrowDownIcon, CheckIcon } from "./Icons";
import { Linkified } from "./Linkified";
import { AgentTag, Avatar } from "./ui";

interface Item {
  key: string;
  ts: number;
  kind: MessageKind;
  seat_id: string | null;
  to_seat_id: string | null;
  msg?: Msg;
  pending?: Pending;
  /** entrance animation */
  enter: "none" | "other" | "own";
}

interface Props {
  state: RoomState;
  sendSignal: number;
  onRetry: (clientId: string) => void;
  onDiscard: (clientId: string) => void;
  onDecide: (approvalId: string, status: "approved" | "declined") => Promise<void>;
  emptyHint: React.ReactNode;
}

const AT_BOTTOM_PX = 120;

function jumpTo(domId: string) {
  const el = document.getElementById(domId);
  if (!el) return;
  const reduced = prefersReducedMotion();
  el.scrollIntoView({ block: "center", behavior: reduced ? "auto" : "smooth" });
  el.classList.remove("flash");
  void el.offsetWidth;
  el.classList.add("flash");
  setTimeout(() => el.classList.remove("flash"), reduced ? 2000 : 1300);
}

export function Timeline({ state, sendSignal, onRetry, onDiscard, onDecide, emptyHint }: Props) {
  const { room, seats, me } = state;
  const scroller = useRef<HTMLDivElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const atBottom = useRef(true);
  const [unseen, setUnseen] = useState<{ count: number; firstId: number } | null>(null);
  const seen = useRef<{ lastId: number; first: boolean; send: number }>({ lastId: 0, first: true, send: 0 });

  const seatsById = useMemo(() => new Map(seats.map((s) => [s.id, s])), [seats]);
  const idx = useMemo(() => indexApprovalMessages(state.confirmed), [state.confirmed]);

  const items = useMemo<Item[]>(() => {
    const out: Item[] = state.confirmed.map((m) => {
      const clientId = state.clientIds[m.id];
      return {
        key: clientId ?? `m${m.id}`,
        ts: Date.parse(m.created_at),
        kind: m.kind,
        seat_id: m.seat_id,
        to_seat_id: m.to_seat_id,
        msg: m,
        enter: clientId ? "own" : state.fresh[m.id] ? "other" : "none",
      };
    });
    for (const p of state.pending)
      out.push({ key: p.clientId, ts: p.createdAt, kind: "chat", seat_id: p.seat_id, to_seat_id: p.to_seat_id, pending: p, enter: "own" });
    return out;
  }, [state.confirmed, state.pending, state.clientIds, state.fresh]);

  const flags = useMemo(() => groupFlags(items), [items]);

  const scrollToBottom = useCallback((smooth: boolean) => {
    const el = scroller.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: smooth && !prefersReducedMotion() ? "smooth" : "auto" });
  }, []);

  // Scroll rules (design 3.7). Runs after layout, before paint.
  useLayoutEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const s = seen.current;
    const maxId = state.confirmed.at(-1)?.id ?? 0;
    if (s.first) {
      s.first = false;
      s.lastId = maxId;
      s.send = sendSignal;
      el.scrollTop = el.scrollHeight;
      return;
    }
    if (sendSignal !== s.send) {
      s.send = sendSignal;
      const far = el.scrollHeight - el.scrollTop - el.clientHeight > el.clientHeight;
      scrollToBottom(!far);
      s.lastId = maxId;
      return;
    }
    if (atBottom.current) {
      el.scrollTop = el.scrollHeight;
      s.lastId = maxId;
      return;
    }
    if (maxId > s.lastId) {
      const fresh = state.confirmed.filter((m) => m.id > s.lastId && m.seat_id !== me?.seat_id);
      s.lastId = maxId;
      if (fresh.length > 0) setUnseen((u) => ({ count: (u?.count ?? 0) + fresh.length, firstId: u?.firstId ?? fresh[0]!.id }));
    }
  }, [items, sendSignal, state.confirmed, me?.seat_id, scrollToBottom]);

  // Keep pinned when the viewport or content resizes (composer growth, keyboard).
  useEffect(() => {
    const el = scroller.current;
    const c = content.current;
    if (!el || !c || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => {
      if (atBottom.current) el.scrollTop = el.scrollHeight;
    });
    ro.observe(el);
    ro.observe(c);
    return () => ro.disconnect();
  }, []);

  const onScroll = () => {
    const el = scroller.current;
    if (!el) return;
    atBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight <= AT_BOTTOM_PX;
    if (atBottom.current) setUnseen((u) => (u ? null : u));
  };

  const jumpToUnseen = () => {
    if (!unseen) return;
    const el = document.getElementById(`msg-${unseen.firstId}`);
    el?.scrollIntoView({ block: "start", behavior: prefersReducedMotion() ? "auto" : "smooth" });
    setUnseen(null);
  };

  const nameOf = useCallback((id: string | null): string => (id ? seatsById.get(id)?.name ?? "Someone" : "Snapwork"), [seatsById]);
  const now = Date.now();
  const lang = room?.lang === "vi" ? "vi" : undefined;

  return (
    <div className="relative min-h-0 flex-1">
      <div
        ref={scroller}
        onScroll={onScroll}
        role="log"
        aria-label="Messages"
        aria-live="off"
        className="h-full overflow-y-auto overscroll-contain bg-surface"
      >
        <div ref={content} className="mx-auto w-full max-w-[720px] px-4 py-4 lg:px-6">
          {items.length === 0 && <div className="mx-auto max-w-[320px] py-16 text-center text-small text-ink-2">{emptyHint}</div>}
          {items.map((it, i) => {
            const prev = items[i - 1];
            const f = flags[i]!;
            const divider = !prev || !sameDay(prev.ts, it.ts);
            return (
              <div key={it.key} id={it.msg ? `msg-${it.msg.id}` : undefined}>
                {divider && <DayDivider label={dayLabel(it.ts, now)} />}
                <Row
                  item={it}
                  continues={f.continues}
                  endsGroup={f.endsGroup}
                  me={me?.seat_id ?? null}
                  seats={seats}
                  seatsById={seatsById}
                  nameOf={nameOf}
                  idx={idx}
                  state={state}
                  lang={lang}
                  onRetry={onRetry}
                  onDiscard={onDiscard}
                  onDecide={onDecide}
                />
              </div>
            );
          })}
        </div>
      </div>
      {unseen && (
        <button
          type="button"
          onClick={jumpToUnseen}
          className="toast-enter absolute bottom-3 left-1/2 inline-flex h-11 -translate-x-1/2 cursor-pointer items-center gap-2 rounded-full border border-line-strong bg-surface px-4 text-label font-semibold text-accent-ink shadow-overlay"
        >
          <ArrowDownIcon size={16} />
          {unseen.count === 1 ? "1 new message" : `${unseen.count} new messages`}
        </button>
      )}
    </div>
  );
}

function DayDivider({ label }: { label: string }) {
  return (
    <div className="my-4 flex items-center gap-3 text-micro text-ink-3" role="separator" aria-label={label}>
      <span className="h-px flex-1 bg-line" />
      {label}
      <span className="h-px flex-1 bg-line" />
    </div>
  );
}

interface RowProps {
  item: Item;
  continues: boolean;
  endsGroup: boolean;
  me: string | null;
  seats: Seat[];
  seatsById: Map<string, Seat>;
  nameOf: (id: string | null) => string;
  idx: ApprovalIndex;
  state: RoomState;
  lang: "vi" | undefined;
  onRetry: (clientId: string) => void;
  onDiscard: (clientId: string) => void;
  onDecide: (approvalId: string, status: "approved" | "declined") => Promise<void>;
}

const Row = memo(function Row(p: RowProps) {
  const { item, continues, endsGroup, me, seatsById, nameOf, idx, state, lang } = p;
  const msg = item.msg;
  const enterCls = item.enter === "other" ? "animate-enter" : item.enter === "own" ? "animate-enter-own" : "";

  if (msg && msg.kind === "system") {
    return (
      <div className={`mx-auto my-6 max-w-[480px] text-center text-caption text-ink-3 ${enterCls}`} lang={lang}>
        <time dateTime={msg.created_at} title={fullDate(item.ts)}>
          {msg.body}
        </time>
      </div>
    );
  }

  if (msg && msg.kind === "approval_decision") {
    const aid = typeof msg.meta.approval_id === "string" ? msg.meta.approval_id : "";
    const v = deriveApproval(aid, state, idx);
    const status = msg.meta.status === "declined" ? "declined" : "approved";
    const note = typeof msg.meta.note === "string" && msg.meta.note ? msg.meta.note : null;
    const owner = nameOf(v.ownerSeatId ?? msg.seat_id);
    const agent = nameOf(v.agentSeatId);
    return (
      <div className={`mx-auto my-6 max-w-[480px] text-center text-caption text-ink-3 ${enterCls}`}>
        <time dateTime={msg.created_at} title={fullDate(item.ts)}>
          {owner} {status} the request from {agent}.
        </time>{" "}
        {aid && (
          <button type="button" onClick={() => jumpTo(`approval-${aid}`)} className="link min-h-11 cursor-pointer no-underline">
            View request
          </button>
        )}
        {note && <p className="text-ink-2">Note: {note}</p>}
      </div>
    );
  }

  if (msg && msg.kind === "approval_request") {
    const aid = typeof msg.meta.approval_id === "string" ? msg.meta.approval_id : "";
    const v = deriveApproval(aid, state, idx);
    const agentSeat = seatsById.get(v.agentSeatId ?? msg.seat_id ?? "");
    const mine = !!me && v.ownerSeatId === me;
    const ownerSeat = seatsById.get(v.ownerSeatId ?? "");
    return (
      <article
        aria-label={`Approval request, ${hhmm(item.ts)}`}
        className={`my-6 flex gap-2 ${enterCls}`}
      >
        <div className="w-8 shrink-0">
          <Avatar name={agentSeat?.name ?? null} agent />
        </div>
        <div id={`approval-${aid}`} className="min-w-0 flex-1 rounded-md">
          <ApprovalCard
            view={v}
            ts={item.ts}
            agentName={agentSeat?.name ?? "An agent"}
            ownerName={ownerSeat?.name ?? "its owner"}
            mine={mine}
            onDecide={p.onDecide}
            onJump={jumpTo}
          />
        </div>
      </article>
    );
  }

  // chat, result, optimistic
  const own = !!me && item.seat_id === me;
  const sender = item.seat_id ? seatsById.get(item.seat_id) : undefined;
  const isAgent = sender?.kind === "agent";
  const name = sender?.name ?? (isAgent ? "Agent" : "Someone");
  const owner = isAgent && sender?.owner_seat_id ? seatsById.get(sender.owner_seat_id) : undefined;
  const mineAgent = isAgent && owner?.id === me;
  const body = item.pending?.body ?? msg?.body ?? "";
  const failed = item.pending?.status === "failed";
  const isResult = msg?.kind === "result";
  const resultId = isResult && typeof msg?.meta.approval_id === "string" ? msg.meta.approval_id : null;
  const resultView = resultId ? deriveApproval(resultId, state, idx) : null;

  const toId = item.to_seat_id;
  const toMe = !!me && toId === me;
  const toName = toId ? nameOf(toId) : null;

  const showHeader = !own && !continues;
  const corner = own ? (continues ? "rounded-r-xs" : "rounded-tr-xs") : continues ? "rounded-l-xs" : "rounded-tl-xs";
  const bubbleColors = own
    ? `bg-accent-soft ${failed ? "border-danger" : "border-accent-soft-line"}`
    : isAgent
      ? "bg-surface border-line"
      : "bg-sunken border-transparent";
  const label = own ? `You, ${hhmm(item.ts)}` : `${name}${isAgent ? ", agent" : ""}, ${hhmm(item.ts)}`;

  return (
    <article
      aria-label={label}
      className={`group flex gap-2 rounded-md ${continues ? "mt-1" : "mt-4"} ${own ? "justify-end" : ""} ${enterCls}`}
    >
      {!own && <div className="w-8 shrink-0">{!continues && <Avatar name={sender?.name ?? null} agent={isAgent} />}</div>}
      <div className={`flex min-w-0 max-w-[85%] flex-col lg:max-w-[560px] ${own ? "items-end" : "items-start"}`}>
        {showHeader && (
          <div className="mb-1">
            <div className="flex items-center gap-1.5">
              <span className="text-label font-semibold text-ink">{name}</span>
              {isAgent && <AgentTag />}
              <time dateTime={msg?.created_at} title={fullDate(item.ts)} className="text-micro text-ink-3">
                {hhmm(item.ts)}
              </time>
            </div>
            {(isAgent || toId) && (
              <div className="text-caption text-ink-3">
                {isAgent && (mineAgent ? "Your agent" : `${owner?.name ?? "Their"}'s agent`)}
                {isAgent && toId && " · "}
                {toId && (toMe ? <span className="font-semibold text-accent-ink">to you</span> : `to ${toName}`)}
              </div>
            )}
          </div>
        )}
        {own && !continues && toId && <div className="mb-1 text-right text-caption text-ink-3">to {toName}</div>}
        <div className="flex items-center gap-2">
          <div id={resultId ? `result-${resultId}` : undefined} className={`rounded-md border px-3 py-2 text-body lg:text-body-lg ${corner} ${bubbleColors}`}>
            {resultView && (
              <button
                type="button"
                onClick={() => jumpTo(`approval-${resultView.id}`)}
                className="mb-2 flex min-h-11 cursor-pointer items-center gap-1.5 text-left text-caption font-semibold text-accent-ink"
              >
                <CheckIcon size={14} className="shrink-0" />
                <span>Done{resultView.task ? ` · ${truncate(resultView.task, 60)}` : ""}</span>
              </button>
            )}
            <p className="whitespace-pre-wrap [overflow-wrap:anywhere]">
              <Linkified text={body} />
            </p>
          </div>
          {!own && continues && (
            <time className="shrink-0 text-micro text-ink-3 opacity-0 group-hover:opacity-100" dateTime={msg?.created_at}>
              {hhmm(item.ts)}
            </time>
          )}
        </div>
        {own && (endsGroup || failed) && <OwnStatus item={item} onRetry={p.onRetry} onDiscard={p.onDiscard} />}
      </div>
    </article>
  );
});

function OwnStatus({ item, onRetry, onDiscard }: { item: Item; onRetry: (id: string) => void; onDiscard: (id: string) => void }) {
  const p = item.pending;
  const [slow, setSlow] = useState(false);
  const sending = p?.status === "sending";
  useEffect(() => {
    if (!sending) {
      setSlow(false);
      return;
    }
    const t = setTimeout(() => setSlow(true), 600);
    return () => clearTimeout(t);
  }, [sending]);

  if (p?.status === "failed") {
    return (
      <div className="mt-1 flex flex-wrap items-center justify-end gap-x-2 text-micro text-danger">
        <span className="inline-flex items-center gap-1">
          <AlertCircleIcon size={14} />
          {p.error === "RATE_LIMITED" ? "Not sent. Too many messages, wait a moment." : "Not sent."}
        </span>
        <button type="button" className="btn-text text-accent-ink" onClick={() => onRetry(p.clientId)}>
          Retry
        </button>
        <button type="button" className="btn-text text-ink-2" onClick={() => onDiscard(p.clientId)}>
          Discard
        </button>
      </div>
    );
  }
  return (
    <div className="mt-1 text-right text-micro text-ink-3">
      {sending ? (slow ? "Sending…" : " ") : <time dateTime={item.msg?.created_at}>{hhmm(item.ts)}</time>}
    </div>
  );
}
