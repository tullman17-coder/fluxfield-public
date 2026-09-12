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
  "h-11 w-full min-w-0 rounded-[10px] border border-white/10 bg-white/10 px-3 text-sm text-[#f5eff6] transition-colors hover:border-white/15 focus-visible:outline-2 focus-visible:outline-[#f2a1ed]";
const labelClass = "mb-2 block text-sm font-medium text-[#b8aebb]";

const STAGES: { id: "improve" | "generate" | "copy"; label: string }[] = [
  { id: "improve", label: "Sharpen the brief" },
  { id: "generate", label: "Make the key art" },
  { id: "copy", label: "Write the copy" },
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
      setError("Write a brief first — product, mood, what it should do.");
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
            productName: brand.trim() || "Key art",
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Job failed");
      job = data.job as StudioJob;
    } catch (err) {
      setStage("error");
      setError(err instanceof Error ? err.message : "Could not make the art");
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
        setError(data.job.error || "Could not make the art");
        return;
      }
    }
    if (!done) {
      setStage("error");
      setError("This is taking too long. Check your connections in Settings.");
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
      <header className="mb-8 grid gap-3 border-b border-white/10 pb-6">
        <div className="flex min-w-0 flex-wrap items-center gap-3">
          <span
            aria-hidden="true"
            className="grid size-10 shrink-0 place-items-center rounded-full text-sm font-extrabold text-[#e77ae6]"
            style={{
              background:
                "conic-gradient(from 20deg, rgb(138 73 190 / 55%), rgb(205 64 154 / 45%), rgb(88 56 160 / 50%), rgb(138 73 190 / 55%))",
            }}
          >
            ZB
          </span>
          <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#e77ae6]">
            Zermobrands
          </p>
        </div>
        <h1 className="text-4xl font-semibold tracking-tight text-balance text-[#f5eff6] md:text-5xl">
          superComputer
        </h1>
        <p className="max-w-xl text-pretty text-[#b8aebb]">
          One brief in. Finished key art and campaign copy out.
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
                className="text-lg font-bold text-[#f5eff6]"
              >
                Brief
              </label>
              <span className="text-sm text-[#8d838f]">
                Product, mood, goal — rough is fine
              </span>
            </div>
            <textarea
              id="brief"
              ref={briefRef}
              value={brief}
              onChange={(e) => setBrief(e.currentTarget.value)}
              placeholder="A quiet luxury candle launch for late-autumn evenings…"
              className="min-h-28 w-full min-w-0 resize-y rounded-[10px] border border-white/15 bg-white/15 p-3 text-base leading-normal text-[#f5eff6] shadow-[0_1.25rem_3.75rem_rgb(0_0_0/44%)] placeholder:text-[#8d838f] focus-visible:outline-2 focus-visible:outline-[#f2a1ed]"
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
              <span className={labelClass}>Sharpen with</span>
              <div
                role="group"
                aria-label="Sharpen with"
                className="flex overflow-hidden rounded-[10px] border border-white/10"
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
                        ? "bg-[#2c162f] text-[#e77ae6]"
                        : "text-[#8d838f] hover:text-[#f5eff6]",
                    )}
                  >
                    {p === "local" ? "My model" : "Cloud"}
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
              className="mt-4 rounded-[10px] border border-[#ff8ea0] bg-[#35171f] p-3 text-sm text-[#ff8ea0]"
            >
              {error}
            </p>
          ) : null}

          <div className="grid pt-5 sm:justify-items-end">
            <button
              type="submit"
              disabled={running}
              className="min-h-11 w-full min-w-0 rounded-[10px] border border-[#d565d6] bg-[#d565d6] px-4 text-sm font-bold text-white transition-colors hover:border-[#e77ae6] hover:bg-[#e77ae6] disabled:border-white/10 disabled:bg-white/5 disabled:text-[#6e6570] sm:w-56"
            >
              {running ? "Working" : "Run superComputer"}
            </button>
          </div>
        </form>

        <aside
          aria-labelledby="pipeline-heading"
          className="glass min-w-0 rounded-[14px] p-5 xl:col-start-2 xl:row-span-2 xl:sticky xl:top-6"
        >
          <div className="flex min-w-0 items-end justify-between gap-3">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#e77ae6]">
                Progress
              </p>
              <h2 id="pipeline-heading" className="mt-1 text-lg text-[#f5eff6]">
                Status
              </h2>
            </div>
            <span
              aria-hidden="true"
              className={cn(
                "size-2 rounded-full",
                stage === "idle"
                  ? "bg-[#8d838f]"
                  : stage === "error"
                    ? "bg-[#d6455b]"
                    : "bg-[#d565d6] shadow-[0_0_0_4px_#2c162f]",
              )}
            />
          </div>
          <p
            role="status"
            aria-live="polite"
            className="mt-5 font-bold text-[#f5eff6]"
          >
            {stage === "idle"
              ? "Ready for a brief"
              : stage === "done"
                ? "Done"
                : stage === "error"
                  ? "Stopped"
                  : "Working"}
          </p>
          <ol aria-label="Steps" className="mt-5 grid gap-3">
            {STAGES.map((s) => {
              const state = stageState(stage, s.id);
              return (
                <li
                  key={s.id}
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
                  {s.label}
                </li>
              );
            })}
          </ol>
          <dl className="mt-5 grid grid-cols-2 gap-2 border-t border-white/10 pt-4">
            <div className="min-w-0">
              <dt className="text-xs text-[#8d838f]">Frame</dt>
              <dd className="mt-1 text-sm tabular-nums text-[#b8aebb]">
                {activeRatio.width} × {activeRatio.height}
              </dd>
            </div>
            <div className="min-w-0">
              <dt className="text-xs text-[#8d838f]">Sharpen</dt>
              <dd className="mt-1 text-sm text-[#b8aebb]">
                {provider === "local" ? "My model" : "Cloud"}
              </dd>
            </div>
          </dl>
          {result?.script ? (
            <details className="mt-4 border-t border-white/10 pt-3">
              <summary className="min-h-11 cursor-pointer list-none content-center text-sm font-medium text-[#b8aebb] [&::-webkit-details-marker]:hidden">
                Settings used
              </summary>
              <pre className="max-h-48 overflow-y-auto whitespace-pre-wrap rounded-[10px] bg-white/10 p-3 font-mono text-xs text-[#b8aebb]">
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
              <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#e77ae6]">
                Finished
              </p>
              <h2 id="run-results-heading" className="mt-1 text-lg text-[#f5eff6]">
                Results
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
                    <p className="text-sm font-bold text-[#f5eff6]">Key art</p>
                    <p className="mt-1 text-sm text-pretty text-[#b8aebb]">
                      {result.improvedPrompt}
                    </p>
                  </figcaption>
                </figure>
              ) : null}
              {result.copy ? (
                <pre className="glass min-w-0 whitespace-pre-wrap rounded-[14px] p-4 font-mono text-xs leading-relaxed text-[#f5eff6]">
                  {result.copy}
                </pre>
              ) : null}
            </div>
          ) : (
            <div className="glass mt-4 rounded-[14px] px-4 py-8 text-center text-[#b8aebb]">
              <p>Your key art and copy show up here.</p>
              <span className="mt-1 block text-sm text-[#8d838f]">
                One brief becomes a finished piece.
              </span>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
