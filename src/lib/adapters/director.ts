import { promises as fs } from "fs";
import path from "path";
import { nanoid } from "nanoid";
import type {
  AdapterContext,
  AdapterResult,
  JobOutput,
  ModeUsed,
} from "@/lib/adapters/types";
import {
  planProduction,
  shotListText,
  normalizeDirectorMode,
  pacingFromCutSpeed,
  type Pacing,
  type Production,
  type Shot,
} from "@/lib/director/plan";
import { planArrangement } from "@/lib/music/theory";
import { renderArrangement } from "@/lib/music/synth";
import { encodeWav } from "@/lib/music/wav";
import { keyLabel, timecode } from "@/lib/music/theory";
import {
  DIRECTOR_RENDER_STILLS,
  generateDirectorFrames,
  MAX_DIRECTOR_FRAMES,
} from "@/lib/adapters/director-frames";
import { runMusicAdapter } from "@/lib/adapters/music";
import { runChainedWanClips, WAN_FAST, wanClipsForDuration } from "@/lib/adapters/zermo";
import { audioDurationSec, concatClips } from "@/lib/adapters/ffmpeg";
import { updateJob } from "@/lib/jobs/store";
import type { LyricSheet } from "@/lib/music/lyrics";
import { lyricSheetToSrt, timedLyricCues, wanLyricPrompt } from "@/lib/music/lyrics";

const OUT_DIR = path.join(process.cwd(), ".data", "outputs");

/** Frames are expensive, so only key shots get art on the first pass. */
const MAX_FRAMES = MAX_DIRECTOR_FRAMES;

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
): Promise<AdapterResult & { production: Production; modeUsed: ModeUsed }> {
  const inputs = ctx.job.inputs;
  const mode = normalizeDirectorMode(inputs.mode);
  const brief = inputs.brief?.trim() || ctx.job.prompt.trim();
  const cast = inputs.cast?.trim() || "";
  const scoreSource = inputs.scoreSource === "upload" ? "upload" : "write";
  const soundtrackName = (inputs.soundtrack || "").trim();
  const soundtrackFile =
    soundtrackName &&
    !soundtrackName.includes("/") &&
    !soundtrackName.includes("\\") &&
    !soundtrackName.includes("..")
      ? path.join(process.cwd(), ".data", "uploads", soundtrackName)
      : "";
  let runtimeSec =
    mode === "tiktok"
      ? Math.max(8, Math.min(60, Number(inputs.runtime || 15)))
      : Math.max(30, Math.min(3600, Number(inputs.runtime || 180)));
  if (mode === "music-video" && scoreSource === "upload") {
    if (!soundtrackFile) throw new Error("Drop a soundtrack, or switch Score to write.");
    const probed = await audioDurationSec(soundtrackFile);
    if (probed) runtimeSec = Math.max(10, Math.min(90, Math.round(probed)));
  }
  const pacing: Pacing =
    inputs.cutSpeed !== undefined && inputs.cutSpeed !== ""
      ? pacingFromCutSpeed(inputs.cutSpeed)
      : (inputs.pacing as Pacing) || (mode === "tiktok" ? "fast" : "steady");

  const production = planProduction({
    mode,
    brief,
    runtimeSec,
    look: inputs.look || "cinematic",
    pacing,
    genre: inputs.genre || "synthwave",
    mood: inputs.mood || "neutral",
    seedText: `${ctx.job.id}:${brief}`,
    template: inputs.template,
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

  const wanCount = wanClipsForDuration(runtimeSec);
  outputs.push({
    id: nanoid(8),
    kind: "storyboard",
    label: `Shot list · ${production.shots.length} shots · ${DIRECTOR_RENDER_STILLS} key still · ${wanCount}×49f WAN`,
    text: preview,
  });
  outputs.push({
    id: nanoid(8),
    kind: "text",
    label: "Full shot list",
    url: `/api/outputs/${listName}`,
  });
  await updateJob(ctx.job.id, {
    outputs: [...outputs],
    progress: 18,
    phase: "compose",
    script: preview,
  });

  const mark = async (progress: number, label: string) => {
    const rest = outputs.filter((o) => o.id !== "run-progress");
    rest.push({ id: "run-progress", kind: "text", label, text: label });
    outputs.length = 0;
    outputs.push(...rest);
    await updateJob(ctx.job.id, { outputs: [...outputs], progress, phase: "compose" });
  };
  await mark(
    18,
    `Plan · ${production.shots.length} shots · ${mode === "music-video" ? "ACE next" : "stills next"}`,
  );

  let lyricSheet: LyricSheet | null = null;
  // ACE + lyrics only when writing a music video. Dropped tracks skip ACE. TikTok is picture-first.
  if (mode === "music-video" && scoreSource === "upload") {
    const ext = path.extname(soundtrackFile) || ".flac";
    const copied = `${ctx.job.id}-score${ext}`;
    await fs.copyFile(soundtrackFile, path.join(OUT_DIR, copied));
    outputs.push({
      id: nanoid(8),
      kind: "audio",
      label: "Dropped score",
      url: `/api/outputs/${copied}`,
    });
    await mark(25, "Score on disk · stills next");
  } else if (mode === "music-video") {
  const score =
    production.arrangement ??
    planArrangement({
      genre: "cinematic",
      mood: inputs.mood || "neutral",
      targetSec: Math.min(production.runtimeSec, 240),
      seedText: `${ctx.job.id}:score`,
    });
  if (ctx.settings.generationMode !== "zermo") {
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
  await mark(25, "Score done · stills next");

  } else {
    ctx.job.inputs.seconds = String(Math.min(90, Math.max(10, runtimeSec)));
    if (!ctx.job.inputs.lyricMode) ctx.job.inputs.lyricMode = "write";
    const music = await runMusicAdapter(ctx);
    outputs.push(...music.outputs);
    lyricSheet = music.lyrics;
    await mark(25, "ACE score done · stills next");
  }
  } else {
    await mark(25, "TikTok · stills next");
  }

  // Key frames — live GPU when Studio/Comfy is up, otherwise local art.
  const size =
    ctx.settings.generationMode === "zermo"
      ? mode === "tiktok"
        ? { w: 352, h: 640 }
        : { w: 640, h: 352 }
      : ASPECTS[inputs.aspect || (mode === "tiktok" ? "9:16" : "16:9")] ??
        ASPECTS["16:9"];
  if (ctx.settings.generationMode === "zermo") {
    ctx.job.inputs.size = mode === "tiktok" ? "352x640" : "640x352";
  }
  const keyShots = pickKeyShots(production);
  // One palette for the whole piece. Without this each frame picks its own hue
  // from its own prompt and a storyboard reads like twelve unrelated films.
  const baseHue = hash32(`${production.title}:${production.look}`) % 360;
  const frameShots = keyShots.map((shot) => {
    const progress = production.runtimeSec
      ? shot.startSec / production.runtimeSec
      : 0;
    const drift = Math.sin(progress * Math.PI * 2) * 20 + (shot.index % 3) * 5;
    return {
      label: `${shot.timecode} · ${shot.size} · ${shot.section}`,
      prompt: [
        cast ? `Cast: ${cast}.` : "",
        brief,
        `Scene: ${shot.section}.`,
        `Shot: ${shot.size}, ${shot.move}.`,
        `Action: ${shot.action}.`,
        `Visual look: ${production.look}.`,
      ]
        .filter(Boolean)
        .join(" "),
      style: production.look,
      hue: baseHue + drift,
      seed: hash32(`${production.title}:${shot.index}:${shot.move}`),
    };
  });
  const frames = await generateDirectorFrames(
    ctx,
    frameShots.slice(0, DIRECTOR_RENDER_STILLS),
    size,
    async (done, total, frameOut) => {
    const kept = outputs.filter((o) => o.kind !== "image");
    outputs.length = 0;
    outputs.push(...kept, ...frameOut);
    await mark(25 + Math.round((done / total) * 25), `Still ${done}/${total} · ${total - done} left`);
  });
  const haveFrames = outputs.some((o) => o.kind === "image");
  if (!haveFrames) outputs.push(...frames.outputs);

  if (ctx.settings.generationMode === "zermo") {
    const stills = outputs.filter((o) => o.kind === "image" && o.url);
    const startStill = stills[0];
    const wanCount = wanClipsForDuration(runtimeSec);
    const clipSec = WAN_FAST.frames / WAN_FAST.fps;
    const fade = WAN_FAST.xfade;
    const cues = lyricSheet ? timedLyricCues(lyricSheet) : [];
    if (startStill?.url) {
    await mark(50, `WAN 0/${wanCount} · ${wanCount} left`);
    const startPath = path.join(OUT_DIR, path.basename(startStill.url));
    const chained = await runChainedWanClips(
      ctx,
      Array.from({ length: wanCount }, (_, i) => ({
        imagePath: startPath,
        prompt: [
          frameShots[i % frameShots.length]?.prompt || brief,
          wanLyricPrompt(cues, i * (clipSec - fade)),
        ].join(" "),
      })),
      async (done, total, clips) => {
        const kept = outputs.filter((o) => o.kind !== "video");
        outputs.length = 0;
        outputs.push(...kept, ...clips);
        await mark(50 + Math.round((done / total) * 40), `WAN ${done}/${total} · ${total - done} left`);
      },
    );
    const haveClips = outputs.some((o) => o.kind === "video");
    if (!haveClips) outputs.push(...chained.outputs);
    await mark(92, "Stitching WAN clips");
    const audioUrl = outputs.find((o) => o.kind === "audio")?.url;
    let srtPath: string | undefined;
    if (lyricSheet && timedLyricCues(lyricSheet).length) {
      srtPath = path.join(OUT_DIR, `${ctx.job.id}-lyrics.srt`);
      await fs.writeFile(srtPath, lyricSheetToSrt(lyricSheet));
    }
    const cut = await concatClips({
      jobId: ctx.job.id,
      videoUrls: chained.clipUrls,
      audioUrl,
      clipSec: WAN_FAST.frames / WAN_FAST.fps,
      xfade: WAN_FAST.xfade,
      srtPath,
    });
    if (cut) outputs.push(cut);
    }
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

  return { outputs, production, modeUsed: frames.modeUsed };
}
