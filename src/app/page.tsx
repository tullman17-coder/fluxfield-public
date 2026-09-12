import Link from "next/link";
import { IMAGE2_WRAPPERS } from "@/lib/wrappers/catalog";
// IMAGE2_WRAPPERS drives the masonry launcher

export default function HomePage() {
  return (
    <div className="w-full min-w-0 space-y-8">
      <section className="glass-strong relative overflow-hidden rounded-[14px] px-5 py-8 sm:px-8 sm:py-12">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-32 right-[-5rem] h-72 w-72 rounded-full opacity-60 blur-3xl"
          style={{
            background:
              "conic-gradient(from 40deg, #f9dce8, #e8ddf7, #ddf0ea, #dbe7f7, #f9dce8)",
          }}
        />
        <p className="relative text-[11px] font-bold uppercase tracking-[0.12em] text-[#a845b0]">
          GPT Image-2 workflows
        </p>
        <h1 className="relative mt-3 max-w-3xl text-4xl font-semibold leading-[1.05] tracking-tight text-balance text-[#2e2833] md:text-6xl">
          Fieldbench
        </h1>
        <p className="relative mt-4 max-w-2xl text-base text-pretty text-[#6f6577] md:text-lg">
          Marketing wrappers as little web-app containers — streetwear drops,
          editorial catalog pages, event posters, shop banners, try-on UIs —
          routed to your offline model box over Netbird.
        </p>
        <div className="relative mt-6 flex min-w-0 flex-wrap gap-3">
          <Link
            href="/supercomputer"
            className="grid min-h-11 place-items-center rounded-[10px] border border-[#a845b0] bg-[#a845b0] px-5 text-sm font-bold text-white transition-colors hover:border-[#c05cc9] hover:bg-[#c05cc9]"
          >
            Run superComputer
          </Link>
          <Link
            href="/create"
            className="grid min-h-11 place-items-center rounded-[10px] border border-[#d5c8da] bg-[#f3e4f4] px-5 text-sm font-bold text-[#a845b0] transition-colors hover:border-[#a845b0]"
          >
            Open Create workbench
          </Link>
          <Link
            href="/settings"
            className="grid min-h-11 place-items-center rounded-[10px] px-5 text-sm font-bold text-[#6f6577] transition-colors hover:text-[#2e2833]"
          >
            Connect adapters
          </Link>
        </div>
      </section>

      <section className="min-w-0">
        <div className="mb-4 flex min-w-0 flex-wrap items-end justify-between gap-4">
          <div className="min-w-0">
            <h2 className="text-2xl font-semibold text-balance text-[#2e2833]">
              Wrapper gallery
            </h2>
            <p className="text-sm text-[#8d8296]">
              Each tile is a composed mini-app — layout chrome + generation +
              copy.
            </p>
          </div>
        </div>

        <div className="columns-1 gap-4 sm:columns-2 lg:columns-3">
          {IMAGE2_WRAPPERS.map((w) => (
            <Link
              key={w.slug}
              href={`/image-2/${w.slug}`}
              className="glass mb-4 block break-inside-avoid overflow-hidden rounded-[14px] transition hover:shadow-[0_16px_48px_rgb(90_70_110/16%)]"
              style={{ background: `${w.surface}55` }}
            >
              <div
                className={
                  w.span === "tall"
                    ? "relative min-h-[420px]"
                    : w.span === "wide"
                      ? "relative min-h-[220px]"
                      : "relative min-h-[280px]"
                }
              >
                {/* Generated card art — real adapter output, cached per wrapper */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`/api/card-bg/${w.slug}`}
                  alt=""
                  loading="lazy"
                  className="absolute inset-0 h-full w-full object-cover"
                />
                <div className="relative flex h-full min-h-[inherit] flex-col justify-between p-5">
                  <div className="flex min-w-0 items-start justify-between gap-3">
                    <span
                      className="rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-white shadow-sm"
                      style={{ background: w.accent }}
                    >
                      {w.category}
                    </span>
                    <span className="rounded-full bg-white/60 px-2 py-0.5 text-[10px] uppercase tracking-wider text-[#6f6577] backdrop-blur-sm">
                      Image-2
                    </span>
                  </div>
                  <div className="min-w-0 rounded-[12px] bg-white/60 p-4 backdrop-blur-md">
                    <div
                      className="text-3xl font-bold leading-none"
                      style={{ color: w.accent }}
                    >
                      {w.brandSample}
                    </div>
                    <div className="mt-3 text-lg font-medium text-[#2e2833]">
                      {w.name}
                    </div>
                    <p className="mt-1 text-sm text-pretty text-[#6f6577]">
                      {w.tagline}
                    </p>
                    <div className="mt-4 flex min-w-0 flex-wrap gap-2">
                      {w.copyHints.slice(0, 3).map((hint) => (
                        <span
                          key={hint}
                          className="rounded-full border border-[#e7dfe8] bg-white/50 px-2 py-0.5 text-[11px] text-[#6f6577]"
                        >
                          {hint}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
