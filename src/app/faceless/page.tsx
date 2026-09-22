import { JobRunner } from "@/components/studio/job-runner";
import { getVideoWorkflow } from "@/lib/video-workflows/catalog";
import { MANAGED_MOTION_LENGTHS, formQueryValues } from "@/lib/workflows";

const def = getVideoWorkflow("faceless")!;

export default async function Page({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  const values = formQueryValues(await searchParams ?? {});
  const fields = [
    { id: "brief", label: "What should the video cover?", type: "textarea" as const, required: true, placeholder: "A friendly cartoon piggy bank grows a garden of coins, simple visual steps and a silly payoff." },
    { id: "aspect", label: "Aspect", type: "select" as const, options: [{"label": "16:9", "value": "16:9"}, {"label": "9:16", "value": "9:16"}, {"label": "1:1", "value": "1:1"}] },
    { id: "duration", label: "Length", type: "select" as const, options: MANAGED_MOTION_LENGTHS.map((d) => ({ label: d.label, value: d.id })) },
  ];
  return (
    <div className="min-w-0 space-y-6">
      <header>
        <p className="text-xs uppercase tracking-wider text-[#e77ae6]">Video · 10–90 seconds</p>
        <h1 className="mt-2 text-3xl font-semibold text-[#f5eff6] md:text-5xl">Faceless story</h1>
        <p className="mt-2 max-w-2xl text-pretty text-[#b8aebb]">Visual stories without an on-camera host. Managed motion is silent; put the story and visual direction in the brief.</p>
      </header>
      <div className="glass min-w-0 rounded-[14px] border border-white/10 p-4 md:p-6">
        <JobRunner
          tool="faceless"
          workflowSlug="faceless"
          fields={fields}
          presets={def.modes}
          initialPresetId={values.preset}
          initialValues={values}
          accent={def.accent}
          submitLabel="Make the story"
        />
      </div>
    </div>
  );
}
