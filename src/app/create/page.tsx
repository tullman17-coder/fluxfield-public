"use client";
import { ZermoJobStatus } from "@/components/studio/zermo-job-status";
import { jobStatusLabel, exactSeed, preferredImproveProvider, ZERMO_IMAGE_PROFILES } from "@/lib/studio/presentation";
import { useStudioConnection } from "@/lib/studio/use-studio-connection";
import { fitZermoSize } from "@/lib/adapters/zermo-image-size";

import { Suspense, useCallback, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  visibleDreamPresets,
  MATURE_PRESETS,
  DREAM_RATIOS,
  FRAMINGS,

  enhancePrompt,
  enhanceNegativePrompt,
  isPromptProposal,
} from "@/lib/dream/presets";
import { useJobWatch } from "@/lib/jobs/use-job-watch";
import type { StudioJob } from "@/lib/adapters/types";
import { cn } from "@/lib/utils";
import { MediaLightbox } from "@/components/studio/media-lightbox";

type ImproveResult = {
  prompt: string;
  originalPrompt: string;
  context: string;
  provider: "local" | "api" | "zermo";
  model: string;
};

const selectClass =
  "h-11 w-full min-w-0 rounded-[10px] border border-white/10 glass px-3 text-sm text-[#f5eff6] transition-colors hover:border-white/15 focus-visible:outline-2 focus-visible:outline-[#f2a1ed]";
const inputClass = selectClass;
const labelClass = "mb-2 block text-sm font-medium text-[#b8aebb]";

export default function CreatePage() {
  return <Suspense fallback={<p role="status">Loading Create…</p>}><CreateFromSearch /></Suspense>;
}

function CreateFromSearch() {
  const params = useSearchParams();
  return <CreateWorkbench key={params.toString()} initial={params} />;
}

function CreateWorkbench({ initial }: { initial: Pick<URLSearchParams, "get"> }) {
  const [prompt, setPrompt] = useState(initial.get("prompt") ?? initial.get("brief") ?? "");
  const [negativePrompt, setNegativePrompt] = useState(initial.get("negativePrompt") ?? "");
  const [preset, setPreset] = useState(initial.get("preset") ?? initial.get("presetId") ?? initial.get("style") ?? "auto");
  const [ratio, setRatio] = useState(initial.get("ratio") ?? "square");
  const [framing, setFraming] = useState(initial.get("framing") ?? "auto");
  const [count, setCount] = useState(initial.get("count") ?? "1");
  const [seed, setSeed] = useState(initial.get("seed") ?? "");
  const [customSteps, setSteps] = useState(initial.get("steps") ?? "");
  const [cfg, setCfg] = useState(initial.get("cfg") ?? "1");
  const [campaignCopy, setCampaignCopy] = useState(initial.get("campaignCopy") === "true" || (initial.get("campaignCopy") === null && initial.get("mode") === "campaign"));
  const [brandName, setBrandName] = useState(initial.get("brandName") ?? initial.get("brand") ?? "");
  const { settings, health, zermo, error: connectionError } = useStudioConnection();
  const [adultCategory, setAdultCategory] = useState(MATURE_PRESETS.some((p) => p.id === preset));
  const steps = customSteps || (zermo ? "8" : "4");
  const [assist, setAssist] = useState(initial.get("assist") !== "off");
  const [visualQa, setVisualQa] = useState(initial.get("visualQa") !== "off");
  const [refFile, setRefFile] = useState<File | null>(null);
  const [refUrl, setRefUrl] = useState(initial.get("referenceImageUrl") ?? "");
  const [referenceJobId, setReferenceJobId] = useState(initial.get("referenceJobId") ?? "");

  const [improveProviderOverride, setImproveProviderOverride] = useState<
    "local" | "api" | null
  >(initial.get("provider") === "api" ? "api" : initial.get("provider") === "local" ? "local" : null);
  const improveProvider =
    improveProviderOverride ?? preferredImproveProvider(settings);
  const hasApiKey = !!settings?.hasImproveApiKey;
  const localModel = zermo ? health?.text?.model : settings?.ollamaModel;
  const unrestricted = !!settings?.unrestricted;
  const [improving, setImproving] = useState(false);
  const [improved, setImproved] = useState<ImproveResult | null>(null);
  const [improveError, setImproveError] = useState<string | null>(null);

  const { job, setJob } = useJobWatch("dream");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [activeMedia, setActiveMedia] = useState<string | null>(null);
  const promptRef = useRef<HTMLTextAreaElement>(null);
  const referenceRef = useRef<HTMLInputElement>(null);
  const [submitting, setSubmitting] = useState(false);
  const submitLock = useRef(false);


  const running = submitting || (!!job && (job.status === "queued" || job.status === "running"));
  const presets = visibleDreamPresets(unrestricted, adultCategory);
  const activePreset = presets.find((p) => p.id === preset) ?? presets[0];
  const ratios = DREAM_RATIOS.map((r) => zermo ? { ...r, ...fitZermoSize(r.width, r.height) } : r);
  const activeRatio = ratios.find((r) => r.id === ratio) ?? ratios[0];
  const assistedPrompt =
    prompt.trim() ? enhancePrompt(prompt, activePreset.id, framing, assist) : "";
  const assistedNegative = enhanceNegativePrompt(prompt, negativePrompt, framing, assist);
  const rewriteContext = JSON.stringify([activePreset.id, framing, negativePrompt]);
  const controlError = !presets.some((p) => p.id === preset) || !ratios.some((r) => r.id === ratio)
    || !FRAMINGS.some((f) => f.id === framing) || !["1", "2", "3", "4"].includes(count)
    ? "This link or saved job has an unavailable style, ratio, composition, or count. Choose a supported control before creating." : null;

  async function improve() {
    if (!prompt.trim() || improving) return;
    setImproving(true);
    setImproveError(null);
    setImproved(null);
    try {
      const res = await fetch("/api/improve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, provider: improveProvider, presetId: activePreset.id, framing, negativePrompt }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not rewrite that");
      if (data.originalPrompt !== prompt || !isPromptProposal(prompt, data.prompt) || typeof data.model !== "string") {
        throw new Error("Invalid rewrite proposal; your original was kept.");
      }
      setImproved({ ...data, context: rewriteContext } as ImproveResult);
    } catch (err) {
      setImproveError(
        err instanceof Error ? err.message : "Could not rewrite that",
      );
    } finally {
      setImproving(false);
    }
  }

  async function submitDream(inputs: Record<string, string>, presetId: string, reference: { file?: File | null; url?: string; jobId?: string }) {
    if (submitLock.current || running) return;
    submitLock.current = true;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const form = new FormData();
      form.set("tool", "dream");
      form.set("workflowSlug", "dream");
      form.set("presetId", presetId);
      const reusable = { ...inputs };
      delete reusable.referenceImage;
      delete reusable.referenceImageUrl;
      delete reusable.referenceJobId;
      form.set("inputs", JSON.stringify(reusable));
      if (reference.file) form.set("referenceImage", reference.file);
      else if (reference.jobId) form.set("referenceJobId", reference.jobId);
      else if (reference.url) form.set("referenceImageUrl", reference.url);
      const res = await fetch("/api/jobs", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Job failed");
      setJob(data.job as StudioJob);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Failed");
    } finally {
      submitLock.current = false;
      setSubmitting(false);
    }
  }

  async function generate() {
      if (!prompt.trim()) {
        setSubmitError("Describe the image you want first.");
        promptRef.current?.focus();
        return;
      }
      if (controlError) { setSubmitError(controlError); return; }
      await submitDream({
            prompt,
            negativePrompt,
            ratio,
            framing,
            count,
            seed,
            steps,
            cfg: zermo ? "1" : cfg,
            assist: assist ? "on" : "off",
            visualQa: visualQa ? "on" : "off",
            campaignCopy: campaignCopy ? "true" : "false",
            brandName,
      }, activePreset.id, { file: refFile, url: refUrl, jobId: referenceJobId });
  }

  const reuseFromJob = useCallback((j: StudioJob) => {
    const i = j.inputs;
    setPrompt(i.prompt || "");
    setNegativePrompt(i.negativePrompt || "");
    setPreset(j.presetId || "auto");
    setAdultCategory(MATURE_PRESETS.some((p) => p.id === j.presetId));
    setRatio(i.ratio || "square");
    setFraming(i.framing || "auto");
    setCount(i.count || "1");
    const effectiveSeed = Object.values(j.zermoJobs || {}).find((r) => r.effective?.seed !== undefined)?.effective?.seed;
    setSeed(i.seed || exactSeed(effectiveSeed));
    setSteps(i.steps || "8");
    setCfg(i.cfg || "1");
    setAssist(i.assist !== "off");
    setVisualQa(i.visualQa === "on");
    setCampaignCopy(i.campaignCopy === "true");
    setBrandName(i.brandName ?? i.productName ?? "");
    setRefFile(null);
    if (referenceRef.current) referenceRef.current.value = "";
    const savedReference = !!(j.referenceImagePath || i.referenceImage);
    setReferenceJobId(savedReference ? j.id : "");
    setRefUrl(savedReference ? "" : i.referenceImageUrl || "");
    setImproved(null);
    promptRef.current?.focus();
  }, []);

  async function varyFromJob(j: StudioJob) {
    reuseFromJob(j);
    setSeed("");
    await submitDream({ ...j.inputs, seed: "" }, j.presetId, {
      jobId: j.referenceImagePath || j.inputs.referenceImage ? j.id : undefined,
      url: j.inputs.referenceImageUrl,
    });
  }

  const images =
    job?.outputs.filter(
      (o) =>
        o.kind === "image" &&
        o.url &&
        !/^Subject(\b| ·)/i.test(o.label),
    ) ?? [];
  const visualQaStatus = job?.outputs.find((output) => output.label === "Visual QA");
  const campaignText = job?.inputs.campaignCopy === "true"
    ? job.outputs.filter((o) => o.text && o.label !== "Visual QA").map((o) => o.text).join("\n\n") || job.script
    : undefined;

  return (
    <div className="w-full min-w-0">
      <header className="mb-8 grid gap-3 border-b border-white/10 pb-6">
        <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#e77ae6]">
          Images
        </p>
        <h1 className="text-4xl font-semibold tracking-tight text-[#f5eff6] md:text-5xl">
          Create
        </h1>
        <p className="max-w-xl text-[#b8aebb]">
          Describe what you want to see. Adjust as much or as little as you like.
        </p>
      </header>

      <div className="grid min-w-0 gap-8 xl:grid-cols-[minmax(0,1fr)_minmax(16rem,18rem)] xl:items-start">
        <form
          className="min-w-0 xl:col-start-1"
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            void generate();
          }}
        >
          <div className="grid gap-2 pb-6">
            <div className="flex min-w-0 flex-wrap items-end justify-between gap-3">
              <label
                htmlFor="prompt"
                className="text-lg font-bold text-[#f5eff6]"
              >
                Prompt
              </label>
              <span className="text-sm text-[#b8aebb]">What should exist?</span>
            </div>
            <textarea
              id="prompt"
              ref={promptRef}
              value={prompt}
              onChange={(e) => { setPrompt(e.currentTarget.value); setImproved(null); }}
              placeholder="A silly three-eyed cartoon creature juggling teacups…"
              className="min-h-32 w-full min-w-0 resize-y rounded-[10px] border border-white/15 glass p-3 text-base leading-normal text-[#f5eff6] shadow-[0_1.25rem_3.75rem_rgb(0_0_0/44%)] placeholder:text-[#8d838f] focus-visible:outline-2 focus-visible:outline-[#f2a1ed]"
            />
            {submitError ? (
              <p role="alert" className="text-sm text-[#ff8ea0]">
                {submitError}
              </p>
            ) : null}
          </div>

          <section className="mb-4 grid gap-3 rounded-[10px] border border-white/10 glass p-4" aria-label="Campaign copy">
            <label className="flex cursor-pointer items-start gap-3">
              <input id="campaign-copy" type="checkbox" checked={campaignCopy} onChange={(e) => setCampaignCopy(e.currentTarget.checked)} className="mt-1 size-4 accent-[#d565d6]" />
              <span>
                <strong className="block text-sm text-[#f5eff6]">Add campaign copy (optional)</strong>
                <small className="mt-1 block text-xs text-[#8d838f]">Super now lives here. Copy and images belong to the same saved Dream job. Your image prompt is not automatically rewritten.</small>
              </span>
            </label>
            {campaignCopy ? <label className="text-sm text-[#b8aebb]">
              Brand name (optional, kept as written)
              <input id="brand-name" value={brandName} onChange={(e) => setBrandName(e.currentTarget.value)} className={`${inputClass} mt-2`} />
            </label> : null}
          </section>

          <section
            aria-label="Rewrite your prompt"
            className="mb-4 grid gap-3 rounded-[10px] border border-white/10 glass p-4"
          >
            <div className="flex min-w-0 flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <strong className="text-sm text-[#f5eff6]">
                  Rewrite my prompt
                </strong>
                <p className="mt-1 text-xs text-[#8d838f]">
                  Proposes details after your unchanged original. Review before using
                  {localModel ? `, using ${localModel}` : ""}.
                </p>
              </div>
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                {zermo ? <span className="text-xs text-[#b8aebb]">Zermo · {localModel || "Checking writing model…"}</span> : <div
                  role="group"
                  aria-label="Rewrite with"
                  className="flex overflow-hidden rounded-[10px] border border-white/10"
                >
                  {(["local", "api"] as const).map((p) => (
                    <button
                      key={p}
                      type="button"
                      aria-pressed={improveProvider === p}
                      onClick={() => setImproveProviderOverride(p)}
                      className={cn(
                        "min-h-11 px-3 text-xs font-semibold transition-colors",
                        improveProvider === p
                          ? "bg-[#2c162f] text-[#e77ae6]"
                          : "text-[#8d838f] hover:text-[#f5eff6]",
                      )}
                    >
                      {p === "local" ? "My model" : "Cloud"}
                    </button>
                  ))}
                </div>}
                <button
                  type="button"
                  onClick={() => void improve()}
                  disabled={improving || !prompt.trim() || !settings || !!controlError}
                  className="min-h-11 rounded-[10px] border border-white/15 bg-[#2c162f] px-4 text-sm font-bold text-[#e77ae6] transition-colors hover:border-[#d565d6] hover:text-[#f5eff6] disabled:border-white/10 disabled:bg-white/10 disabled:text-[#6e6570]"
                >
                  {improving ? "Rewriting…" : "Rewrite"}
                </button>
              </div>
            </div>
            {!zermo && improveProvider === "api" && !hasApiKey ? (
              <p className="text-xs text-[#ff8ea0]">
                No cloud key saved yet. Add one in Settings, or switch to My
                model.
              </p>
            ) : null}
            {improveError ? (
              <p role="alert" className="text-sm text-[#ff8ea0]">
                {improveError}
              </p>
            ) : null}
            {improved ? (
              <div className="grid gap-3 border-t border-white/10 pt-3">
                <p className="whitespace-pre-wrap text-sm leading-normal text-[#b8aebb]">
                  <strong className="text-[#f5eff6]">Proposed rewrite:</strong>{" "}
                  {improved.prompt}
                <small className="block">Returned by {improved.model}</small>
                </p>
                <div>
                  {improved.originalPrompt !== prompt || improved.context !== rewriteContext ? <p role="status" className="mb-2 text-sm text-[#b8aebb]">The brief or controls changed. Rewrite again; this proposal cannot replace your edits.</p> : null}
                  <button
                    type="button"
                    disabled={improved.originalPrompt !== prompt || improved.context !== rewriteContext}
                    onClick={() => {
                      if (improved.originalPrompt !== prompt || improved.context !== rewriteContext) return;
                      setPrompt(improved.prompt);
                      setImproved(null);
                      promptRef.current?.focus();
                    }}
                    className="min-h-11 rounded-[10px] border border-white/15 px-4 text-sm font-bold text-[#b8aebb] transition-colors hover:border-[#d565d6] hover:text-[#f5eff6]"
                  >
                    Use this proposal
                  </button>
                  <button type="button" onClick={() => setImproved(null)} className="ml-2 min-h-11 px-3 text-sm text-[#b8aebb]">Keep original</button>
                </div>
              </div>
            ) : null}
          </section>

          <section
            aria-label="Composition assist"
            className="mb-2 grid gap-3 rounded-[10px] border border-white/10 glass p-4"
          >
            <label className="flex min-w-0 cursor-pointer items-start gap-3">
              <input
                type="checkbox"
                checked={assist}
                onChange={(e) => setAssist(e.currentTarget.checked)}
                className="mt-1 size-4 accent-[#d565d6]"
              />
              <span className="min-w-0">
                <strong className="block text-sm text-[#f5eff6]">
                  Recognize composition words
                </strong>
                <small className="mt-1 block text-xs leading-normal text-[#8d838f]">
                  Auto recognizes framing in your prompt. Explicit style and composition choices win. No generic anatomy, lighting, or setting is added.
                </small>
              </span>
            </label>
            {assistedPrompt ? (
              <p className="max-h-48 overflow-y-auto whitespace-pre-wrap border-t border-white/10 pt-3 text-sm leading-normal text-[#b8aebb]">
                <strong className="text-[#f5eff6]">Prompt to send:</strong>{" "}
                {assistedPrompt}
              </p>
            ) : null}
            {assistedNegative ? <p className="whitespace-pre-wrap text-xs text-[#b8aebb]"><strong>Negative prompt to send:</strong>{" "}{assistedNegative}</p> : null}
          </section>

          <label className="mb-4 flex min-w-0 cursor-pointer items-start gap-3 rounded-[10px] border border-white/10 glass p-4">
            <input
              id="visual-qa"
              type="checkbox"
              checked={visualQa}
              onChange={(event) => setVisualQa(event.currentTarget.checked)}
              className="mt-1 size-4 accent-[#d565d6]"
            />
            <span className="min-w-0">
              <strong className="block text-sm text-[#f5eff6]">
                Optional visual QA
              </strong>
              <small className="mt-1 block text-xs leading-normal text-[#8d838f]">
                On by default. Reports checked, failed, or unavailable. If review fails, outputs are retained for review—not automatically regenerated. Model review can miss identity, color and count errors. Inspect reference edits yourself.
              </small>
            </span>
          </label>

          <fieldset className="min-w-0 border-y border-white/10 py-5">
            <legend className="flex flex-wrap items-center gap-2 text-sm font-medium text-[#b8aebb]">
              Style
            </legend>
            <p className="mb-3 text-xs text-[#8d838f]">{zermo ? "Qwen-Image-2.1 · one model, different prompt styles." : "Prompt styles for the selected image provider."}</p>
            <label className="mb-3 flex min-h-11 items-center gap-3 text-sm text-[#b8aebb]">
              <input type="checkbox" checked={adultCategory && unrestricted} disabled={!unrestricted}
                onChange={(e) => { setAdultCategory(e.target.checked); setPreset(e.target.checked ? "boudoir" : "auto"); }} />
              Adult / NSFW (18+) — opt in to adult styles
            </label>
            {!unrestricted ? <p className="mb-3 text-xs text-[#8d838f]">Adult styles are off. Enable Adult styles in <a href="/settings" className="underline">Connections</a>, then opt in here.</p> : null}
            <p className="mb-2 text-sm text-[#b8aebb]">{adultCategory && unrestricted ? "Adult / NSFW (18+)" : "General"}</p>
            <div className="grid min-w-0 grid-cols-2 gap-2 sm:grid-cols-3">
              {presets.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  aria-pressed={preset === p.id}
                  onClick={() => setPreset(p.id)}
                  className={cn(
                    "grid min-h-11 min-w-0 place-content-center rounded-[10px] border px-2 py-1 text-center text-sm transition-colors",
                    preset === p.id
                      ? "border-[#d565d6] bg-[#2c162f] text-[#e77ae6]"
                      : "border-white/10 glass text-[#b8aebb] hover:border-white/15 hover:bg-white/15 hover:text-[#f5eff6]",
                  )}
                >
                  <span>{zermo ? `Qwen 2.1 · ${p.label}` : p.label}</span>
                  <small className="mt-1 block text-xs font-normal text-[#b8aebb]">{p.example}</small>
                </button>
              ))}
            </div>
            <p className="mt-3 text-sm text-[#8d838f]">
              {preset === "auto" ? "Default: playful, silly cartoon unless your brief specifies another look." : `Selected style takes precedence: ${activePreset.suffix}`}
            </p>
            <div className="mt-4 grid min-w-0 gap-3 sm:grid-cols-2">
              <label className="min-w-0 text-sm text-[#b8aebb]">
                Reference still
                <input
                  ref={referenceRef}
                  type="file"
                  accept="image/png,image/jpeg"
                  className="mt-2 block w-full min-w-0 text-sm text-[#f5eff6] file:mr-3 file:rounded-[10px] file:border file:border-white/15 file:bg-white/10 file:px-3 file:py-2"
                  onChange={(e) => { setRefFile(e.currentTarget.files?.[0] || null); setReferenceJobId(""); setRefUrl(""); }}
                />
              </label>
              <label className="min-w-0 text-sm text-[#b8aebb]">
                Or image URL
                <input
                  type="url"
                  value={refUrl}
                  onChange={(e) => { setRefUrl(e.currentTarget.value); setReferenceJobId(""); setRefFile(null); if (referenceRef.current) referenceRef.current.value = ""; }}
                  placeholder="https://"
                  className={`${inputClass} mt-2`}
                />
              </label>
            </div>
            {referenceJobId ? <p role="status" className="mt-3 break-words text-sm text-[#b8aebb]">
              Retained reference from job {referenceJobId}. The server reuses the saved image; no re-upload needed.
              <button type="button" onClick={() => setReferenceJobId("")} className="ml-2 min-h-11 px-2 underline">Remove retained reference</button>
            </p> : null}
          </fieldset>

          <div className="grid min-w-0 gap-5 py-5 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,0.75fr)] md:items-end">
            <fieldset className="min-w-0">
              <legend className="mb-2 text-sm font-medium text-[#b8aebb]">
                Aspect ratio
              </legend>
              <div className="grid min-w-0 grid-cols-2 gap-2 sm:grid-cols-3">
                {ratios.map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    aria-pressed={ratio === r.id}
                    onClick={() => setRatio(r.id)}
                    className={cn(
                      "grid min-h-[4.25rem] min-w-0 place-content-center gap-1 rounded-[10px] border px-2 py-1 text-center transition-colors",
                      ratio === r.id
                        ? "border-[#d565d6] bg-[#2c162f] text-[#e77ae6]"
                        : "border-white/10 glass text-[#b8aebb] hover:border-white/15 hover:bg-white/15 hover:text-[#f5eff6]",
                    )}
                  >
                    <strong className="text-sm">{r.label}</strong>
                    <small className="text-xs text-[#8d838f]">
                      {r.width} × {r.height}
                    </small>
                  </button>
                ))}
              </div>
            </fieldset>

            <div className="min-w-0">
              <label htmlFor="framing" className={labelClass}>
                Composition
              </label>
              <select
                id="framing"
                value={framing}
                onChange={(e) => setFraming(e.currentTarget.value)}
                className={selectClass}
              >
                {FRAMINGS.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.label}
                  </option>
                ))}
              </select>
              <small className="mt-1 block text-xs leading-normal text-[#8d838f]">
                Auto picks up words like wide angle, full body, or macro.
              </small>
            </div>

            <div className="min-w-0">
              <label htmlFor="count" className={labelClass}>
                Image count
              </label>
              <select
                id="count"
                value={count}
                onChange={(e) => setCount(e.currentTarget.value)}
                className={selectClass}
              >
                {[1, 2, 3, 4].map((n) => (
                  <option key={n} value={n}>
                    {n} {n === 1 ? "image" : "images"}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {zermo ? <fieldset className="mb-4 border-y border-white/10 py-4">
            <legend className={labelClass}>Image profile</legend>
            <div className="flex flex-wrap gap-2">{ZERMO_IMAGE_PROFILES.map((profile) => <button key={profile.steps} type="button" aria-pressed={steps === profile.steps} onClick={() => setSteps(profile.steps)} className={cn("min-h-11 rounded-[10px] border px-4 text-sm", steps === profile.steps ? "border-[#d565d6] text-[#e77ae6]" : "border-white/15 text-[#b8aebb]")}>{profile.label}</button>)}</div>
            <p className="mt-2 text-xs text-[#8d838f]">Same {activeRatio.width} × {activeRatio.height} output, fitted within 1024px. CFG 1 fixed. Fast (8) is the default; Detail is 20 steps, not a smaller image.</p>
          </fieldset> : null}
          <details className="min-w-0 border-b border-white/10">
            <summary className="grid min-h-11 cursor-pointer list-none content-center gap-1 py-3 font-medium text-[#f5eff6] [&::-webkit-details-marker]:hidden">
              <span>Advanced settings</span>
              <span className="text-xs font-normal text-[#8d838f]">
                Seed, steps, and how closely to follow the prompt
              </span>
            </summary>
            <div className="grid min-w-0 gap-4 pb-5 sm:grid-cols-2">
              <label className="min-w-0 sm:col-span-2">
                <span className={labelClass}>Negative prompt</span>
                <textarea
                  value={negativePrompt}
                  onChange={(e) => setNegativePrompt(e.currentTarget.value)}
                  placeholder="Anything to avoid"
                  className="min-h-20 w-full min-w-0 resize-y rounded-[10px] border border-white/10 glass p-3 text-sm text-[#f5eff6] placeholder:text-[#8d838f] hover:border-white/15 focus-visible:outline-2 focus-visible:outline-[#f2a1ed]"
                />
              </label>
              <label className="min-w-0">
                <span className={labelClass}>Seed</span>
                <input
                  type="text"
                  inputMode="numeric"
                  value={seed}
                  placeholder="Random"
                  onChange={(e) => setSeed(e.currentTarget.value)}
                  className={inputClass}
                />
              </label>
              <label className="min-w-0">
                <span className={labelClass}>Steps</span>
                <input
                  type="number"
                  min={1}
                  max={50}
                  value={steps}
                  disabled={zermo}
                  onChange={(e) => setSteps(e.currentTarget.value)}
                  className={inputClass}
                />
              </label>
              <label className="min-w-0">
                <span className={labelClass}>Prompt strength</span>
                <input
                  type="number"
                  min={0}
                  max={20}
                  step={0.1}
                  value={zermo ? "1" : cfg}
                  disabled={zermo}
                  onChange={(e) => setCfg(e.currentTarget.value)}
                  className={inputClass}
                />
              </label>
            </div>
          </details>

          {job?.status === "failed" && job.error ? (
            <div
              role="alert"
              className="mt-4 grid gap-3 rounded-[10px] border border-[#ff8ea0] bg-[#35171f] p-4"
            >
              <div className="min-w-0">
                <p className="mb-1 font-bold text-[#ff8ea0]">
                  {images.length ? "Outputs retained — needs review" : "That did not finish"}
                </p>
                <p className="text-sm text-[#f5eff6]">{job.error}</p>
                <p className="mt-1 text-sm text-[#b8aebb]">
                  {images.length ? "Inspect the retained outputs and review report. Nothing is automatically regenerated." : zermo ? "Resume the same job below to recover completed media. A new attempt creates new work." : "Try again, or check your connections in Settings."}
                </p>
              </div>
              <div className="flex min-w-0 flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => void generate()}
                  className="min-h-11 rounded-[10px] border border-white/15 bg-[#2c162f] px-4 text-sm font-bold text-[#e77ae6] hover:border-[#d565d6]"
                >
                  {zermo ? "Start a new attempt" : "Try again"}
                </button>
                <a
                  href="/settings"
                  className="grid min-h-11 place-items-center rounded-[10px] px-4 text-sm font-bold text-[#b8aebb] hover:text-[#f5eff6]"
                >
                  Open Settings
                </a>
              </div>
            </div>
          ) : null}

          <div className="grid pt-5 sm:justify-items-end">
            {controlError ? <p role="alert" className="mb-3 text-sm text-[#ff8ea0]">{controlError}</p> : null}
            <button
              type="submit"
              disabled={running || !settings || !!controlError}
              className="min-h-11 w-full min-w-0 rounded-[10px] border border-[#d565d6] bg-[#d565d6] px-4 text-sm font-bold text-white transition-colors hover:border-[#e77ae6] hover:bg-[#e77ae6] disabled:border-white/10 disabled:bg-white/10 disabled:text-[#6e6570] sm:w-48"
            >
              {submitting ? "Submitting…" : running ? "Making it" : campaignCopy ? "Make image + copy" : "Make it"}
            </button>
          </div>
        </form>

        <aside
          aria-labelledby="job-heading"
          className="min-w-0 rounded-[14px] border border-white/10 glass p-5 xl:col-start-2 xl:row-span-2 xl:sticky xl:top-6"
        >
          <div className="flex min-w-0 items-end justify-between gap-3">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#e77ae6]">
                Now
              </p>
              <h2 id="job-heading" className="mt-1 text-lg text-[#f5eff6]">
                Job status
              </h2>
            </div>
            <span
              aria-hidden="true"
              className={cn(
                "size-2 rounded-full",
                !job
                  ? "bg-[#8d838f]"
                  : job.status === "failed"
                    ? "bg-[#ff8ea0]"
                    : "bg-[#d565d6] shadow-[0_0_0_4px_#2c162f]",
              )}
            />
          </div>
          <p
            role="status"
            aria-live="polite"
            className="mt-5 font-bold text-[#f5eff6]"
          >
            {jobStatusLabel(job)}
          </p>
          <ZermoJobStatus job={job} onResume={setJob} />
          {visualQaStatus?.text ? (
            <pre className="mt-3 whitespace-pre-wrap rounded-[10px] bg-white/10 p-3 text-xs text-[#b8aebb]">
              Visual QA{"\n"}
              {visualQaStatus.text}
            </pre>
          ) : null}
          {connectionError ? <p role="alert" className="mt-3 text-sm text-[#ff8ea0]">{connectionError}</p> : null}
          {job ? <p className="mt-2 break-words text-xs text-[#8d838f]">Updated <time dateTime={job.updatedAt}>{new Date(job.updatedAt).toLocaleString()}</time></p> : null}
          <dl className="mt-5 grid grid-cols-3 gap-2 border-t border-white/10 pt-4">
            <div className="min-w-0">
              <dt className="text-xs text-[#8d838f]">Output</dt>
              <dd className="mt-1 text-sm text-[#b8aebb]">
                {activeRatio.width} × {activeRatio.height}
              </dd>
            </div>
            <div className="min-w-0">
              <dt className="text-xs text-[#8d838f]">Batch</dt>
              <dd className="mt-1 text-sm text-[#b8aebb]">{count}</dd>
            </div>
            <div className="min-w-0">
              <dt className="text-xs text-[#8d838f]">Seed</dt>
              <dd className="mt-1 truncate text-sm text-[#b8aebb]">
                {seed.trim() || "Random"}
              </dd>
            </div>
          </dl>
          {job ? <button type="button" onClick={() => reuseFromJob(job)} className="mt-3 min-h-11 text-sm text-[#b8aebb] underline">Reuse this job’s settings</button> : null}
          {job?.script ? (
            <details className="mt-4 border-t border-white/10 pt-3">
              <summary className="min-h-11 cursor-pointer list-none content-center text-sm font-medium text-[#b8aebb] [&::-webkit-details-marker]:hidden">
                {job.inputs.campaignCopy === "true" ? "Saved job text" : "Settings used"}
              </summary>
              <pre className="max-h-48 overflow-y-auto whitespace-pre-wrap rounded-[10px] bg-white/10 p-3 text-xs text-[#b8aebb]">
                {job.script}
              </pre>
            </details>
          ) : null}
          <p className="mt-4 text-xs text-[#8d838f]">
            {job?.status === "completed" && images.length ? "Saved to your library" : "Results are saved after generation completes."}
          </p>
        </aside>

        <section
          aria-labelledby="results-heading"
          className="min-w-0 pt-3 xl:col-start-1"
        >
          <div className="flex min-w-0 flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#e77ae6]">
                Finished
              </p>
              <h2 id="results-heading" className="mt-1 text-lg text-[#f5eff6]">
                Results
              </h2>
            </div>
            {images.length ? (
              <span className="rounded-full border border-white/15 glass px-3 py-1 text-xs text-[#b8aebb]">
                {images.length} new
              </span>
            ) : null}
          </div>
          {campaignText ? <article className="mt-4 rounded-[10px] border border-white/10 glass p-4">
            <h3 className="mb-2 text-sm font-bold text-[#f5eff6]">Campaign copy</h3>
            <pre className="whitespace-pre-wrap break-words text-sm text-[#b8aebb]">{campaignText}</pre>
          </article> : null}
          {images.length && job ? (
            <ul className="mt-4 grid min-w-0 grid-cols-[repeat(auto-fill,minmax(min(100%,15rem),1fr))] gap-5">
              {images.map((o) => (
                <li
                  key={o.id}
                  className="min-w-0 border-b border-white/10 pb-4"
                >
                  <figure className="min-w-0">
                    <button
                      type="button"
                      onClick={() => setActiveMedia(o.url!)}
                      className="relative aspect-square min-w-0 w-full overflow-hidden rounded-[14px] border border-white/10 bg-white/10"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={o.url}
                        alt={o.label}
                        loading="lazy"
                        decoding="async"
                        className="h-full w-full object-contain"
                      />
                      <span className="absolute right-2 bottom-2 rounded-full border border-white/15 glass px-2 py-1 text-xs text-[#b8aebb]">
                        {job.status === "failed" ? "Retained" : "Saved"}
                      </span>
                    </button>
                    <figcaption className="min-w-0 py-3">
                      <p className="font-bold break-words text-[#f5eff6]">
                        {job.inputs.prompt || job.prompt}
                      </p>
                      <p className="mt-1 text-sm text-[#8d838f]">
                        {job.presetLabel} · {job.inputs.size || job.aspect}
                      </p>
                    </figcaption>
                  </figure>
                  <div className="flex min-w-0 flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setActiveMedia(o.url!)}
                      className="grid min-h-11 flex-1 place-items-center rounded-[10px] px-3 text-sm font-bold text-[#b8aebb] transition-colors hover:text-[#f5eff6]"
                    >
                      Open
                    </button>
                    <button
                      type="button"
                      onClick={() => reuseFromJob(job)}
                      className="min-h-11 flex-1 rounded-[10px] px-3 text-sm font-bold text-[#b8aebb] transition-colors hover:text-[#f5eff6]"
                    >
                      Reuse settings
                    </button>
                    <button
                      type="button"
                      disabled={running || !settings}
                      onClick={() => void varyFromJob(job)}
                      className="min-h-11 flex-1 rounded-[10px] border border-white/15 bg-[#2c162f] px-3 text-sm font-bold text-[#e77ae6] transition-colors hover:border-[#d565d6] disabled:border-white/10 disabled:bg-white/10 disabled:text-[#6e6570]"
                    >
                      Vary
                    </button>
                    <a href={o.url} download className="grid min-h-11 flex-1 place-items-center rounded-[10px] px-3 text-sm font-bold text-[#b8aebb]">Download</a>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <div className="mt-4 border-y border-white/10 px-4 py-8 text-center text-[#b8aebb]">
              <p>Your images will settle here.</p>
              <span className="mt-1 block text-sm text-[#8d838f]">
                Each one keeps its settings so you can make it again.
              </span>
            </div>
          )}
        </section>
      </div>
      <MediaLightbox
        items={images.map((o) => ({
          url: o.url!,
          label: o.label,
        }))}
        activeUrl={activeMedia}
        onClose={() => setActiveMedia(null)}
        onActiveUrl={setActiveMedia}
      />
    </div>
  );
}
