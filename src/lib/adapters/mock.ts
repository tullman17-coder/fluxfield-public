import { promises as fs } from "fs";
import path from "path";
import { nanoid } from "nanoid";
import type {
  AdapterContext,
  AdapterResult,
  JobOutput,
} from "@/lib/adapters/types";
import { composeWrapperSvg } from "@/lib/compose/wrapper-svg";
import { renderArt } from "@/lib/art/render";
import { getImage2Wrapper } from "@/lib/wrappers/catalog";
import { getExplainerPreset } from "@/lib/explainer/presets";

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

function fit(w: number, h: number, maxDim: number) {
  const longest = Math.max(w, h);
  if (longest <= maxDim) return { w, h };
  const k = maxDim / longest;
  return { w: Math.round(w * k), h: Math.round(h * k) };
}

/** Paints a real frame and writes it as PNG. */
async function writeArtFrame(
  ctx: AdapterContext,
  label: string,
  opts: { aspect?: string; accent?: string; style?: string; seedSalt?: string } = {},
): Promise<JobOutput> {
  const base = aspectSize(opts.aspect ?? ctx.job.aspect);
  const maxDim = Number(ctx.job.inputs.maxDim || 0) || 1024;
  const { w, h } = fit(base.w, base.h, maxDim);
  const id = nanoid(8);
  const filename = `${ctx.job.id}-${id}.png`;
  const outDir = path.join(process.cwd(), ".data", "outputs");
  await fs.mkdir(outDir, { recursive: true });

  const seedInput = ctx.job.inputs.seed?.trim();
  const png = renderArt({
    width: w,
    height: h,
    prompt: `${ctx.job.prompt} ${opts.seedSalt || ""}`,
    accent: opts.accent,
    style: opts.style || ctx.job.presetId,
    seed: seedInput ? Number(seedInput) || undefined : undefined,
  });

  await fs.writeFile(path.join(outDir, filename), png);
  return {
    id,
    kind: "image",
    label,
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
        // Paint a real subject first, then set it inside the layout chrome so
        // the wrapper shows actual art rather than an empty placeholder block.
        const frame = await writeArtFrame(ctx, `${wrapper.name} subject`, {
          accent: wrapper.accent,
          seedSalt: `v${i}`,
        });
        const file = path.join(
          process.cwd(),
          ".data",
          "outputs",
          frame.url!.split("/").pop()!,
        );
        let subjectImageDataUri: string | undefined;
        try {
          const buf = await fs.readFile(file);
          subjectImageDataUri = `data:image/png;base64,${buf.toString("base64")}`;
        } catch {
          // fall back to chrome-only if the frame cannot be read back
        }
        const composed = await composeWrapperSvg({
          wrapper,
          values: ctx.job.inputs,
          presetLabel: ctx.job.presetLabel,
          aspect: ctx.job.aspect,
          jobId: ctx.job.id,
          subjectHint: ctx.job.inputs.productDescription || ctx.job.prompt,
          subjectImageDataUri,
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
      const frame = await writeArtFrame(ctx, `Scene ${i + 1}`, {
        aspect: ctx.job.aspect || "16:9",
        accent: preset.accent,
        seedSalt: `beat${i}`,
      });
      outputs.push(frame);
      board.push(`${i + 1}. ${frame.label} → ${frame.url}`);
    }
    outputs.unshift({
      id: nanoid(8),
      kind: "storyboard",
      label: "Scene list",
      text: board.join("\n"),
    });
    return { outputs };
  }

  for (let i = 0; i < count; i++) {
    outputs.push(
      await writeArtFrame(
        ctx,
        ctx.job.inputs.productName || ctx.job.workflowName,
        { seedSalt: `v${i}` },
      ),
    );
  }
  return { outputs };
}
