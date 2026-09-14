"use client";
import { ZermoJobStatus } from "@/components/studio/zermo-job-status";

import { useCallback, useRef, useState } from "react";
import { GENRES, MOODS, NOTE_NAMES } from "@/lib/music/theory";
import { useJobWatch } from "@/lib/jobs/use-job-watch";
import type { StudioJob } from "@/lib/adapters/types";
import { musicLengths, musicSeconds } from "@/lib/studio/presentation";
import { useStudioConnection } from "@/lib/studio/use-studio-connection";
import { cn } from "@/lib/utils";

const LYRIC_MODES = [
  { id: "instrumental", label: "No words", blurb: "Just the music" },
  { id: "write", label: "Write them", blurb: "Words to match the brief" },
  { id: "own", label: "Use mine", blurb: "Paste your own" },
];

const selectClass =
  "h-11 w-full min-w-0 rounded-[10px] border border-white/10 bg-white/10 px-3 text-sm text-[#f5eff6] transition-colors hover:border-white/15 focus-visible:outline-2 focus-visible:outline-[#f2a1ed]";
const labelClass = "mb-2 block text-sm font-medium text-[#b8aebb]";

export default function MusicPage() {
  const { settings, zermo, error: connectionError } = useStudioConnection();
  const [brief, setBrief] = useState("");
  const [trackName, setTrackName] = useState("");
  const [genre, setGenre] = useState("synthwave");
  const [mood, setMood] = useState("neutral");
  const [seconds, setSeconds] = useState("60");
  const [key, setKey] = useState("");
  const [bpm, setBpm] = useState("");
  const [lyricMode, setLyricMode] = useState("write");
  const [lyrics, setLyrics] = useState("");
  const { job, setJob } = useJobWatch("music");
  const [error, setError] = useState<string | null>(null);
  const briefRef = useRef<HTMLTextAreaElement>(null);

  const effectiveSeconds = musicSeconds(settings?.generationMode, seconds);
  const lengths = musicLengths(settings?.generationMode);

  const compose = useCallback(async () => {
    if (!brief.trim()) {
      setError("Say what the track is for — the mood, the scene, the pace.");
      briefRef.current?.focus();
      return;
    }
    setError(null);
    try {
      const res = await fetch("/api/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tool: "music",
          workflowSlug: "music",
          presetId: genre,
          inputs: {
            brief,
            trackName,
            genre,
            mood,
            seconds: effectiveSeconds,
            key,
            bpm,
            lyricMode,
            lyrics,
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not start the track");
      setJob(data.job as StudioJob);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start the track");
    }
  }, [brief, trackName, genre, mood, effectiveSeconds, key, bpm, lyricMode, lyrics, setJob]);

  const running = !!job && (job.status === "queued" || job.status === "running");
  const track = job?.outputs.find((o) => o.kind === "audio");
  const arrangement = job?.outputs.find((o) => o.kind === "storyboard");
  const lyricSheet = job?.outputs.find((o) => o.kind === "script");
  const activeGenre = GENRES.find((g) => g.id === genre) ?? GENRES[0];

  return (
    <div className="w-full min-w-0">
      <header className="mb-8 grid gap-3 border-b border-white/10 pb-6">
        <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#e77ae6]">
          Sound
        </p>
        <h1 className="text-4xl font-semibold tracking-tight text-balance text-[#f5eff6] md:text-5xl">
          Music
        </h1>
        <p className="max-w-xl text-pretty text-[#b8aebb]">
          Describe a track, suggest its mood and structure, then listen and download the result.
        </p>
      </header>

      <div className="grid min-w-0 gap-8 xl:grid-cols-[minmax(0,1fr)_minmax(16rem,20rem)] xl:items-start">
        <form
          className="glass min-w-0 rounded-[14px] p-5 xl:col-start-1"
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            void compose();
          }}
        >
          <div className="grid gap-2 pb-5">
            <div className="flex min-w-0 flex-wrap items-end justify-between gap-3">
              <label htmlFor="brief" className="text-lg font-bold text-[#f5eff6]">
                What is it for?
              </label>
              <span className="text-sm text-[#8d838f]">Mood, scene, pace</span>
            </div>
            <textarea
              id="brief"
              ref={briefRef}
              value={brief}
              onChange={(e) => setBrief(e.currentTarget.value)}
              placeholder="Slow burn for a candle launch film — warm, unhurried, opens quiet and lifts near the end."
              className="min-h-24 w-full min-w-0 resize-y rounded-[10px] border border-white/15 bg-white/15 p-3 text-base leading-normal text-[#f5eff6] placeholder:text-[#8d838f] focus-visible:outline-2 focus-visible:outline-[#f2a1ed]"
            />
          </div>

          <fieldset className="min-w-0 border-y border-white/10 py-5">
            <legend className="text-sm font-medium text-[#b8aebb]">Style</legend>
            <div className="grid min-w-0 grid-cols-2 gap-2 sm:grid-cols-4">
              {GENRES.map((g) => (
                <button
                  key={g.id}
                  type="button"
                  aria-pressed={genre === g.id}
                  onClick={() => setGenre(g.id)}
                  className={cn(
                    "grid min-h-11 min-w-0 place-content-center rounded-[10px] border px-2 py-1 text-center text-sm transition-colors",
                    genre === g.id
                      ? "border-[#d565d6] bg-[#2c162f] text-[#e77ae6]"
                      : "border-white/10 bg-white/5 text-[#b8aebb] hover:border-white/15 hover:text-[#f5eff6]",
                  )}
                >
                  {g.label}
                </button>
              ))}
            </div>
            <p className="mt-3 text-sm text-[#8d838f]">{activeGenre.blurb}</p>
          </fieldset>

          <div className="grid min-w-0 gap-4 py-5 sm:grid-cols-2">
            <div className="min-w-0">
              <label htmlFor="trackName" className={labelClass}>
                Track name
              </label>
              <input
                id="trackName"
                value={trackName}
                onChange={(e) => setTrackName(e.currentTarget.value)}
                placeholder="Late Autumn"
                className={selectClass}
              />
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
            <div className="min-w-0">
              <label htmlFor="seconds" className={labelClass}>
                Length {zermo ? "(10–90 seconds)" : ""}
              </label>
              <select
                id="seconds"
                value={effectiveSeconds}
                onChange={(e) => setSeconds(e.currentTarget.value)}
                className={selectClass}
              >
                {lengths.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid min-w-0 grid-cols-2 gap-3">
              <div className="min-w-0">
                <label htmlFor="key" className={labelClass}>
                  Key {zermo ? "suggestion" : ""}
                </label>
                <select
                  id="key"
                  value={key}
                  onChange={(e) => setKey(e.currentTarget.value)}
                  className={selectClass}
                >
                  <option value="">Pick for me</option>
                  {NOTE_NAMES.map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </div>
              <div className="min-w-0">
                <label htmlFor="bpm" className={labelClass}>
                  Tempo {zermo ? "suggestion" : ""}
                </label>
                <input
                  id="bpm"
                  inputMode="numeric"
                  value={bpm}
                  onChange={(e) => setBpm(e.currentTarget.value)}
                  placeholder="Auto"
                  className={selectClass}
                />
              </div>
            </div>
          </div>

          {zermo ? <p className="mb-4 text-xs text-[#b8aebb]">Key and BPM are prompt suggestions, not fixed model controls. The result shows the effective settings returned by Zermo.</p> : null}
          <fieldset className="min-w-0 border-t border-white/10 py-5">
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
              <div className="mt-4 min-w-0">
                <label htmlFor="lyrics" className={labelClass}>
                  Your words — leave a blank line between parts
                </label>
                <textarea
                  id="lyrics"
                  value={lyrics}
                  onChange={(e) => setLyrics(e.currentTarget.value)}
                  placeholder={"First verse goes here\nSecond line of the verse\n\nThis block becomes the hook"}
                  className="min-h-32 w-full min-w-0 resize-y rounded-[10px] border border-white/15 bg-white/15 p-3 font-mono text-sm leading-relaxed text-[#f5eff6] placeholder:text-[#8d838f] focus-visible:outline-2 focus-visible:outline-[#f2a1ed]"
                />
              </div>
            ) : lyricMode === "write" ? (
              <p className="mt-3 text-sm text-[#8d838f]">
                {zermo ? "Zermo writes the lyrics for ACE. Timing and lyric adherence are generated, not guaranteed." : "Your connected writing model writes the lyrics."}
              </p>
            ) : null}
          </fieldset>

          {connectionError ? <p role="alert" className="text-sm text-red-400">{connectionError}</p> : null}
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
              disabled={running || !settings}
              className="min-h-11 w-full min-w-0 rounded-[10px] border border-[#d565d6] bg-[#d565d6] px-4 text-sm font-bold text-white transition-colors hover:border-[#e77ae6] hover:bg-[#e77ae6] disabled:border-white/10 disabled:bg-white/5 disabled:text-[#6e6570] sm:w-48"
            >
              {running ? "Writing" : "Write the track"}
            </button>
          </div>
        </form>

        <aside className="glass min-w-0 rounded-[14px] p-5 xl:col-start-2 xl:sticky xl:top-6">
          <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#e77ae6]">
            Arrangement
          </p>
          <h2 className="mt-1 text-lg text-[#f5eff6]">Structure</h2>
          {arrangement?.text ? (
            <pre className="mt-4 max-h-96 overflow-y-auto whitespace-pre-wrap font-mono text-xs leading-relaxed text-[#b8aebb]">
              {arrangement.text}
            </pre>
          ) : (
            <p className="mt-4 text-sm text-[#8d838f]">
              The section map shows up here once the track is written — where
              the hook lands, and how loud each part gets.
            </p>
          )}

          {lyricSheet?.text ? (
            <div className="mt-6 border-t border-white/10 pt-5">
              <h3 className="text-sm font-bold text-[#f5eff6]">
                {lyricSheet.label}
              </h3>
              <pre className="mt-3 max-h-96 overflow-y-auto whitespace-pre-wrap font-mono text-xs leading-relaxed tabular-nums text-[#b8aebb]">
                {lyricSheet.text}
              </pre>
            </div>
          ) : null}
        </aside>

        <section className="min-w-0 pt-3 xl:col-start-1">
          <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#e77ae6]">
            Finished
          </p>
          <h2 className="mt-1 text-lg text-[#f5eff6]">Track</h2>
          <p className="text-xs text-[#b8aebb]">Zermo mode uses ACE, 10–90 seconds, FLAC. Select the provider in Settings.</p>
          <ZermoJobStatus job={job} onResume={setJob} />
          {track?.url ? (
            <figure className="glass mt-4 min-w-0 rounded-[14px] p-5">
              <figcaption className="mb-3 text-sm font-bold text-[#f5eff6]">
                {track.label}
              </figcaption>
              <audio src={track.url} controls preload="none" className="w-full" />
              <a
                href={track.url}
                download
                className="mt-3 inline-grid min-h-11 place-items-center rounded-[10px] border border-white/15 px-4 text-sm font-bold text-[#b8aebb] transition-colors hover:border-[#d565d6] hover:text-[#f5eff6]"
              >
                Download
              </a>
            </figure>
          ) : job?.status === "failed" ? (
            <p
              role="alert"
              className="mt-4 rounded-[10px] border border-[#ff8ea0] bg-[#35171f] p-3 text-sm text-[#ff8ea0]"
            >
              {job.error}
            </p>
          ) : (
            <div className="glass mt-4 rounded-[14px] px-4 py-8 text-center text-[#b8aebb]">
              <p>{running ? "Writing the track…" : "Your track shows up here."}</p>
              <span className="mt-1 block text-sm text-[#8d838f]">
                Play it here, or download it for the video.
              </span>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
