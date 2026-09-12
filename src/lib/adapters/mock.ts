import { promises as fs } from "fs";
import path from "path";
import { nanoid } from "nanoid";
import type {
  AdapterContext,
  AdapterResult,
  JobOutput,
} from "@/lib/adapters/types";
import { composeWrapperSvg } from "@/lib/compose/wrapper-svg";
import { getImage2Wrapper } from "@/lib/wrappers/catalog";
import { getExplainerPreset } from "@/lib/explainer/presets";

function escapeXml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function aspectSize(aspect: string): { w: number; h: number } {
  const map: Record<string, { w: number; h: number }> = {
    "1:1": { w: 1024, h: 1024 },
    "4:5": { w: 1024, h: 1280 },
    "9:16": { w: 768, h: 1344 },
    "16:9": { w: 1344, h: 768 },
    "2:3": { w: 1024, h: 1536 },
    "3:4": { w: 960, h: 1280 },
    "1.91:1": { w: 1200, h: 628 },
  };
  return map[aspect] ?? { w: 1024, h: 1024 };
}

async function writePlainSvg(
  jobId: string,
  aspect: string,
  title: string,
  subtitle: string,
  accent = "#e77ae6",
): Promise<JobOutput> {
  const { w, h } = aspectSize(aspect);
  const id = nanoid(8);
  const filename = `${jobId}-${id}.svg`;
  const outDir = path.join(process.cwd(), ".data", "outputs");
  await fs.mkdir(outDir, { recursive: true });
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#fdfbf7"/>
      <stop offset="55%" stop-color="#f3ecf5"/>
      <stop offset="100%" stop-color="${accent}"/>
    </linearGradient>
    <radialGradient id="swirl" cx="0.7" cy="0.25" r="0.9">
      <stop offset="0%" stop-color="#ffffff" stop-opacity="0.9"/>
      <stop offset="100%" stop-color="#ffffff" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="${w}" height="${h}" fill="url(#g)"/>
  <rect width="${w}" height="${h}" fill="url(#swirl)"/>
  <rect x="${w * 0.08}" y="${h * 0.7}" width="${w * 0.84}" height="${h * 0.2}" rx="16" fill="#ffffffbb"/>
  <text x="${w * 0.12}" y="${h * 0.8}" fill="#2e2833" font-family="ui-sans-serif,system-ui" font-size="${Math.round(Math.min(w, h) * 0.045)}">${escapeXml(title)}</text>
  <text x="${w * 0.12}" y="${h * 0.86}" fill="${accent}" font-family="ui-sans-serif,system-ui" font-size="${Math.round(Math.min(w, h) * 0.028)}">${escapeXml(subtitle)}</text>
</svg>`;
  await fs.writeFile(path.join(outDir, filename), svg);
  return {
    id,
    kind: "image",
    label: title,
    url: `/api/outputs/${filename}`,
  };
}

export async function runMockAdapter(
  ctx: AdapterContext,
  count = 1,
): Promise<AdapterResult> {
  const outputs: JobOutput[] = [];

  if (ctx.job.tool === "image2") {
    const wrapper = getImage2Wrapper(ctx.job.workflowSlug);
    if (wrapper) {
      for (let i = 0; i < Math.max(1, count); i++) {
        const composed = await composeWrapperSvg({
          wrapper,
          values: ctx.job.inputs,
          presetLabel: ctx.job.presetLabel,
          aspect: ctx.job.aspect,
          jobId: ctx.job.id,
          subjectHint: ctx.job.prompt.slice(0, 80),
        });
        outputs.push({
          id: nanoid(8),
          kind: "image",
          label: `${wrapper.name} · v${i + 1}`,
          url: composed.url,
        });
      }
      return { outputs };
    }
  }

  if (ctx.job.tool === "explainer") {
    const preset = getExplainerPreset(ctx.job.presetId);
    const beatCount = Number(ctx.job.inputs.beats || 6);
    const board: string[] = [];
    for (let i = 0; i < beatCount; i++) {
      const frame = await writePlainSvg(
        ctx.job.id,
        ctx.job.aspect || "16:9",
        `Beat ${i + 1}`,
        `${preset.name} · ${ctx.job.inputs.topic || "topic"}`,
        preset.accent,
      );
      outputs.push(frame);
      board.push(`${i + 1}. ${frame.label} → ${frame.url}`);
    }
    outputs.unshift({
      id: nanoid(8),
      kind: "storyboard",
      label: "Storyboard index",
      text: board.join("\n"),
    });
    return { outputs };
  }

  for (let i = 0; i < count; i++) {
    outputs.push(
      await writePlainSvg(
        ctx.job.id,
        ctx.job.aspect,
        ctx.job.inputs.productName || ctx.job.workflowName,
        `${ctx.job.presetLabel} · mock · ${ctx.job.workflowName}`,
      ),
    );
  }
  return { outputs };
}
