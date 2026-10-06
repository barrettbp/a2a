import { forwardRef, useId, type InputHTMLAttributes, type ReactNode } from "react";
import { AlertCircleIcon } from "./Icons";
import type { ApprovalStatus } from "../types";

interface FieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  optional?: boolean;
  helper?: string;
  error?: string | null;
}

export const Field = forwardRef<HTMLInputElement, FieldProps>(function Field(
  { label, optional, helper, error, id, ...rest },
  ref,
) {
  const auto = useId();
  const fid = id ?? auto;
  const hid = `${fid}-help`;
  const eid = `${fid}-err`;
  return (
    <div>
      <label htmlFor={fid} className="mb-1.5 block text-label font-medium text-ink">
        {label}
        {optional && <span className="font-normal text-ink-3"> (optional)</span>}
      </label>
      <input
        ref={ref}
        id={fid}
        className="field"
        aria-invalid={error ? true : undefined}
        aria-describedby={[error ? eid : null, helper ? hid : null].filter(Boolean).join(" ") || undefined}
        {...rest}
      />
      {error && (
        <p id={eid} className="mt-1.5 flex items-center gap-1.5 text-caption text-danger">
          <AlertCircleIcon size={16} />
          {error}
        </p>
      )}
      {helper && (
        <p id={hid} className="mt-1.5 text-caption text-ink-3">
          {helper}
        </p>
      )}
    </div>
  );
});

export function FormError({ children }: { children: ReactNode }) {
  return (
    <div role="alert" className="flex gap-2 rounded-sm border border-danger-soft-line bg-danger-soft p-3 text-small text-ink">
      <AlertCircleIcon size={20} className="shrink-0 text-danger" />
      <span>{children}</span>
    </div>
  );
}

const PILL: Record<ApprovalStatus, { text: string; cls: string }> = {
  pending: { text: "Pending", cls: "bg-warning-soft border-warning-soft-line text-warning-ink" },
  approved: { text: "Approved", cls: "bg-accent-soft border-accent-soft-line text-accent-ink" },
  declined: { text: "Declined", cls: "bg-danger-soft border-danger-soft-line text-danger" },
  done: { text: "Done", cls: "bg-accent border-accent text-on-accent" },
};

export function StatusPill({ status }: { status: ApprovalStatus }) {
  const p = PILL[status];
  return (
    <span className={`pill inline-flex h-6 items-center rounded-full border px-2 text-micro font-semibold ${p.cls}`}>{p.text}</span>
  );
}

export function AgentTag() {
  return (
    <span className="inline-flex h-[18px] items-center rounded-xs border border-line bg-sunken px-1.5 font-mono text-micro font-medium text-ink-2">
      agent
    </span>
  );
}

export function Avatar({ name, agent }: { name: string | null; agent?: boolean }) {
  const initial = (name ?? "?").trim().charAt(0).toUpperCase() || "?";
  return agent ? (
    <span
      aria-hidden="true"
      className="inline-flex size-8 shrink-0 items-center justify-center rounded-sm border border-line-strong bg-surface font-mono text-caption font-medium text-ink-2"
    >
      {initial}
    </span>
  ) : (
    <span
      aria-hidden="true"
      className="inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-avatar text-label font-semibold text-ink-2"
    >
      {initial}
    </span>
  );
}

export function PresenceDot({ state }: { state: "online" | "offline" | "hollow" }) {
  if (state === "hollow") return <span className="dot border-[1.5px] border-offline bg-transparent" aria-hidden="true" />;
  return <span className={`dot ${state === "online" ? "bg-online" : "bg-offline"}`} aria-hidden="true" />;
}

export function Wordmark() {
  return <span className="text-title font-semibold text-ink">Snapwork</span>;
}
