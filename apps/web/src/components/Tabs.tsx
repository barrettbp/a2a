import { useRef, type KeyboardEvent, type ReactNode } from "react";

export interface TabDef {
  id: string;
  label: string;
}

export function Tabs({
  tabs,
  value,
  onChange,
  idBase,
  children,
}: {
  tabs: TabDef[];
  value: string;
  onChange: (id: string) => void;
  idBase: string;
  children: ReactNode;
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const index = Math.max(0, tabs.findIndex((t) => t.id === value));

  function onKey(e: KeyboardEvent) {
    let next = -1;
    if (e.key === "ArrowRight") next = (index + 1) % tabs.length;
    else if (e.key === "ArrowLeft") next = (index - 1 + tabs.length) % tabs.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = tabs.length - 1;
    if (next < 0) return;
    e.preventDefault();
    onChange(tabs[next]!.id);
    refs.current[next]?.focus();
  }

  return (
    <div>
      <div role="tablist" aria-label="Connection method" className="grid grid-cols-3 border-b border-line" onKeyDown={onKey}>
        {tabs.map((t, i) => {
          const active = i === index;
          return (
            <button
              key={t.id}
              ref={(el) => {
                refs.current[i] = el;
              }}
              type="button"
              role="tab"
              id={`${idBase}-tab-${t.id}`}
              aria-selected={active}
              aria-controls={`${idBase}-panel`}
              tabIndex={active ? 0 : -1}
              onClick={() => onChange(t.id)}
              className={`-mb-px min-h-[52px] cursor-pointer border-b-2 p-2 text-center text-label hover:bg-sunken focus-visible:-outline-offset-2 md:min-h-11 ${
                active ? "border-accent font-semibold text-ink" : "border-transparent font-medium text-ink-2"
              }`}
            >
              {t.label}
            </button>
          );
        })}
      </div>
      <div role="tabpanel" id={`${idBase}-panel`} aria-labelledby={`${idBase}-tab-${tabs[index]!.id}`} className="pt-4">
        {children}
      </div>
    </div>
  );
}
