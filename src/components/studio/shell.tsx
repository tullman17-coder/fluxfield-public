"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { AuthStatus } from "@/components/studio/auth-status";

const NAV = [
  { href: "/supercomputer", label: "Super", icon: "cpu" },
  { href: "/create", label: "Create", icon: "create" },
  { href: "/", label: "Wrappers", icon: "grid" },
  { href: "/studio", label: "Studio", icon: "studio" },
  { href: "/explainer", label: "Explainer", icon: "play" },
  { href: "/director", label: "Director", icon: "clapper" },
  { href: "/ugc", label: "UGC", icon: "ugc" },
  { href: "/ad-multiplier", label: "Ads", icon: "ads" },
  { href: "/faceless", label: "Faceless", icon: "faceless" },
  { href: "/music", label: "Music", icon: "note" },
  { href: "/workflows", label: "Marketing", icon: "megaphone" },
  { href: "/gallery", label: "Gallery", icon: "image" },
  { href: "/settings", label: "Settings", icon: "gear" },
] as const;

const ENGINE_LABEL: Record<string, string> = {
  zermo: "Qwen Image 2.1",
  "zermo-unreachable": "Zermo offline",
  "local-studio": "Studio",
  comfyui: "Comfy",
  mock: "Preview",
};

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
    case "clapper":
      return (
        <svg {...common}>
          <path d="M3 10h18v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
          <path d="m3 10 1-4 17-1-1 5" />
          <path d="m8.5 5.7 1.8 3.9M13.5 5.4l1.8 3.9" />
        </svg>
      );
    case "studio":
      return (
        <svg {...common}>
          <rect x="3" y="4" width="18" height="14" rx="2" />
          <path d="M8 18v2M16 18v2M7 9h4M7 13h10" />
        </svg>
      );
    case "ugc":
      return (
        <svg {...common}>
          <circle cx="12" cy="8" r="3.5" />
          <path d="M5 19c1.5-3 4-4.5 7-4.5S17.5 16 19 19" />
        </svg>
      );
    case "ads":
      return (
        <svg {...common}>
          <path d="M4 8h10l6-3v14l-6-3H4z" />
          <path d="M8 12v4" />
        </svg>
      );
    case "faceless":
      return (
        <svg {...common}>
          <rect x="4" y="5" width="16" height="14" rx="2" />
          <path d="M8 15h8M9 10h.01M15 10h.01" />
        </svg>
      );
    case "note":
      return (
        <svg {...common}>
          <path d="M9 18V6l11-2v12" />
          <circle cx="6.5" cy="18" r="2.5" />
          <circle cx="17.5" cy="16" r="2.5" />
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
    (health.effectiveMode === "zermo" || health.studio || health.comfy || health.ollama || health.tts);

  return (
    <div className="grid min-h-dvh w-full grid-cols-[4rem_minmax(0,1fr)] text-[#f5eff6] sm:grid-cols-[5.75rem_minmax(0,1fr)]">
      {/* Iridescent swirl backdrop */}
      <div className="swirl-layer" aria-hidden="true">
        <div className="swirl-blob swirl-blob--a" />
        <div className="swirl-blob swirl-blob--b" />
        <div className="swirl-blob swirl-blob--c" />
      </div>

      {/* The rail is taller than a phone held sideways, so it scrolls on its
          own. Padding keeps it clear of the notch and the home indicator. */}
      <aside className="shell-rail glass-strong sticky top-0 z-40 flex h-dvh min-w-0 flex-col items-stretch overflow-y-auto overscroll-contain border-y-0 border-l-0">
        <Link
          href="/supercomputer"
          aria-label="Fluxfield home"
          className="grid min-h-11 w-full place-items-center rounded-[10px] border border-white/15 bg-[#2c162f] text-sm font-extrabold tracking-[0.12em] text-[#e77ae6]"
        >
          FB
        </Link>

        <nav aria-label="Primary" className="mt-4 grid shrink-0 gap-1.5">
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
                    ? "border-white/15 bg-[#2c162f] text-[#e77ae6]"
                    : "text-[#8d838f] hover:bg-white/15 hover:text-[#f5eff6]",
                )}
              >
                <RailIcon name={item.icon} />
                {/* A column of unlabelled icons is a guessing game on a phone,
                    where there is no hover to fall back on. */}
                <span className="whitespace-nowrap text-[9px] sm:text-[11px]">
                  {item.label}
                </span>
              </Link>
            );
          })}
        </nav>

        <div
          className="mt-auto grid shrink-0 justify-items-center gap-1 pt-3 text-[11px] text-[#8d838f]"
          title={
            health
              ? `Making images with ${ENGINE_LABEL[health.effectiveMode] ?? health.effectiveMode}`
              : "Checking connections"
          }
        >
          <span
            aria-hidden="true"
            className={cn(
              "size-2 rounded-full",
              anyUp
                ? "bg-[#d565d6] shadow-[0_0_0_4px_#2c162f]"
                : "bg-[#8d838f]",
            )}
          />
          <span className="text-[9px] sm:text-[11px]">
            {health ? (ENGINE_LABEL[health.effectiveMode] ?? health.effectiveMode) : "…"}
          </span>
          <AuthStatus />
        </div>
      </aside>

      <main className="shell-main w-full min-w-0">
        <div className="mx-auto w-full min-w-0 max-w-[100rem]">{children}</div>
      </main>
    </div>
  );
}
