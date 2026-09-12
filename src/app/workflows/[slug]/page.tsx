import { notFound } from "next/navigation";
import Link from "next/link";
import { getWorkflow } from "@/lib/workflows";
import { JobRunner } from "@/components/studio/job-runner";

export default async function WorkflowPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const workflow = getWorkflow(slug);
  if (!workflow) notFound();

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/workflows"
          className="text-xs uppercase tracking-wider text-[#8d8296] hover:text-[#6f6577]"
        >
          ← Marketing desk
        </Link>
        <h1 className="mt-2 font-[family-name:var(--font-display)] text-3xl text-[#2e2833]">
          {workflow.name}
        </h1>
        <p className="text-[#6f6577]">{workflow.tagline}</p>
      </div>
      <JobRunner
        tool="workflow"
        workflowSlug={workflow.slug}
        fields={workflow.inputs}
        presets={workflow.presets}
        accent={workflow.accent}
        submitLabel="Generate"
      />
    </div>
  );
}
