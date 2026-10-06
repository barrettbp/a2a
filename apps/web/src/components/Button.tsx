import { forwardRef, useLayoutEffect, useRef, type ButtonHTMLAttributes, type ReactNode } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  loading?: boolean;
  loadingLabel?: string;
  icon?: boolean;
  children?: ReactNode;
}

/** Locks its width while loading so the label change does not shift the layout. */
export const Button = forwardRef<HTMLButtonElement, Props>(function Button(
  { variant = "secondary", loading, loadingLabel, icon, className = "", children, disabled, ...rest },
  outer,
) {
  const ref = useRef<HTMLButtonElement | null>(null);
  const width = useRef<number | null>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (loading) {
      if (width.current === null) width.current = el.offsetWidth;
      el.style.minWidth = `${width.current}px`;
    } else {
      width.current = null;
      el.style.minWidth = "";
    }
  }, [loading]);
  return (
    <button
      ref={(el) => {
        ref.current = el;
        if (typeof outer === "function") outer(el);
        else if (outer) outer.current = el;
      }}
      type="button"
      {...rest}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={`btn btn-${variant} ${icon ? "btn-icon" : ""} ${className}`}
    >
      {loading ? (
        <>
          <span className="spinner" aria-hidden="true" />
          {loadingLabel}
        </>
      ) : (
        children
      )}
    </button>
  );
});
