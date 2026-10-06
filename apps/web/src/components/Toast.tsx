import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

interface ToastItem {
  id: number;
  text: string;
  kind: "info" | "error";
}

interface Api {
  toast: (text: string, kind?: "info" | "error") => void;
  /** announce text for screen readers without a visible toast */
  announce: (text: string) => void;
}

const Ctx = createContext<Api>({ toast: () => {}, announce: () => {} });
export const useToast = () => useContext(Ctx);

/** Bottom offset: room page sits above the composer. */
export function ToastProvider({ children, bottom = "24px" }: { children: ReactNode; bottom?: string }) {
  const [item, setItem] = useState<ToastItem | null>(null);
  const [live, setLive] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const paused = useRef(false);
  const seq = useRef(0);

  const arm = useCallback((ms: number) => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setItem(null), ms);
  }, []);

  const toast = useCallback(
    (text: string, kind: "info" | "error" = "info") => {
      seq.current += 1;
      setItem({ id: seq.current, text, kind });
      arm(kind === "error" ? 6000 : 3000);
    },
    [arm],
  );
  const announce = useCallback((text: string) => {
    setLive("");
    setTimeout(() => setLive(text), 50);
  }, []);
  useEffect(() => () => clearTimeout(timer.current), []);

  const api = useMemo(() => ({ toast, announce }), [toast, announce]);
  return (
    <Ctx.Provider value={api}>
      {children}
      <div className="sr-only" aria-live="polite" role="status">
        {live}
      </div>
      <div
        className="pointer-events-none fixed inset-x-0 z-50 flex justify-center px-4"
        style={{ bottom: `calc(${bottom} + env(safe-area-inset-bottom))` }}
      >
        {item && (
          <div
            key={item.id}
            role="status"
            aria-live="polite"
            className="toast-enter pointer-events-auto w-[min(360px,100%)] rounded-sm bg-toast px-4 py-3 text-small text-white shadow-overlay"
            onMouseEnter={() => {
              paused.current = true;
              clearTimeout(timer.current);
            }}
            onMouseLeave={() => {
              paused.current = false;
              arm(3000);
            }}
          >
            {item.text}
          </div>
        )}
      </div>
    </Ctx.Provider>
  );
}
