"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/supercomputer", label: "Super", icon: "cpu" },
  { href: "/create", label: "Create", icon: "create" },
  { href: "/", label: "Wrappers", icon: "grid" },
  { href: "/explainer", label: "Explainer", icon: "play" },
  { href: "/workflows", label: "Marketing", icon: "megaphone" },
  { href: "/gallery", label: "Gallery", icon: "image" },
  { href: "/settings", label: "Adapters", icon: "gear" },
] as const;

type Health = {
  health: {
    comfy: boolean;
    ollama: boolean;
    tts: boolean;
    ffmpeg: boolean;
    studio: boolean;
    effectiveMode: string;
  };
};

function RailIcon({ name }: { name: string }) {
  const common = {
    className: "size-5",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.6,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    "aria-hidden": true,
  } as const;
  switch (name) {
    case "cpu":
      return (
        <svg {...common}>
          <rect x="6" y="6" width="12" height="12" rx="2" />
          <path d="M9 2v2M15 2v2M9 20v2M15 20v2M2 9h2M2 15h2M20 9h2M20 15h2" />
        </svg>
      );
    case "create":
      return (
        <svg {...common}>
          <path d="M12 3v18M3 12h18" />
        </svg>
      );
    case "grid":
      return (
        <svg {...common}>
          <rect x="3" y="3" width="7" height="7" rx="1.5" />
          <rect x="14" y="3" width="7" height="7" rx="1.5" />
          <rect x="3" y="14" width="7" height="7" rx="1.5" />
          <rect x="14" y="14" width="7" height="7" rx="1.5" />
        </svg>
      );
    case "play":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="9" />
          <path d="m10 8.5 5 3.5-5 3.5z" />
        </svg>
      );
    case "megaphone":
      return (
        <svg {...common}>
          <path d="m3 11 14-5v12L3 13v-2z" />
          <path d="M11.5 16.5a4.5 4.5 0 0 1-4.5 4.5" />
        </svg>
      );
    case "image":
      return (
        <svg {...common}>
          <rect x="3" y="4" width="18" height="16" rx="2" />
          <path d="m7 16 3-3 2 2 3-4 3 5" />
        </svg>
      );
    default:
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="3" />
          <path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9 7 7M17 17l2.1 2.1M19.1 4.9 17 7M7 17l-2.1 2.1" />
        </svg>
      );
  }
}

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

  const anyUp =
    !!health &&
    (health.studio || health.comfy || health.ollama || health.tts);

  return (
    <div className="grid min-h-dvh w-full grid-cols-[3.5rem_minmax(0,1fr)] text-[#2e2833] sm:grid-cols-[5.75rem_minmax(0,1fr)]">
      {/* Iridescent swirl backdrop */}
      <div className="swirl-layer" aria-hidden="true">
        <div className="swirl-blob swirl-blob--a" />
        <div className="swirl-blob swirl-blob--b" />
        <div className="swirl-blob swirl-blob--c" />
      </div>

      <aside className="glass-strong sticky top-0 z-40 flex h-dvh min-w-0 flex-col items-stretch border-y-0 border-l-0 p-2 sm:p-3">
        <Link
          href="/supercomputer"
          aria-label="Fieldbench home"
          className="grid min-h-11 w-full place-items-center rounded-[10px] border border-[#d5c8da] bg-[#f3e4f4] text-sm font-extrabold tracking-[0.12em] text-[#a845b0]"
        >
          FB
        </Link>

        <nav aria-label="Primary" className="mt-5 grid gap-2">
          {NAV.map((item) => {
            const active =
              item.href === "/"
                ? pathname === "/" || pathname.startsWith("/image-2")
                : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "grid min-h-[3.25rem] w-full min-w-0 place-items-center gap-1 rounded-[10px] border border-transparent p-1 text-[11px] leading-tight transition-colors",
                  active
                    ? "border-[#d5c8da] bg-[#f3e4f4] text-[#a845b0]"
                    : "text-[#8d8296] hover:bg-white/70 hover:text-[#2e2833]",
                )}
              >
                <RailIcon name={item.icon} />
                <span className="whitespace-nowrap max-sm:sr-only">
                  {item.label}
                </span>
              </Link>
            );
          })}
        </nav>

        <div
          className="mt-auto grid justify-items-center gap-1 py-2 text-[11px] text-[#8d8296]"
          title={`Effective mode: ${health?.effectiveMode || "…"}`}
        >
          <span
            aria-hidden="true"
            className={cn(
              "size-2 rounded-full",
              anyUp
                ? "bg-[#a845b0] shadow-[0_0_0_4px_#f3e4f4]"
                : "bg-[#8d8296]",
            )}
          />
          <span className="max-sm:sr-only">
            {health?.effectiveMode || "…"}
          </span>
        </div>
      </aside>

      <main className="w-full min-w-0 px-3 py-6 sm:px-6 sm:py-8 lg:px-8">
        <div className="mx-auto w-full min-w-0 max-w-[100rem]">{children}</div>
      </main>
    </div>
  );
}
