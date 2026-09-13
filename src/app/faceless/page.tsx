"use client";

import { useMemo } from "react";
import { JobRunner } from "@/components/studio/job-runner";
import { getVideoWorkflow } from "@/lib/video-workflows/catalog";

const def = getVideoWorkflow("faceless")!;

export default function FacelessPage() {
  const fields = useMemo(
    () => [
      {
        id: "brief",
        label: "What should the video cover?",
        type: "textarea" as const,
        required: true,
        placeholder:
          "How compound interest grows a small monthly save — calm voice, simple charts, soft color.",
      },
      {
        id: "aspect",
        label: "Aspect",
        type: "select" as const,
        options: [
          { label: "16:9", value: "16:9" },
          { label: "9:16", value: "9:16" },
          { label: "1:1", value: "1:1" },
        ],
      },
      {
        id: "voice",
        label: "Voice",
        type: "select" as const,
        options: [
          { label: "Default", value: "default" },
          { label: "Story", value: "story" },
          { label: "Kids", value: "kids" },
        ],
      },
      {
        id: "script",
        label: "Narration (optional)",
        type: "textarea" as const,
        placeholder: "Paste a script, or leave blank and we write from the brief.",
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
          tool="faceless"
          workflowSlug="faceless"
          fields={fields}
          presets={def.modes.map((m) => ({
            id: m.id,
            label: m.label,
            description: m.description,
          }))}
          accent={def.accent}
          submitLabel="Make the video"
        />
      </div>
    </div>
  );
}
