import { useEffect, useRef, useState } from "react";
import { Button } from "./Button";
import { CheckIcon, CopyIcon } from "./Icons";
import { useToast } from "./Toast";

/** Copy text. On clipboard failure, select the text in `selectRef` and show a toast. */
export function CopyButton({
  text,
  label = "Copy",
  variant = "secondary",
  className = "",
  selectRef,
  ariaLabel,
}: {
  text: string;
  label?: string;
  variant?: "primary" | "secondary" | "ghost";
  className?: string;
  selectRef?: React.RefObject<HTMLElement>;
  ariaLabel?: string;
}) {
  const [copied, setCopied] = useState(false);
  const { toast, announce } = useToast();
  const timer = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => () => clearTimeout(timer.current), []);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      announce("Copied to clipboard.");
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), 1500);
    } catch {
      const el = selectRef?.current;
      if (el) {
        const range = document.createRange();
        range.selectNodeContents(el);
        const sel = window.getSelection();
        sel?.removeAllRanges();
        sel?.addRange(range);
      }
      toast("Couldn't copy. The text is selected, copy it manually.", "error");
    }
  }

  return (
    <Button
      variant={variant}
      onClick={copy}
      aria-label={ariaLabel}
      className={`${copied && variant !== "primary" ? "!text-accent-ink" : ""} ${className}`}
    >
      {copied ? <CheckIcon /> : <CopyIcon />}
      {copied ? "Copied" : label}
    </Button>
  );
}
