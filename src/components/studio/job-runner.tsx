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
};

export function JobRunner({
  tool,
  workflowSlug,
  fields,
  presets,
  accent = "#e77ae6",
  submitLabel = "Generate",
  disabled = false,
}: Props) {
  const { zermo } = useStudioConnection();
  const [presetId, setPresetId] = useState(presets[0]?.id || "");
  const [values, setValues] = useState<Record<string, string>>({
    dreamStyle: tool === "explainer" ? "" : "photo",
    framing: "auto",
    visualQa: "off",
  });
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [kits, setKits] = useState<BrandKit[]>([]);
  const [activeMedia, setActiveMedia] = useState<string | null>(null);
  const { job, setJob } = useJobWatch(`${tool}:${workflowSlug}`);
  const supportsVisualQa = jobRunnerSupportsVisualQa(tool);

  useEffect(() => {
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
  }, []);

  const fileField = useMemo(
    () => fields.find((f) => f.type === "file"),
    [fields],
  );

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (disabled || busy || job?.status === "queued" || job?.status === "running") return;
    setBusy(true);
    setError(null);
    try {
      const form = new FormData();
      form.set("tool", tool);
      form.set("workflowSlug", workflowSlug);
      form.set("presetId", presetId);
      const inputs = { ...values };
      for (const field of fields) {
        if (field.type === "select" && !inputs[field.id]) inputs[field.id] = field.options?.[0]?.value || "";
      }
      if (zermo) { delete inputs.voice; delete inputs.subtitles; }
      form.set("inputs", JSON.stringify(inputs));
      if (file) form.set("referenceImage", file);
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
    <div className="grid gap-8 lg:grid-cols-[minmax(280px,360px)_1fr]">
      <form onSubmit={onSubmit} className="space-y-5">
        <div>
          <Label className="mb-2 block text-xs uppercase tracking-wider text-[#8d838f]">
            Preset
          </Label>
          <div className="grid gap-2">
            {presets.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setPresetId(p.id)}
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
        </div>

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
              value={values.dreamStyle || "photo"}
              onChange={(e) =>
                setValues((v) => ({ ...v, dreamStyle: e.target.value }))
              }
            >
              {DREAM_PRESETS.map((p) => (
                <option key={p.id} value={p.id}>
                  {zermo ? `Qwen 2.1 · ${p.label}` : p.label}
                </option>
              ))}
            </select>
            <p className="text-xs text-[#8d838f]">
              {zermo ? "Prompt styles on Qwen-Image-2.1 (qwen-image-2.1-Q4_K_M.gguf), not separate models." : "Sets the overall finish of the art."}
            </p>
          </div> : null}
          <div className="space-y-2">
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
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="brandKitId">Brand kit</Label>
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
            Palette from the kit lands in the finished layout.
          </p>
        </div>

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
                Optional visual QA
              </strong>
              <small className="mt-1 block text-xs leading-normal text-[#8d838f]">
                Checks generated art when a compatible vision model is available.
                The result reports checked or skipped; this is off by default.
              </small>
            </span>
          </label>
        ) : null}

        {fileField ? (
          <div className="space-y-2">
            <Label htmlFor="ref">{fileField.label}</Label>
            <Input
              id="ref"
              type="file"
              accept="image/*"
              className="border-white/10 bg-white/10"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
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

      <div className="space-y-4">
        {!job ? (
          <div className="flex min-h-64 items-center justify-center rounded-2xl border border-dashed border-white/10 text-sm text-[#8d838f]">
            Your finished pieces show up here.
          </div>
        ) : (
          <>
            <div className="rounded-2xl border border-white/10 glass p-4">
              <div className="flex items-center justify-between gap-3 text-sm">
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
                .filter(
                  (o) => o.url && !/^Subject(\b| ·)/i.test(o.label),
                )
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
                        className="w-full object-cover"
                      />
                    </button>
                  ),
                )}
              {job.outputs
                .filter((o) => o.text)
                .map((o) => (
                  <pre
                    key={o.id}
                    className="rounded-2xl border border-white/10 bg-white/10 p-4 text-xs text-[#b8aebb] whitespace-pre-wrap sm:col-span-2"
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
              (o.kind === "image" || o.kind === "video") &&
              !/^Subject(\b| ·)/i.test(o.label),
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
