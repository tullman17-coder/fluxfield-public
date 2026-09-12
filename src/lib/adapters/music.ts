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
): Promise<Buffer | null> {
  try {
    const res = await fetch(`${url.replace(/\/$/, "")}/generate`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ prompt, model, duration: seconds, format: "wav" }),
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

/** Composes a track, preferring a local music server and falling back to the built-in composer. */
export async function runMusicAdapter(
  ctx: AdapterContext,
): Promise<AdapterResult & { arrangement: Arrangement; usedServer: boolean }> {
  const inputs = ctx.job.inputs;
  const targetSec = Math.max(
    10,
    Math.min(MAX_RENDER_SEC, Number(inputs.seconds || 60)),
  );

  const arrangement = planArrangement({
    genre: inputs.genre || "synthwave",
    mood: inputs.mood || "neutral",
    targetSec,
    key: inputs.key || undefined,
    bpm: Number(inputs.bpm) || undefined,
    seedText: `${ctx.job.id}:${inputs.brief || ctx.job.prompt}`,
  });

  await fs.mkdir(OUT_DIR, { recursive: true });
  const outputs: JobOutput[] = [];

  let audio: Buffer | null = null;

  if (ctx.settings.musicUrl) {
    audio = await generateOnServer(
      ctx.settings.musicUrl,
      ctx.settings.musicModel,
      `${inputs.brief || ctx.job.prompt}. ${inputs.genre || ""} ${inputs.mood || ""}, ${arrangement.bpm} BPM, ${keyLabel(arrangement)}`,
      targetSec,
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

  return { outputs, arrangement, usedServer };
}
