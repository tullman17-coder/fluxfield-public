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
import { renderArt } from "@/lib/art/render";
import { renderArrangement } from "@/lib/music/synth";
import { encodeWav } from "@/lib/music/wav";
import { keyLabel, timecode } from "@/lib/music/theory";

const OUT_DIR = path.join(process.cwd(), ".data", "outputs");

/** Frames are expensive, so only key shots get art on the first pass. */
const MAX_FRAMES = 12;

function pickKeyShots(p: Production): Shot[] {
  if (p.shots.length <= MAX_FRAMES) return p.shots;
  // One per section where possible, then spread the remainder evenly.
  const bySection = new Map<string, Shot>();
  for (const s of p.shots) {
    if (!bySection.has(s.section)) bySection.set(s.section, s);
  }
  const picked = [...bySection.values()];
  if (picked.length >= MAX_FRAMES) return picked.slice(0, MAX_FRAMES);
  const step = Math.max(1, Math.floor(p.shots.length / (MAX_FRAMES - picked.length)));
  for (let i = 0; i < p.shots.length && picked.length < MAX_FRAMES; i += step) {
    const s = p.shots[i];
    if (!picked.includes(s)) picked.push(s);
  }
  return picked.sort((a, b) => a.startSec - b.startSec);
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
  outputs.push({
    id: nanoid(8),
    kind: "storyboard",
    label: `Shot list · ${production.shots.length} shots`,
    text: shotListText(production),
  });

  // Soundtrack for music videos, so the cuts have something to sit against.
  if (production.arrangement) {
    const rendered = renderArrangement(
      production.arrangement,
      `${ctx.job.id}:${production.title}`,
    );
    const wav = encodeWav(rendered.left, rendered.right, rendered.sampleRate);
    const name = `${ctx.job.id}-${nanoid(8)}.wav`;
    await fs.writeFile(path.join(OUT_DIR, name), wav);
    outputs.push({
      id: nanoid(8),
      kind: "audio",
      label: `Soundtrack · ${production.arrangement.bpm} BPM ${keyLabel(production.arrangement)}`,
      url: `/api/outputs/${name}`,
    });
  }

  // Key frames.
  const size = ASPECTS[inputs.aspect || "16:9"] ?? ASPECTS["16:9"];
  const keyShots = pickKeyShots(production);
  for (const shot of keyShots) {
    const png = renderArt({
      width: size.w,
      height: size.h,
      prompt: `${production.title} ${shot.section} ${shot.size} ${shot.move} ${shot.action}`,
      style: production.look,
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

  return { outputs, production };
}
