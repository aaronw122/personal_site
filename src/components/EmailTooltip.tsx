import { useRef, useCallback } from "react";

const EMAIL = "youfoundaaron@gmail.com";

const COPY_HTML =
  '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg> Copy';

const COPIED_HTML =
  '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg> Copied!';

export default function EmailTooltip() {
  const btnRef = useRef<HTMLButtonElement>(null);

  const copyEmail = useCallback(() => {
    navigator.clipboard.writeText(EMAIL).then(() => {
      const btn = btnRef.current;
      if (!btn) return;
      btn.classList.add("copied");
      btn.innerHTML = COPIED_HTML;
      setTimeout(() => {
        btn.classList.remove("copied");
        btn.innerHTML = COPY_HTML;
      }, 2000);
    });
  }, []);

  return (
    <span className="email-tooltip-wrap">
      reach out
      <span className="email-tooltip">
        <span>{EMAIL}</span>
        <button
          ref={btnRef}
          className="email-tooltip-copy"
          onClick={copyEmail}
          aria-label="Copy email address"
          dangerouslySetInnerHTML={{ __html: COPY_HTML }}
        />
      </span>
    </span>
  );
}
