"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import type { StudioJob } from "@/lib/adapters/types";
import type { JobTool } from "@/lib/adapters/types";
import { DREAM_PRESETS, FRAMINGS } from "@/lib/dream/presets";

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
};

export function JobRunner({
  tool,
  workflowSlug,
  fields,
  presets,
  accent = "#e77ae6",
  submitLabel = "Generate",
}: Props) {
  const [presetId, setPresetId] = useState(presets[0]?.id || "");
  const [values, setValues] = useState<Record<string, string>>({
    dreamStyle: "photo",
    framing: "auto",
  });
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [job, setJob] = useState<StudioJob | null>(null);

  const fileField = useMemo(
    () => fields.find((f) => f.type === "file"),
    [fields],
  );

  useEffect(() => {
    if (!job || job.status === "completed" || job.status === "failed") return;
    const id = setInterval(async () => {
      const res = await fetch(`/api/jobs/${job.id}`);
      if (!res.ok) return;
      const data = (await res.json()) as { job: StudioJob };
      setJob(data.job);
    }, 1200);
    return () => clearInterval(id);
  }, [job]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const form = new FormData();
      form.set("tool", tool);
      form.set("workflowSlug", workflowSlug);
      form.set("presetId", presetId);
      form.set("inputs", JSON.stringify(values));
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
          <div className="space-y-2">
            <Label htmlFor="dreamStyle">Dream style</Label>
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
                  {p.label}
                </option>
              ))}
            </select>
            <p className="text-xs text-[#8d838f]">
              Prompt suffix from Local Dream Studio
            </p>
          </div>
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
          disabled={busy}
          className="w-full font-semibold text-black"
          style={{ backgroundColor: accent }}
        >
          {busy ? "Queuing…" : submitLabel}
        </Button>
      </form>

      <div className="space-y-4">
        {!job ? (
          <div className="flex min-h-64 items-center justify-center rounded-2xl border border-dashed border-white/10 text-sm text-[#8d838f]">
            Outputs land here after you generate.
          </div>
        ) : (
          <>
            <div className="rounded-2xl border border-white/10 glass p-4">
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="text-[#b8aebb]">
                  {job.workflowName} · {job.presetLabel}
                </span>
                <span style={{ color: accent }}>
                  {job.status} · {job.progress}% · {job.modeUsed}
                </span>
              </div>
              {job.error ? (
                <p className="mt-2 text-sm text-red-400">{job.error}</p>
              ) : null}
              {job.script ? (
                <pre className="mt-3 max-h-48 overflow-auto whitespace-pre-wrap rounded-xl bg-white/10 p-3 text-xs text-[#b8aebb]">
                  {job.script}
                </pre>
              ) : null}
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {job.outputs
                .filter((o) => o.url)
                .map((o) => (
                  <a
                    key={o.id}
                    href={o.url}
                    target="_blank"
                    rel="noreferrer"
                    className="overflow-hidden rounded-2xl border border-white/10 bg-white/10"
                  >
                    {o.kind === "video" ? (
                      <video src={o.url} controls className="w-full" />
                    ) : o.kind === "audio" ? (
                      <div className="p-4">
                        <div className="mb-2 text-sm">{o.label}</div>
                        <audio src={o.url} controls className="w-full" />
                      </div>
                    ) : (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={o.url}
                        alt={o.label}
                        className="w-full object-cover"
                      />
                    )}
                  </a>
                ))}
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
    </div>
  );
}
