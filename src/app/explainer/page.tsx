"use client";

import { useMemo, useState } from "react";
import {
  EXPLAINER_DURATIONS,
  EXPLAINER_PRESETS,
  EXPLAINER_VOICES,
} from "@/lib/explainer/presets";
import { JobRunner } from "@/components/studio/job-runner";

export default function ExplainerPage() {
  const [presetId, setPresetId] = useState(EXPLAINER_PRESETS[0].id);
  const preset =
    EXPLAINER_PRESETS.find((p) => p.id === presetId) ?? EXPLAINER_PRESETS[0];

  const fields = useMemo(
    () => [
      {
        id: "topic",
        label: "What should the video explain?",
        type: "textarea" as const,
        required: true,
        placeholder: "Type a topic, or describe the story you want told.",
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
        id: "duration",
        label: "Duration",
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
        options: EXPLAINER_VOICES.map((v) => ({
          label: v.label,
          value: v.id,
        })),
      },
      {
        id: "subtitles",
        label: "Subtitles",
        type: "select" as const,
        options: [
          { label: "Off", value: "off" },
          { label: "On", value: "on" },
        ],
      },
    ],
    [],
  );

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.25em] text-[#a845b0]">
          Explainer
        </p>
        <h1 className="mt-2 font-[family-name:var(--font-display)] text-3xl text-white md:text-5xl">
          Style presets → script → beats → VO
        </h1>
        <p className="mt-2 max-w-2xl text-[#6f6577]">
          Higgsfield-style explainer container. Pick a visual language, describe
          the topic, then Fieldbench routes script (Ollama), frames (Comfy/mock),
          voice (Piper / OpenAI-compatible TTS), and optional FFmpeg assemble to
          your offline box.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {EXPLAINER_PRESETS.map((p) => {
          const active = p.id === presetId;
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => setPresetId(p.id)}
              className="relative overflow-hidden rounded-2xl border text-left transition"
              style={{
                borderColor: active ? "#a845b0" : "rgba(255,255,255,0.1)",
              }}
            >
              <div
                className="relative aspect-video"
                style={{
                  background: `linear-gradient(145deg, ${p.preview.join(",")})`,
                }}
              >
                {active ? (
                  <span className="absolute left-2 top-2 flex size-6 items-center justify-center rounded-full bg-[#a845b0] text-xs font-bold text-black">
                    ✓
                  </span>
                ) : null}
                <span className="absolute bottom-2 left-2 rounded bg-white/70 px-2 py-1 text-[10px] uppercase tracking-wide text-[#2e2833]">
                  {p.overlayHint}
                </span>
              </div>
              <div className="bg-white/70 p-3">
                <div className="text-sm font-medium text-[#2e2833]">{p.name}</div>
                <div className="text-xs text-[#8d8296]">{p.blurb}</div>
              </div>
            </button>
          );
        })}
      </div>

      <div className="rounded-[24px] border border-[#e7dfe8] glass p-5 md:p-6">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-xs uppercase tracking-wider text-[#8d8296]">
              Active style
            </div>
            <div className="text-lg text-[#2e2833]">{preset.name}</div>
          </div>
          <div
            className="rounded-full px-3 py-1 text-xs font-semibold text-black"
            style={{ background: preset.accent }}
          >
            {preset.overlayHint}
          </div>
        </div>

        <JobRunner
          key={presetId}
          tool="explainer"
          workflowSlug="explainer"
          fields={fields}
          presets={[
            {
              id: preset.id,
              label: preset.name,
              description: preset.blurb,
            },
          ]}
          accent="#e77ae6"
          submitLabel="Generate explainer"
        />
      </div>
    </div>
  );
}
