"use client";

import { useMemo } from "react";
import { JobRunner } from "@/components/studio/job-runner";
import { getVideoWorkflow } from "@/lib/video-workflows/catalog";

const def = getVideoWorkflow("ad-multiplier")!;

export default function AdMultiplierPage() {
  const fields = useMemo(
    () => [
      {
        id: "brief",
        label: "What should every cut sell?",
        type: "textarea" as const,
        required: true,
        placeholder:
          "Wireless earbuds — quiet commute, clear calls, all-day charge. Bold first second.",
      },
      {
        id: "aspect",
        label: "Aspect",
        type: "select" as const,
        options: [
          { label: "9:16", value: "9:16" },
          { label: "1:1", value: "1:1" },
          { label: "16:9", value: "16:9" },
        ],
      },
      {
        id: "sourceVideoPath",
        label: "Source clip path (optional)",
        type: "text" as const,
        placeholder: "Leave blank to plan variants from the brief alone",
        help: "If you already have a master clip on disk, paste its path. Otherwise we still build a full variant board.",
      },
      {
        id: "voice",
        label: "Voice",
        type: "select" as const,
        options: [
          { label: "Default", value: "default" },
          { label: "Urgent", value: "urgent" },
          { label: "Calm", value: "calm" },
        ],
      },
    ],
    [],
  );

  return (
    <div className="space-y-6">
      <div>
        <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#e77ae6]">
          Video
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-balance text-[#f5eff6] md:text-5xl">
          {def.name}
        </h1>
        <p className="mt-2 max-w-2xl text-pretty text-[#b8aebb]">{def.tagline}</p>
      </div>

      <div className="glass rounded-[14px] border border-white/10 p-5 md:p-6">
        <JobRunner
          tool="ad-multiplier"
          workflowSlug="ad-multiplier"
          fields={fields}
          presets={def.modes.map((m) => ({
            id: m.id,
            label: m.label,
            description: m.description,
          }))}
          accent={def.accent}
          submitLabel="Make the variants"
        />
      </div>
    </div>
  );
}
