import { promises as fs } from "fs";
import path from "path";
import { nanoid } from "nanoid";
import type { AdapterContext, AdapterResult, JobOutput } from "@/lib/adapters/types";
import {
  planProduction,
  shotListText,
  type Pacing,
  type Production,
  type Shot,
} from "@/lib/director/plan";
import { planArrangement } from "@/lib/music/theory";
import { hueToHex, renderArt } from "@/lib/art/render";
import { renderArrangement } from "@/lib/music/synth";
import { encodeWav } from "@/lib/music/wav";
import { keyLabel, timecode } from "@/lib/music/theory";

const OUT_DIR = path.join(process.cwd(), ".data", "outputs");

/** Frames are expensive, so only key shots get art on the first pass. */
const MAX_FRAMES = 12;

/** How much of a long shot list is worth showing before the download. */
const PREVIEW_LINES = 220;

function hash32(text: string) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function pickKeyShots(p: Production): Shot[] {
  if (p.shots.length <= MAX_FRAMES) return p.shots;
  // Split the runtime into equal stretches and take the strongest shot in each,
  // so an hour-long piece is covered end to end rather than front-loaded.
  const bucket = p.runtimeSec / MAX_FRAMES;
  const picked: Shot[] = [];
  for (let i = 0; i < MAX_FRAMES; i++) {
    const from = i * bucket;
    const to = from + bucket;
    let best: Shot | undefined;
    for (const s of p.shots) {
      if (s.startSec < from || s.startSec >= to) continue;
      // Prefer the peak of the stretch; ties go to whichever comes first.
      if (!best || s.energy > best.energy) best = s;
    }
    if (best) picked.push(best);
  }
  return picked;
}

const ASPECTS: Record<string, { w: number; h: number }> = {
  "16:9": { w: 960, h: 540 },
  "9:16": { w: 540, h: 960 },
  "2.39:1": { w: 1020, h: 427 },
  "1:1": { w: 720, h: 720 },
};

export async function runDirectorAdapter(
  ctx: AdapterContext,
): Promise<AdapterResult & { production: Production }> {
  const inputs = ctx.job.inputs;
  const mode = inputs.mode === "film" ? "film" : "music-video";
  const runtimeSec = Math.max(30, Math.min(3600, Number(inputs.runtime || 180)));

  const production = planProduction({
    mode,
    brief: inputs.brief || ctx.job.prompt,
    runtimeSec,
    look: inputs.look || "cinematic",
    pacing: (inputs.pacing as Pacing) || "steady",
    genre: inputs.genre || "synthwave",
    mood: inputs.mood || "neutral",
    seedText: `${ctx.job.id}:${inputs.brief || ctx.job.prompt}`,
  });

  await fs.mkdir(OUT_DIR, { recursive: true });
  const outputs: JobOutput[] = [];

  // Shot list first — it is the deliverable even before any frame exists.
  const fullList = shotListText(production);
  const listName = `${ctx.job.id}-shot-list.txt`;
  await fs.writeFile(path.join(OUT_DIR, listName), fullList);

  // An hour of frantic cutting is thousands of lines. Keep a readable slice on
  // screen and hand over the whole thing as a file.
  const lines = fullList.split("\n");
  const preview =
    lines.length > PREVIEW_LINES
      ? [
          ...lines.slice(0, PREVIEW_LINES),
          "",
          `${lines.length - PREVIEW_LINES} more lines in the full shot list.`,
        ].join("\n")
      : fullList;

  outputs.push({
    id: nanoid(8),
    kind: "storyboard",
    label: `Shot list · ${production.shots.length} shots`,
    text: preview,
  });

  // A track for music videos so the cuts have something to sit against, and a
  // score bed for films so the acts have a floor under them.
  const score =
    production.arrangement ??
    planArrangement({
      genre: "cinematic",
      mood: inputs.mood || "neutral",
      targetSec: Math.min(production.runtimeSec, 240),
      seedText: `${ctx.job.id}:score`,
    });
  const rendered = renderArrangement(score, `${ctx.job.id}:${production.title}`);
  const wav = encodeWav(rendered.left, rendered.right, rendered.sampleRate);
  const wavName = `${ctx.job.id}-${nanoid(8)}.wav`;
  await fs.writeFile(path.join(OUT_DIR, wavName), wav);
  const partial = rendered.seconds < score.durationSec - 2;
  outputs.push({
    id: nanoid(8),
    kind: "audio",
    label: [
      production.arrangement ? "Soundtrack" : "Score bed",
      `${score.bpm} BPM ${keyLabel(score)}`,
      partial ? `first ${timecode(rendered.seconds)}` : null,
    ]
      .filter(Boolean)
      .join(" · "),
    url: `/api/outputs/${wavName}`,
  });

  // Key frames.
  const size = ASPECTS[inputs.aspect || "16:9"] ?? ASPECTS["16:9"];
  const keyShots = pickKeyShots(production);
  // One palette for the whole piece. Without this each frame picks its own hue
  // from its own prompt and a storyboard reads like twelve unrelated films.
  const baseHue = hash32(`${production.title}:${production.look}`) % 360;
  for (const shot of keyShots) {
    // The light turns once over the runtime rather than jumping shot to shot,
    // so the set holds together and still moves.
    const progress = production.runtimeSec
      ? shot.startSec / production.runtimeSec
      : 0;
    const drift = Math.sin(progress * Math.PI * 2) * 20 + (shot.index % 3) * 5;
    const png = renderArt({
      width: size.w,
      height: size.h,
      prompt: `${production.title} ${shot.section} ${shot.size} ${shot.move} ${shot.action}`,
      style: production.look,
      accent: hueToHex(baseHue + drift, 0.5 + shot.energy * 0.25),
      // Composition varies by position even when two shots read alike.
      seed: hash32(`${production.title}:${shot.index}:${shot.move}`),
    });
    const name = `${ctx.job.id}-${nanoid(8)}.png`;
    await fs.writeFile(path.join(OUT_DIR, name), png);
    outputs.push({
      id: nanoid(8),
      kind: "image",
      label: `${shot.timecode} · ${shot.size} · ${shot.section}`,
      url: `/api/outputs/${name}`,
    });
  }

  // Window plan — what is rendered and what is still queued.
  const windowLines = production.windows.map((w) => {
    const done = keyShots.filter(
      (s) => s.startSec >= w.startSec && s.startSec < w.endSec,
    ).length;
    return `Window ${w.index + 1}  ${timecode(w.startSec)}–${timecode(w.endSec)}  ${w.shots} shots  ${done} keyframed`;
  });
  outputs.push({
    id: nanoid(8),
    kind: "text",
    label: "Windows",
    text: [
      `${production.shots.length} shots across ${production.windows.length} windows.`,
      `${keyShots.length} keyframed on this pass.`,
      "",
      ...windowLines,
    ].join("\n"),
  });

  outputs.push({
    id: nanoid(8),
    kind: "text",
    label: "Full shot list",
    url: `/api/outputs/${listName}`,
  });

  return { outputs, production };
}
