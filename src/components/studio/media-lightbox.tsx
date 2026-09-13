"use client";

import { useEffect } from "react";

export type LightboxMedia = {
  url: string;
  label: string;
  kind?: "image" | "video";
};

type Props = {
  items: LightboxMedia[];
  activeUrl: string | null;
  onClose: () => void;
  onActiveUrl?: (url: string) => void;
};

export function MediaLightbox({
  items,
  activeUrl,
  onClose,
  onActiveUrl,
}: Props) {
  const index = items.findIndex((item) => item.url === activeUrl);
  const item = index >= 0 ? items[index] : null;
  const hasPrev = index > 0;
  const hasNext = index >= 0 && index < items.length - 1;

  useEffect(() => {
    if (!item) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
      if (event.key === "ArrowLeft" && hasPrev) {
        event.preventDefault();
        onActiveUrl?.(items[index - 1]!.url);
      }
      if (event.key === "ArrowRight" && hasNext) {
        event.preventDefault();
        onActiveUrl?.(items[index + 1]!.url);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [hasNext, hasPrev, index, item, items, onActiveUrl, onClose]);

  if (!item) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={item.label}
      className="fixed inset-0 z-[80] flex flex-col bg-[#0b0910]/92"
      onClick={onClose}
    >
      <div className="flex items-center justify-between gap-3 px-4 py-3">
        <p className="min-w-0 truncate text-sm text-[#f5eff6]">{item.label}</p>
        <button
          type="button"
          onClick={onClose}
          className="min-h-11 shrink-0 rounded-[10px] px-3 text-sm font-bold text-[#b8aebb] hover:text-[#f5eff6]"
        >
          Close
        </button>
      </div>
      <div
        className="relative flex min-h-0 flex-1 items-center justify-center px-4 pb-6"
        onClick={(event) => event.stopPropagation()}
      >
        {item.kind === "video" ? (
          <video
            src={item.url}
            controls
            playsInline
            autoPlay
            className="max-h-full max-w-full rounded-xl"
          />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.url}
            alt={item.label}
            className="max-h-full max-w-full object-contain"
          />
        )}
        {hasPrev ? (
          <button
            type="button"
            aria-label="Previous"
            onClick={() => onActiveUrl?.(items[index - 1]!.url)}
            className="absolute left-3 top-1/2 min-h-11 -translate-y-1/2 rounded-full border border-white/15 bg-black/40 px-3 text-sm text-[#f5eff6]"
          >
            ←
          </button>
        ) : null}
        {hasNext ? (
          <button
            type="button"
            aria-label="Next"
            onClick={() => onActiveUrl?.(items[index + 1]!.url)}
            className="absolute right-3 top-1/2 min-h-11 -translate-y-1/2 rounded-full border border-white/15 bg-black/40 px-3 text-sm text-[#f5eff6]"
          >
            →
          </button>
        ) : null}
      </div>
    </div>
  );
}
