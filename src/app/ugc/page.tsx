import { JobRunner } from "@/components/studio/job-runner";
import { getVideoWorkflow } from "@/lib/video-workflows/catalog";
import { MANAGED_MOTION_LENGTHS, formQueryValues, legacyVideoEntry } from "@/lib/workflows";

const def = getVideoWorkflow("ugc")!;

export default async function Page({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  const values = formQueryValues(await searchParams ?? {});
  const legacy = legacyVideoEntry(values.legacy || "", values.preset || "", values);
  const fields = [
    { id: "brief", label: "What happens in the clip?", type: "textarea" as const, required: true, placeholder: "A cheerful cartoon raccoon unboxes a tiny espresso machine, proud reveal, playful gestures." },
    { id: "aspect", label: "Aspect", type: "select" as const, options: [{"label": "9:16", "value": "9:16"}, {"label": "1:1", "value": "1:1"}, {"label": "16:9", "value": "16:9"}] },
    { id: "duration", label: "Length", type: "select" as const, options: MANAGED_MOTION_LENGTHS.map((d) => ({ label: d.label, value: d.id })) },
  ];
  return (
    <div className="min-w-0 space-y-6">
      <header>
        <p className="text-xs uppercase tracking-wider text-[#e77ae6]">Video · 10–90 seconds</p>
        <h1 className="mt-2 text-3xl font-semibold text-[#f5eff6] md:text-5xl">Creator clips</h1>
        <p className="mt-2 max-w-2xl text-pretty text-[#b8aebb]">Creator-style motion concepts: reviews, demos, unboxing and outfit ideas. Managed clips are silent, without lip-sync or garment transfer.</p>
      </header>
      <div className="glass min-w-0 rounded-[14px] border border-white/10 p-4 md:p-6">
        <JobRunner
          tool="ugc"
          workflowSlug="ugc"
          fields={fields}
          presets={def.modes.map((m) => ({ ...m, label: m.id === "tryon" ? "Outfit concept" : m.label, description: m.id === "tryon" ? "Generated wardrobe idea; no garment transfer" : m.id === "review" ? "Silent creator gestures and product close-ups" : m.description }))}
          initialPresetId={legacy?.presetId || values.preset}
          initialValues={legacy?.inputs || values}
          accent={def.accent}
          submitLabel="Make the clip"
        />
      </div>
    </div>
  );
}
