import { memo } from "react";
import { autolink } from "../lib/autolink";

/** Plain text with http(s) URLs turned into links. The only element created is <a>. */
export const Linkified = memo(function Linkified({ text }: { text: string }) {
  return (
    <>
      {autolink(text).map((p, i) =>
        p.type === "text" ? (
          p.value
        ) : (
          <a key={i} href={p.href} target="_blank" rel="noopener noreferrer" className="link">
            {p.value}
          </a>
        ),
      )}
    </>
  );
});
