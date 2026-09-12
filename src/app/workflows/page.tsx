import Link from "next/link";
import { WORKFLOWS } from "@/lib/workflows";

export default function WorkflowsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-[family-name:var(--font-display)] text-3xl text-[#f5eff6]">
          Marketing desk
        </h1>
        <p className="text-[#b8aebb]">
          Classic studio tools — product shots, ad packs, UGC, motion briefs.
          For composed campaign wrappers, use{" "}
          <Link href="/" className="text-[#e77ae6]">
            Image-2
          </Link>
          .
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {WORKFLOWS.map((w) => (
          <Link
            key={w.slug}
            href={`/workflows/${w.slug}`}
            className="rounded-2xl border border-white/10 glass p-5 transition hover:border-white/25"
          >
            <div
              className="mb-3 size-2.5 rounded-full"
              style={{ background: w.accent }}
            />
            <div className="text-lg text-[#f5eff6]">{w.name}</div>
            <p className="mt-1 text-sm text-[#8d838f]">{w.tagline}</p>
            <p className="mt-3 text-xs text-[#8d838f]">{w.durationHint}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
