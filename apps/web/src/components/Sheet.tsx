import { useEffect, useRef, type ReactNode } from "react";
import { Button } from "./Button";
import { XIcon } from "./Icons";

/** Bottom sheet on phones, right-hand overlay panel on tablets. Native dialog: focus trap, Esc and focus return come free. */
export function Sheet({ open, onClose, children }: { open: boolean; onClose: () => void; children: ReactNode }) {
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
      aria-labelledby="sheet-title"
      className="sheet scrim fixed inset-x-0 bottom-0 top-auto m-0 max-h-[90dvh] w-full max-w-none overflow-hidden rounded-t-lg bg-canvas p-0 text-ink shadow-overlay md:inset-y-0 md:left-auto md:right-0 md:h-dvh md:max-h-none md:w-[360px] md:rounded-none"
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
    >
      <div className="flex max-h-[90dvh] flex-col md:h-dvh md:max-h-none">
        <div className="mx-auto mt-2 h-1 w-9 shrink-0 rounded-full bg-line-strong md:hidden" aria-hidden="true" />
        <div className="flex h-14 shrink-0 items-center justify-between px-4">
          <h2 id="sheet-title" className="text-title font-semibold">
            Room
          </h2>
          <Button variant="ghost" icon aria-label="Close" onClick={onClose}>
            <XIcon />
          </Button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-[calc(16px+env(safe-area-inset-bottom))]">{children}</div>
      </div>
    </dialog>
  );
}
