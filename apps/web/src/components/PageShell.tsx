import { type ReactNode } from "react";
import { ToastProvider } from "./Toast";
import { Wordmark } from "./ui";

/** Layout shared by create, claim and error pages: wordmark, optional intro, then a card on desktop. */
export function PageShell({ intro, children, card = true }: { intro?: ReactNode; children: ReactNode; card?: boolean }) {
  return (
    <ToastProvider>
      <div className="min-h-dvh bg-canvas px-4 pb-12 pt-10 lg:px-6 lg:pt-24">
        <div className="mx-auto w-full max-w-[440px]">
          <Wordmark />
          {intro}
          <div className={`mt-8 ${card ? "lg:mt-6 lg:rounded-md lg:border lg:border-line lg:bg-surface lg:p-8" : ""}`}>{children}</div>
        </div>
      </div>
    </ToastProvider>
  );
}
