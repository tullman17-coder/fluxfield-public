"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  dreamPresets,
  DREAM_RATIOS,
  FRAMINGS,
  dreamRatio,
  enhancePrompt,
} from "@/lib/dream/presets";
import { useJobWatch } from "@/lib/jobs/use-job-watch";
import type { StudioJob } from "@/lib/adapters/types";
import { cn } from "@/lib/utils";

type ImproveResult = {
  prompt: string;
  provider: "local" | "api";
  model: string;
};

const selectClass =
  "h-11 w-full min-w-0 rounded-[10px] border border-white/10 glass px-3 text-sm text-[#f5eff6] transition-colors hover:border-white/15 focus-visible:outline-2 focus-visible:outline-[#f2a1ed]";
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
  const [unrestricted, setUnrestricted] = useState(false);
  const [improving, setImproving] = useState(false);
  const [improved, setImproved] = useState<ImproveResult | null>(null);
  const [improveError, setImproveError] = useState<string | null>(null);

  const { job, setJob } = useJobWatch("dream");
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
        setUnrestricted(Boolean(s?.unrestricted));
      })
      .catch(() => undefined);
  }, []);

  const running = !!job && (job.status === "queued" || job.status === "running");
  const presets = dreamPresets(unrestricted);
  const activePreset = presets.find((p) => p.id === preset) ?? presets[0];
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
      if (!res.ok) throw new Error(data.error || "Could not rewrite that");
      setImproved(data as ImproveResult);
    } catch (err) {
      setImproveError(
        err instanceof Error ? err.message : "Could not rewrite that",
      );
    } finally {
      setImproving(false);
    }
  }, [prompt, improving, improveProvider]);

  const generate = useCallback(
    async (seedOverride?: string) => {
      if (!prompt.trim()) {
        setSubmitError("Describe the image you want first.");
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
    [prompt, negativePrompt, preset, ratio, framing, count, seed, steps, cfg, assist, setJob],
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
    [reuseFromJob, setJob],
  );

  const images = job?.outputs.filter((o) => o.kind === "image" && o.url) ?? [];

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
              onChange={(e) => setPrompt(e.currentTarget.value)}
              placeholder="A moonlit observatory above a quiet violet sea…"
              className="min-h-32 w-full min-w-0 resize-y rounded-[10px] border border-white/15 glass p-3 text-base leading-normal text-[#f5eff6] shadow-[0_1.25rem_3.75rem_rgb(0_0_0/44%)] placeholder:text-[#8d838f] focus-visible:outline-2 focus-visible:outline-[#f2a1ed]"
            />
            {submitError ? (
              <p role="alert" className="text-sm text-[#ff8ea0]">
                {submitError}
              </p>
            ) : null}
          </div>

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
                  Turns a short line into a fully described scene
                  {localModel ? `, using ${localModel}` : ""}.
                </p>
              </div>
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <div
                  role="group"
                  aria-label="Rewrite with"
                  className="flex overflow-hidden rounded-[10px] border border-white/10"
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
                      {p === "local" ? "My model" : "Cloud"}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => void improve()}
                  disabled={improving || !prompt.trim()}
                  className="min-h-11 rounded-[10px] border border-white/15 bg-[#2c162f] px-4 text-sm font-bold text-[#e77ae6] transition-colors hover:border-[#d565d6] hover:text-[#f5eff6] disabled:border-white/10 disabled:bg-white/10 disabled:text-[#6e6570]"
                >
                  {improving ? "Rewriting…" : "Rewrite"}
                </button>
              </div>
            </div>
            {improveProvider === "api" && !hasApiKey ? (
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
                <p className="text-sm leading-normal text-[#b8aebb]">
                  <strong className="text-[#f5eff6]">Rewritten:</strong>{" "}
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
                    className="min-h-11 rounded-[10px] border border-white/15 px-4 text-sm font-bold text-[#b8aebb] transition-colors hover:border-[#d565d6] hover:text-[#f5eff6]"
                  >
                    Use this
                  </button>
                </div>
              </div>
            ) : null}
          </section>

          <section
            aria-label="Fill in the details"
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
                  Fill in the details
                </strong>
                <small className="mt-1 block text-xs leading-normal text-[#8d838f]">
                  Adds composition, setting, light, and material when you leave
                  them out.
                </small>
              </span>
            </label>
            {assistedPrompt ? (
              <p className="max-h-32 overflow-y-auto border-t border-white/10 pt-3 text-sm leading-normal text-[#b8aebb]">
                <strong className="text-[#f5eff6]">What gets made:</strong>{" "}
                {assistedPrompt}
              </p>
            ) : null}
          </section>

          <fieldset className="min-w-0 border-y border-white/10 py-5">
            <legend className="flex flex-wrap items-center gap-2 text-sm font-medium text-[#b8aebb]">
              Preset
              {unrestricted ? (
                <span className="rounded-full border border-[#d565d6] px-2 py-0.5 text-[11px] text-[#e77ae6]">
                  Prompts go through as written
                </span>
              ) : null}
            </legend>
            <div className="grid min-w-0 grid-cols-2 gap-2 sm:grid-cols-4 2xl:grid-cols-8">
              {presets.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  aria-pressed={preset === p.id}
                  onClick={() => setPreset(p.id)}
                  className={cn(
                    "grid min-h-11 min-w-0 place-content-center rounded-[10px] border px-2 py-1 text-center text-sm whitespace-nowrap transition-colors",
                    preset === p.id
                      ? "border-[#d565d6] bg-[#2c162f] text-[#e77ae6]"
                      : "border-white/10 glass text-[#b8aebb] hover:border-white/15 hover:bg-white/15 hover:text-[#f5eff6]",
                  )}
                >
                  {p.label}
                </button>
              ))}
            </div>
            <p className="mt-3 text-sm text-[#8d838f]">
              Adds: {activePreset.suffix}
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
                  That did not finish
                </p>
                <p className="text-sm text-[#f5eff6]">{job.error}</p>
                <p className="mt-1 text-sm text-[#b8aebb]">
                  Try again, or check your connections in Settings.
                </p>
              </div>
              <div className="flex min-w-0 flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => void generate()}
                  className="min-h-11 rounded-[10px] border border-white/15 bg-[#2c162f] px-4 text-sm font-bold text-[#e77ae6] hover:border-[#d565d6]"
                >
                  Try again
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
            <button
              type="submit"
              disabled={running}
              className="min-h-11 w-full min-w-0 rounded-[10px] border border-[#d565d6] bg-[#d565d6] px-4 text-sm font-bold text-white transition-colors hover:border-[#e77ae6] hover:bg-[#e77ae6] disabled:border-white/10 disabled:bg-white/10 disabled:text-[#6e6570] sm:w-48"
            >
              {running ? "Making it" : "Make it"}
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
                In progress
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
                ? "Starting"
                : job.status === "running"
                  ? "Making it"
                  : job.status === "completed"
                    ? `Done — ${images.length} ${images.length === 1 ? "image" : "images"}`
                    : "Stopped"}
          </p>
          <ol aria-label="Progress" className="mt-5 grid gap-3">
            {[
              ["queued", "Starting"],
              ["running", "Making"],
              ["completed", "Saving"],
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
                      "size-2 shrink-0 rounded-full border border-white/15",
                      state === "current" && "border-[#d565d6] bg-[#d565d6]",
                      state === "done" && "border-[#b94ebc] bg-[#2c162f]",
                    )}
                  />
                  {label}
                </li>
              );
            })}
          </ol>
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
          {job?.script ? (
            <details className="mt-4 border-t border-white/10 pt-3">
              <summary className="min-h-11 cursor-pointer list-none content-center text-sm font-medium text-[#b8aebb] [&::-webkit-details-marker]:hidden">
                Settings used
              </summary>
              <pre className="max-h-48 overflow-y-auto whitespace-pre-wrap rounded-[10px] bg-white/10 p-3 text-xs text-[#b8aebb]">
                {job.script}
              </pre>
            </details>
          ) : null}
          <p className="mt-4 text-xs text-[#8d838f]">
            Saved to your library
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
          {images.length && job ? (
            <ul className="mt-4 grid min-w-0 grid-cols-[repeat(auto-fill,minmax(min(100%,15rem),1fr))] gap-5">
              {images.map((o) => (
                <li
                  key={o.id}
                  className="min-w-0 border-b border-white/10 pb-4"
                >
                  <figure className="min-w-0">
                    <div className="relative aspect-square min-w-0 overflow-hidden rounded-[14px] border border-white/10 bg-white/10">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={o.url}
                        alt={o.label}
                        className="h-full w-full object-cover"
                      />
                      <span className="absolute right-2 bottom-2 rounded-full border border-white/15 glass px-2 py-1 text-xs text-[#b8aebb]">
                        Saved
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
                      className="min-h-11 flex-1 rounded-[10px] border border-white/15 bg-[#2c162f] px-3 text-sm font-bold text-[#e77ae6] transition-colors hover:border-[#d565d6] disabled:border-white/10 disabled:bg-white/10 disabled:text-[#6e6570]"
                    >
                      Vary
                    </button>
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
    </div>
  );
}
