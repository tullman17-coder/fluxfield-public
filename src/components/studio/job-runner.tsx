"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import type { JobTool } from "@/lib/adapters/types";
import { useJobWatch } from "@/lib/jobs/use-job-watch";
import {
  jobRunnerSupportsVisualQa,
  jobStatusLabel,
} from "@/lib/studio/presentation";
import { useStudioConnection } from "@/lib/studio/use-studio-connection";
import { ZermoJobStatus } from "./zermo-job-status";
import { DREAM_PRESETS, FRAMINGS } from "@/lib/dream/presets";
import { getWorkflow, MANAGED_MOTION_LENGTHS } from "@/lib/workflows";
import type { BrandKit } from "@/lib/brand-kits/types";
import { MediaLightbox } from "@/components/studio/media-lightbox";

type Field = {
  id: string;
  label: string;
  type: "text" | "textarea" | "select" | "file";
  placeholder?: string;
  required?: boolean;
  options?: { label: string; value: string }[];
  help?: string;
};

type Props = {
  tool: JobTool;
  workflowSlug: string;
  fields: Field[];
  presets: { id: string; label: string; description?: string }[];
  accent?: string;
  submitLabel?: string;
  disabled?: boolean;
  initialPresetId?: string;
  initialValues?: Record<string, string>;
  selectedPresetId?: string;
  onPresetChange?: (id: string) => void;
  showPresets?: boolean;
};

export function JobRunner({
  tool,
  workflowSlug,
  fields,
  presets,
  accent = "#e77ae6",
  submitLabel = "Generate",
  disabled = false,
  initialPresetId,
  initialValues = {},
  selectedPresetId,
  onPresetChange,
  showPresets = true,
}: Props) {
  const { zermo } = useStudioConnection();
  const video = ["ugc", "ad-multiplier", "faceless"].includes(tool);
  const motion = video || tool === "explainer";
  const composition = tool === "image2" || (tool === "workflow" && getWorkflow(workflowSlug)?.outputKind === "composition");
  const [localPresetId, setPresetId] = useState(
    presets.find((p) => p.id === initialPresetId)?.id || presets[0]?.id || "",
  );
  const presetId = selectedPresetId ?? localPresetId;
  const [values, setValues] = useState<Record<string, string>>(() => ({
    ...Object.fromEntries(fields.filter((f) => f.type !== "file").map((f) => [f.id,
      f.type === "select"
        ? f.options?.find((o) => o.value === initialValues[f.id])?.value || (f.id === "duration" && motion ? "30s" : f.options?.[0]?.value || "")
        : initialValues[f.id] ?? "",
    ])),
    dreamStyle: DREAM_PRESETS.find((p) => p.id !== "auto" && p.id === initialValues.dreamStyle)?.id || "",
    framing: FRAMINGS.find((f) => f.id === initialValues.framing)?.id || "auto",
    visualQa: initialValues.visualQa === "off" ? "off" : "on",
  }));
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [kits, setKits] = useState<BrandKit[]>([]);
  const [activeMedia, setActiveMedia] = useState<string | null>(null);
  const { job, setJob } = useJobWatch(`${tool}:${workflowSlug}`);
  const supportsVisualQa = jobRunnerSupportsVisualQa(tool);

  useEffect(() => {
    if (!composition) return;
    let alive = true;
    fetch("/api/brand-kits")
      .then((r) => r.json())
      .then((data) => {
        if (alive && Array.isArray(data.kits)) setKits(data.kits);
      })
      .catch(() => {
        // picker stays empty — jobs still run without a kit
      });
    return () => {
      alive = false;
    };
  }, [composition]);

  const fileField = useMemo(
    () => fields.find((f) => f.type === "file") || (composition ? { id: "referenceImage", label: "Reference / finished art (optional)", type: "file" as const } : undefined),
    [fields, composition],
  );

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (disabled || busy || job?.status === "queued" || job?.status === "running") return;
    setBusy(true);
    setError(null);
    try {
      if (values.composeOnly === "on" && !file && !values.referenceImageUrl?.trim()) {
        throw new Error("Layout-only reuse needs an uploaded image or reference image URL.");
      }
      const form = new FormData();
      form.set("tool", tool);
      form.set("workflowSlug", workflowSlug);
      form.set("presetId", presetId);
      const inputs = { ...values };
      for (const field of fields) {
        if (field.type === "select" && !inputs[field.id]) inputs[field.id] = field.options?.[0]?.value || "";
      }
      if (motion) {
        const length = MANAGED_MOTION_LENGTHS.find((d) => d.id === inputs.duration);
        if (!length) throw new Error("Choose a supported motion length (10–90 seconds).");
        inputs.seconds = String(length.seconds);
        inputs.voice = "none";
        inputs.subtitles = "off";
      }
      form.set("inputs", JSON.stringify(inputs));
      if (file) form.set("referenceImage", file);
      if (!file && values.referenceImageUrl?.trim()) form.set("referenceImageUrl", values.referenceImageUrl.trim());
      const res = await fetch("/api/jobs", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Job failed");
      setJob(data.job);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-8 min-w-0 lg:grid-cols-[minmax(0,360px)_minmax(0,1fr)]">
      <form onSubmit={onSubmit} className="min-w-0 space-y-5">
        {showPresets ? <div>
          <Label className="mb-2 block text-xs uppercase tracking-wider text-[#8d838f]">
            Preset
          </Label>
          <div className="grid gap-2">
            {presets.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => onPresetChange ? onPresetChange(p.id) : setPresetId(p.id)}
                aria-pressed={presetId === p.id}
                className="rounded-xl border px-3 py-2 text-left transition-colors"
                style={{
                  borderColor: presetId === p.id ? accent : "rgba(255,255,255,0.1)",
                  background:
                    presetId === p.id ? `${accent}18` : "transparent",
                }}
              >
                <div className="text-sm font-medium">{p.label}</div>
                {p.description ? (
                  <div className="text-xs text-[#8d838f]">{p.description}</div>
                ) : null}
              </button>
            ))}
          </div>
        </div> : null}

        {motion ? <p className="text-xs text-[#b8aebb]">Narration unavailable in this form. Clips are silent. A configured TTS backend is required before adding spoken narration. Length is 10–90 seconds.</p> : null}

        {fields
          .filter((f) => f.type !== "file")
          .map((field) => (
            <div key={field.id} className="space-y-2">
              <Label htmlFor={field.id}>{field.label}</Label>
              {field.type === "textarea" ? (
                <Textarea
                  id={field.id}
                  required={field.required}
                  placeholder={field.placeholder}
                  value={values[field.id] || ""}
                  onChange={(e) =>
                    setValues((v) => ({ ...v, [field.id]: e.target.value }))
                  }
                  className="min-h-24 border-white/10 bg-white/10"
                />
              ) : field.type === "select" ? (
                <select
                  id={field.id}
                  className="flex h-10 w-full rounded-lg border border-white/10 bg-white/5 px-3 text-sm"
                  value={values[field.id] || field.options?.[0]?.value || ""}
                  onChange={(e) =>
                    setValues((v) => ({ ...v, [field.id]: e.target.value }))
                  }
                >
                  {field.options?.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              ) : (
                <Input
                  id={field.id}
                  required={field.required}
                  placeholder={field.placeholder}
                  value={values[field.id] || ""}
                  onChange={(e) =>
                    setValues((v) => ({ ...v, [field.id]: e.target.value }))
                  }
                  className="border-white/10 bg-white/10"
                />
              )}
              {field.help ? (
                <p className="text-xs text-[#8d838f]">{field.help}</p>
              ) : null}
            </div>
          ))}

        <div className="grid gap-3 sm:grid-cols-2">
          {tool !== "explainer" ? <div className="space-y-2">
            <Label htmlFor="dreamStyle">Look</Label>
            <select
              id="dreamStyle"
              className="flex h-10 w-full rounded-lg border border-white/10 bg-white/5 px-3 text-sm"
              value={values.dreamStyle || ""}
              onChange={(e) =>
                setValues((v) => ({ ...v, dreamStyle: e.target.value }))
              }
            >
              <option value="">Follow selected preset / brief</option>
              {DREAM_PRESETS.filter((p) => p.id !== "auto").map((p) => (
                <option key={p.id} value={p.id}>
                  {zermo ? `Qwen 2.1 · ${p.label}` : p.label}
                </option>
              ))}
            </select>
            <p className="text-xs text-[#8d838f]">
              {zermo ? "Prompt styles on Qwen-Image-2.1 (qwen-image-2.1-Q4_K_M.gguf), not separate models." : "Sets the overall finish of the art."}
            </p>
          </div> : null}
          {!video ? <div className="space-y-2">
            <Label htmlFor="framing">Framing</Label>
            <select
              id="framing"
              className="flex h-10 w-full rounded-lg border border-white/10 bg-white/5 px-3 text-sm"
              value={values.framing || "auto"}
              onChange={(e) =>
                setValues((v) => ({ ...v, framing: e.target.value }))
              }
            >
              {FRAMINGS.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.label}
                </option>
              ))}
            </select>
          </div> : null}
        </div>

        {composition ? <div className="space-y-2">
          <Label htmlFor="brandKitId">Layout palette</Label>
          <select
            id="brandKitId"
            className="flex h-10 w-full rounded-lg border border-white/10 bg-white/5 px-3 text-sm"
            value={values.brandKitId || ""}
            onChange={(e) =>
              setValues((v) => ({ ...v, brandKitId: e.target.value }))
            }
          >
            <option value="">
              {kits.length ? "None — use layout colors" : "No kits yet"}
            </option>
            {kits.map((kit) => (
              <option key={kit.id} value={kit.id}>
                {kit.name}
              </option>
            ))}
          </select>
          <p className="text-xs text-[#8d838f]">
            Only accent, surface and text colors are used — not kit fonts, logos or tone.
          </p>
        </div> : null}

        {supportsVisualQa ? (
          <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-white/10 bg-white/5 p-3">
            <input
              type="checkbox"
              checked={values.visualQa === "on"}
              onChange={(event) => {
                const on = event.currentTarget.checked;
                setValues((current) => ({ ...current, visualQa: on ? "on" : "off" }));
              }}
              className="mt-1 size-4 accent-[#d565d6]"
            />
            <span>
              <strong className="block text-sm text-[#f5eff6]">
                Visual adherence check
              </strong>
              <small className="mt-1 block text-xs leading-normal text-[#8d838f]">
                On by default. A failed or unavailable review blocks completion,
                while retaining the generated output for inspection. Model review can miss identity, color and count errors. Inspect reference edits yourself.
              </small>
            </span>
          </label>
        ) : null}

        {fileField ? (
          <div className="min-w-0 space-y-2">
            {composition ? <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" checked={values.composeOnly === "on"} onChange={(e) => { const composeOnly = e.currentTarget.checked ? "on" : "off"; setValues((v) => ({ ...v, composeOnly })); }} className="mt-1 size-4" />
              <span>Use image as finished art (layout only)<small className="mt-1 block text-xs text-[#8d838f]">Upload saved art below. Skips image generation; your literal copy and selected layout are applied to it.</small></span>
            </label> : null}
            <Label htmlFor="ref">{fileField.label}</Label>
            <Input
              id="ref"
              type="file"
              accept="image/*"
              className="border-white/10 bg-white/10"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
            />
            <Label htmlFor="refUrl">Or reference image URL</Label>
            <Input
              id="refUrl"
              type="url"
              placeholder="or paste an image URL"
              value={values.referenceImageUrl || ""}
              onChange={(e) => {
                const referenceImageUrl = e.currentTarget.value;
                setValues((v) => ({ ...v, referenceImageUrl }));
              }}
              className="border-white/10 bg-white/10"
            />
          </div>
        ) : null}

        {error ? <p className="text-sm text-red-400">{error}</p> : null}

        <Button
          type="submit"
          disabled={disabled || busy || job?.status === "queued" || job?.status === "running"}
          className="w-full font-semibold text-black"
          style={{ backgroundColor: accent }}
        >
          {busy ? "Starting…" : submitLabel}
        </Button>
      </form>

      <div className="min-w-0 space-y-4">
        {!job ? (
          <div className="flex min-h-64 items-center justify-center rounded-2xl border border-dashed border-white/10 text-sm text-[#8d838f]">
            Your finished pieces show up here.
          </div>
        ) : (
          <>
            <div className="rounded-2xl border border-white/10 glass p-4">
              <div className="flex min-w-0 flex-wrap items-center justify-between gap-3 text-sm">
                <span className="text-[#b8aebb]">
                  {job.workflowName} · {job.presetLabel}
                </span>
                <span style={{ color: accent }}>
                  {jobStatusLabel(job)}
                </span>
              </div>
              {job.error ? (
                <p className="mt-2 text-sm text-red-400">{job.error}</p>
              ) : null}
              <ZermoJobStatus job={job} onResume={setJob} />
              {job.script ? (
                <details className="mt-3">
                  <summary className="cursor-pointer list-none text-xs text-[#8d838f] [&::-webkit-details-marker]:hidden">
                    Settings used
                  </summary>
                  <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap rounded-xl bg-white/10 p-3 text-xs text-[#b8aebb]">
                    {job.script}
                  </pre>
                </details>
              ) : null}
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {job.outputs
                .filter((o) => o.url)
                .slice()
                .sort((a, b) => {
                  if (a.id === job.primaryOutputId) return -1;
                  if (b.id === job.primaryOutputId) return 1;
                  const aHero = /creative|layout/i.test(a.label);
                  const bHero = /creative|layout/i.test(b.label);
                  if (aHero !== bHero) return aHero ? -1 : 1;
                  return 0;
                })
                .map((o) =>
                  o.kind === "video" ? (
                    <div
                      key={o.id}
                      className="overflow-hidden rounded-2xl border border-white/10 bg-white/10"
                    >
                      <video
                        src={o.url}
                        controls
                        playsInline
                        preload="metadata"
                        className="w-full"
                      />
                    </div>
                  ) : o.kind === "audio" ? (
                    <div
                      key={o.id}
                      className="overflow-hidden rounded-2xl border border-white/10 bg-white/10 p-4"
                    >
                      <div className="mb-2 text-sm">{o.label}</div>
                      <audio
                        src={o.url}
                        controls
                        preload="none"
                        className="w-full"
                      />
                    </div>
                  ) : (
                    <button
                      key={o.id}
                      type="button"
                      onClick={() => setActiveMedia(o.url!)}
                      className="overflow-hidden rounded-2xl border border-white/10 bg-white/10 text-left"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={o.url}
                        alt={o.label}
                        loading="lazy"
                        decoding="async"
                        className="w-full object-contain"
                      />
                      <span className="block break-words px-3 py-2 text-xs text-[#b8aebb]">{o.label}</span>
                    </button>
                  ),
                )}
              {job.outputs
                .filter((o) => o.text)
                .map((o) => (
                  <pre
                    key={o.id}
                    className="min-w-0 overflow-auto break-words rounded-2xl border border-white/10 bg-white/10 p-4 text-xs text-[#b8aebb] whitespace-pre-wrap sm:col-span-2"
                  >
                    {o.label}
                    {"\n"}
                    {o.text}
                  </pre>
                ))}
            </div>
          </>
        )}
      </div>
      <MediaLightbox
        items={(job?.outputs ?? [])
          .filter(
            (o) =>
              o.url &&
              (o.kind === "image" || o.kind === "video"),
          )
          .map((o) => ({
            url: o.url!,
            label: o.label,
            kind: o.kind === "video" ? "video" : "image",
          }))}
        activeUrl={activeMedia}
        onClose={() => setActiveMedia(null)}
        onActiveUrl={setActiveMedia}
      />
    </div>
  );
}
