import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Relative luminance 0–1 for hex colors (#rgb / #rrggbb). */
export function hexLuminance(hex: string): number {
  const raw = hex.replace("#", "").trim();
  const full =
    raw.length === 3
      ? raw
          .split("")
          .map((c) => c + c)
          .join("")
      : raw;
  if (full.length !== 6) return 0;
  const r = parseInt(full.slice(0, 2), 16) / 255;
  const g = parseInt(full.slice(2, 4), 16) / 255;
  const b = parseInt(full.slice(4, 6), 16) / 255;
  const lin = (c: number) =>
    c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

export function isLightSurface(hex: string): boolean {
  return hexLuminance(hex) > 0.45;
}

/** Ink / muted / chip styles that stay readable on light or dark card surfaces. */
export function surfaceTextClasses(surfaceHex: string) {
  if (isLightSurface(surfaceHex)) {
    return {
      title: "text-zinc-900",
      body: "text-zinc-700",
      muted: "text-zinc-500",
      chip: "border-zinc-900/15 text-zinc-800",
      border: "border-zinc-900/10 hover:border-zinc-900/25",
    };
  }
  return {
    title: "text-white",
    body: "text-white/70",
    muted: "text-white/50",
    chip: "border-white/15 text-white/75",
    border: "border-white/10 hover:border-white/25",
  };
}
