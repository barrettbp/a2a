import { useId, useState } from "react";
import { hhmm } from "../lib/time";
import type { ApprovalView } from "../state/roomReducer";
import type { ApprovalStatus } from "../types";
import { Button } from "./Button";
import { ChevronDownIcon } from "./Icons";
import { Linkified } from "./Linkified";
import { StatusPill } from "./ui";

interface Props {
  view: ApprovalView;
  ts: number;
  agentName: string;
  ownerName: string;
  /** I am the owner of the requesting agent */
  mine: boolean;
  /** resolves when the server accepted the decision, rejects on failure */
  onDecide: (id: string, status: "approved" | "declined") => Promise<void>;
  onJump: (domId: string) => void;
}

export function ApprovalCard({ view, ts, agentName, ownerName, mine, onDecide, onJump }: Props) {
  const [optimistic, setOptimistic] = useState<"approved" | "declined" | null>(null);
  const [plan, setPlan] = useState<boolean | null>(null);
  const taskId = useId();
  const planId = useId();

  const status: ApprovalStatus = optimistic ?? view.status;
  const needsMe = mine && status === "pending";
  const planOpen = plan ?? (mine && view.status === "pending");
  const decidedAt = view.decidedAt ? Date.parse(view.decidedAt) : null;
  const who = mine ? "you" : ownerName;

  async function decide(s: "approved" | "declined") {
    setOptimistic(s);
    try {
      await onDecide(view.id, s);
    } catch {
      /* the parent shows the toast; revert */
    } finally {
      setOptimistic(null);
    }
  }

  return (
    <div
      className={`w-full max-w-[600px] rounded-md ${
        needsMe ? "border-2 border-accent p-[15px]" : "border border-line-strong p-4"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-label font-semibold text-ink-2">Approval request</span>
        <StatusPill status={status} />
      </div>
      <p className="mt-1 text-caption text-ink-3">
        {agentName} asks {mine ? "you" : ownerName} · {hhmm(ts)}
      </p>
      <p id={taskId} className="mb-1 mt-2 whitespace-pre-wrap text-body font-medium text-ink [overflow-wrap:anywhere] lg:text-body-lg">
        <Linkified text={view.task} />
      </p>
      {view.plan ? (
        <div>
          <Button
            variant="ghost"
            className="-ml-4"
            aria-expanded={planOpen}
            aria-controls={planId}
            onClick={() => setPlan(!planOpen)}
          >
            {planOpen ? "Hide plan" : "Show plan"}
            <ChevronDownIcon size={16} className={`chev ${planOpen ? "rotate-180" : ""}`} />
          </Button>
          <div id={planId} className="plan-wrap" data-open={planOpen}>
            <div className="min-h-0 overflow-hidden">
              <div className="max-h-80 overflow-y-auto whitespace-pre-wrap rounded-sm bg-sunken p-3 text-small text-ink [overflow-wrap:anywhere]">
                <Linkified text={view.plan} />
              </div>
            </div>
          </div>
        </div>
      ) : (
        <p className="text-caption text-ink-3">No plan given.</p>
      )}
      <div className="mt-3">
        {needsMe ? (
          <>
            <p className="mb-2 text-caption font-semibold text-ink">Needs your decision</p>
            <div className="flex gap-2 [&>button]:flex-1 lg:[&>button]:flex-none">
              <Button
                variant="primary"
                aria-describedby={taskId}
                loading={optimistic === "approved"}
                loadingLabel="Approving…"
                disabled={optimistic !== null}
                onClick={() => decide("approved")}
              >
                Approve
              </Button>
              <Button
                variant="secondary"
                aria-describedby={taskId}
                loading={optimistic === "declined"}
                loadingLabel="Declining…"
                disabled={optimistic !== null}
                onClick={() => decide("declined")}
              >
                Decline
              </Button>
            </div>
            <p className="mt-2 text-caption text-ink-3">
              Snapwork can't stop your agent from acting. Approving is how you tell it to go ahead.
            </p>
          </>
        ) : status === "pending" ? (
          <p className="text-caption text-ink-3">Waiting for {ownerName} to decide.</p>
        ) : (
          <div className="text-caption text-ink-2">
            <p>
              {status === "declined" ? "Declined" : status === "done" ? "Done" : "Approved"}
              {status !== "done" && ` by ${who}`}
              {decidedAt ? ` · ${hhmm(decidedAt)}` : ""}
              {status === "done" && view.resultMessageId && (
                <>
                  {" · "}
                  <button
                    type="button"
                    onClick={() => onJump(`result-${view.id}`)}
                    className="link inline-flex min-h-11 cursor-pointer items-center font-semibold no-underline"
                  >
                    See result
                  </button>
                </>
              )}
            </p>
            {status === "declined" && view.note && <p className="mt-1">Note: {view.note}</p>}
          </div>
        )}
      </div>
    </div>
  );
}
