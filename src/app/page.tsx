import Link from "next/link";
import { IMAGE2_WRAPPERS } from "@/lib/wrappers/catalog";
import { cn, surfaceTextClasses } from "@/lib/utils";
// IMAGE2_WRAPPERS drives the masonry launcher

export default function HomePage() {
  return (
    <div className="space-y-8">
      <section className="relative overflow-hidden rounded-[28px] border border-white/10 bg-[radial-gradient(ellipse_at_top_left,#1a2a0a,transparent_45%),linear-gradient(160deg,#121212,#0b0b0b)] px-6 py-10 md:px-10 md:py-14">
        <div className="pointer-events-none absolute inset-0 opacity-[0.07] [background-image:radial-gradient(circle_at_1px_1px,#fff_1px,transparent_0)] [background-size:18px_18px]" />
        <p className="relative text-xs uppercase tracking-[0.25em] text-[#c8f135]">
          GPT Image-2 workflows
        </p>
        <h1 className="relative mt-3 max-w-3xl font-[family-name:var(--font-display)] text-4xl leading-[1.05] tracking-tight text-white md:text-6xl">
          Fieldbench
        </h1>
        <p className="relative mt-4 max-w-2xl text-base text-zinc-400 md:text-lg">
          Marketing wrappers as little web-app containers — streetwear drops,
          editorial catalog pages, event posters, shop banners, try-on UIs —
          routed to your offline model box.
        </p>
        <div className="relative mt-6 flex flex-wrap gap-3">
          <Link
            href="/explainer"
            className="rounded-full bg-[#c8f135] px-5 py-2.5 text-sm font-semibold text-black"
          >
            Open Explainer
          </Link>
          <Link
            href="/settings"
            className="rounded-full border border-white/15 px-5 py-2.5 text-sm text-zinc-200"
          >
            Connect adapters
          </Link>
        </div>
      </section>

      <section>
        <div className="mb-4 flex items-end justify-between gap-4">
          <div>
            <h2 className="font-[family-name:var(--font-display)] text-2xl text-white">
              Wrapper gallery
            </h2>
            <p className="text-sm text-zinc-500">
              Each tile is a composed mini-app — layout chrome + generation + copy.
            </p>
          </div>
        </div>

        <div className="columns-1 gap-4 sm:columns-2 lg:columns-3">
          {IMAGE2_WRAPPERS.map((w) => {
            const ink = surfaceTextClasses(w.surface);
            return (
              <Link
                key={w.slug}
                href={`/image-2/${w.slug}`}
                className={cn(
                  "mb-4 block break-inside-avoid overflow-hidden rounded-2xl border transition",
                  ink.border,
                )}
                style={{ background: w.surface }}
              >
                <div
                  className={
                    w.span === "tall"
                      ? "min-h-[420px]"
                      : w.span === "wide"
                        ? "min-h-[220px]"
                        : "min-h-[280px]"
                  }
                >
                  <div className="flex h-full flex-col justify-between p-5">
                    <div className="flex items-start justify-between gap-3">
                      <span
                        className="rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-black"
                        style={{ background: w.accent }}
                      >
                        {w.category}
                      </span>
                      <span
                        className={cn(
                          "text-[10px] uppercase tracking-wider",
                          ink.muted,
                        )}
                      >
                        Image-2
                      </span>
                    </div>
                    <div>
                      <div
                        className="font-[family-name:var(--font-display)] text-3xl font-bold leading-none"
                        style={{ color: w.accent }}
                      >
                        {w.brandSample}
                      </div>
                      <div className={cn("mt-3 text-lg font-medium", ink.title)}>
                        {w.name}
                      </div>
                      <p className={cn("mt-1 text-sm", ink.body)}>{w.tagline}</p>
                      <div className="mt-4 flex flex-wrap gap-2">
                        {w.copyHints.slice(0, 3).map((hint) => (
                          <span
                            key={hint}
                            className={cn(
                              "rounded-full border px-2 py-0.5 text-[11px]",
                              ink.chip,
                            )}
                          >
                            {hint}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </section>
    </div>
  );
}
