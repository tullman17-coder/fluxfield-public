"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/", label: "Image-2" },
  { href: "/explainer", label: "Explainer" },
  { href: "/workflows", label: "Marketing" },
  { href: "/gallery", label: "Gallery" },
  { href: "/settings", label: "Adapters" },
];

type Health = {
  health: {
    comfy: boolean;
    ollama: boolean;
    tts: boolean;
    ffmpeg: boolean;
    effectiveMode: string;
  };
};

export function StudioShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [health, setHealth] = useState<Health["health"] | null>(null);

  useEffect(() => {
    let alive = true;
    const load = () =>
      fetch("/api/health")
        .then((r) => r.json())
        .then((d: Health) => {
          if (alive) setHealth(d.health);
        })
        .catch(() => undefined);
    load();
    const id = setInterval(load, 15000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  return (
    <div className="min-h-screen bg-[#0b0b0b] text-zinc-100">
      <header className="sticky top-0 z-40 border-b border-white/10 bg-[#0b0b0b]/90 backdrop-blur">
        <div className="mx-auto flex max-w-[1400px] items-center gap-6 px-4 py-3 md:px-6">
          <Link href="/" className="shrink-0 font-[family-name:var(--font-display)] text-lg tracking-tight text-[#c8f135]">
            Fieldbench
          </Link>
          <nav className="flex flex-1 items-center gap-1 overflow-x-auto text-sm">
            {NAV.map((item) => {
              const active =
                item.href === "/"
                  ? pathname === "/"
                  : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "rounded-full px-3 py-1.5 transition-colors",
                    active
                      ? "bg-white/10 text-white"
                      : "text-zinc-400 hover:text-white",
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
          <div className="hidden items-center gap-2 text-[11px] uppercase tracking-wider text-zinc-500 sm:flex">
            <StatusDot ok={!!health?.comfy} label="Comfy" />
            <StatusDot ok={!!health?.ollama} label="Ollama" />
            <StatusDot ok={!!health?.tts} label="TTS" />
            <StatusDot ok={!!health?.ffmpeg} label="FFmpeg" />
            <span className="rounded-full border border-white/10 px-2 py-0.5 text-[#c8f135]">
              {health?.effectiveMode || "…"}
            </span>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-[1400px] px-4 py-6 md:px-6 md:py-8">
        {children}
      </main>
    </div>
  );
}

function StatusDot({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className={cn(
          "size-1.5 rounded-full",
          ok ? "bg-emerald-400" : "bg-zinc-600",
        )}
      />
      {label}
    </span>
  );
}
