import { useEffect, useRef } from "react";

interface LightboxProps {
  open: boolean;
  onClose: () => void;
  src: string;
  alt?: string;
}

export default function Lightbox({ open, onClose, src, alt }: LightboxProps) {
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) overlayRef.current?.focus();
  }, [open]);

  if (!open) return null;

  return (
    <div
      ref={overlayRef}
      role="dialog"
      aria-modal="true"
      aria-label={alt || "Enlarged image"}
      tabIndex={-1}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 outline-none"
      onClick={onClose}
      onKeyDown={(e) => {
        if (e.key === "Escape") onClose();
      }}
    >
      <button
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
