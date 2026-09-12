import Link from "next/link";
import { WORKFLOWS } from "@/lib/workflows";

export default function WorkflowsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-[family-name:var(--font-display)] text-3xl text-[#2e2833]">
          Marketing desk
        </h1>
        <p className="text-[#6f6577]">
          Classic studio tools — product shots, ad packs, UGC, motion briefs.
          For composed campaign wrappers, use{" "}
          <Link href="/" className="text-[#a845b0]">
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
            className="rounded-2xl border border-[#e7dfe8] glass p-5 transition hover:border-[#c8b7d0]"
          >
            <div
              className="mb-3 size-2.5 rounded-full"
              style={{ background: w.accent }}
            />
            <div className="text-lg text-[#2e2833]">{w.name}</div>
            <p className="mt-1 text-sm text-[#8d8296]">{w.tagline}</p>
            <p className="mt-3 text-xs text-[#8d8296]">{w.durationHint}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
