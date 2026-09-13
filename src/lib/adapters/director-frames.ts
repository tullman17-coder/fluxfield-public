import { promises as fs } from "fs";
import path from "path";
import { nanoid } from "nanoid";
import type {
  AdapterContext,
  JobOutput,
  ModeUsed,
} from "@/lib/adapters/types";
import {
  checkLocalStudioHealth,
  runLocalStudioAdapter,
} from "@/lib/adapters/local-studio";
import { checkComfyHealth, runComfyAdapter } from "@/lib/adapters/comfyui";
import { hueToHex, renderArt } from "@/lib/art/render";

const OUT_DIR = path.join(process.cwd(), ".data", "outputs");

/** Hard cap shared with the director adapter. */
export const MAX_DIRECTOR_FRAMES = 12;

export type DirectorFrameShot = {
  label: string;
  prompt: string;
  /** Degrees; used only for mock fallback palette. */
  hue?: number;
  style?: string;
  seed?: number;
};

async function writeMockFrame(
  jobId: string,
  shot: DirectorFrameShot,
  size: { w: number; h: number },
): Promise<JobOutput> {
  const png = renderArt({
    width: size.w,
    height: size.h,
    prompt: shot.prompt,
    style: shot.style || "cinematic",
    accent: hueToHex(shot.hue ?? 280, 0.55),
    seed: shot.seed,
  });
  const name = `${jobId}-${nanoid(8)}.png`;
  await fs.mkdir(OUT_DIR, { recursive: true });
  await fs.writeFile(path.join(OUT_DIR, name), png);
  return {
    id: nanoid(8),
    kind: "image",
    label: shot.label,
    url: `/api/outputs/${name}`,
  };
}

function withShotPrompt(ctx: AdapterContext, prompt: string): AdapterContext {
  return {
    ...ctx,
    job: {
      ...ctx.job,
      prompt,
    },
  };
}

async function resolveFrameMode(ctx: AdapterContext): Promise<ModeUsed> {
  const { settings } = ctx;
  const wantStudio = settings.generationMode !== "mock";
  const studioUp =
    wantStudio &&
    Boolean(settings.studioUrl && settings.studioApiKey) &&
    (await checkLocalStudioHealth(settings));
  const comfyUp =
    settings.generationMode !== "mock" &&
    settings.generationMode !== "local-studio" &&
    (await checkComfyHealth(settings.comfyUrl));

  if (settings.generationMode === "local-studio") {
    return studioUp ? "local-studio" : "mock";
  }
  if (settings.generationMode === "comfyui") {
    return comfyUp ? "comfyui" : "mock";
  }
  if (settings.generationMode === "auto") {
    if (studioUp) return "local-studio";
    if (comfyUp) return "comfyui";
  }
  return "mock";
}

/**
 * Generate one frame per shot. Prefers Local Studio, then Comfy, then the
 * local art renderer. Caps at MAX_DIRECTOR_FRAMES.
 */
export async function generateDirectorFrames(
  ctx: AdapterContext,
  shots: DirectorFrameShot[],
  size: { w: number; h: number } = { w: 960, h: 540 },
): Promise<{ outputs: JobOutput[]; modeUsed: ModeUsed }> {
  const capped = shots.slice(0, MAX_DIRECTOR_FRAMES);
  if (!capped.length) return { outputs: [], modeUsed: "mock" };

  let modeUsed = await resolveFrameMode(ctx);
  const outputs: JobOutput[] = [];
  let liveSucceeded = 0;

  for (const shot of capped) {
    if (modeUsed === "local-studio") {
      try {
        const result = await runLocalStudioAdapter(
          withShotPrompt(ctx, shot.prompt),
          1,
        );
        const frame = result.outputs.find((o) => o.kind === "image");
        if (frame) {
          outputs.push({ ...frame, label: shot.label, id: nanoid(8) });
          liveSucceeded += 1;
          continue;
        }
      } catch {
        // fall through to mock for this shot
      }
    } else if (modeUsed === "comfyui") {
      try {
        const result = await runComfyAdapter(withShotPrompt(ctx, shot.prompt));
        const frame = result.outputs.find((o) => o.kind === "image");
        if (frame) {
          outputs.push({ ...frame, label: shot.label, id: nanoid(8) });
          liveSucceeded += 1;
          continue;
        }
      } catch {
        // fall through to mock for this shot
      }
    }

    outputs.push(await writeMockFrame(ctx.job.id, shot, size));
  }

  if (liveSucceeded === 0) modeUsed = "mock";
  else if (liveSucceeded < capped.length && modeUsed !== "mock") {
    // Mixed pass still reports the live engine that produced frames.
  }

  return { outputs, modeUsed };
}
