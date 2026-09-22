import { nanoid } from "nanoid";
import type {
  AdapterContext,
  AdapterResult,
  JobOutput,
  ModeUsed,
} from "@/lib/adapters/types";
import {
  generateDirectorFrames,
  type DirectorFrameShot,
} from "@/lib/adapters/director-frames";
import { synthesizeSpeech } from "@/lib/adapters/tts";
import { assembleExplainerVideo, concatClips, checkFfmpeg, videoSize, extractLastFrame, audioDurationSec } from "@/lib/adapters/ffmpeg";
import { runChainedWanClips, WAN_FAST, wanClipsForDuration } from "@/lib/adapters/zermo";
import { getDurationBeats } from "@/lib/explainer/presets";
import { promises as fs } from "fs";
import path from "path";
import { updateJob } from "@/lib/jobs/store";
import { checkJobImages } from "@/lib/compose/verify";
import { applyDreamPreset } from "@/lib/dream/presets";
import {
  getVideoWorkflow,
  getVideoWorkflowMode,
  type VideoWorkflowDef,
  type VideoWorkflowTool,
} from "@/lib/video-workflows/catalog";


function hash32(text: string) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function beatLabels(def: VideoWorkflowDef, modeId: string, n: number): string[] {
  if (def.id === "ad-multiplier") {
    const packs: Record<string, string[]> = {
      variants: ["Hook", "Problem", "Product", "Proof", "CTA"],

    };
    const base = packs[modeId] ?? packs.variants;
    return Array.from({ length: n }, (_, i) => base[i % base.length]!);
  }
  if (def.id === "ugc") {
    const packs: Record<string, string[]> = {
      review: ["Open", "Claim", "Demo", "Close-up", "Verdict", "CTA"],
      product: ["Hero", "Hands", "Detail", "Benefit", "Use", "CTA"],
      tryon: ["Mirror", "On", "Move", "Detail", "Compare", "CTA"],
      unboxing: ["Box", "Open", "Reveal", "First look", "Detail", "CTA"],
      tutorial: ["Goal", "Step 1", "Step 2", "Step 3", "Result", "CTA"],
    };
    const base = packs[modeId] ?? packs.review;
    return Array.from({ length: n }, (_, i) => base[i % base.length]!);
  }
  // faceless
  const packs: Record<string, string[]> = {
    explainer: [
      "Title",
      "Problem",
      "Idea",
      "How",
      "Example",
      "Tip",
      "Summary",
      "CTA",
    ],
    story: [
      "Cold open",
      "Setup",
      "Twist",
      "Rising",
      "Peak",
      "Fall",
      "Payoff",
      "Tag",
    ],
    kids: [
      "Hello",
      "Friend",
      "Adventure",
      "Lesson",
      "Funny beat",
      "Help",
      "Win",
      "Bye",
    ],
  };
  const base = packs[modeId] ?? packs.explainer;
  return Array.from({ length: n }, (_, i) => base[i % base.length]!);
}

function buildStoryboard(
  def: VideoWorkflowDef,
  modeLabel: string,
  brief: string,
  labels: string[],

): string {
  const lines = [
    `${def.id === "ad-multiplier" ? "Ad video · one cut" : def.name} · ${modeLabel}`,
    brief ? `Brief: ${brief}` : "Brief: (none)",
    "",
  ];

  labels.forEach((label, i) => {
    lines.push(
      `${String(i + 1).padStart(2, "0")}  ${label}`,
      `     ${brief || def.tagline} — ${label.toLowerCase()} beat.`,
      "",
    );
  });
  return lines.join("\n").trimEnd();
}

function framePrompts(
  def: VideoWorkflowDef,
  modeId: string,
  brief: string,
  labels: string[],
  style: string,
): DirectorFrameShot[] {
  const seedBase = hash32(`${def.id}:${modeId}:${brief}`);
  return labels.map((label, i) => ({
    label: `${String(i + 1).padStart(2, "0")} · ${label}`,
    prompt: [
      def.name,
      modeId,
      label,
      brief || def.tagline,
      "marketing video keyframe, clear subject, readable composition",
    ].join(" "),
    style,
    hue: (seedBase + i * 37) % 360,
    seed: seedBase + i * 997,
  }));
}

export function parseVideoDuration(value: string | undefined, fallbackSec = 60): number {
  const match = /^(\d+(?:\.\d+)?)(s|m)?$/.exec(value || String(fallbackSec));
  const seconds = match ? Number(match[1]) * (match[2] === "m" ? 60 : 1) : NaN;
  if (!Number.isFinite(seconds) || seconds < 10 || seconds > 90) throw new Error("House WAN video supports 10–90 seconds; longer plans are not finished video");
  return seconds;
}

function rejectUnsupportedInputs(ctx: AdapterContext) {
  if (ctx.job.inputs.sourceVideoPath) throw new Error("Source video remix is unsupported; remove the source clip path before rendering");
  if (ctx.job.tool === "ad-multiplier" && ["hooks", "angles"].includes(ctx.job.presetId)) throw new Error("Ads produces one cut, not multiple deliverables; choose the single ad cut");
}

async function prepareNarration(ctx: AdapterContext, narration: { text: string; voice?: string } | undefined, durationSec: number): Promise<JobOutput | undefined> {
  if (!narration) return undefined;
  if (!narration.text.trim() || narration.text.length > 4000) throw new Error("Narration must be 1–4000 characters; it will not be silently truncated");
  if (narration.voice === "none") throw new Error("A requested narration script conflicts with silent video");
  const voice = !narration.voice || narration.voice === "default" ? ctx.settings.ttsVoice : narration.voice;
  const audio = await synthesizeSpeech({ settings: { ...ctx.settings, ttsVoice: voice }, text: narration.text, jobId: ctx.job.id, label: `Narration · ${voice || "configured voice"}` });
  if (!audio?.url) throw new Error("Requested narration is unavailable: configure a working TTS voice before rendering");
  const seconds = await audioDurationSec(path.join(process.cwd(), ".data", "outputs", path.basename(audio.url)));
  if (!seconds || seconds > durationSec + 0.001) throw new Error("Narration is invalid or exceeds the requested duration; shorten the script or choose a longer supported video");
  return audio;
}

/** One Qwen opener, then sequential last-frame WAN; only a verified cut is success. */
export async function runManagedSceneVideo(ctx: AdapterContext, args: {
  shots: DirectorFrameShot[];
  durationSec: number;
  aspect?: string;
  narration?: { text: string; voice?: string };
  audioUrl?: string;
  openerImagePath?: string;
  srtPath?: string;
  onProgress?: (progress: number, label: string, outputs: JobOutput[]) => Promise<void>;
}): Promise<AdapterResult & { modeUsed: "zermo"; cut: JobOutput }> {
  const durationSec = parseVideoDuration(String(args.durationSec));
  rejectUnsupportedInputs(ctx);
  if (ctx.settings.generationMode !== "zermo") throw new Error("Managed scene video requires Zermo mode");
  if (!args.shots.length || args.shots.some(s => !s.prompt.trim())) throw new Error("Scene prompts are required");
  const aspect = args.aspect || ctx.job.inputs.aspect || ctx.job.aspect;
  const size = videoSize(aspect);
  const shots = args.shots.map(shot => ({ ...shot, prompt: applyDreamPreset(shot.prompt, shot.style) }));
  if (!ctx.settings.ffmpegEnabled || !(await checkFfmpeg(Boolean(args.srtPath)))) throw new Error("Enable FFmpeg (with libass for requested subtitles) before rendering a video");
  if (ctx.job.inputs.subtitles === "on" && !args.srtPath) throw new Error("Timed subtitles are unavailable; supply a timed SRT or turn subtitles off before rendering");
  if (args.srtPath) await fs.access(args.srtPath);
  const narration = args.narration ?? (ctx.job.inputs.script ? { text: ctx.job.inputs.script, voice: ctx.job.inputs.voice } : undefined);
  if (narration && args.audioUrl) throw new Error("Narration and soundtrack mixing is not supported; supply one audio deliverable");
  const audio = await prepareNarration(ctx, narration, durationSec);
  const audioUrl = audio?.url || args.audioUrl;
  if (args.audioUrl && !(await audioDurationSec(path.join(process.cwd(), ".data", "outputs", path.basename(args.audioUrl))))) throw new Error("Soundtrack is unreadable; no video was rendered");
  // Native Qwen latents use /16; keep its opener small and pad, never stretch, the finished cut.
  const openerSize = aspect === "2.39:1" ? { w: 640, h: 272 }
    : { w: Math.floor(size.w / 16) * 16, h: Math.floor(size.h / 16) * 16 };
  const next = { ...ctx, job: { ...ctx.job, aspect, inputs: { ...ctx.job.inputs, size: `${openerSize.w}x${openerSize.h}` } } };
  const outputs: JobOutput[] = [];
  if (audio) outputs.push(audio);
  const mark = async (progress: number, label: string) => {
    if (args.onProgress) await args.onProgress(progress, label, [...outputs]);
    else await updateJob(ctx.job.id, { outputs: [...ctx.job.outputs, ...outputs], progress, phase: "compose" });
  };
  const outDir = path.join(process.cwd(), ".data", "outputs");
  await fs.mkdir(outDir, { recursive: true });
  if (args.openerImagePath) {
    const file = `${ctx.job.id}-ref.png`;
    await extractLastFrame(args.openerImagePath, path.join(outDir, file));
    outputs.push({ id: nanoid(8), kind: "image", label: "Reference still", url: `/api/outputs/${file}` });
  } else {
    const frames = await generateDirectorFrames(next, shots.slice(0, 1), openerSize);
    outputs.push(...frames.outputs);
  }
  const reviewed = await checkJobImages(next, outputs);
  outputs.splice(0, outputs.length, ...reviewed);
  const opener = outputs.find(o => o.kind === "image" && o.url);
  if (!opener?.url) throw new Error("No opener for managed video");
  const wanCount = wanClipsForDuration(durationSec);
  await mark(50, `WAN 0/${wanCount}`);
  const beforeClips = [...outputs];
  const chained = await runChainedWanClips(next, Array.from({ length: wanCount }, (_, i) => ({
    imagePath: path.join(outDir, path.basename(opener.url!)),
    prompt: shots[Math.floor(i * shots.length / wanCount)].prompt,
  })), async (done, total, clips) => {
    outputs.splice(0, outputs.length, ...beforeClips, ...clips);
    await mark(50 + Math.round(done / total * 40), `WAN ${done}/${total} · ${total - done} left`);
  });
  if (chained.clipUrls.length !== wanCount) throw new Error("Incomplete WAN chain; final cut required");
  outputs.splice(0, outputs.length, ...beforeClips, ...chained.outputs);
  await mark(92, "Stitching final cut");
  const cut = await concatClips({ jobId: ctx.job.id, videoUrls: chained.clipUrls, audioUrl,
    xfade: WAN_FAST.xfade, durationSec, aspect, srtPath: args.srtPath });
  outputs.push(cut);
  await mark(98, "Final cut verified");
  return { outputs, modeUsed: "zermo", cut };
}

export async function runVideoWorkflowAdapter(
  ctx: AdapterContext,
): Promise<AdapterResult & { modeUsed: ModeUsed; script?: string; cut: JobOutput }> {
  rejectUnsupportedInputs(ctx);
  const durationSec = parseVideoDuration(ctx.job.inputs.duration);
  const tool = ctx.job.tool as VideoWorkflowTool;
  const def = getVideoWorkflow(tool);
  if (!def) throw new Error(`Unknown video workflow: ${tool}`);

  const mode = getVideoWorkflowMode(def, ctx.job.presetId || def.defaultMode);
  const brief =
    ctx.job.inputs.brief?.trim() ||
    ctx.job.inputs.topic?.trim() ||
    ctx.job.prompt ||
    "";
  const style = ctx.job.inputs.dreamStyle || ctx.job.inputs.look || "auto";
  const n = Math.min(
    12,
    Math.max(3, getDurationBeats(ctx.job.inputs.duration || "1m")),
  );
  const labels = beatLabels(def, mode.id, n);
  const storyboard = buildStoryboard(def, def.id === "ad-multiplier" ? "Hook → proof → CTA" : mode.label, brief, labels);

  const outputs: JobOutput[] = [
    {
      id: nanoid(8),
      kind: "storyboard",
      label: `Storyboard · ${labels.length} beats`,
      text: storyboard,
    },
  ];

  const aspect = ctx.job.inputs.aspect || def.aspectDefault;
  const size = videoSize(aspect);
  const shots = framePrompts(def, mode.id, brief, labels, style);
  const narration = ctx.job.inputs.script || ctx.job.inputs.voice !== "none"
    ? { text: ctx.job.inputs.script || brief, voice: ctx.job.inputs.voice }
    : undefined;
  if (ctx.settings.generationMode === "zermo") {
    const result = await runManagedSceneVideo({ ...ctx, job: { ...ctx.job, outputs } }, {
      shots, durationSec, aspect, narration,
    });
    return { ...result, outputs: [...outputs, ...result.outputs], script: storyboard };
  }
  if (!ctx.settings.ffmpegEnabled || !(await checkFfmpeg())) throw new Error("Enable FFmpeg before rendering a video");
  if (ctx.job.inputs.subtitles === "on") throw new Error("Timed subtitles are unavailable for slideshow video");
  const audio = await prepareNarration(ctx, narration, durationSec);
  if (audio) outputs.push(audio);
  const frames = await generateDirectorFrames(ctx, shots, size);
  outputs.push(...frames.outputs);
  const imageUrls = frames.outputs.filter(o => o.kind === "image" && o.url).map(o => o.url!);
  const cut = await assembleExplainerVideo({ jobId: ctx.job.id, imageUrls, audioUrl: audio?.url,
    secondsPerBeat: durationSec / imageUrls.length, durationSec, aspect });
  outputs.push(cut);

  return {
    outputs,
    modeUsed: frames.modeUsed,
    script: storyboard,
    cut,
  };
}
