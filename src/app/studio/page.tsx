import Link from "next/link";
import {
  MARKETPLACE_PRESETS,
  PRESET_CATEGORIES,
  type PresetCategory,
} from "@/lib/studio/presets-marketplace";

const CATEGORY_TINT: Record<PresetCategory, string> = {
  ugc: "#3a1a3f",
  product: "#1f2438",
  poster: "#2a1830",
  marketplace: "#1a2a28",
  editorial: "#24182e",
  motion: "#1c2035",
};

export default function StudioPage() {
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
          Studio
        </p>
        <h1 className="relative mt-3 max-w-3xl text-4xl font-semibold leading-[1.05] tracking-tight text-balance text-[#f5eff6] md:text-6xl">
          Presets
        </h1>
        <p className="relative mt-4 max-w-2xl text-base text-pretty text-[#b8aebb] md:text-lg">
          Pick a finished look — UGC, product, posters, marketplace, editorial,
          or motion — then jump straight into the layout or workflow that makes
          it.
        </p>
      </section>

      {PRESET_CATEGORIES.map((cat) => {
        const presets = MARKETPLACE_PRESETS.filter(
          (p) => p.category === cat.id,
        );
        if (!presets.length) return null;
        return (
          <section key={cat.id} className="min-w-0">
            <div className="mb-4">
              <h2 className="text-2xl font-semibold text-balance text-[#f5eff6]">
                {cat.label}
              </h2>
              <p className="text-sm text-[#8d838f]">
                {presets.length} ready to open
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {presets.map((preset) => (
                <Link
                  key={preset.id}
                  href={preset.href}
                  className="glass block overflow-hidden rounded-[14px] transition hover:shadow-[0_16px_48px_rgb(90_70_110/16%)]"
                  style={{ background: `${CATEGORY_TINT[preset.category]}aa` }}
                >
                  <div
                    className="relative aspect-[16/10] overflow-hidden p-4"
                    style={{
                      background: `linear-gradient(145deg, ${CATEGORY_TINT[preset.category]}, #120a14)`,
                    }}
                  >
                    <span className="absolute bottom-3 left-3 rounded bg-white/15 px-2 py-1 text-[10px] uppercase tracking-wide text-[#f5eff6]">
                      {preset.defaultStyle}
                    </span>
                    <p className="relative mt-auto max-w-[14rem] text-lg font-semibold leading-tight text-[#f5eff6]">
                      {preset.tagline}
                    </p>
                  </div>
                  <div className="space-y-1 p-4">
                    <h3 className="text-base font-semibold text-[#f5eff6]">
                      {preset.name}
                    </h3>
                    <p className="text-sm text-[#8d838f]">{preset.description}</p>
                    <p className="pt-1 text-[11px] uppercase tracking-[0.1em] text-[#b8aebb]">
                      {preset.layoutId}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
