"use client";

import { use, useMemo, useState } from "react";
import {
  EXPLAINER_PRESETS,
} from "@/lib/explainer/presets";
import { useStudioConnection } from "@/lib/studio/use-studio-connection";
import { MANAGED_MOTION_LENGTHS, formQueryValues } from "@/lib/workflows";
import { JobRunner } from "@/components/studio/job-runner";

export default function ExplainerPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const values = formQueryValues(use(searchParams));
  const { settings, error } = useStudioConnection();
  const [presetId, setPresetId] = useState(EXPLAINER_PRESETS.find((p) => p.id === values.preset)?.id || "stickman-cartoon");
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
        label: "Length (10–90 seconds)",
        type: "select" as const,
        options: MANAGED_MOTION_LENGTHS.map((d) => ({
          label: d.label,
          value: d.id,
        })),
      },
    ],
    [],
  );

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.25em] text-[#e77ae6]">
          Explainer
        </p>
        <h1 className="mt-2 font-[family-name:var(--font-display)] text-3xl text-white md:text-5xl">
          Explain with a short visual story
        </h1>
        <p className="mt-2 max-w-2xl text-[#b8aebb]">
          Script and generated motion scenes. Managed narration is unavailable; optional TTS on other connections must be configured and reachable.
        </p>
      </div>

      <p className="text-sm text-[#b8aebb]">Six styles of Qwen-Image-2.1, not six different models.</p>
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
                <img src={p.previewImage} alt={`${p.name} — Qwen-Image-2.1 generated still sample`} loading="lazy" decoding="async" width={640} height={360} className="h-full w-full object-cover" />
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
                <p className="mt-2 text-[10px] text-[#b8aebb]">Qwen-Image-2.1 · generated still sample, not video</p>
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
          tool="explainer"
          workflowSlug="explainer"
          fields={fields}
          presets={EXPLAINER_PRESETS.map((p) => ({ id: p.id, label: p.name, description: p.blurb }))}
          selectedPresetId={presetId}
          onPresetChange={setPresetId}
          showPresets={false}
          initialValues={values}
          accent="#e77ae6"
          disabled={!settings}
          submitLabel="Make the visual story"
        />
      </div>
    </div>
  );
}
