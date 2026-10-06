import { useEffect, useRef } from "react";
import { Button } from "./Button";

interface Props {
  open: boolean;
  title: string;
  body: string;
  confirmLabel: string;
  loadingLabel: string;
  busy: boolean;
  error: string | null;
  onCancel: () => void;
  onConfirm: () => void;
}

export function ConfirmDialog({ open, title, body, confirmLabel, loadingLabel, busy, error, onCancel, onConfirm }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      role="alertdialog"
      aria-labelledby="confirm-title"
      aria-describedby="confirm-body"
      className="confirm scrim m-auto w-[min(420px,calc(100vw-32px))] rounded-md bg-surface p-0 text-ink shadow-overlay"
      onCancel={(e) => {
        e.preventDefault();
        if (!busy) onCancel();
      }}
      onClick={(e) => {
        if (e.target === ref.current && !busy) onCancel();
      }}
    >
      <div className="p-6">
        <h2 id="confirm-title" className="text-title font-semibold">
          {title}
        </h2>
        <p id="confirm-body" className="mt-2 text-small text-ink-2">
          {body}
        </p>
        {error && (
          <p role="alert" className="mt-4 text-caption text-danger">
            {error}
          </p>
        )}
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="secondary" onClick={onCancel} disabled={busy} autoFocus>
            Cancel
          </Button>
          <Button variant="danger" onClick={onConfirm} loading={busy} loadingLabel={loadingLabel}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </dialog>
  );
}
