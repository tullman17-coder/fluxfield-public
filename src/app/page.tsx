import Link from "next/link";
import { IMAGE2_WRAPPERS } from "@/lib/wrappers/catalog";
import { cn, surfaceTextClasses } from "@/lib/utils";
// IMAGE2_WRAPPERS drives the masonry launcher

export default function HomePage() {
  return (
    <div className="w-full min-w-0 space-y-8">
      <section className="relative overflow-hidden rounded-[14px] border border-[#332a38] bg-[#100e14] px-5 py-8 sm:px-8 sm:py-12">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-40 right-[-6rem] h-80 w-80 rounded-full bg-[radial-gradient(circle,rgb(138_73_190/22%),transparent_70%)]"
        />
        <p className="relative text-[11px] font-bold uppercase tracking-[0.12em] text-[#e77ae6]">
          GPT Image-2 workflows
        </p>
        <h1 className="relative mt-3 max-w-3xl text-4xl font-semibold leading-[1.05] tracking-tight text-[#f5eff6] md:text-6xl">
          Fieldbench
        </h1>
        <p className="relative mt-4 max-w-2xl text-base text-[#b8aebb] md:text-lg">
          Marketing wrappers as little web-app containers — streetwear drops,
          editorial catalog pages, event posters, shop banners, try-on UIs —
          routed to your offline model box over Netbird.
        </p>
        <div className="relative mt-6 flex min-w-0 flex-wrap gap-3">
          <Link
            href="/create"
            className="grid min-h-11 place-items-center rounded-[10px] border border-[#d565d6] bg-[#d565d6] px-5 text-sm font-bold text-[#170b18] transition-colors hover:border-[#e77ae6] hover:bg-[#e77ae6]"
          >
            Open Create workbench
          </Link>
          <Link
            href="/explainer"
            className="grid min-h-11 place-items-center rounded-[10px] border border-[#504156] bg-[#2c162f] px-5 text-sm font-bold text-[#e77ae6] transition-colors hover:border-[#d565d6]"
          >
            Open Explainer
          </Link>
          <Link
            href="/settings"
            className="grid min-h-11 place-items-center rounded-[10px] px-5 text-sm font-bold text-[#b8aebb] transition-colors hover:text-[#f5eff6]"
          >
            Connect adapters
          </Link>
        </div>
      </section>

      <section className="min-w-0">
        <div className="mb-4 flex min-w-0 flex-wrap items-end justify-between gap-4">
          <div className="min-w-0">
            <h2 className="text-2xl font-semibold text-[#f5eff6]">
              Wrapper gallery
            </h2>
            <p className="text-sm text-[#8d838f]">
              Each tile is a composed mini-app — layout chrome + generation +
              copy.
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
                  "mb-4 block break-inside-avoid overflow-hidden rounded-[14px] border transition",
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
                    <div className="flex min-w-0 items-start justify-between gap-3">
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
                    <div className="min-w-0">
                      <div
                        className="text-3xl font-bold leading-none"
                        style={{ color: w.accent }}
                      >
                        {w.brandSample}
                      </div>
                      <div className={cn("mt-3 text-lg font-medium", ink.title)}>
                        {w.name}
                      </div>
                      <p className={cn("mt-1 text-sm", ink.body)}>{w.tagline}</p>
                      <div className="mt-4 flex min-w-0 flex-wrap gap-2">
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
