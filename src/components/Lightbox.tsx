import { useEffect, useRef } from "react";

interface LightboxProps {
  open: boolean;
  onClose: () => void;
  src: string;
  alt?: string;
}

export default function Lightbox({ open, onClose, src, alt }: LightboxProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const previousFocusRef = useRef<Element | null>(null);

  useEffect(() => {
    if (!open) return;

    previousFocusRef.current = document.activeElement;

    document.body.style.overflow = "hidden";

    overlayRef.current?.focus();

    return () => {
      document.body.style.overflow = "";

      if (previousFocusRef.current instanceof HTMLElement) {
        previousFocusRef.current.focus();
      }
    };
  }, [open]);

  if (!open) return null;

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      onClose();
      return;
    }

    if (e.key === "Tab") {
      const overlay = overlayRef.current;
      const closeBtn = closeRef.current;
      if (!overlay || !closeBtn) return;

      if (e.shiftKey) {
        if (document.activeElement === overlay) {
          e.preventDefault();
          closeBtn.focus();
        }
      } else {
        if (document.activeElement === closeBtn) {
          e.preventDefault();
          overlay.focus();
        }
      }
    }
  };

  return (
    <div
      ref={overlayRef}
      role="dialog"
      aria-modal="true"
      aria-label={alt || "Enlarged image"}
      tabIndex={-1}
      className="lightbox-overlay"
      onClick={onClose}
      onKeyDown={handleKeyDown}
    >
      <button
        ref={closeRef}
        className="lightbox-close"
        aria-label="Close lightbox"
        onClick={onClose}
      >
        &times;
      </button>
      <img
        src={src}
        alt={alt}
        className="lightbox-image"
        onClick={(e) => e.stopPropagation()}
      />
    </div>
  );
}
