import Link from "next/link";
import { IMAGE2_WRAPPERS } from "@/lib/wrappers/catalog";
import { WORKFLOWS } from "@/lib/workflows";
import { MARKETPLACE_PRESETS, PRESET_CATEGORIES } from "@/lib/studio/presets-marketplace";

const VIDEO_TOOLS = [
  { href: "/explainer", name: "Explainer", description: "Script and stylized motion scenes." },
  { href: "/ugc", name: "Creator clips", description: "Reviews, demos, outfit ideas and unboxing concepts." },
  { href: "/ad-multiplier", name: "Ad sequence", description: "One cut with hook, benefit and CTA beats." },
  { href: "/faceless", name: "Faceless story", description: "Visual stories without an on-camera host." },
  { href: "/director", name: "Director", description: "Short motion cut with a generated or uploaded soundtrack." },
];
const card = "glass min-w-0 rounded-[14px] border border-white/10 p-4 transition hover:border-white/30";

export default function HomePage() {
  return (
    <div className="min-w-0 space-y-8">
      <header className="glass-strong rounded-[14px] p-5 sm:p-8">
        <p className="text-xs uppercase tracking-wider text-[#e77ae6]">Fluxfield · personal art studio</p>
        <h1 className="mt-3 text-4xl font-semibold text-balance text-[#f5eff6] md:text-5xl">Make something delightfully silly.</h1>
        <p className="mt-4 max-w-2xl text-pretty text-[#b8aebb]">Start with a playful character or your own visual direction. Realism remains your choice. Create makes images and campaigns; this catalog keeps the distinct layouts, clean product art and short-motion tools together.</p>
        <div className="mt-5 flex flex-wrap gap-3">
          <Link href="/create" className="grid min-h-11 place-items-center rounded-[10px] bg-[#e77ae6] px-5 text-sm font-semibold text-black">Create an image</Link>
          <Link href="/create?mode=campaign" className="grid min-h-11 place-items-center rounded-[10px] border border-white/20 px-5 text-sm">Create a campaign</Link>
        </div>
        <p className="mt-4 text-xs text-[#8d838f]">House image, motion and music connections are managed in Settings. Optional cloud connections remain opt-in. Examples below are historical samples, not newly tested outputs.</p>
      </header>

      <section id="layouts" className="min-w-0 space-y-3">
        <h2 className="text-2xl font-semibold">Six composed layouts</h2>
        <p className="text-sm text-[#b8aebb]">Literal copy over generated or reused art. Text that cannot fit is reported, never silently shortened.</p>
        <div className="grid min-w-0 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {IMAGE2_WRAPPERS.map((wrapper) => (
            <Link key={wrapper.slug} href={`/image-2/${wrapper.slug}`} className={card}>
              {/* Static shipped samples never trigger generation while browsing. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`/examples/wrappers/${wrapper.slug}.webp`} alt={`Historical ${wrapper.name} layout sample`} loading="lazy" decoding="async" className="mb-3 h-48 w-full rounded-lg object-contain" />
              <h3 className="font-semibold">{wrapper.name}</h3>
              <p className="mt-1 text-sm text-[#b8aebb]">{wrapper.tagline}</p>
              <p className="mt-2 text-xs text-[#8d838f]">{wrapper.presets.length} directions · historical layout sample</p>
            </Link>
          ))}
        </div>
      </section>

      <section className="min-w-0 space-y-3">
        <h2 className="text-2xl font-semibold">Product art &amp; campaigns</h2>
        <div className="grid min-w-0 gap-3 sm:grid-cols-2">
          {WORKFLOWS.filter((w) => w.kind !== "video").map((workflow) => (
            <Link key={workflow.slug} href={`/workflows/${workflow.slug}`} className={card}>
              <h3 className="font-semibold">{workflow.name}</h3>
              <p className="mt-1 text-sm text-[#b8aebb]">{workflow.tagline}</p>
              <p className="mt-2 text-xs text-[#8d838f]">{workflow.outputKind === "image" ? "Clean images — no layout overlays" : "Composed artwork with printed copy"}</p>
            </Link>
          ))}
        </div>
      </section>

      <section className="min-w-0 space-y-3">
        <h2 className="text-2xl font-semibold">Short motion</h2>
        <p className="text-sm text-[#b8aebb]">10–90 seconds. Managed narration, lip-sync and source-clip remixing are unavailable. Director can add a music soundtrack.</p>
        <div className="grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {VIDEO_TOOLS.map((tool) => <Link key={tool.href} href={tool.href} className={card}><h3 className="font-semibold">{tool.name}</h3><p className="mt-1 text-sm text-[#b8aebb]">{tool.description}</p></Link>)}
        </div>
      </section>

      <section id="presets" className="min-w-0 space-y-3">
        <h2 className="text-2xl font-semibold">Preset shortcuts</h2>
        <p className="text-sm text-[#b8aebb]">Open an existing tool with this direction selected — not another generator.</p>
        {PRESET_CATEGORIES.map((category) => (
          <details key={category.id} className="glass rounded-xl border border-white/10 p-3">
            <summary className="min-h-11 cursor-pointer content-center font-medium">{category.label}</summary>
            <div className="mt-2 grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {MARKETPLACE_PRESETS.filter((p) => p.category === category.id).map((preset) => (
                <Link key={preset.id} href={preset.href} className="min-w-0 rounded-lg border border-white/10 p-3 hover:border-white/30"><h3 className="text-sm font-semibold">{preset.name}</h3><p className="mt-1 text-xs text-[#b8aebb]">{preset.description}</p></Link>
              ))}
            </div>
          </details>
        ))}
      </section>
    </div>
  );
}
