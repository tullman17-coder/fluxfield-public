"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  DREAM_PRESETS,
  DREAM_RATIOS,
  FRAMINGS,
  dreamRatio,
  enhancePrompt,
} from "@/lib/dream/presets";
import type { StudioJob } from "@/lib/adapters/types";
import { cn } from "@/lib/utils";

type ImproveResult = {
  prompt: string;
  provider: "local" | "api";
  model: string;
};

const selectClass =
  "h-11 w-full min-w-0 rounded-[10px] border border-[#332a38] bg-[#100e14] px-3 text-sm text-[#f5eff6] transition-colors hover:border-[#504156] focus-visible:outline-2 focus-visible:outline-[#f2a1ed]";
const inputClass = selectClass;
const labelClass = "mb-2 block text-sm font-medium text-[#b8aebb]";

export default function CreatePage() {
  const [prompt, setPrompt] = useState("");
  const [negativePrompt, setNegativePrompt] = useState("");
  const [preset, setPreset] = useState("dream");
  const [ratio, setRatio] = useState("square");
  const [framing, setFraming] = useState("auto");
  const [count, setCount] = useState("1");
  const [seed, setSeed] = useState("");
  const [steps, setSteps] = useState("4");
  const [cfg, setCfg] = useState("1");
  const [assist, setAssist] = useState(true);

  const [improveProvider, setImproveProvider] = useState<"local" | "api">(
    "local",
  );
  const [hasApiKey, setHasApiKey] = useState(false);
  const [localModel, setLocalModel] = useState("");
  const [improving, setImproving] = useState(false);
  const [improved, setImproved] = useState<ImproveResult | null>(null);
  const [improveError, setImproveError] = useState<string | null>(null);

  const [job, setJob] = useState<StudioJob | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const promptRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((d) => {
        const s = d.settings;
        if (s?.improveProvider === "api" && s?.improveApiKey) {
          setImproveProvider("api");
        }
        setHasApiKey(Boolean(s?.improveApiKey));
        setLocalModel(s?.ollamaModel || "");
      })
      .catch(() => undefined);
  }, []);

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

  const running = !!job && (job.status === "queued" || job.status === "running");
  const activePreset =
    DREAM_PRESETS.find((p) => p.id === preset) ?? DREAM_PRESETS[0];
  const activeRatio = dreamRatio(ratio);
  const assistedPrompt =
    assist && prompt.trim() ? enhancePrompt(prompt, preset, framing, true) : "";

  const improve = useCallback(async () => {
    if (!prompt.trim() || improving) return;
    setImproving(true);
    setImproveError(null);
    setImproved(null);
    try {
      const res = await fetch("/api/improve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, provider: improveProvider }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Improvement failed");
      setImproved(data as ImproveResult);
    } catch (err) {
      setImproveError(
        err instanceof Error ? err.message : "Prompt improvement failed",
      );
    } finally {
      setImproving(false);
    }
  }, [prompt, improving, improveProvider]);

  const generate = useCallback(
    async (seedOverride?: string) => {
      if (!prompt.trim()) {
        setSubmitError("Describe the image you want to create.");
        promptRef.current?.focus();
        return;
      }
      setSubmitError(null);
      setImproved(null);
      try {
        const res = await fetch("/api/jobs", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            tool: "dream",
            workflowSlug: "dream",
            presetId: preset,
            inputs: {
              prompt,
              negativePrompt,
              ratio,
              framing,
              count,
              seed: seedOverride ?? seed,
              steps,
              cfg,
              assist: assist ? "on" : "off",
            },
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Job failed");
        setJob(data.job as StudioJob);
      } catch (err) {
        setSubmitError(err instanceof Error ? err.message : "Failed");
      }
    },
    [prompt, negativePrompt, preset, ratio, framing, count, seed, steps, cfg, assist],
  );

  const reuseFromJob = useCallback((j: StudioJob) => {
    const i = j.inputs;
    setPrompt(i.prompt || "");
    setNegativePrompt(i.negativePrompt || "");
    setPreset(j.presetId || "dream");
    setRatio(i.ratio || "square");
    setFraming(i.framing || "auto");
    setCount(i.count || "1");
    setSeed(i.seed || "");
    setSteps(i.steps || "4");
    setCfg(i.cfg || "1");
    setAssist(i.assist !== "off");
    promptRef.current?.focus();
  }, []);

  const varyFromJob = useCallback(
    (j: StudioJob) => {
      reuseFromJob(j);
      setSeed("");
      const i = j.inputs;
      setTimeout(() => {
        void (async () => {
          setSubmitError(null);
          try {
            const res = await fetch("/api/jobs", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                tool: "dream",
                workflowSlug: "dream",
                presetId: j.presetId,
                inputs: { ...i, seed: "" },
              }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Job failed");
            setJob(data.job as StudioJob);
          } catch (err) {
            setSubmitError(err instanceof Error ? err.message : "Failed");
          }
        })();
      }, 0);
    },
    [reuseFromJob],
  );

  const images = job?.outputs.filter((o) => o.kind === "image" && o.url) ?? [];

  return (
    <div className="w-full min-w-0">
      <header className="mb-8 grid gap-3 border-b border-[#332a38] pb-6">
        <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#e77ae6]">
          Local image workbench
        </p>
        <h1 className="text-4xl font-semibold tracking-tight text-[#f5eff6] md:text-5xl">
          Create
        </h1>
        <p className="max-w-xl text-[#b8aebb]">
          Shape the prompt. Keep every useful setting. Generate on your own
          controller — nothing leaves your mesh.
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
              onChange={(e) => setPrompt(e.currentTarget.value)}
              placeholder="A moonlit observatory above a quiet violet sea…"
              className="min-h-32 w-full min-w-0 resize-y rounded-[10px] border border-[#504156] bg-[#100e14] p-3 text-base leading-normal text-[#f5eff6] shadow-[0_1.25rem_3.75rem_rgb(0_0_0/44%)] placeholder:text-[#8d838f] focus-visible:outline-2 focus-visible:outline-[#f2a1ed]"
            />
            {submitError ? (
              <p role="alert" className="text-sm text-[#ff8ea0]">
                {submitError}
              </p>
            ) : null}
          </div>

          <section
            aria-label="Prompt improvement"
            className="mb-4 grid gap-3 rounded-[10px] border border-[#332a38] bg-[#100e14] p-4"
          >
            <div className="flex min-w-0 flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <strong className="text-sm text-[#f5eff6]">
                  AI prompt improvement
                </strong>
                <p className="mt-1 text-xs text-[#8d838f]">
                  Local uses your Ollama server
                  {localModel ? ` (${localModel})` : ""}. API uses the key set
                  in Adapters.
                </p>
              </div>
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <div
                  role="group"
                  aria-label="Improvement provider"
                  className="flex overflow-hidden rounded-[10px] border border-[#332a38]"
                >
                  {(["local", "api"] as const).map((p) => (
                    <button
                      key={p}
                      type="button"
                      aria-pressed={improveProvider === p}
                      onClick={() => setImproveProvider(p)}
                      className={cn(
                        "min-h-11 px-3 text-xs font-semibold transition-colors",
                        improveProvider === p
                          ? "bg-[#2c162f] text-[#e77ae6]"
                          : "text-[#8d838f] hover:text-[#f5eff6]",
                      )}
                    >
                      {p === "local" ? "Local" : "API key"}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => void improve()}
                  disabled={improving || !prompt.trim()}
                  className="min-h-11 rounded-[10px] border border-[#504156] bg-[#2c162f] px-4 text-sm font-bold text-[#e77ae6] transition-colors hover:border-[#d565d6] hover:text-[#f5eff6] disabled:border-[#332a38] disabled:bg-[#17131b] disabled:text-[#6e6570]"
                >
                  {improving ? "Improving…" : "Improve prompt"}
                </button>
              </div>
            </div>
            {improveProvider === "api" && !hasApiKey ? (
              <p className="text-xs text-[#ff8ea0]">
                No API key saved yet — add one under Adapters → Prompt
                improvement, or switch to Local.
              </p>
            ) : null}
            {improveError ? (
              <p role="alert" className="text-sm text-[#ff8ea0]">
                {improveError}
              </p>
            ) : null}
            {improved ? (
              <div className="grid gap-3 border-t border-[#332a38] pt-3">
                <p className="text-sm leading-normal text-[#b8aebb]">
                  <strong className="text-[#f5eff6]">
                    Improved ({improved.provider} · {improved.model}):
                  </strong>{" "}
                  {improved.prompt}
                </p>
                <div>
                  <button
                    type="button"
                    onClick={() => {
                      setPrompt(improved.prompt);
                      setImproved(null);
                      promptRef.current?.focus();
                    }}
                    className="min-h-11 rounded-[10px] border border-[#504156] px-4 text-sm font-bold text-[#b8aebb] transition-colors hover:border-[#d565d6] hover:text-[#f5eff6]"
                  >
                    Use improved prompt
                  </button>
                </div>
              </div>
            ) : null}
          </section>

          <section
            aria-label="Prompt assist"
            className="mb-2 grid gap-3 rounded-[10px] border border-[#332a38] bg-[#100e14] p-4"
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
                  Prompt assist
                </strong>
                <small className="mt-1 block text-xs leading-normal text-[#8d838f]">
                  Deterministic pass that fills missing composition,
                  environment, light, and structural detail.
                </small>
              </span>
            </label>
            {assistedPrompt ? (
              <p className="max-h-32 overflow-y-auto border-t border-[#332a38] pt-3 text-sm leading-normal text-[#b8aebb]">
                <strong className="text-[#f5eff6]">Generation prompt:</strong>{" "}
                {assistedPrompt}
              </p>
            ) : null}
          </section>

          <fieldset className="min-w-0 border-y border-[#332a38] py-5">
            <legend className="text-sm font-medium text-[#b8aebb]">
              Preset
            </legend>
            <div className="grid min-w-0 grid-cols-2 gap-2 sm:grid-cols-4 2xl:grid-cols-8">
              {DREAM_PRESETS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  aria-pressed={preset === p.id}
                  onClick={() => setPreset(p.id)}
                  className={cn(
                    "grid min-h-11 min-w-0 place-content-center rounded-[10px] border px-2 py-1 text-center text-sm whitespace-nowrap transition-colors",
                    preset === p.id
                      ? "border-[#d565d6] bg-[#2c162f] text-[#e77ae6]"
                      : "border-[#332a38] bg-[#100e14] text-[#b8aebb] hover:border-[#504156] hover:bg-[#211a25] hover:text-[#f5eff6]",
                  )}
                >
                  {p.label}
                </button>
              ))}
            </div>
            <p className="mt-3 text-sm text-[#8d838f]">
              Adds to your prompt: {activePreset.suffix}
            </p>
          </fieldset>

          <div className="grid min-w-0 gap-5 py-5 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,0.75fr)] md:items-end">
            <fieldset className="min-w-0">
              <legend className="mb-2 text-sm font-medium text-[#b8aebb]">
                Aspect ratio
              </legend>
              <div className="grid min-w-0 grid-cols-2 gap-2 sm:grid-cols-3">
                {DREAM_RATIOS.map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    aria-pressed={ratio === r.id}
                    onClick={() => setRatio(r.id)}
                    className={cn(
                      "grid min-h-[4.25rem] min-w-0 place-content-center gap-1 rounded-[10px] border px-2 py-1 text-center transition-colors",
                      ratio === r.id
                        ? "border-[#d565d6] bg-[#2c162f] text-[#e77ae6]"
                        : "border-[#332a38] bg-[#100e14] text-[#b8aebb] hover:border-[#504156] hover:bg-[#211a25] hover:text-[#f5eff6]",
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
                Auto reads framing words like wide angle, full body, macro.
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

          <details className="min-w-0 border-b border-[#332a38]">
            <summary className="grid min-h-11 cursor-pointer list-none content-center gap-1 py-3 font-medium text-[#f5eff6] [&::-webkit-details-marker]:hidden">
              <span>Advanced settings</span>
              <span className="text-xs font-normal text-[#8d838f]">
                Flux2 distilled defaults · 4 steps · CFG 1
              </span>
            </summary>
            <div className="grid min-w-0 gap-4 pb-5 sm:grid-cols-2">
              <label className="min-w-0 sm:col-span-2">
                <span className={labelClass}>Negative prompt</span>
                <textarea
                  value={negativePrompt}
                  onChange={(e) => setNegativePrompt(e.currentTarget.value)}
                  placeholder="Anything to avoid"
                  className="min-h-20 w-full min-w-0 resize-y rounded-[10px] border border-[#332a38] bg-[#100e14] p-3 text-sm text-[#f5eff6] placeholder:text-[#8d838f] hover:border-[#504156] focus-visible:outline-2 focus-visible:outline-[#f2a1ed]"
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
                  onChange={(e) => setSteps(e.currentTarget.value)}
                  className={inputClass}
                />
              </label>
              <label className="min-w-0">
                <span className={labelClass}>CFG scale</span>
                <input
                  type="number"
                  min={0}
                  max={20}
                  step={0.1}
                  value={cfg}
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
                  Generation needs attention
                </p>
                <p className="text-sm text-[#f5eff6]">{job.error}</p>
                <p className="mt-1 text-sm text-[#b8aebb]">
                  Retry, or open Adapters to verify the controller.
                </p>
              </div>
              <div className="flex min-w-0 flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => void generate()}
                  className="min-h-11 rounded-[10px] border border-[#504156] bg-[#2c162f] px-4 text-sm font-bold text-[#e77ae6] hover:border-[#d565d6]"
                >
                  Retry generation
                </button>
                <a
                  href="/settings"
                  className="grid min-h-11 place-items-center rounded-[10px] px-4 text-sm font-bold text-[#b8aebb] hover:text-[#f5eff6]"
                >
                  Open Adapters
                </a>
              </div>
            </div>
          ) : null}

          <div className="grid items-center gap-3 pt-5 sm:grid-cols-[minmax(0,1fr)_minmax(0,12rem)]">
            <p className="text-xs text-[#8d838f]">
              Generation runs locally. No prompt or credential leaves your
              controller.
            </p>
            <button
              type="submit"
              disabled={running}
              className="min-h-11 w-full min-w-0 rounded-[10px] border border-[#d565d6] bg-[#d565d6] px-4 text-sm font-bold text-[#170b18] transition-colors hover:border-[#e77ae6] hover:bg-[#e77ae6] disabled:border-[#332a38] disabled:bg-[#17131b] disabled:text-[#6e6570]"
            >
              {running ? "Generating" : "Generate"}
            </button>
          </div>
        </form>

        <aside
          aria-labelledby="job-heading"
          className="min-w-0 rounded-[14px] border border-[#332a38] bg-[#100e14] p-5 xl:col-start-2 xl:row-span-2 xl:sticky xl:top-6"
        >
          <div className="flex min-w-0 items-end justify-between gap-3">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#e77ae6]">
                Live task
              </p>
              <h2 id="job-heading" className="mt-1 text-lg text-[#f5eff6]">
                Current job
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
            {!job
              ? "Ready for a prompt"
              : job.status === "queued"
                ? "Sending"
                : job.status === "running"
                  ? "Queued / generating"
                  : job.status === "completed"
                    ? `Complete — ${images.length} ${images.length === 1 ? "image" : "images"} saved locally`
                    : "Generation stopped"}
          </p>
          <ol aria-label="Generation stages" className="mt-5 grid gap-3">
            {[
              ["queued", "Sending"],
              ["running", "Generate"],
              ["completed", "Save locally"],
            ].map(([stage, label]) => {
              const order = { queued: 0, running: 1, completed: 2 };
              const current = !job
                ? -1
                : job.status === "failed"
                  ? 2
                  : (order[job.status as keyof typeof order] ?? -1);
              const target = order[stage as keyof typeof order];
              const state =
                target < current
                  ? "done"
                  : target === current
                    ? "current"
                    : "waiting";
              return (
                <li
                  key={stage}
                  data-state={state}
                  className={cn(
                    "flex min-w-0 items-center gap-2 text-sm",
                    state === "current"
                      ? "text-[#e77ae6]"
                      : state === "done"
                        ? "text-[#b8aebb]"
                        : "text-[#8d838f]",
                  )}
                >
                  <span
                    aria-hidden="true"
                    className={cn(
                      "size-2 shrink-0 rounded-full border border-[#504156]",
                      state === "current" && "border-[#d565d6] bg-[#d565d6]",
                      state === "done" && "border-[#b94ebc] bg-[#2c162f]",
                    )}
                  />
                  {label}
                </li>
              );
            })}
          </ol>
          <dl className="mt-5 grid grid-cols-3 gap-2 border-t border-[#332a38] pt-4">
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
          {job?.script ? (
            <details className="mt-4 border-t border-[#332a38] pt-3">
              <summary className="min-h-11 cursor-pointer list-none content-center text-sm font-medium text-[#b8aebb] [&::-webkit-details-marker]:hidden">
                Reproducibility
              </summary>
              <pre className="max-h-48 overflow-y-auto whitespace-pre-wrap rounded-[10px] bg-[#09080c] p-3 text-xs text-[#b8aebb]">
                {job.script}
              </pre>
            </details>
          ) : null}
          <p className="mt-4 text-xs text-[#8d838f]">
            Saved to Fieldbench library (.data/outputs)
          </p>
        </aside>

        <section
          aria-labelledby="results-heading"
          className="min-w-0 pt-3 xl:col-start-1"
        >
          <div className="flex min-w-0 flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#e77ae6]">
                Generated work
              </p>
              <h2 id="results-heading" className="mt-1 text-lg text-[#f5eff6]">
                Results
              </h2>
            </div>
            {images.length ? (
              <span className="rounded-full border border-[#504156] bg-[#100e14] px-3 py-1 text-xs text-[#b8aebb]">
                {images.length} local
              </span>
            ) : null}
          </div>
          {images.length && job ? (
            <ul className="mt-4 grid min-w-0 grid-cols-[repeat(auto-fill,minmax(min(100%,15rem),1fr))] gap-5">
              {images.map((o) => (
                <li
                  key={o.id}
                  className="min-w-0 border-b border-[#332a38] pb-4"
                >
                  <figure className="min-w-0">
                    <div className="relative aspect-square min-w-0 overflow-hidden rounded-[14px] border border-[#332a38] bg-[#17131b]">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={o.url}
                        alt={o.label}
                        className="h-full w-full object-cover"
                      />
                      <span className="absolute right-2 bottom-2 rounded-full border border-[#504156] bg-[#100e14] px-2 py-1 text-xs text-[#b8aebb]">
                        Saved locally
                      </span>
                    </div>
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
                    <a
                      href={o.url}
                      target="_blank"
                      rel="noreferrer"
                      className="grid min-h-11 flex-1 place-items-center rounded-[10px] px-3 text-sm font-bold text-[#b8aebb] transition-colors hover:text-[#f5eff6]"
                    >
                      Open
                    </a>
                    <button
                      type="button"
                      onClick={() => reuseFromJob(job)}
                      className="min-h-11 flex-1 rounded-[10px] px-3 text-sm font-bold text-[#b8aebb] transition-colors hover:text-[#f5eff6]"
                    >
                      Reuse settings
                    </button>
                    <button
                      type="button"
                      disabled={running}
                      onClick={() => varyFromJob(job)}
                      className="min-h-11 flex-1 rounded-[10px] border border-[#504156] bg-[#2c162f] px-3 text-sm font-bold text-[#e77ae6] transition-colors hover:border-[#d565d6] disabled:border-[#332a38] disabled:bg-[#17131b] disabled:text-[#6e6570]"
                    >
                      Vary
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <div className="mt-4 border-y border-[#332a38] px-4 py-8 text-center text-[#b8aebb]">
              <p>Your generated images will settle here.</p>
              <span className="mt-1 block text-sm text-[#8d838f]">
                They are downloaded locally with reproducibility metadata.
              </span>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
