import { notFound } from "next/navigation";
import Link from "next/link";
import { getImage2Wrapper } from "@/lib/wrappers/catalog";
import { JobRunner } from "@/components/studio/job-runner";

export default async function Image2WrapperPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const wrapper = getImage2Wrapper(slug);
  if (!wrapper) notFound();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Link
            href="/"
            className="text-xs uppercase tracking-wider text-[#8d838f] hover:text-[#b8aebb]"
          >
            ← Image-2 gallery
          </Link>
          <h1 className="mt-2 font-[family-name:var(--font-display)] text-3xl text-white md:text-4xl">
            {wrapper.name}
          </h1>
          <p className="mt-1 max-w-2xl text-[#b8aebb]">{wrapper.tagline}</p>
        </div>
        <div
          className="rounded-2xl px-4 py-3 text-sm font-semibold text-black"
          style={{ background: wrapper.accent }}
        >
          {wrapper.brandSample}
        </div>
      </div>

      <JobRunner
        tool="image2"
        workflowSlug={wrapper.slug}
        fields={wrapper.inputs}
        presets={wrapper.presets}
        accent={wrapper.accent}
        submitLabel="Compose wrapper"
      />
    </div>
  );
}
