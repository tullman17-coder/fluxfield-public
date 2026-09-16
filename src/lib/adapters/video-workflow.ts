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
import { assembleExplainerVideo } from "@/lib/adapters/ffmpeg";
import { runZermoVideoAdapter } from "@/lib/adapters/zermo";
import { promises as fs } from "fs";
import path from "path";
import {
  getVideoWorkflow,
  getVideoWorkflowMode,
  type VideoWorkflowDef,
  type VideoWorkflowTool,
} from "@/lib/video-workflows/catalog";

const ASPECTS: Record<string, { w: number; h: number }> = {
  "16:9": { w: 960, h: 540 },
  "9:16": { w: 540, h: 960 },
  "1:1": { w: 720, h: 720 },
};

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
      hooks: ["Hook A", "Hook B", "Hook C", "Hook D", "Hook E"],
      angles: ["Price", "Quality", "Speed", "Social proof", "Lifestyle"],
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
  opts: { sourceMissing?: boolean },
): string {
  const lines = [
    `${def.name} · ${modeLabel}`,
    brief ? `Brief: ${brief}` : "Brief: (none)",
    "",
  ];
  if (def.id === "ad-multiplier" && opts.sourceMissing) {
    lines.push(
      "No source clip attached — variants are planned from the brief alone.",
      "",
    );
  }
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
      style,
      "marketing video keyframe, clear subject, readable composition",
    ].join(" "),
    style,
    hue: (seedBase + i * 37) % 360,
    seed: seedBase + i * 997,
  }));
}

export async function runVideoWorkflowAdapter(
  ctx: AdapterContext,
): Promise<AdapterResult & { modeUsed: ModeUsed; script?: string }> {
  const tool = ctx.job.tool as VideoWorkflowTool;
  const def = getVideoWorkflow(tool);
  if (!def) throw new Error(`Unknown video workflow: ${tool}`);

  const mode = getVideoWorkflowMode(def, ctx.job.presetId || def.defaultMode);
  const brief =
    ctx.job.inputs.brief?.trim() ||
    ctx.job.inputs.topic?.trim() ||
    ctx.job.prompt ||
    "";
  const style = ctx.job.inputs.dreamStyle || ctx.job.inputs.look || "photo";
  const n = Math.min(
    12,
    Math.max(3, Number(ctx.job.inputs.frames || def.frameCount) || def.frameCount),
  );
  const labels = beatLabels(def, mode.id, n);
  const sourceMissing =
    def.id === "ad-multiplier" && !ctx.job.inputs.sourceVideoPath;

  const storyboard = buildStoryboard(def, mode.label, brief, labels, {
    sourceMissing,
  });

  const outputs: JobOutput[] = [
    {
      id: nanoid(8),
      kind: "storyboard",
      label: `Storyboard · ${labels.length} beats`,
      text: storyboard,
    },
  ];

  const size =
    ctx.settings.generationMode === "zermo"
      ? { w: 640, h: 352 }
      : ASPECTS[ctx.job.inputs.aspect || def.aspectDefault] ?? ASPECTS["9:16"];
  const shots = framePrompts(def, mode.id, brief, labels, style);
  if (ctx.settings.generationMode === "zermo") {
    ctx.job.inputs.size = "640x352";
    const frames = await generateDirectorFrames(ctx, shots.slice(0, 1), size);
    outputs.push(...frames.outputs);
    const still = frames.outputs.find((o) => o.kind === "image" && o.url);
    if (!still?.url) throw new Error("WAN fast video needs a still");
    const imagePath = path.join(process.cwd(), ".data", "outputs", path.basename(still.url));
    await fs.access(imagePath);
    const clip = await runZermoVideoAdapter(ctx, imagePath, brief);
    outputs.push(...clip.outputs);
    return { outputs, modeUsed: "zermo", script: storyboard };
  }
  const frames = await generateDirectorFrames(ctx, shots, size);
  outputs.push(...frames.outputs);

  const voText =
    ctx.job.inputs.script?.trim() ||
    [
      brief,
      ...labels.map((l) => `${l}: ${brief || def.tagline}`),
    ]
      .filter(Boolean)
      .join(". ")
      .slice(0, 2000);

  if (voText) {
    const audio = await synthesizeSpeech({
      settings: ctx.settings,
      text: voText,
      jobId: ctx.job.id,
      label: `Narration · ${ctx.job.inputs.voice || "default voice"}`,
    });
    if (audio) outputs.push(audio);
  }

  if (ctx.settings.ffmpegEnabled) {
    const imageUrls = outputs
      .filter((o) => o.kind === "image" && o.url)
      .map((o) => o.url!);
    const audioUrl = outputs.find((o) => o.kind === "audio")?.url;
    const video = await assembleExplainerVideo({
      jobId: ctx.job.id,
      imageUrls,
      audioUrl,
      secondsPerBeat: Number(ctx.job.inputs.secondsPerBeat || 3.2),
    });
    if (video) outputs.push(video);
  }

  return {
    outputs,
    modeUsed: frames.modeUsed,
    script: storyboard,
  };
}
