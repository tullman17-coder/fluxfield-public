"use client";

import { ZermoJobStatus } from "@/components/studio/zermo-job-status";
import { useStudioConnection } from "@/lib/studio/use-studio-connection";
import Image from "next/image";
import { useCallback, useRef, useState } from "react";
import { LOOKS, TIKTOK_TEMPLATES, CUT_SPEEDS } from "@/lib/director/plan";
import { MANAGED_MOTION_LENGTHS } from "@/lib/workflows";
import { DIRECTOR_GENRES, MOODS } from "@/lib/music/theory";
import { useJobWatch } from "@/lib/jobs/use-job-watch";
import type { StudioJob } from "@/lib/adapters/types";
import { cn } from "@/lib/utils";
import { MediaLightbox } from "@/components/studio/media-lightbox";

const SCORE_SOURCES = [
  { id: "write", label: "Write ACE", blurb: "House writes the score" },
  { id: "upload", label: "Drop track", blurb: "Use a song you already have" },
] as const;

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

export function VideoComposer({ tool, values = {} }: { tool: "music" | "director"; values?: Record<string, string> }) {
  const mode = tool === "music" ? "music-video" : "tiktok";
  const { zermo } = useStudioConnection();
  const [brief, setBrief] = useState(values.brief || "");
  const [runtime, setRuntime] = useState(mode === "tiktok" ? "15" : "30");
  const [look, setLook] = useState(LOOKS.find((l) => l.id === values.look)?.id || "auto");
  const [pacing, setPacing] = useState(mode === "tiktok" ? "fast" : "steady");
  const [cutSpeed, setCutSpeed] = useState(mode === "tiktok" ? "1" : "0");
  const [cast, setCast] = useState("");
  const [scoreSource, setScoreSource] = useState<"write" | "upload">("write");
  const [scoreFile, setScoreFile] = useState<File | null>(null);
  const [refFile, setRefFile] = useState<File | null>(null);
  const [refUrl, setRefUrl] = useState("");
  const [aspect, setAspect] = useState(mode === "tiktok" ? "9:16" : "16:9");
  const [template, setTemplate] = useState("hook-payoff");
  const [genre, setGenre] = useState("auto");
  const [mood, setMood] = useState("neutral");
  const [lyricMode, setLyricMode] = useState("write");
  const [lyrics, setLyrics] = useState("");
  // Separate from the existing song watch; switching modes cannot show the wrong job.
  const { job, setJob } = useJobWatch(tool === "music" ? "music:music-video" : "director:tiktok", 1500);
  const [error, setError] = useState<string | null>(null);
  const [activeMedia, setActiveMedia] = useState<string | null>(null);
  const briefRef = useRef<HTMLTextAreaElement>(null);

  const start = useCallback(async () => {
    if (!brief.trim()) {
      setError("Say what happens — who is in it, where it goes, how it ends.");
      briefRef.current?.focus();
      return;
    }
    if (mode === "music-video" && scoreSource === "upload" && !scoreFile) {
      setError("Drop a soundtrack, or switch Score to Write ACE.");
      return;
    }
    setError(null);
    try {
      const form = new FormData();
      form.set("tool", tool);
      form.set("workflowSlug", tool);
      form.set("presetId", look);
      form.set(
        "inputs",
        JSON.stringify({
          mode,
          brief,
          runtime,
          look,
          pacing,
          cutSpeed,
          cast,
          scoreSource: mode === "music-video" ? scoreSource : "write",
          clipMax: "3",
          videoLane: "boop-5b",
          aspect: mode === "tiktok" ? "9:16" : aspect,
          template: mode === "tiktok" ? template : "",
          genre,
          mood,
          lyricMode: mode === "music-video" ? lyricMode : "instrumental",
          lyrics: mode === "music-video" ? lyrics : "",
          ...(refUrl.trim() && !refFile ? { referenceImageUrl: refUrl.trim() } : {}),
          ...(mode === "music-video"
            ? { seconds: String(Math.min(90, Math.max(10, Number(runtime) || 30))) }
            : {}),
        }),
      );
      if (mode === "music-video" && scoreSource === "upload" && scoreFile) {
        form.set("soundtrack", scoreFile);
      }
      if (refFile) form.set("referenceImage", refFile);
      if (!refFile && refUrl.trim()) form.set("referenceImageUrl", refUrl.trim());
      const res = await fetch("/api/jobs", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not start the plan");
      setJob(data.job as StudioJob);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start the plan");
    }
  }, [tool, brief, mode, runtime, look, pacing, cutSpeed, cast, scoreSource, scoreFile, refFile, refUrl, aspect, template, genre, mood, lyricMode, lyrics, setJob]);

  const running = !!job && (job.status === "queued" || job.status === "running");
  const shotList = job?.outputs.find((o) => o.kind === "storyboard");
  const runStatus = job?.outputs.find((o) => o.id === "run-progress");
  const windows = job?.outputs.find((o) => o.kind === "text" && o.label === "Windows");
  const listFile = job?.outputs.find((o) => o.kind === "text" && o.url);
  const soundtrack = job?.outputs.find((o) => o.kind === "audio");
  const lyricSheet = job?.outputs.find((o) => o.kind === "script");
  const frames = job?.outputs.filter((o) => o.kind === "image" && o.url) ?? [];
  const clips = job?.outputs.filter((o) => o.kind === "video" && o.url) ?? [];

  return (
    <div className="w-full min-w-0">
      <header className="mb-8 grid gap-3 border-b border-white/10 pb-6">
        <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#e77ae6]">
          {mode === "music-video" ? "Music video" : "Short motion · TikTok"} · 10–90 seconds
        </p>
        <h1 className="text-4xl font-semibold tracking-tight text-balance text-[#f5eff6] md:text-5xl">
          {tool === "music" ? "Music" : "Director"}
        </h1>
        <p className="max-w-xl text-pretty text-[#b8aebb]">
          {mode === "music-video"
            ? "Describe the visuals and music. Make a 10–90 second cut with an ACE score or your own soundtrack. Music vocals are not spoken narration or lip-sync."
            : "Make a 10–90 second vertical story. Choose a TikTok template and describe the action. No song writing or soundtrack."}
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
          <div className="grid gap-2 border-t border-white/10 py-5">
            <div className="flex min-w-0 flex-wrap items-end justify-between gap-3">
              <label htmlFor="brief" className="text-lg font-bold text-[#f5eff6]">
                What do you want
              </label>
              <span className="text-sm text-[#8d838f]">
                {mode === "music-video" ? "Music video" : "TikTok"}
              </span>
            </div>
            <textarea
              id="brief"
              ref={briefRef}
              value={brief}
              onChange={(e) => setBrief(e.currentTarget.value)}
              placeholder=""
              className="min-h-28 w-full min-w-0 resize-y rounded-[10px] border border-white/15 bg-white/15 p-3 text-base leading-normal text-[#f5eff6] placeholder:text-[#8d838f] focus-visible:outline-2 focus-visible:outline-[#f2a1ed]"
            />
          </div>

          <div className="grid gap-2 border-t border-white/10 py-5">
            <label htmlFor="cast" className="text-sm font-medium text-[#b8aebb]">
              Cast
            </label>
            <input
              id="cast"
              value={cast}
              onChange={(e) => setCast(e.currentTarget.value)}
              placeholder="Maya, black coat, scar on left brow. One person unless you name two."
              className="h-11 w-full min-w-0 rounded-[10px] border border-white/10 bg-white/10 px-3 text-sm text-[#f5eff6] placeholder:text-[#8d838f] focus-visible:outline-2 focus-visible:outline-[#f2a1ed]"
            />
          </div>

          <fieldset className="min-w-0 border-t border-white/10 py-5">
            <legend className="text-sm font-medium text-[#b8aebb]">Picture (optional)</legend>
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
            <div className="mt-4 grid min-w-0 gap-3 sm:grid-cols-2">
              <div className="min-w-0">
                <label htmlFor="refStill" className={labelClass}>
                  Upload still
                </label>
                <input
                  id="refStill"
                  type="file"
                  accept="image/*"
                  onChange={(e) => setRefFile(e.currentTarget.files?.[0] || null)}
                  className="block w-full min-w-0 text-sm text-[#b8aebb] file:mr-3 file:rounded-[8px] file:border-0 file:bg-white/10 file:px-3 file:py-2 file:text-sm file:text-[#f5eff6]"
                />
              </div>
              <div className="min-w-0">
                <label htmlFor="refUrl" className={labelClass}>
                  Or image URL
                </label>
                <input
                  id="refUrl"
                  value={refUrl}
                  onChange={(e) => setRefUrl(e.currentTarget.value)}
                  placeholder="https://…"
                  className="h-11 w-full min-w-0 rounded-[10px] border border-white/10 bg-white/10 px-3 text-sm text-[#f5eff6] placeholder:text-[#8d838f] focus-visible:outline-2 focus-visible:outline-[#f2a1ed]"
                />
              </div>
            </div>
            <p className="mt-2 text-sm text-[#8d838f]">
              Becomes the WAN opener. Skip Qwen still if you drop one.
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
                {MANAGED_MOTION_LENGTHS.map((r) => (
                  <option key={r.id} value={String(r.seconds)}>
                    {r.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="min-w-0">
              <label htmlFor="cutSpeed" className={labelClass}>
                Cut speed
              </label>
              <select
                id="cutSpeed"
                value={cutSpeed}
                onChange={(e) => {
                  const v = e.currentTarget.value;
                  setCutSpeed(v);
                  const n = Number(v);
                  setPacing(
                    n <= -2 ? "slow" : n === 1 ? "fast" : n >= 2 ? "frantic" : "steady",
                  );
                }}
                className={selectClass}
              >
                {CUT_SPEEDS.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label} — {c.blurb}
                  </option>
                ))}
              </select>
            </div>
            <div className="min-w-0">
              <label htmlFor="clipMax" className={labelClass}>
                Clip length
              </label>
              <select id="clipMax" value="3" disabled className={selectClass}>
                <option value="3">Auto · 3s WAN 5B (Boop)</option>
              </select>
            </div>
            <div className="min-w-0">
              <label htmlFor="aspect" className={labelClass}>
                Frame
              </label>
              <select
                id="aspect"
                disabled={mode === "tiktok"}
                value={mode === "tiktok" ? "9:16" : aspect}
                onChange={(e) => setAspect(e.currentTarget.value)}
                className={selectClass}
              >
                {ASPECTS.filter((a) => mode !== "tiktok" || a.id === "9:16").map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.label} · {a.id}
                  </option>
                ))}
              </select>
            </div>
            {mode === "tiktok" ? (
              <div className="min-w-0 sm:col-span-2">
                <label htmlFor="template" className={labelClass}>
                  Trend
                </label>
                <select
                  id="template"
                  value={template}
                  onChange={(e) => setTemplate(e.currentTarget.value)}
                  className={selectClass}
                >
                  {TIKTOK_TEMPLATES.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.label} — {t.blurb}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}
            {mode === "music-video" && scoreSource === "write" ? (
              <div className="grid min-w-0 grid-cols-2 gap-3">
                <div className="min-w-0">
                  <label htmlFor="genre" className={labelClass}>
                    Genre override
                  </label>
                  <select
                    id="genre"
                    value={genre}
                    onChange={(e) => setGenre(e.currentTarget.value)}
                    className={selectClass}
                  >
                    {DIRECTOR_GENRES.map((g) => (
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
            {mode === "music-video" ? (
            <fieldset className="min-w-0 sm:col-span-2 border-t border-white/10 py-4">
              <legend className="text-sm font-medium text-[#b8aebb]">Score</legend>
              <div className="grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-2">
                {SCORE_SOURCES.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    aria-pressed={scoreSource === s.id}
                    onClick={() => setScoreSource(s.id)}
                    className={cn(
                      "grid min-h-11 min-w-0 gap-0.5 rounded-[10px] border px-3 py-2 text-left transition-colors",
                      scoreSource === s.id
                        ? "border-[#d565d6] bg-[#2c162f] text-[#e77ae6]"
                        : "border-white/10 bg-white/5 text-[#b8aebb] hover:border-white/15 hover:text-[#f5eff6]",
                    )}
                  >
                    <span className="text-sm font-bold">{s.label}</span>
                    <span className="text-sm text-[#8d838f]">{s.blurb}</span>
                  </button>
                ))}
              </div>
              {scoreSource === "upload" ? (
                <label className="mt-3 block text-sm text-[#b8aebb]">
                  Soundtrack
                  <input
                    type="file"
                    accept="audio/*,.flac,.wav,.mp3,.m4a"
                    className="mt-2 block w-full text-sm text-[#f5eff6]"
                    onChange={(e) => setScoreFile(e.currentTarget.files?.[0] ?? null)}
                  />
                </label>
              ) : null}
            </fieldset>
            ) : null}
            {mode === "music-video" && scoreSource === "write" ? (
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
                  aria-label="Your lyrics"
                  className="mt-3 min-h-28 w-full rounded-[10px] border border-white/10 bg-white/10 p-3 text-sm text-[#f5eff6]"
                  value={lyrics}
                  onChange={(e) => setLyrics(e.currentTarget.value)}
                  placeholder="Verse / chorus — blank line between parts"
                />
              ) : null}
            </fieldset>
            ) : null}
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
              {running ? (runStatus?.text || "Working…") : "Make the cut"}
            </button>
          </div>
        </form>

        <aside className="glass min-w-0 rounded-[14px] p-5 xl:col-start-2 xl:sticky xl:top-6">
          <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#e77ae6]">
            Schedule
          </p>
          <h2 className="mt-1 text-lg text-[#f5eff6]">Cut plan</h2>
          {windows?.text ? (
            <pre className="mt-4 max-h-72 overflow-y-auto whitespace-pre-wrap font-mono text-xs leading-relaxed tabular-nums text-[#b8aebb]">
              {windows.text}
            </pre>
          ) : (
            <p className="mt-4 text-sm text-[#8d838f]">
              Short motion clips are stitched to the selected length. The shot plan
              and actual outputs appear here after submission.
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
          {job && job.status !== "completed" ? (
            <div className="glass mb-6 rounded-[14px] p-4" role="status">
              <p className="text-sm font-bold text-[#f5eff6]">
                {runStatus?.text || (running ? "Working…" : job.error || "Queued")}
              </p>
              <progress
                value={job.progress}
                max={100}
                className="mt-2 h-2 w-full accent-[#d565d6]"
              />
              <p className="mt-1 font-mono text-xs tabular-nums text-[#b8aebb]">
                {job.progress}%
                {frames.length ? ` · stills ${frames.length}` : ""}
                {clips.length ? ` · WAN ${clips.length}` : ""}
              </p>
            </div>
          ) : null}
          {shotList?.text ? (
            <details className="glass mb-6 min-w-0 rounded-[14px] p-5" open>
              <summary className="cursor-pointer text-lg font-bold text-[#f5eff6]">
                {shotList.label || "Shot list"}
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
          <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#e77ae6]">
            Key frames
          </p>
          <h2 className="mt-1 text-lg text-[#f5eff6]">
            {frames.length ? `${frames.length} frames` : "Frames"}
          </h2>
          <ZermoJobStatus job={job} onResume={setJob} />
          {zermo ? <p className="mt-2 text-xs text-[#b8aebb]">Qwen Image 2.1 still → WAN 5B 49f/8step, last-frame chain + 0.25s xfade. {mode === "music-video" ? "ACE or dropped score." : "Silent TikTok cut."} Same Boop fast lane, not FastWan-QAD.</p> : null}
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
                  ? (shotList?.label || "Laying out the shots…")
                  : "Frames for the key moments show up here."}
              </p>
              <span className="mt-1 block text-sm text-[#8d838f]">
                One key still. WAN last-frame chain fills the selected cut (~3s per clip).
              </span>
            </div>
          )}
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
