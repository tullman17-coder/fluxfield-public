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
              "conic-gradient(from 40deg, rgb(138 73 190 / 45%), rgb(205 64 154 / 35%), rgb(88 56 160 / 40%), rgb(138 73 190 / 45%))",
          }}
        />
        <p className="relative text-[11px] font-bold uppercase tracking-[0.12em] text-[#e77ae6]">
          Campaign layouts
        </p>
        <h1 className="relative mt-3 max-w-3xl text-4xl font-semibold leading-[1.05] tracking-tight text-balance text-[#f5eff6] md:text-6xl">
          Fieldbench
        </h1>
        <p className="relative mt-4 max-w-2xl text-base text-pretty text-[#b8aebb] md:text-lg">
          Drop posters, catalog spreads, event bills, shop banners, fitting-room
          screens. Pick a layout, describe the product, and get finished art with
          the words already set.
        </p>
        <div className="relative mt-6 flex min-w-0 flex-wrap gap-3">
          <Link
            href="/supercomputer"
            className="grid min-h-11 place-items-center rounded-[10px] border border-[#d565d6] bg-[#d565d6] px-5 text-sm font-bold text-white transition-colors hover:border-[#e77ae6] hover:bg-[#e77ae6]"
          >
            Run superComputer
          </Link>
          <Link
            href="/create"
            className="grid min-h-11 place-items-center rounded-[10px] border border-white/15 bg-[#2c162f] px-5 text-sm font-bold text-[#e77ae6] transition-colors hover:border-[#d565d6]"
          >
            Make an image
          </Link>
          <Link
            href="/settings"
            className="grid min-h-11 place-items-center rounded-[10px] px-5 text-sm font-bold text-[#b8aebb] transition-colors hover:text-[#f5eff6]"
          >
            Settings
          </Link>
        </div>
      </section>

      <section className="min-w-0">
        <div className="mb-4 flex min-w-0 flex-wrap items-end justify-between gap-4">
          <div className="min-w-0">
            <h2 className="text-2xl font-semibold text-balance text-[#f5eff6]">
              Layouts
            </h2>
            <p className="text-sm text-[#8d838f]">
              Your art and your words drop straight into the design.
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
                {/* real generated art, cached per layout */}
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
                    <span className="rounded-full bg-black/30 px-2 py-0.5 text-[10px] uppercase tracking-wider text-white/60 backdrop-blur-sm">
                      Layout
                    </span>
                  </div>
                  <div className="min-w-0 rounded-[12px] bg-[#100e14]/55 p-4 backdrop-blur-md">
                    <div
                      className="text-3xl font-bold leading-none"
                      style={{ color: w.accent }}
                    >
                      {w.brandSample}
                    </div>
                    <div className="mt-3 text-lg font-medium text-[#f5eff6]">
                      {w.name}
                    </div>
                    <p className="mt-1 text-sm text-pretty text-[#b8aebb]">
                      {w.tagline}
                    </p>
                    <div className="mt-4 flex min-w-0 flex-wrap gap-2">
                      {w.copyHints.slice(0, 3).map((hint) => (
                        <span
                          key={hint}
                          className="rounded-full border border-white/15 bg-white/10 px-2 py-0.5 text-[11px] text-white/75"
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
