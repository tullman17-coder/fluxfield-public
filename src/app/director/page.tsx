"use client";

import { ZermoJobStatus } from "@/components/studio/zermo-job-status";
import { useStudioConnection } from "@/lib/studio/use-studio-connection";
import Image from "next/image";
import { useCallback, useRef, useState } from "react";
import { LOOKS, RUNTIMES } from "@/lib/director/plan";
import { GENRES, MOODS } from "@/lib/music/theory";
import { useJobWatch } from "@/lib/jobs/use-job-watch";
import type { StudioJob } from "@/lib/adapters/types";
import { cn } from "@/lib/utils";
import { MediaLightbox } from "@/components/studio/media-lightbox";

const MODES = [
  {
    id: "music-video",
    label: "Music video",
    blurb: "ACE score + lyrics, Qwen Image 2.1 stills, WAN 5B clips per key shot.",
  },
  {
    id: "film",
    label: "Short film",
    blurb: "Six acts, WAN clips per window, ACE bed.",
  },
] as const;

const PACES = [
  { id: "slow", label: "Slow", blurb: "Long holds, room to breathe" },
  { id: "steady", label: "Steady", blurb: "Even cuts, conversational" },
  { id: "fast", label: "Fast", blurb: "Short holds, forward drive" },
  { id: "frantic", label: "Frantic", blurb: "Rapid cuts, high pressure" },
];

const LYRIC_MODES = [
  { id: "instrumental", label: "No words", blurb: "Just the music" },
  { id: "write", label: "Write them", blurb: "Words to match the brief" },
  { id: "own", label: "Use mine", blurb: "Paste your own" },
];

const ASPECTS = [
  { id: "16:9", label: "Widescreen" },
  { id: "2.39:1", label: "Scope" },
  { id: "9:16", label: "Vertical" },
  { id: "1:1", label: "Square" },
];

const selectClass =
  "h-11 w-full min-w-0 rounded-[10px] border border-white/10 bg-white/10 px-3 text-sm text-[#f5eff6] transition-colors hover:border-white/15 focus-visible:outline-2 focus-visible:outline-[#f2a1ed]";
const labelClass = "mb-2 block text-sm font-medium text-[#b8aebb]";

export default function DirectorPage() {
  const { zermo } = useStudioConnection();
  const [mode, setMode] = useState<"music-video" | "film">("music-video");
  const [brief, setBrief] = useState("");
  const [runtime, setRuntime] = useState("180");
  const [look, setLook] = useState("cinematic");
  const [pacing, setPacing] = useState("steady");
  const [aspect, setAspect] = useState("16:9");
  const [genre, setGenre] = useState("synthwave");
  const [mood, setMood] = useState("neutral");
  const [lyricMode, setLyricMode] = useState("write");
  const [lyrics, setLyrics] = useState("");
  const { job, setJob } = useJobWatch("director", 1500);
  const [error, setError] = useState<string | null>(null);
  const [activeMedia, setActiveMedia] = useState<string | null>(null);
  const briefRef = useRef<HTMLTextAreaElement>(null);

  const start = useCallback(async () => {
    if (!brief.trim()) {
      setError("Say what happens — who is in it, where it goes, how it ends.");
      briefRef.current?.focus();
      return;
    }
    setError(null);
    try {
      const res = await fetch("/api/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tool: "director",
          workflowSlug: "director",
          presetId: look,
          inputs: {
            mode,
            brief,
            runtime,
            look,
            pacing,
            aspect,
            genre,
            mood,
            lyricMode,
            lyrics,
            seconds: String(Math.min(90, Math.max(10, Number(runtime) || 180))),
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not start the plan");
      setJob(data.job as StudioJob);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start the plan");
    }
  }, [brief, mode, runtime, look, pacing, aspect, genre, mood, lyricMode, lyrics, setJob]);

  const running = !!job && (job.status === "queued" || job.status === "running");
  const shotList = job?.outputs.find((o) => o.kind === "storyboard");
  const windows = job?.outputs.find((o) => o.kind === "text" && o.text);
  const listFile = job?.outputs.find((o) => o.kind === "text" && o.url);
  const soundtrack = job?.outputs.find((o) => o.kind === "audio");
  const lyricSheet = job?.outputs.find((o) => o.kind === "script");
  const frames = job?.outputs.filter((o) => o.kind === "image" && o.url) ?? [];
  const clips = job?.outputs.filter((o) => o.kind === "video" && o.url) ?? [];
  const activeMode = MODES.find((m) => m.id === mode)!;

  return (
    <div className="w-full min-w-0">
      <header className="mb-8 grid gap-3 border-b border-white/10 pb-6">
        <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#e77ae6]">
          Long form
        </p>
        <h1 className="text-4xl font-semibold tracking-tight text-balance text-[#f5eff6] md:text-5xl">
          Director
        </h1>
        <p className="max-w-xl text-pretty text-[#b8aebb]">
          Plan a whole piece instead of a single clip — up to an hour of shots
          with timecodes and key frames. This is a plan, not a rendered film.
          Zermo makes still key frames only; native score, video, and narration are not enabled.
        </p>
      </header>

      <div className="grid min-w-0 gap-8 xl:grid-cols-[minmax(0,1fr)_minmax(18rem,22rem)] xl:items-start">
        <form
          className="glass min-w-0 rounded-[14px] p-5 xl:col-start-1"
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            void start();
          }}
        >
          <fieldset className="min-w-0 pb-5">
            <legend className="text-sm font-medium text-[#b8aebb]">
              What are you making?
            </legend>
            <div className="grid min-w-0 gap-2 sm:grid-cols-2">
              {MODES.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  aria-pressed={mode === m.id}
                  onClick={() => setMode(m.id)}
                  className={cn(
                    "grid min-h-11 min-w-0 gap-1 rounded-[10px] border px-3 py-2 text-left transition-colors",
                    mode === m.id
                      ? "border-[#d565d6] bg-[#2c162f] text-[#e77ae6]"
                      : "border-white/10 bg-white/5 text-[#b8aebb] hover:border-white/15 hover:text-[#f5eff6]",
                  )}
                >
                  <span className="text-sm font-bold">{m.label}</span>
                  <span className="text-sm text-[#8d838f]">{m.blurb}</span>
                </button>
              ))}
            </div>
          </fieldset>

          <div className="grid gap-2 border-t border-white/10 py-5">
            <div className="flex min-w-0 flex-wrap items-end justify-between gap-3">
              <label htmlFor="brief" className="text-lg font-bold text-[#f5eff6]">
                The story
              </label>
              <span className="text-sm text-[#8d838f]">
                {activeMode.label}
              </span>
            </div>
            <textarea
              id="brief"
              ref={briefRef}
              value={brief}
              onChange={(e) => setBrief(e.currentTarget.value)}
              placeholder="A glassblower works through the night in a coastal workshop. Rain on the windows, molten glass the only warm light, the piece finished at dawn."
              className="min-h-28 w-full min-w-0 resize-y rounded-[10px] border border-white/15 bg-white/15 p-3 text-base leading-normal text-[#f5eff6] placeholder:text-[#8d838f] focus-visible:outline-2 focus-visible:outline-[#f2a1ed]"
            />
          </div>

          <fieldset className="min-w-0 border-t border-white/10 py-5">
            <legend className="text-sm font-medium text-[#b8aebb]">Look</legend>
            <div className="grid min-w-0 grid-cols-2 gap-2 sm:grid-cols-3">
              {LOOKS.map((l) => (
                <button
                  key={l.id}
                  type="button"
                  aria-pressed={look === l.id}
                  onClick={() => setLook(l.id)}
                  className={cn(
                    "grid min-h-11 min-w-0 place-content-center rounded-[10px] border px-2 py-2 text-center text-sm transition-colors",
                    look === l.id
                      ? "border-[#d565d6] bg-[#2c162f] text-[#e77ae6]"
                      : "border-white/10 bg-white/5 text-[#b8aebb] hover:border-white/15 hover:text-[#f5eff6]",
                  )}
                >
                  {l.label}
                </button>
              ))}
            </div>
            <p className="mt-3 text-sm text-[#8d838f]">
              {LOOKS.find((l) => l.id === look)?.blurb}
            </p>
          </fieldset>

          <div className="grid min-w-0 gap-4 border-t border-white/10 py-5 sm:grid-cols-2">
            <div className="min-w-0">
              <label htmlFor="runtime" className={labelClass}>
                Runtime
              </label>
              <select
                id="runtime"
                value={runtime}
                onChange={(e) => setRuntime(e.currentTarget.value)}
                className={selectClass}
              >
                {RUNTIMES.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="min-w-0">
              <label htmlFor="pacing" className={labelClass}>
                Cutting
              </label>
              <select
                id="pacing"
                value={pacing}
                onChange={(e) => setPacing(e.currentTarget.value)}
                className={selectClass}
              >
                {PACES.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label} — {p.blurb}
                  </option>
                ))}
              </select>
            </div>
            <div className="min-w-0">
              <label htmlFor="aspect" className={labelClass}>
                Frame
              </label>
              <select
                id="aspect"
                value={aspect}
                onChange={(e) => setAspect(e.currentTarget.value)}
                className={selectClass}
              >
                {ASPECTS.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.label} · {a.id}
                  </option>
                ))}
              </select>
            </div>
            {mode === "music-video" ? (
              <div className="grid min-w-0 grid-cols-2 gap-3">
                <div className="min-w-0">
                  <label htmlFor="genre" className={labelClass}>
                    Score
                  </label>
                  <select
                    id="genre"
                    value={genre}
                    onChange={(e) => setGenre(e.currentTarget.value)}
                    className={selectClass}
                  >
                    {GENRES.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="min-w-0">
                  <label htmlFor="mood" className={labelClass}>
                    Feel
                  </label>
                  <select
                    id="mood"
                    value={mood}
                    onChange={(e) => setMood(e.currentTarget.value)}
                    className={selectClass}
                  >
                    {Object.keys(MOODS).map((m) => (
                      <option key={m} value={m}>
                        {m[0].toUpperCase() + m.slice(1)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            ) : null}
            <fieldset className="min-w-0 border-t border-white/10 py-4">
              <legend className="text-sm font-medium text-[#b8aebb]">Words</legend>
              <div className="grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-3">
                {LYRIC_MODES.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    aria-pressed={lyricMode === m.id}
                    onClick={() => setLyricMode(m.id)}
                    className={cn(
                      "grid min-h-11 min-w-0 gap-0.5 rounded-[10px] border px-3 py-2 text-left transition-colors",
                      lyricMode === m.id
                        ? "border-[#d565d6] bg-[#2c162f] text-[#e77ae6]"
                        : "border-white/10 bg-white/5 text-[#b8aebb] hover:border-white/15 hover:text-[#f5eff6]",
                    )}
                  >
                    <span className="text-sm font-bold">{m.label}</span>
                    <span className="text-sm text-[#8d838f]">{m.blurb}</span>
                  </button>
                ))}
              </div>
              {lyricMode === "own" ? (
                <textarea
                  className="mt-3 min-h-28 w-full rounded-[10px] border border-white/10 bg-white/10 p-3 text-sm text-[#f5eff6]"
                  value={lyrics}
                  onChange={(e) => setLyrics(e.currentTarget.value)}
                  placeholder="Verse / chorus — blank line between parts"
                />
              ) : null}
            </fieldset>
          </div>

          {error ? (
            <p
              role="alert"
              className="mb-4 rounded-[10px] border border-[#ff8ea0] bg-[#35171f] p-3 text-sm text-[#ff8ea0]"
            >
              {error}
            </p>
          ) : null}

          <div className="grid sm:justify-items-end">
            <button
              type="submit"
              disabled={running}
              className="min-h-11 w-full min-w-0 rounded-[10px] border border-[#d565d6] bg-[#d565d6] px-4 text-sm font-bold text-white transition-colors hover:border-[#e77ae6] hover:bg-[#e77ae6] disabled:border-white/10 disabled:bg-white/5 disabled:text-[#6e6570] sm:w-48"
            >
              {running ? "Planning" : "Build the plan"}
            </button>
          </div>
        </form>

        <aside className="glass min-w-0 rounded-[14px] p-5 xl:col-start-2 xl:sticky xl:top-6">
          <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#e77ae6]">
            Schedule
          </p>
          <h2 className="mt-1 text-lg text-[#f5eff6]">Windows</h2>
          {windows?.text ? (
            <pre className="mt-4 max-h-72 overflow-y-auto whitespace-pre-wrap font-mono text-xs leading-relaxed tabular-nums text-[#b8aebb]">
              {windows.text}
            </pre>
          ) : (
            <p className="mt-4 text-sm text-[#8d838f]">
              Anything over two minutes gets split into windows, so a long piece
              comes together a stretch at a time instead of all at once.
            </p>
          )}

          {soundtrack?.url ? (
            <div className="mt-6 border-t border-white/10 pt-5">
              <h3 className="text-sm font-bold text-[#f5eff6]">Score</h3>
              <p className="mt-1 text-sm text-[#8d838f]">{soundtrack.label}</p>
              <audio
                src={soundtrack.url}
                controls
                preload="none"
                className="mt-3 w-full"
              />
            </div>
          ) : null}
          {lyricSheet?.text ? (
            <pre className="mt-4 max-h-48 overflow-y-auto whitespace-pre-wrap font-mono text-xs text-[#b8aebb]">{lyricSheet.text}</pre>
          ) : null}
          {clips.length ? (
            <ul className="mt-4 grid gap-3">
              {clips.map((c) => (
                <li key={c.id}>
                  <p className="text-xs text-[#b8aebb]">{c.label}</p>
                  <video src={c.url} controls preload="none" className="mt-1 w-full rounded-[10px]" />
                </li>
              ))}
            </ul>
          ) : null}
        </aside>

        <section className="min-w-0 pt-3 xl:col-start-1">
          <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#e77ae6]">
            Key frames
          </p>
          <h2 className="mt-1 text-lg text-[#f5eff6]">
            {frames.length ? `${frames.length} frames` : "Frames"}
          </h2>
          <ZermoJobStatus job={job} onResume={setJob} />
          {zermo ? <p className="mt-2 text-xs text-[#b8aebb]">Director cut: Qwen Image 2.1 still → WAN 5B 49f/8step, last-frame chain + 0.25s xfade, ACE score. Same Boop fast lane, not FastWan-QAD.</p> : null}
          {frames.length ? (
            <ul className="mt-4 grid min-w-0 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {frames.map((f) => (
                <li key={f.id} className="glass min-w-0 rounded-[14px] p-2">
                  <button
                    type="button"
                    onClick={() => setActiveMedia(f.url!)}
                    className="block w-full"
                  >
                    <Image
                      src={f.url!}
                      alt={f.label}
                      width={480}
                      height={270}
                      unoptimized
                      className="h-auto w-full rounded-[10px] border border-white/10"
                    />
                  </button>
                  <p className="px-1 py-2 font-mono text-xs tabular-nums text-[#b8aebb]">
                    {f.label}
                  </p>
                </li>
              ))}
            </ul>
          ) : job?.status === "failed" ? (
            <p
              role="alert"
              className="mt-4 rounded-[10px] border border-[#ff8ea0] bg-[#35171f] p-3 text-sm text-[#ff8ea0]"
            >
              {job.error}
            </p>
          ) : (
            <div className="glass mt-4 rounded-[14px] px-4 py-8 text-center text-[#b8aebb]">
              <p>
                {running
                  ? "Laying out the shots…"
                  : "Frames for the key moments show up here."}
              </p>
              <span className="mt-1 block text-sm text-[#8d838f]">
                One from each stretch of the piece, so you can read the whole
                thing before every shot is drawn.
              </span>
            </div>
          )}

          {shotList?.text ? (
            <details className="glass mt-6 min-w-0 rounded-[14px] p-5" open>
              <summary className="cursor-pointer text-lg font-bold text-[#f5eff6]">
                Shot list
              </summary>
              <pre className="mt-4 max-h-[32rem] min-w-0 overflow-auto whitespace-pre font-mono text-xs leading-relaxed tabular-nums text-[#b8aebb]">
                {shotList.text}
              </pre>
              {listFile?.url ? (
                <a
                  href={listFile.url}
                  download
                  className="mt-4 inline-grid min-h-11 place-items-center rounded-[10px] border border-white/15 px-4 text-sm font-bold text-[#b8aebb] transition-colors hover:border-[#d565d6] hover:text-[#f5eff6]"
                >
                  Download the full list
                </a>
              ) : null}
            </details>
          ) : null}
        </section>
      </div>
      <MediaLightbox
        items={frames.map((f) => ({
          url: f.url!,
          label: f.label,
        }))}
        activeUrl={activeMedia}
        onClose={() => setActiveMedia(null)}
        onActiveUrl={setActiveMedia}
      />
    </div>
  );
}
