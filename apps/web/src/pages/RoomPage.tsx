import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { useLocation, useParams } from "react-router-dom";
import { ApiError, api } from "../api";
import { Button } from "../components/Button";
import { Composer, type Recipient } from "../components/Composer";
import { CopyButton } from "../components/CopyButton";
import { AlertCircleIcon, RefreshIcon, UsersIcon, XIcon } from "../components/Icons";
import { Panel } from "../components/Panel";
import { Sheet } from "../components/Sheet";
import { Timeline } from "../components/Timeline";
import { ToastProvider, useToast } from "../components/Toast";
import { announceText, createThrottle } from "../lib/announce";
import { uuid, useMedia, useNow } from "../lib/hooks";
import { isOnline } from "../lib/presence";
import { resolveToken, type ResolvedToken } from "../lib/token";
import { connectStream, type StreamStatus } from "../sse";
import {
  deriveApproval,
  indexApprovalMessages,
  initialState,
  roomReducer,
  type Pending,
} from "../state/roomReducer";
import { BANNER_DISMISSED, BANNER_SHOW, getItem, keys, removeItem, setItem } from "../storage";
import type { Approval, Msg } from "../types";
import { ErrorPage } from "./ErrorPage";

const resolved = new Map<string, ResolvedToken>();

/** Read the owner token once per room: from the URL fragment, else from storage. Then remove the fragment. */
function resolveForRoom(roomId: string): ResolvedToken {
  const cached = resolved.get(roomId);
  if (cached) return cached;
  const r = resolveToken(keys.token(roomId), window.location.hash, {
    get: (k) => getItem("local", k),
    set: (k, v) => setItem("local", k, v),
  });
  if (r.needsVerify) {
    // Decided later, once the server has said whether the fragment token is valid (see RoomPage).
    resolved.set(roomId, r);
    return r;
  }
  if (r.fromFragment && r.persisted) {
    // Keep history.state so the router's own state survives.
    window.history.replaceState(window.history.state, "", window.location.pathname + window.location.search);
  }
  if (r.firstOnDevice && r.persisted && getItem("local", keys.banner(roomId)) === null) {
    setItem("local", keys.banner(roomId), BANNER_SHOW);
  }
  if (r.token) resolved.set(roomId, r);
  return r;
}

function stripFragment() {
  window.history.replaceState(window.history.state, "", window.location.pathname + window.location.search);
}

export function RoomPage() {
  const { roomId = "" } = useParams();
  const location = useLocation();
  const r = useMemo(() => resolveForRoom(roomId), [roomId]);
  const panel = (location.state as { panel?: string } | null)?.panel;
  // When a link carries a different token than the one stored, ask the server first. Keep the stored token
  // if the link's token is refused, so a bad link cannot lock you out.
  const [token, setToken] = useState<string | null | "checking">(r.needsVerify ? "checking" : r.token);
  const [startNotice, setStartNotice] = useState<string | null>(null);
  useEffect(() => {
    if (!r.needsVerify || !r.token) return;
    const ctrl = new AbortController();
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      ctrl.abort();
    }, 10_000);
    const check = (t: string) => api.getRoom(roomId, t, ctrl.signal).then(() => true as const);
    const isAuth = (e: unknown) => e instanceof ApiError && (e.status === 401 || e.status === 403 || e.status === 404);
    Promise.allSettled([check(r.token), r.fallback ? check(r.fallback) : Promise.reject(new Error("none"))]).then(([cand, stored]) => {
      clearTimeout(timer);
      if (ctrl.signal.aborted && !timedOut) return; // unmounted
      // Rule: a stored key that still works is never replaced by a link. The other person in the room
      // can send a link with their own valid key, and taking it would put you in their seat.
      if (stored.status === "fulfilled") {
        stripFragment();
        if (cand.status === "fulfilled") {
          setStartNotice("A link tried to open this room with a different key. Your own key was kept.");
        }
        setToken(r.fallback ?? null);
        return;
      }
      if (cand.status === "fulfilled") {
        // The stored key no longer works (or there was none) and the link's key does: take it.
        setItem("local", keys.token(roomId), r.token!);
        if (getItem("local", keys.banner(roomId)) === null) setItem("local", keys.banner(roomId), BANNER_SHOW);
        stripFragment();
        setToken(r.token);
        return;
      }
      // Neither worked. Drop the link's key only if the server clearly refused it; on network trouble keep the URL so a reload retries.
      if (isAuth(cand.reason)) stripFragment();
      setToken(r.fallback ?? null);
    });
    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
  }, [r, roomId]);
  if (token === "checking") return <div className="p-6 text-small text-ink-2" role="status">Opening your room...</div>;
  if (!token) return <ErrorPage kind="no-key" />;
  return (
    <ToastProvider bottom="calc(var(--composer-h, 96px) + 16px)">
      <RoomView key={roomId} roomId={roomId} token={token} openConnect={panel === "connect"} startNotice={startNotice} />
    </ToastProvider>
  );
}

type Load = "loading" | "ready" | "error" | "denied" | "notfound" | "gone";
type Notice = "none" | "reconnecting" | "offline";

const isSlash = (s: string) => /^\/(approve|decline)(\s|$)/i.test(s.trim());

function RoomView({ roomId, token, openConnect, startNotice }: { roomId: string; token: string; openConnect: boolean; startNotice: string | null }) {
  const { toast, announce } = useToast();
  useEffect(() => {
    if (startNotice) toast(startNotice);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startNotice]);
  const [state, dispatch] = useReducer(roomReducer, initialState);
  const stateRef = useRef(state);
  stateRef.current = state;
  const [load, setLoad] = useState<Load>("loading");
  const [slow, setSlow] = useState(false);
  const [conn, setConn] = useState<StreamStatus>("connecting");
  const [online, setOnline] = useState(() => navigator.onLine);
  const [notice, setNotice] = useState<Notice>("none");
  const streamRef = useRef<ReturnType<typeof connectStream> | null>(null);
  const isDesktop = useMedia("(min-width: 1024px)");
  const [panelOpen, setPanelOpen] = useState(openConnect);
  const [connectSignal, setConnectSignal] = useState(openConnect ? 1 : 0);
  const [inviteSignal, setInviteSignal] = useState(0);
  const [prompt, setPrompt] = useState(() => getItem("session", keys.prompt(roomId)));
  const [mcpUrl, setMcpUrl] = useState(() => getItem("session", keys.mcpUrl(roomId)));
  const [inviteUrl, setInviteUrl] = useState(() => getItem("local", keys.invite(roomId)));
  const [banner, setBanner] = useState(() => getItem("local", keys.banner(roomId)) === BANNER_SHOW);
  const [sendSignal, setSendSignal] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const tick = useNow(15_000);
  const clock = Math.max(now, tick);
  const replayUntil = useRef(0);
  const prevClaimed = useRef<boolean | undefined>(undefined);
  const composerWrap = useRef<HTMLDivElement>(null);
  const peopleBtn = useRef<HTMLButtonElement>(null);

  // ---- loading ----
  const applySnapshot = useCallback(async () => {
    const snap = await api.getRoom(roomId, token);
    dispatch({ type: "snapshot", snap });
    setNow(Date.now());
  }, [roomId, token]);

  const loadAll = useCallback(async () => {
    setLoad("loading");
    try {
      const [snap, hist] = await Promise.all([api.getRoom(roomId, token), api.getMessages(roomId, token)]);
      dispatch({ type: "snapshot", snap });
      dispatch({ type: "history", messages: hist.messages });
      setNow(Date.now());
      setLoad("ready");
    } catch (e) {
      if (e instanceof ApiError && (e.status === 401 || e.status === 403)) setLoad("denied");
      else if (e instanceof ApiError && e.status === 404) setLoad("notfound");
      else if (e instanceof ApiError && e.status === 410) setLoad("gone");
      else setLoad("error");
    }
  }, [roomId, token]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  useEffect(() => {
    if (load !== "loading") return setSlow(false);
    const t = setTimeout(() => setSlow(true), 300);
    return () => clearTimeout(t);
  }, [load]);

  const lastIdRef = useRef(0);
  lastIdRef.current = state.confirmed.at(-1)?.id ?? 0;

  /** Refetch the snapshot and everything after our last message id. Used on (re)connect. */
  const catchUp = useCallback(async () => {
    try {
      await applySnapshot();
      let after = lastIdRef.current;
      for (let i = 0; i < 5; i++) {
        const page = await api.getMessages(roomId, token, after || undefined);
        dispatch({ type: "messages", messages: page.messages, live: false });
        if (page.messages.length < 200 || page.last_id <= after) break;
        after = page.last_id;
      }
    } catch (e) {
      if (e instanceof ApiError && (e.status === 401 || e.status === 403)) setLoad("denied");
    }
  }, [applySnapshot, roomId, token]);

  // ---- stream ----
  useEffect(() => {
    if (load !== "ready") return;
    const say = createThrottle(announce);
    let refreshTimer: ReturnType<typeof setTimeout> | undefined;
    const refresh = () => {
      clearTimeout(refreshTimer);
      refreshTimer = setTimeout(() => void applySnapshot().catch(() => {}), 400);
    };
    const stream = connectStream({
      url: api.streamUrl(roomId),
      token,
      getLastId: () => lastIdRef.current,
      onStatus: (s) => {
        setConn(s);
        if (s === "live") {
          replayUntil.current = Date.now() + 1500;
          void catchUp();
        }
      },
      onFatal: (status) => setLoad(status === 404 ? "notfound" : status === 410 ? "gone" : "denied"),
      onFrame: (f) => {
        let data: unknown;
        try {
          data = JSON.parse(f.data);
        } catch {
          return;
        }
        if (f.event === "message") {
          const m = data as Msg;
          if (typeof m?.id !== "number" || typeof m.body !== "string") return;
          const live = Date.now() > replayUntil.current;
          const st = stateRef.current;
          const known = st.confirmed.some((x) => x.id === m.id);
          dispatch({ type: "messages", messages: [m], live });
          if (known) return;
          if (live && st.me && m.seat_id !== st.me.seat_id) say.push(announceText(m, st.seats, st.me.seat_id));
          if (m.kind === "system" || (st.room?.paused && m.seat_id !== null)) refresh();
        } else if (f.event === "seat") {
          refresh();
        } else if (f.event === "approval") {
          const a = data as Approval;
          if (a && typeof a.id === "string") dispatch({ type: "approval", approval: a });
        }
      },
    });
    streamRef.current = stream;
    return () => {
      stream.close();
      say.stop();
      clearTimeout(refreshTimer);
      streamRef.current = null;
    };
  }, [load, roomId, token, announce, applySnapshot, catchUp]);

  // ---- connection notice ----
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);
  useEffect(() => {
    if (conn === "live" || conn === "connecting") return setNotice("none");
    if (!online) return setNotice("offline");
    const t1 = setTimeout(() => setNotice("reconnecting"), 2000);
    const t2 = setTimeout(() => setNotice("offline"), 30_000);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [conn, online]);

  // ---- derived ----
  const { room, seats, me } = state;
  const meSeat = seats.find((s) => s.id === me?.seat_id);
  const myAgent = seats.find((s) => s.kind === "agent" && s.owner_seat_id === me?.seat_id);
  const otherHuman = seats.find((s) => s.kind === "human" && s.id !== me?.seat_id);
  const otherAgent = seats.find((s) => s.kind === "agent" && s.id !== myAgent?.id);

  const recipients = useMemo<Recipient[]>(() => {
    const out: Recipient[] = [];
    const nameOfSeat = (id: string | null) => seats.find((s) => s.id === id)?.name ?? "their";
    if (otherHuman?.claimed && otherHuman.name) out.push({ id: otherHuman.id, label: otherHuman.name });
    if (myAgent?.claimed && myAgent.name) out.push({ id: myAgent.id, label: `${myAgent.name} (your agent)` });
    if (otherAgent?.claimed && otherAgent.name)
      out.push({ id: otherAgent.id, label: `${otherAgent.name} (${nameOfSeat(otherAgent.owner_seat_id)}'s agent)` });
    return out;
  }, [seats, otherHuman, myAgent, otherAgent]);

  const idx = useMemo(() => indexApprovalMessages(state.confirmed), [state.confirmed]);
  const needsDecision = useMemo(
    () =>
      state.confirmed.some(
        (m) =>
          m.kind === "approval_request" &&
          typeof m.meta.approval_id === "string" &&
          (() => {
            const v = deriveApproval(m.meta.approval_id as string, state, idx);
            return v.status === "pending" && v.ownerSeatId === me?.seat_id;
          })(),
      ),
    [state, idx, me?.seat_id],
  );
  const needsAttention =
    needsDecision ||
    (meSeat?.slot === 1 && !!otherHuman && !otherHuman.claimed) ||
    (!!myAgent && !isOnline(myAgent.last_seen_at, clock) && !myAgent.last_seen_at);

  // Invite card bookkeeping: drop the stored link once the second person claimed.
  useEffect(() => {
    if (!otherHuman) return;
    const claimed = otherHuman.claimed;
    if (claimed) {
      removeItem("local", keys.invite(roomId));
      setInviteUrl(null);
      if (prevClaimed.current === false) toast(`${otherHuman.name ?? "Someone"} joined.`);
    }
    prevClaimed.current = claimed;
  }, [otherHuman, roomId, toast]);

  useEffect(() => {
    if (room) document.title = `${room.name} · Snapwork`;
  }, [room]);

  // Composer height drives the toast offset.
  useEffect(() => {
    const el = composerWrap.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => document.documentElement.style.setProperty("--composer-h", `${el.offsetHeight}px`));
    ro.observe(el);
    return () => {
      ro.disconnect();
      document.documentElement.style.removeProperty("--composer-h");
    };
  }, [load]);

  // ---- actions ----
  const post = useCallback(
    (p: Pending) => {
      api
        .postMessage(roomId, token, p.body, p.to_seat_id ?? undefined)
        .then((r) => dispatch({ type: "sent", clientId: p.clientId, id: r.id }))
        .catch((e) => {
          const code = e instanceof ApiError ? (e.isNetwork ? "NETWORK" : e.code) : "NETWORK";
          dispatch({ type: "failed", clientId: p.clientId, error: code });
          if (code === "ROOM_READONLY") void applySnapshot().catch(() => {});
        });
    },
    [roomId, token, applySnapshot],
  );

  const send = useCallback(
    (body: string, to: string | null) => {
      const meNow = stateRef.current.me;
      if (!meNow) return;
      if (isSlash(body)) {
        // A command runs on the server; its result arrives over the stream. No optimistic bubble.
        api.postMessage(roomId, token, body).catch(() => toast("Couldn't send the command. Try again.", "error"));
        return;
      }
      const p: Pending = {
        clientId: uuid(),
        body,
        to_seat_id: to,
        seat_id: meNow.seat_id,
        status: "sending",
        error: null,
        createdAt: Date.now(),
      };
      dispatch({ type: "pendingAdd", pending: p });
      setSendSignal((n) => n + 1);
      post(p);
    },
    [roomId, token, post, toast],
  );

  const retry = useCallback(
    (clientId: string) => {
      const p = stateRef.current.pending.find((x) => x.clientId === clientId);
      if (!p) return;
      dispatch({ type: "retry", clientId });
      post({ ...p, status: "sending", error: null });
    },
    [post],
  );
  const discard = useCallback((clientId: string) => dispatch({ type: "discard", clientId }), []);

  const decide = useCallback(
    async (id: string, status: "approved" | "declined") => {
      try {
        await api.decide(token, id, status);
        const existing = stateRef.current.approvals[id];
        if (existing) dispatch({ type: "approval", approval: { ...existing, status, decided_at: new Date().toISOString() } });
      } catch (e) {
        if (e instanceof ApiError && e.status === 409) void catchUp();
        else toast("Couldn't save your decision. Try again.", "error");
        throw e;
      }
    },
    [token, toast, catchUp],
  );

  const openPanel = (which?: "invite" | "connect") => {
    setPanelOpen(true);
    if (which === "invite") setInviteSignal((n) => n + 1);
    if (which === "connect") setConnectSignal((n) => n + 1);
  };

  // ---- render ----
  if (load === "denied") return <ErrorPage kind="no-access" />;
  if (load === "notfound") return <ErrorPage kind="not-found" />;
  if (load === "gone") return <ErrorPage kind="room-gone" />;

  const header = (
    <header className="flex h-14 shrink-0 items-center gap-3 border-b border-line bg-surface px-4 lg:px-6">
      <span className="hidden text-label font-semibold text-ink-2 lg:inline">Snapwork</span>
      <span className="hidden h-5 w-px bg-line lg:inline" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <h1 className="truncate text-header font-semibold text-ink">{room?.name ?? " "}</h1>
        {notice !== "none" && (
          <p className="truncate text-caption text-warning-ink lg:hidden">
            {notice === "offline" ? "You're offline." : "Reconnecting…"}
          </p>
        )}
      </div>
      <button
        ref={peopleBtn}
        type="button"
        className="btn btn-secondary relative lg:hidden"
        aria-label={needsAttention ? "People, needs attention" : "People"}
        onClick={() => openPanel()}
      >
        <UsersIcon />
        People
        {needsAttention && (
          <span className="absolute -right-1 -top-1 size-2.5 rounded-full border-2 border-surface bg-accent" aria-hidden="true" />
        )}
      </button>
    </header>
  );

  let body: React.ReactNode;
  if (load === "error") {
    body = (
      <div className="flex flex-1 flex-col items-center justify-center gap-2 px-4 text-center">
        <AlertCircleIcon size={24} className="text-danger" />
        <p className="text-label font-semibold">Couldn't load this room.</p>
        <p className="text-small text-ink-2">Check your connection.</p>
        <Button onClick={() => void loadAll()}>Try again</Button>
      </div>
    );
  } else if (load === "loading") {
    body = slow ? <Skeleton /> : <div className="flex-1" />;
  } else {
    const creatorWaiting = meSeat?.slot === 1 && !!otherHuman && !otherHuman.claimed;
    body = (
      <>
        <Timeline
          state={state}
          sendSignal={sendSignal}
          onRetry={retry}
          onDiscard={discard}
          onDecide={decide}
          emptyHint={
            <>
              <p className="text-label font-semibold text-ink">No messages yet</p>
              <p className="mt-1">
                {creatorWaiting
                  ? "Invite the other person and connect your agent. Your agent will say hello when it joins."
                  : "Connect your agent. It will say hello when it joins."}
              </p>
              <div className="mt-4 flex flex-col gap-2 lg:hidden">
                {creatorWaiting && (
                  <Button onClick={() => openPanel("invite")}>Invite</Button>
                )}
                <Button onClick={() => openPanel("connect")}>Connect your agent</Button>
              </div>
            </>
          }
        />
        <div ref={composerWrap}>
          <Composer recipients={recipients} paused={!!room?.paused} readOnly={room?.status === "readonly"} onSend={send} />
        </div>
      </>
    );
  }

  const panel =
    me && load === "ready" ? (
      <Panel
        roomId={roomId}
        token={token}
        seats={seats}
        meSeatId={me.seat_id}
        now={clock}
        inviteUrl={inviteUrl}
        prompt={prompt}
        mcpUrl={mcpUrl}
        onPrompt={(p, u) => {
          setPrompt(p);
          setMcpUrl(u);
        }}
        connectSignal={connectSignal}
        inviteSignal={inviteSignal}
      />
    ) : null;

  return (
    <div className="flex h-dvh flex-col bg-surface text-ink">
      <button
        type="button"
        className="sr-only z-50 focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:flex focus:h-11 focus:items-center focus:rounded-sm focus:bg-accent focus:px-4 focus:text-label focus:font-semibold focus:text-on-accent"
        onClick={() => document.getElementById("message-box")?.focus()}
      >
        Skip to message box
      </button>
      {header}
      <div className="flex min-h-0 flex-1">
        <main className="relative flex min-w-0 flex-1 flex-col">
          {banner && load === "ready" && (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-accent-soft-line bg-accent-soft px-4 py-3 text-small text-ink">
              <p className="min-w-0 flex-1 basis-60">Bookmark this link. It is the only way back into your seat.</p>
              <div className="flex items-center gap-1">
                <CopyButton text={`${window.location.origin}/r/${roomId}#${token}`} label="Copy link" />
                <Button
                  variant="ghost"
                  icon
                  aria-label="Dismiss"
                  onClick={() => {
                    setItem("local", keys.banner(roomId), BANNER_DISMISSED);
                    setBanner(false);
                  }}
                >
                  <XIcon />
                </Button>
              </div>
            </div>
          )}
          <div className="relative flex min-h-0 flex-1 flex-col">
          {notice !== "none" && (
            <div
              role="status"
              className="absolute inset-x-0 top-0 z-10 flex h-9 items-center justify-center gap-2 border-b border-warning-soft-line bg-warning-soft px-4 text-caption text-warning-ink"
            >
              <RefreshIcon size={16} />
              {notice === "offline" ? "You're offline. Messages will load when you're back." : "Reconnecting…"}
              {notice === "offline" && (
                <button type="button" className="btn-text text-warning-ink" onClick={() => streamRef.current?.retryNow()}>
                  Retry now
                </button>
              )}
            </div>
          )}
          {body}
          </div>
        </main>
        {isDesktop && (
          <aside aria-label="Room details" className="w-[360px] shrink-0 overflow-y-auto border-l border-line bg-canvas p-4">
            {panel}
          </aside>
        )}
      </div>
      {!isDesktop && (
        <Sheet
          open={panelOpen}
          onClose={() => {
            setPanelOpen(false);
            peopleBtn.current?.focus();
          }}
        >
          {panel}
        </Sheet>
      )}
    </div>
  );
}

function Skeleton() {
  const rows: [string, string, string][] = [
    ["h-10", "w-[60%]", "self-start"],
    ["h-14", "w-[45%]", "self-end"],
    ["h-10", "w-[70%]", "self-start"],
    ["h-[72px]", "w-[50%]", "self-end"],
    ["h-10", "w-[40%]", "self-start"],
  ];
  return (
    <div className="flex flex-1 flex-col gap-4 px-4 py-4" aria-hidden="true">
      {rows.map(([h, w, s], i) => (
        <div key={i} className={`rounded-md bg-sunken ${h} ${w} ${s}`} />
      ))}
    </div>
  );
}
