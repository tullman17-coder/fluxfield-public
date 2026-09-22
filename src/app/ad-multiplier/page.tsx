import { JobRunner } from "@/components/studio/job-runner";
import { getVideoWorkflow } from "@/lib/video-workflows/catalog";
import { MANAGED_MOTION_LENGTHS, formQueryValues } from "@/lib/workflows";

const def = getVideoWorkflow("ad-multiplier")!;

export default async function Page({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  const values = formQueryValues(await searchParams ?? {});
  const fields = [
    { id: "brief", label: "What should this sequence show?", type: "textarea" as const, required: true, placeholder: "Wireless earbuds — a silly commuter escapes a noisy bus into a quiet cartoon bubble." },
    { id: "aspect", label: "Aspect", type: "select" as const, options: [{"label": "9:16", "value": "9:16"}, {"label": "1:1", "value": "1:1"}, {"label": "16:9", "value": "16:9"}] },
    { id: "duration", label: "Length", type: "select" as const, options: MANAGED_MOTION_LENGTHS.map((d) => ({ label: d.label, value: d.id })) },
  ];
  return (
    <div className="min-w-0 space-y-6">
      <header>
        <p className="text-xs uppercase tracking-wider text-[#e77ae6]">Video · 10–90 seconds</p>
        <h1 className="mt-2 text-3xl font-semibold text-[#f5eff6] md:text-5xl">Ad sequence</h1>
        <p className="mt-2 max-w-2xl text-pretty text-[#b8aebb]">One generated sequence per run: hook, benefit, proof and CTA. Independent A/B variants, hook packs, angle packs and source-clip remixing are unavailable.</p>
      </header>
      <div className="glass min-w-0 rounded-[14px] border border-white/10 p-4 md:p-6">
        <JobRunner
          tool="ad-multiplier"
          workflowSlug="ad-multiplier"
          fields={fields}
          presets={def.modes.filter((m) => m.id === "variants").map((m) => ({ ...m, label: "Ad sequence", description: "Hook, benefit, proof and CTA beats in one cut" }))}
          initialPresetId={values.preset}
          initialValues={values}
          accent={def.accent}
          submitLabel="Make the sequence"
        />
      </div>
    </div>
  );
}
