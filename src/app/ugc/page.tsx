"use client";

import { useMemo } from "react";
import { JobRunner } from "@/components/studio/job-runner";
import { getVideoWorkflow } from "@/lib/video-workflows/catalog";
import { EXPLAINER_DURATIONS } from "@/lib/explainer/presets";

const def = getVideoWorkflow("ugc")!;

export default function UgcPage() {
  const fields = useMemo(
    () => [
      {
        id: "brief",
        label: "What is the video about?",
        type: "textarea" as const,
        required: true,
        placeholder:
          "Honest review of a matte lipstick — warm light, bathroom mirror, soft voice.",
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
        id: "duration",
        label: "Length",
        type: "select" as const,
        options: EXPLAINER_DURATIONS.map((d) => ({
          label: d.label,
          value: d.id,
        })),
      },
      {
        id: "voice",
        label: "Voice",
        type: "select" as const,
        options: [
          { label: "Default", value: "default" },
          { label: "Warm", value: "warm" },
          { label: "Bright", value: "bright" },
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
          tool="ugc"
          workflowSlug="ugc"
          fields={fields}
          presets={def.modes.map((m) => ({
            id: m.id,
            label: m.label,
            description: m.description,
          }))}
          accent={def.accent}
          submitLabel="Make the clip"
        />
      </div>
    </div>
  );
}
