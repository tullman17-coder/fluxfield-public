import { promises as fs } from "fs";
import path from "path";
import { nanoid } from "nanoid";
import type { AdapterContext, AdapterResult, JobOutput } from "@/lib/adapters/types";
import {
  keyLabel,
  planArrangement,
  timecode,
  type Arrangement,
} from "@/lib/music/theory";
import { MAX_RENDER_SEC, renderArrangement } from "@/lib/music/synth";
import { encodeWav } from "@/lib/music/wav";
import {
  lyricPlainText,
  lyricSheetText,
  parseLyricResponse,
  placeLyrics,
  writeLyrics,
  type LyricSheet,
} from "@/lib/music/lyrics";
import { generateLyrics } from "@/lib/adapters/ollama";
import { interpretMusicBrief } from "@/lib/music/brief";
import { runZermoJob, uploadZermoAsset } from "./zermo";

const OUT_DIR = path.join(process.cwd(), ".data", "outputs");

export async function checkMusicHealth(url: string) {
  if (!url) return false;
  try {
    const res = await fetch(`${url.replace(/\/$/, "")}/health`, {
      signal: AbortSignal.timeout(2500),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * ACE-Step / MusicGen style servers accept a prompt and return audio bytes.
 * Anything that answers with audio on POST /generate works here.
 */
async function generateOnServer(
  url: string,
  model: string,
  prompt: string,
  seconds: number,
  lyrics?: string,
): Promise<Buffer | null> {
  try {
    const res = await fetch(`${url.replace(/\/$/, "")}/generate`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        prompt,
        model,
        duration: seconds,
        format: "wav",
        // ACE-Step and friends take the words alongside the style prompt.
        lyrics: lyrics || undefined,
      }),
      signal: AbortSignal.timeout(300_000),
    });
    if (!res.ok) return null;
    const type = res.headers.get("content-type") || "";
    if (type.includes("application/json")) {
      const data = (await res.json()) as { audio?: string; url?: string };
      if (data.audio) return Buffer.from(data.audio, "base64");
      if (data.url) {
        const follow = await fetch(data.url, { signal: AbortSignal.timeout(120_000) });
        if (!follow.ok) return null;
        return Buffer.from(await follow.arrayBuffer());
      }
      return null;
    }
    return Buffer.from(await res.arrayBuffer());
  } catch {
    return null;
  }
}

export function arrangementSummary(a: Arrangement) {
  const lines = [
    `${a.bpm} BPM · ${keyLabel(a)} · ${timecode(a.durationSec)}`,
    "",
    ...a.sections.map(
      (s) =>
        `${timecode(s.startSec).padStart(5)}  ${s.name.padEnd(7)} ${s.bars} bars  energy ${Math.round(s.energy * 100)}%`,
    ),
  ];
  return lines.join("\n");
}

/**
 * Words for the track: the writer's own, a local model's, or the built-in
 * writer. Returns null when the track is meant to be instrumental.
 */
async function buildLyrics(
  ctx: AdapterContext,
  arrangement: Arrangement,
  title: string,
): Promise<LyricSheet | null> {
  const inputs = ctx.job.inputs;
  const parsed = interpretMusicBrief(inputs.brief || ctx.job.prompt);
  const lyricBrief = inputs.lyricTopic || parsed.topic;
  const mode = inputs.lyricMode || "instrumental";
  if (mode === "instrumental") return null;

  if (mode === "own") {
    const text = inputs.lyrics?.trim();
    if (!text) return null;
    return placeLyrics({ text, title, arrangement });
  }

  const sung = arrangement.sections
    .map((s) => s.name)
    .filter((n) => n === "Verse" || n === "Pre" || n === "Chorus" || n === "Bridge");
  if (sung.length) {
    const raw = await generateLyrics(ctx.settings, {
      brief: lyricBrief,
      title,
      genre: inputs.genre || parsed.genre,
      mood: inputs.mood || "neutral",
      cadence: parsed.cadence,
      sections: sung,
      linesPerSection: 4,
    });
    if (raw) {
      const parsed = parseLyricResponse(raw, title, arrangement);
      if (parsed) return parsed;
    }
  }

  return writeLyrics({
    brief: lyricBrief,
    title,
    arrangement,
    seedText: `${ctx.job.id}:${lyricBrief}`,
  });
}

/** Composes a track, preferring a local music server and falling back to the built-in composer. */
export async function runMusicAdapter(
  ctx: AdapterContext,
): Promise<
  AdapterResult & {
    arrangement: Arrangement;
    usedServer: boolean;
    lyrics: LyricSheet | null;
  }
> {
  const inputs = ctx.job.inputs;
  const parsed = interpretMusicBrief(inputs.brief || ctx.job.prompt);
  const tags = inputs.acePrompt || parsed.tags;
  const targetSec = Math.max(
    10,
    Math.min(MAX_RENDER_SEC, Number(inputs.seconds || 60)),
  );

  const arrangement = planArrangement({
    genre: inputs.genre || parsed.genre,
    mood: inputs.mood || "neutral",
    targetSec,
    key: inputs.key || undefined,
    bpm: Number(inputs.bpm) || undefined,
    seedText: `${ctx.job.id}:${inputs.brief || ctx.job.prompt}`,
  });

  await fs.mkdir(OUT_DIR, { recursive: true });
  const outputs: JobOutput[] = [];

  const title = inputs.trackName?.trim() || "Untitled";
  if (ctx.settings.generationMode === "zermo") {
    const saved = ctx.job.zermoJobs?.["music:track"]?.request;
    const duration = saved?.settings.duration ?? Number(inputs.seconds || 60);
    if (!Number.isFinite(duration) || duration < 10 || duration > 90) throw new Error("Zermo ACE supports 10–90 seconds; choose a shorter track");
    const sheet = saved ? null : await buildLyrics(ctx, arrangement, title);
    let audioId: string | undefined;
    const sample = inputs.voiceSample?.trim();
    if (!saved && sample) {
      const buf = await fs.readFile(path.join(process.cwd(), ".data", "uploads", path.basename(sample)));
      if (buf.length > 8 * 1024 * 1024) throw new Error("Voice sample must be under 8 MB");
      const mime = buf.subarray(0, 4).toString() === "fLaC" ? "audio/flac" : buf.subarray(0, 4).toString() === "RIFF" ? "audio/wav" : "";
      if (!mime) throw new Error("Voice sample must be WAV or FLAC you recorded");
      audioId = await uploadZermoAsset(buf, mime);
    }
    const requested = saved ?? {
      operation: "music.generate" as const, model: "ace-step-1.5-turbo" as const,
      prompt: `${tags}, ${inputs.genre || parsed.genre}, ${inputs.mood || ""}, ${arrangement.bpm} BPM, ${keyLabel(arrangement)}`,
      ...(audioId ? { inputs: { audio: audioId } } : {}),
      settings: { duration, lyrics: sheet ? lyricPlainText(sheet) : "", bpm: arrangement.bpm, keyscale: keyLabel(arrangement) },
    };
    const result = await runZermoJob(ctx.job, "music:track", requested);
    if (requested.settings.lyrics) result.outputs.push({ id: nanoid(8), kind: "script", label: "Lyrics requested", text: requested.settings.lyrics });
    result.outputs.push({ id: nanoid(8), kind: "script", label: "ACE tags", text: tags });
    return { ...result, arrangement, usedServer: true, lyrics: sheet };
  }

  const sheet = await buildLyrics(ctx, arrangement, title);
  let audio: Buffer | null = null;

  if (ctx.settings.musicUrl) {
    audio = await generateOnServer(
      ctx.settings.musicUrl,
      ctx.settings.musicModel,
      `${tags}, ${inputs.genre || parsed.genre}, ${inputs.mood || ""}, ${arrangement.bpm} BPM, ${keyLabel(arrangement)}`,
      targetSec,
      sheet ? lyricPlainText(sheet) : undefined,
    );
  }
  const usedServer = Boolean(audio);

  if (!audio) {
    const rendered = renderArrangement(
      arrangement,
      `${ctx.job.id}:${inputs.brief || ctx.job.prompt}`,
    );
    audio = encodeWav(rendered.left, rendered.right, rendered.sampleRate);
  }

  const filename = `${ctx.job.id}-${nanoid(8)}.wav`;
  await fs.writeFile(path.join(OUT_DIR, filename), audio);

  outputs.push({
    id: nanoid(8),
    kind: "audio",
    label: `${inputs.trackName || "Untitled"} · ${arrangement.bpm} BPM ${keyLabel(arrangement)} · ${timecode(arrangement.durationSec)}`,
    url: `/api/outputs/${filename}`,
  });

  outputs.push({
    id: nanoid(8),
    kind: "storyboard",
    label: "Arrangement",
    text: arrangementSummary(arrangement),
  });

  if (sheet) {
    const sung = sheet.sections.reduce((n, s) => n + s.lines.length, 0);
    outputs.push({
      id: nanoid(8),
      kind: "script",
      label: `Lyrics · ${sung} lines`,
      text: lyricSheetText(sheet),
    });
  }

  return { outputs, arrangement, usedServer, lyrics: sheet };
}
