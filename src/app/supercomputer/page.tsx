"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  DREAM_PRESETS,
  DREAM_RATIOS,
  dreamRatio,
} from "@/lib/dream/presets";
import type { StudioJob } from "@/lib/adapters/types";
import { cn } from "@/lib/utils";

type Stage = "idle" | "improve" | "generate" | "copy" | "done" | "error";

type RunResult = {
  improvedPrompt: string;
  improveProvider: string;
  artUrl?: string;
  copy?: string;
  script?: string;
};

const selectClass =
  "h-11 w-full min-w-0 rounded-[10px] border border-[#e7dfe8] bg-white/60 px-3 text-sm text-[#2e2833] transition-colors hover:border-[#d5c8da] focus-visible:outline-2 focus-visible:outline-[#d98ce0]";
const labelClass = "mb-2 block text-sm font-medium text-[#6f6577]";

const STAGES: { id: "improve" | "generate" | "copy"; label: string }[] = [
  { id: "improve", label: "Improve brief" },
  { id: "generate", label: "Generate key art" },
  { id: "copy", label: "Write campaign copy" },
];

function stageState(
  stage: Stage,
  id: "improve" | "generate" | "copy",
): "waiting" | "current" | "done" {
  const order: Record<"improve" | "generate" | "copy", number> = {
    improve: 0,
    generate: 1,
    copy: 2,
  };
  const current =
    stage === "done" || stage === "error"
      ? 3
      : stage === "idle"
        ? -1
        : order[stage];
  const target = order[id];
  return target < current ? "done" : target === current ? "current" : "waiting";
}

export default function SupercomputerPage() {
  const [brief, setBrief] = useState("");
  const [brand, setBrand] = useState("");
  const [provider, setProvider] = useState<"local" | "api">("local");
  const [style, setStyle] = useState("cinematic");
  const [ratio, setRatio] = useState("landscape");
  const [stage, setStage] = useState<Stage>("idle");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<RunResult | null>(null);
  const briefRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((d) => {
        if (d.settings?.improveProvider === "api" && d.settings?.improveApiKey)
          setProvider("api");
      })
      .catch(() => undefined);
  }, []);

  const run = useCallback(async () => {
    const text = brief.trim();
    if (!text) {
      setError("Drop in a brief first — product, mood, campaign goal.");
      briefRef.current?.focus();
      return;
    }
    setError(null);
    setResult(null);

    // 1 — improve the brief
    setStage("improve");
    let improved = text;
    let usedProvider: string = provider;
    try {
      const res = await fetch("/api/improve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: text, provider }),
      });
      const data = await res.json();
      if (res.ok && data.prompt) {
        improved = data.prompt;
        usedProvider = data.provider;
      }
    } catch {
      // improvement is best-effort; the raw brief still drives the run
    }

    // 2 — dream key art through the adapter chain
    setStage("generate");
    let job: StudioJob;
    try {
      const res = await fetch("/api/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tool: "dream",
          workflowSlug: "dream",
          presetId: style,
          inputs: {
            prompt: improved,
            negativePrompt: "text, words, letters, logo, watermark",
            ratio,
            framing: "auto",
            count: "1",
            steps: "4",
            cfg: "1",
            assist: "on",
            productName: brand.trim() || "superComputer run",
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Job failed");
      job = data.job as StudioJob;
    } catch (err) {
      setStage("error");
      setError(err instanceof Error ? err.message : "Generation failed");
      return;
    }

    let done: StudioJob | null = null;
    const start = Date.now();
    while (Date.now() - start < 180_000) {
      await new Promise((r) => setTimeout(r, 1200));
      const res = await fetch(`/api/jobs/${job.id}`);
      if (!res.ok) continue;
      const data = (await res.json()) as { job: StudioJob };
      if (data.job.status === "completed") {
        done = data.job;
        break;
      }
      if (data.job.status === "failed") {
        setStage("error");
        setError(data.job.error || "Generation failed");
        return;
      }
    }
    if (!done) {
      setStage("error");
      setError("Generation timed out — check Adapters.");
      return;
    }

    // 3 — campaign copy
    setStage("copy");
    let copy: string | undefined;
    try {
      const res = await fetch("/api/copy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brandName: brand,
          productName: "Key art",
          productDescription: improved,
          wrapperName: "superComputer",
          presetLabel:
            DREAM_PRESETS.find((p) => p.id === style)?.label || style,
        }),
      });
      const data = await res.json();
      if (res.ok) copy = data.copy;
    } catch {
      // copy is best-effort
    }

    setResult({
      improvedPrompt: improved,
      improveProvider: usedProvider,
      artUrl: done.outputs.find((o) => o.kind === "image" && o.url)?.url,
      copy,
      script: done.script,
    });
    setStage("done");
  }, [brief, brand, provider, style, ratio]);

  const running = stage === "improve" || stage === "generate" || stage === "copy";
  const activeRatio = dreamRatio(ratio);

  return (
    <div className="w-full min-w-0">
      <header className="mb-8 grid gap-3 border-b border-[#e7dfe8] pb-6">
        <div className="flex min-w-0 flex-wrap items-center gap-3">
          <span
            aria-hidden="true"
            className="grid size-10 shrink-0 place-items-center rounded-full text-sm font-extrabold text-[#a845b0]"
            style={{
              background:
                "conic-gradient(from 20deg, #f9dce8, #e8ddf7, #ddf0ea, #dbe7f7, #f9dce8)",
            }}
          >
            ZB
          </span>
          <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#a845b0]">
            Zermobrands · Dream Studio variant
          </p>
        </div>
        <h1 className="text-4xl font-semibold tracking-tight text-balance text-[#2e2833] md:text-5xl">
          superComputer
        </h1>
        <p className="max-w-xl text-pretty text-[#6f6577]">
          One brief in — improved prompt, generated key art, and campaign copy
          out. Runs the whole chain on your own adapters.
        </p>
      </header>

      <div className="grid min-w-0 gap-8 xl:grid-cols-[minmax(0,1fr)_minmax(16rem,18rem)] xl:items-start">
        <form
          className="glass min-w-0 rounded-[14px] p-5 xl:col-start-1"
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            void run();
          }}
        >
          <div className="grid gap-2 pb-5">
            <div className="flex min-w-0 flex-wrap items-end justify-between gap-3">
              <label
                htmlFor="brief"
                className="text-lg font-bold text-[#2e2833]"
              >
                Brief
              </label>
              <span className="text-sm text-[#8d8296]">
                Product, mood, goal — rough is fine
              </span>
            </div>
            <textarea
              id="brief"
              ref={briefRef}
              value={brief}
              onChange={(e) => setBrief(e.currentTarget.value)}
              placeholder="A quiet luxury candle launch for late-autumn evenings…"
              className="min-h-28 w-full min-w-0 resize-y rounded-[10px] border border-[#d5c8da] bg-white/70 p-3 text-base leading-normal text-[#2e2833] shadow-[0_1.25rem_3.75rem_rgb(90_70_110/14%)] placeholder:text-[#8d8296] focus-visible:outline-2 focus-visible:outline-[#d98ce0]"
            />
          </div>

          <div className="grid min-w-0 gap-4 sm:grid-cols-2">
            <div className="min-w-0">
              <label htmlFor="brand" className={labelClass}>
                Brand mark
              </label>
              <input
                id="brand"
                value={brand}
                onChange={(e) => setBrand(e.currentTarget.value)}
                placeholder="Zermobrands"
                className={selectClass}
              />
            </div>
            <div className="min-w-0">
              <span className={labelClass}>Improve with</span>
              <div
                role="group"
                aria-label="Improvement provider"
                className="flex overflow-hidden rounded-[10px] border border-[#e7dfe8]"
              >
                {(["local", "api"] as const).map((p) => (
                  <button
                    key={p}
                    type="button"
                    aria-pressed={provider === p}
                    onClick={() => setProvider(p)}
                    className={cn(
                      "min-h-11 flex-1 px-3 text-xs font-semibold transition-colors",
                      provider === p
                        ? "bg-[#f3e4f4] text-[#a845b0]"
                        : "text-[#8d8296] hover:text-[#2e2833]",
                    )}
                  >
                    {p === "local" ? "Local (Ollama)" : "API key"}
                  </button>
                ))}
              </div>
            </div>
            <div className="min-w-0">
              <label htmlFor="style" className={labelClass}>
                Art style
              </label>
              <select
                id="style"
                value={style}
                onChange={(e) => setStyle(e.currentTarget.value)}
                className={selectClass}
              >
                {DREAM_PRESETS.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="min-w-0">
              <label htmlFor="ratio" className={labelClass}>
                Frame
              </label>
              <select
                id="ratio"
                value={ratio}
                onChange={(e) => setRatio(e.currentTarget.value)}
                className={selectClass}
              >
                {DREAM_RATIOS.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.label} · {r.width}×{r.height}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {error ? (
            <p
              role="alert"
              className="mt-4 rounded-[10px] border border-[#d6455b] bg-[#fbe9ec] p-3 text-sm text-[#d6455b]"
            >
              {error}
            </p>
          ) : null}

          <div className="grid items-center gap-3 pt-5 sm:grid-cols-[minmax(0,1fr)_minmax(0,12rem)]">
            <p className="text-xs text-[#8d8296]">
              Everything runs on your mesh — no brief or key leaves your
              adapters.
            </p>
            <button
              type="submit"
              disabled={running}
              className="min-h-11 w-full min-w-0 rounded-[10px] border border-[#a845b0] bg-[#a845b0] px-4 text-sm font-bold text-white transition-colors hover:border-[#c05cc9] hover:bg-[#c05cc9] disabled:border-[#e7dfe8] disabled:bg-[#f6f1ee] disabled:text-[#a79fad]"
            >
              {running ? "Computing" : "Run superComputer"}
            </button>
          </div>
        </form>

        <aside
          aria-labelledby="pipeline-heading"
          className="glass min-w-0 rounded-[14px] p-5 xl:col-start-2 xl:row-span-2 xl:sticky xl:top-6"
        >
          <div className="flex min-w-0 items-end justify-between gap-3">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#a845b0]">
                Pipeline
              </p>
              <h2 id="pipeline-heading" className="mt-1 text-lg text-[#2e2833]">
                Run state
              </h2>
            </div>
            <span
              aria-hidden="true"
              className={cn(
                "size-2 rounded-full",
                stage === "idle"
                  ? "bg-[#8d8296]"
                  : stage === "error"
                    ? "bg-[#d6455b]"
                    : "bg-[#a845b0] shadow-[0_0_0_4px_#f3e4f4]",
              )}
            />
          </div>
          <p
            role="status"
            aria-live="polite"
            className="mt-5 font-bold text-[#2e2833]"
          >
            {stage === "idle"
              ? "Ready for a brief"
              : stage === "done"
                ? "Run complete"
                : stage === "error"
                  ? "Run stopped"
                  : "Computing"}
          </p>
          <ol aria-label="Pipeline stages" className="mt-5 grid gap-3">
            {STAGES.map((s) => {
              const state = stageState(stage, s.id);
              return (
                <li
                  key={s.id}
                  data-state={state}
                  className={cn(
                    "flex min-w-0 items-center gap-2 text-sm",
                    state === "current"
                      ? "text-[#a845b0]"
                      : state === "done"
                        ? "text-[#6f6577]"
                        : "text-[#8d8296]",
                  )}
                >
                  <span
                    aria-hidden="true"
                    className={cn(
                      "size-2 shrink-0 rounded-full border border-[#d5c8da]",
                      state === "current" && "border-[#a845b0] bg-[#a845b0]",
                      state === "done" && "border-[#96369e] bg-[#f3e4f4]",
                    )}
                  />
                  {s.label}
                </li>
              );
            })}
          </ol>
          <dl className="mt-5 grid grid-cols-2 gap-2 border-t border-[#e7dfe8] pt-4">
            <div className="min-w-0">
              <dt className="text-xs text-[#8d8296]">Frame</dt>
              <dd className="mt-1 text-sm tabular-nums text-[#6f6577]">
                {activeRatio.width} × {activeRatio.height}
              </dd>
            </div>
            <div className="min-w-0">
              <dt className="text-xs text-[#8d8296]">Improve</dt>
              <dd className="mt-1 text-sm text-[#6f6577]">
                {provider === "local" ? "Local" : "API key"}
              </dd>
            </div>
          </dl>
          {result?.script ? (
            <details className="mt-4 border-t border-[#e7dfe8] pt-3">
              <summary className="min-h-11 cursor-pointer list-none content-center text-sm font-medium text-[#6f6577] [&::-webkit-details-marker]:hidden">
                Reproducibility
              </summary>
              <pre className="max-h-48 overflow-y-auto whitespace-pre-wrap rounded-[10px] bg-white/60 p-3 font-mono text-xs text-[#6f6577]">
                {result.script}
              </pre>
            </details>
          ) : null}
        </aside>

        <section
          aria-labelledby="run-results-heading"
          className="min-w-0 pt-3 xl:col-start-1"
        >
          <div className="flex min-w-0 flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#a845b0]">
                Output
              </p>
              <h2 id="run-results-heading" className="mt-1 text-lg text-[#2e2833]">
                Run results
              </h2>
            </div>
          </div>
          {result ? (
            <div className="mt-4 grid min-w-0 gap-5">
              {result.artUrl ? (
                <figure className="glass min-w-0 overflow-hidden rounded-[14px]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={result.artUrl}
                    alt="Generated key art"
                    className="w-full object-cover"
                  />
                  <figcaption className="p-4">
                    <p className="text-sm font-bold text-[#2e2833]">
                      Key art · {result.improveProvider} improved
                    </p>
                    <p className="mt-1 text-sm text-pretty text-[#6f6577]">
                      {result.improvedPrompt}
                    </p>
                  </figcaption>
                </figure>
              ) : null}
              {result.copy ? (
                <pre className="glass min-w-0 whitespace-pre-wrap rounded-[14px] p-4 font-mono text-xs leading-relaxed text-[#2e2833]">
                  {result.copy}
                </pre>
              ) : null}
            </div>
          ) : (
            <div className="glass mt-4 rounded-[14px] px-4 py-8 text-center text-[#6f6577]">
              <p>Run output lands here.</p>
              <span className="mt-1 block text-sm text-[#8d8296]">
                Key art, improved prompt, and campaign copy.
              </span>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
