import { useEffect, useId, useMemo, useRef, useState } from "react";
import { ApiError, api } from "../api";
import { installCommand, parseConnectPrompt } from "../lib/prompt";
import { isOnline, lastSeenText } from "../lib/presence";
import { getItem, keys, setItem } from "../storage";
import type { Seat } from "../types";
import { Button } from "./Button";
import { ConfirmDialog } from "./ConfirmDialog";
import { CopyButton } from "./CopyButton";
import { ChevronDownIcon } from "./Icons";
import { Tabs } from "./Tabs";
import { useToast } from "./Toast";
import { AgentTag, Avatar, PresenceDot } from "./ui";

export interface PanelProps {
  roomId: string;
  token: string;
  seats: Seat[];
  meSeatId: string;
  now: number;
  /** invite link kept on this device, null when not available */
  inviteUrl: string | null;
  /** connect prompt held in this tab, null when it can't be shown */
  prompt: string | null;
  onPrompt: (p: string) => void;
  /** bump to expand the connect card and focus its heading */
  connectSignal: number;
  inviteSignal: number;
}

function ownerName(seats: Seat[], agent: Seat): string | null {
  return seats.find((s) => s.id === agent.owner_seat_id)?.name ?? null;
}

export function Panel(p: PanelProps) {
  const me = p.seats.find((s) => s.id === p.meSeatId);
  const myAgent = p.seats.find((s) => s.kind === "agent" && s.owner_seat_id === p.meSeatId);
  const otherHuman = p.seats.find((s) => s.kind === "human" && s.id !== p.meSeatId);
  const otherAgent = p.seats.find((s) => s.kind === "agent" && s.id !== myAgent?.id);
  const showInvite = me?.kind === "human" && me.slot === 1 && otherHuman && !otherHuman.claimed;

  return (
    <div className="flex flex-col gap-3 pt-1">
      <PeopleCard {...p} me={me} myAgent={myAgent} otherHuman={otherHuman} otherAgent={otherAgent} />
      {showInvite && <InviteCard url={p.inviteUrl} signal={p.inviteSignal} />}
      {myAgent && <ConnectCard {...p} agent={myAgent} />}
      <section className="card text-small text-ink-2">
        <h2 className="text-label font-semibold text-ink">How approvals work</h2>
        <p className="mt-2">
          Before doing work beyond chatting, an agent is asked to post an approval request here and wait for its owner. This is a
          convention, not a lock: Snapwork can't stop an agent on your own computer from acting without approval. Only you can approve
          your agent's requests.
        </p>
      </section>
    </div>
  );
}

function PeopleCard({
  seats,
  now,
  me,
  myAgent,
  otherHuman,
  otherAgent,
}: PanelProps & { me?: Seat; myAgent?: Seat; otherHuman?: Seat; otherAgent?: Seat }) {
  const rows: { seat: Seat; mine: boolean }[] = [];
  if (me) rows.push({ seat: me, mine: true });
  if (myAgent) rows.push({ seat: myAgent, mine: true });
  if (otherHuman) rows.push({ seat: otherHuman, mine: false });
  if (otherAgent) rows.push({ seat: otherAgent, mine: false });
  return (
    <section className="card">
      <h2 className="text-title font-semibold">People</h2>
      <ul className="mt-2">
        {rows.map(({ seat, mine }) => (
          <PersonRow key={seat.id} seat={seat} mine={mine} seats={seats} now={now} isMe={seat.id === me?.id} />
        ))}
      </ul>
    </section>
  );
}

function PersonRow({ seat, mine, seats, now, isMe }: { seat: Seat; mine: boolean; seats: Seat[]; now: number; isMe: boolean }) {
  const isAgent = seat.kind === "agent";
  const owner = isAgent ? seats.find((s) => s.id === seat.owner_seat_id) : undefined;
  const waiting = isAgent ? !owner?.claimed : !seat.claimed;
  const online = isMe || isOnline(seat.last_seen_at, now);
  const seen = lastSeenText(seat.last_seen_at, now);
  const ownerLabel = mine ? "Your agent" : `${ownerName(seats, seat) ?? "Their"}${ownerName(seats, seat) ? "'s agent" : " agent"}`;

  let name: string;
  let sub: string;
  let dot: "online" | "offline" | "hollow";
  if (waiting) {
    name = isAgent ? "Their agent" : "Invited person";
    sub = "Waiting for invite";
    dot = "hollow";
  } else {
    name = seat.name ?? (isAgent ? (mine ? "Your agent" : "Their agent") : "Someone");
    if (online) {
      sub = isAgent ? `Online · ${ownerLabel}` : "Online";
      dot = "online";
    } else if (seen) {
      sub = isAgent ? `${seen} · ${ownerLabel}` : seen;
      dot = "offline";
    } else {
      sub = isAgent ? "Not connected yet" : "Not seen yet";
      dot = "hollow";
    }
  }
  const stale = mine && isAgent && !waiting && !online && !!seen && now - Date.parse(seat.last_seen_at ?? "") > 120_000;
  return (
    <li className="min-h-14 py-2">
      <div className="flex items-center gap-3">
        <Avatar name={waiting ? null : name} agent={isAgent} />
        <div className="min-w-0">
          <div className={`flex items-center gap-1.5 text-label font-semibold ${waiting ? "text-ink-3" : "text-ink"}`}>
            <span className="truncate">{name}</span>
            {isMe && <span className="font-normal text-ink-3">(you)</span>}
            {isAgent && !waiting && <AgentTag />}
          </div>
          <div className="flex items-center gap-1.5 text-caption text-ink-3">
            <PresenceDot state={dot} />
            <span>{sub}</span>
          </div>
        </div>
      </div>
      {stale && (
        <div className="ml-11 mt-1 text-caption text-ink-2">
          <p>If your agent stopped, tell it: keep listening in the Snapwork room.</p>
          <CopyButton text="keep listening in the Snapwork room" label="Copy" variant="ghost" />
        </div>
      )}
    </li>
  );
}

/** Focus the heading after the container had time to open (sheet animation, dialog). */
function useHeadingFocus<T extends HTMLElement>(signal: number) {
  const ref = useRef<T>(null);
  useEffect(() => {
    if (signal <= 0) return;
    const t = setTimeout(() => ref.current?.focus(), 80);
    return () => clearTimeout(t);
  }, [signal]);
  return ref;
}

function InviteCard({ url, signal }: { url: string | null; signal: number }) {
  const heading = useHeadingFocus<HTMLHeadingElement>(signal);
  const codeRef = useRef<HTMLDivElement>(null);
  return (
    <section className="card" id="invite-card">
      <h2 ref={heading} tabIndex={-1} className="text-title font-semibold outline-none">
        Invite someone
      </h2>
      {url ? (
        <>
          <p className="mt-2 text-small text-ink-2">This link works once. Send it to the person you want in the room.</p>
          <div ref={codeRef} className="code-block mt-3">
            {url}
          </div>
          <CopyButton text={url} label="Copy link" variant="primary" className="mt-3 w-full" selectRef={codeRef} />
        </>
      ) : (
        <p className="mt-2 text-small text-ink-2">The invite link was shown when you created the room and can't be shown again here.</p>
      )}
    </section>
  );
}

type TabId = "code" | "desktop" | "other";
const TABS: { id: TabId; label: string }[] = [
  { id: "code", label: "Claude Code" },
  { id: "desktop", label: "Claude Desktop and ChatGPT" },
  { id: "other", label: "Other MCP" },
];

function ConnectCard({ roomId, token, agent, now, prompt, onPrompt, connectSignal }: PanelProps & { agent: Seat }) {
  const { toast } = useToast();
  const online = isOnline(agent.last_seen_at, now);
  const [open, setOpen] = useState(!online);
  const [tab, setTab] = useState<TabId>(() => {
    const t = getItem("local", keys.tab);
    return TABS.some((x) => x.id === t) ? (t as TabId) : "code";
  });
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const heading = useHeadingFocus<HTMLButtonElement>(connectSignal);
  const urlRef = useRef<HTMLDivElement>(null);
  const promptRef = useRef<HTMLPreElement>(null);
  const bodyId = useId();
  const parsed = useMemo(() => (prompt ? parseConnectPrompt(prompt) : null), [prompt]);

  // A new signal (after create, claim or regenerate) expands the card.
  useEffect(() => {
    if (connectSignal > 0) setOpen(true);
  }, [connectSignal]);

  async function regenerate() {
    setBusy(true);
    setErr(null);
    try {
      const r = await api.rotateToken(token, agent.id);
      setItem("session", keys.prompt(roomId), r.connect_prompt);
      onPrompt(r.connect_prompt);
      setConfirm(false);
      toast("New connect prompt ready. The old one no longer works.");
      setOpen(true);
      setTimeout(() => heading.current?.focus(), 0);
    } catch (e) {
      setErr("Couldn't regenerate. Check your connection and try again.");
      if (e instanceof ApiError && e.status === 401) setErr("You can't regenerate this prompt from this device.");
    } finally {
      setBusy(false);
    }
  }

  const chooseTab = (id: string) => {
    setTab(id as TabId);
    setItem("local", keys.tab, id);
  };

  const regenButton = (variant: "ghost" | "secondary", full: boolean) => (
    <Button variant={variant} className={full ? "w-full" : ""} onClick={() => setConfirm(true)}>
      Regenerate connect prompt
    </Button>
  );

  return (
    <section className="card" id="connect-card">
      <h2 className="text-title font-semibold">
        <button
          ref={heading}
          type="button"
          className="-m-4 flex min-h-11 w-[calc(100%+32px)] cursor-pointer items-center justify-between gap-2 rounded-md p-4 text-left text-title font-semibold"
          aria-expanded={open}
          aria-controls={bodyId}
          onClick={() => setOpen((o) => !o)}
        >
          <span className="min-w-0">
            <span className="block">Connect your agent</span>
            {!open && online && (
              <span className="mt-0.5 flex items-center gap-1.5 text-caption font-normal text-ink-3">
                <PresenceDot state="online" />
                Connected as {agent.name ?? "your agent"}
              </span>
            )}
          </span>
          <ChevronDownIcon size={16} className={`chev shrink-0 text-ink-2 ${open ? "rotate-180" : ""}`} />
        </button>
      </h2>
      <div id={bodyId} hidden={!open} className="mt-6">
        {parsed ? (
          <>
            <p className="mb-4 rounded-sm border border-warning-soft-line bg-warning-soft p-3 text-small text-warning-ink">
              Shown once. This contains your agent's secret token. Copy it now; after you leave this page it can't be shown again.
            </p>
            <Tabs tabs={TABS} value={tab} onChange={chooseTab} idBase="connect">
              {parsed.url ? (
                tab === "code" ? (
                  <Step title="1. Run once in your terminal" text={null} code={installCommand(parsed.url)} label="Copy command" codeRef={urlRef} />
                ) : (
                  <Step
                    title={tab === "desktop" ? "1. Add a custom connector" : "1. Add an MCP server"}
                    text={
                      tab === "desktop"
                        ? "In settings, add a custom connector or MCP server with this URL."
                        : "Use Streamable HTTP with this URL."
                    }
                    code={parsed.url}
                    label="Copy URL"
                    codeRef={urlRef}
                  />
                )
              ) : (
                <p className="text-small text-ink-2">Use the prompt below. It includes the connection details.</p>
              )}
              <h3 className="mt-5 text-label font-semibold">2. Paste this into your agent</h3>
              <pre ref={promptRef} className="code-block mt-2 max-h-[200px] overflow-y-auto whitespace-pre-wrap">
                {parsed.paste}
              </pre>
              <CopyButton text={parsed.paste} label="Copy prompt" variant="primary" className="mt-3 w-full" selectRef={promptRef} />
            </Tabs>
            <div className="mt-4">{regenButton("ghost", false)}</div>
          </>
        ) : (
          <>
            <p className="text-small text-ink-2">
              Your connect prompt was shown once and can't be shown again. If your agent isn't connected, regenerate it.
            </p>
            <div className="mt-3">{regenButton("secondary", true)}</div>
          </>
        )}
      </div>
      <ConfirmDialog
        open={confirm}
        title="Regenerate connect prompt?"
        body="Your agent's current connection stops working right away. You will need to run the new install line and paste the new prompt into your agent."
        confirmLabel="Regenerate"
        loadingLabel="Regenerating…"
        busy={busy}
        error={err}
        onCancel={() => {
          setConfirm(false);
          setErr(null);
        }}
        onConfirm={regenerate}
      />
    </section>
  );
}

function Step({
  title,
  text,
  code,
  label,
  codeRef,
}: {
  title: string;
  text: string | null;
  code: string;
  label: string;
  codeRef: React.RefObject<HTMLDivElement>;
}) {
  return (
    <div>
      <h3 className="text-label font-semibold">{title}</h3>
      {text && <p className="mt-1 text-small text-ink-2">{text}</p>}
      <div ref={codeRef} className="code-block mt-2">
        {code}
      </div>
      <CopyButton text={code} label={label} className="mt-2" selectRef={codeRef} />
    </div>
  );
}
