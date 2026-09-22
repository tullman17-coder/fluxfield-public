import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { formQueryValues } from "@/lib/workflows";
import { getWorkflow } from "@/lib/workflows";
import { JobRunner } from "@/components/studio/job-runner";

export default async function WorkflowPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { slug } = await params;
  const values = formQueryValues(await searchParams ?? {});
  const workflow = getWorkflow(slug);
  if (!workflow) notFound();
  if (workflow.kind === "video") {
    const query = new URLSearchParams({ ...values, legacy: workflow.slug, preset: values.preset || workflow.presets[0].id });
    redirect(`/ugc?${query}`);
  }

  return (
    <div className="min-w-0 space-y-6">
      <div>
        <Link
          href="/#presets"
          className="text-xs uppercase tracking-wider text-[#8d838f] hover:text-[#b8aebb]"
        >
          ← Catalog
        </Link>
        <h1 className="mt-2 font-[family-name:var(--font-display)] text-3xl text-[#f5eff6]">
          {workflow.name}
        </h1>
        <p className="text-[#b8aebb]">{workflow.tagline}</p>
      </div>
      <JobRunner
        tool="workflow"
        workflowSlug={workflow.slug}
        initialPresetId={values.preset}
        initialValues={values}
        fields={workflow.inputs}
        presets={workflow.presets}
        accent={workflow.accent}
        submitLabel="Generate"
      />
    </div>
  );
}
