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

    // Save the element that had focus before the lightbox opened
    previousFocusRef.current = document.activeElement;

    // Lock body scroll to prevent iOS Safari from scrolling behind the overlay
    document.body.style.overflow = "hidden";

    // Focus the overlay
    overlayRef.current?.focus();

    return () => {
      // Restore body scroll
      document.body.style.overflow = "";

      // Restore focus to the previously focused element
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
        // Shift+Tab: if on overlay, wrap to close button
        if (document.activeElement === overlay) {
          e.preventDefault();
          closeBtn.focus();
        }
      } else {
        // Tab: if on close button, wrap to overlay
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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 outline-none"
      onClick={onClose}
      onKeyDown={handleKeyDown}
    >
      <button
        ref={closeRef}
        className="absolute top-4 right-4 text-white text-3xl leading-none cursor-pointer"
        aria-label="Close lightbox"
        onClick={onClose}
      >
        &times;
      </button>
      <img
        src={src}
        alt={alt}
        className="max-w-[90vw] max-h-[85vh] rounded-md"
        onClick={(e) => e.stopPropagation()}
      />
    </div>
  );
}
