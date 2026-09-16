"use client";

import { useMemo, useState } from "react";
import {
  EXPLAINER_DURATIONS,
  EXPLAINER_PRESETS,
  EXPLAINER_VOICES,
} from "@/lib/explainer/presets";
import { useStudioConnection } from "@/lib/studio/use-studio-connection";
import { JobRunner } from "@/components/studio/job-runner";

export default function ExplainerPage() {
  const { settings, zermo, error } = useStudioConnection();
  const [presetId, setPresetId] = useState(EXPLAINER_PRESETS[0].id);
  const preset =
    EXPLAINER_PRESETS.find((p) => p.id === presetId) ?? EXPLAINER_PRESETS[0];

  const fields = useMemo(
    () => [
      {
        id: "topic",
        label: "What should the story explain?",
        type: "textarea" as const,
        required: true,
        placeholder: "A topic, or the story you want told.",
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
        label: "Planned duration",
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
    ].filter((field) => (settings && !zermo) || !["voice", "subtitles"].includes(field.id)),
    [settings, zermo],
  );

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.25em] text-[#e77ae6]">
          Explainer
        </p>
        <h1 className="mt-2 font-[family-name:var(--font-display)] text-3xl text-white md:text-5xl">
          Explain with a script and scene art
        </h1>
        <p className="mt-2 max-w-2xl text-[#b8aebb]">
          Script, Flux.1 stills, WAN 49f last-frame chain, and VO when TTS is up.
        </p>
      </div>

      <p className="text-sm text-[#b8aebb]">Six styles of Flux.1-dev Q4, not six different models.</p>
      {error ? <p role="alert" className="text-sm text-red-400">{error}</p> : null}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {EXPLAINER_PRESETS.map((p) => {
          const active = p.id === presetId;
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => setPresetId(p.id)}
              aria-pressed={active}
              className="relative overflow-hidden rounded-2xl border text-left transition"
              style={{
                borderColor: active ? "#a845b0" : "rgba(255,255,255,0.1)",
              }}
            >
              <div className="relative aspect-video bg-black/20">
                {/* Static WebP samples are already downsized; preserve their provenance. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.previewImage} alt={`${p.name} — Flux.1-dev Q4 generated still sample`} loading="lazy" decoding="async" width={640} height={360} className="h-full w-full object-cover" />
                {active ? (
                  <span className="absolute left-2 top-2 flex size-6 items-center justify-center rounded-full bg-[#d565d6] text-xs font-bold text-black">
                    ✓
                  </span>
                ) : null}
                <span className="absolute bottom-2 left-2 rounded bg-white/15 px-2 py-1 text-[10px] uppercase tracking-wide text-[#f5eff6]">
                  {p.overlayHint}
                </span>
              </div>
              <div className="bg-white/15 p-3">
                <div className="text-sm font-medium text-[#f5eff6]">{p.styleAlias}</div>
                <div className="text-xs text-[#8d838f]">{p.blurb}</div>
                <p className="mt-1 text-xs text-[#b8aebb]">Example: {p.example}</p>
                <p className="mt-2 text-[10px] text-[#b8aebb]">Flux.1-dev Q4 · generated still sample, not video</p>
              </div>
            </button>
          );
        })}
      </div>

      <div className="rounded-[24px] border border-white/10 glass p-5 md:p-6">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-xs uppercase tracking-wider text-[#8d838f]">
              Look
            </div>
            <div className="text-lg text-[#f5eff6]">{preset.name}</div>
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
          disabled={!settings}
          submitLabel={zermo || !settings ? "Make script + scene art" : "Make the explainer"}
        />
      </div>
    </div>
  );
}
