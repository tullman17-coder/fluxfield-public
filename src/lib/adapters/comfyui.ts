import { promises as fs } from "fs";
import path from "path";
import { nanoid } from "nanoid";
import type {
  AdapterContext,
  AdapterResult,
  JobOutput,
} from "@/lib/adapters/types";
import { probeComfy } from "@/lib/adapters/probe";
import { allowsImageVideo, refuseImageVideo } from "@/lib/mesh/factory";

function aspectPixels(aspect: string): { width: number; height: number } {
  const map: Record<string, { width: number; height: number }> = {
    "1:1": { width: 1024, height: 1024 },
    "4:5": { width: 896, height: 1152 },
    "9:16": { width: 768, height: 1344 },
    "16:9": { width: 1344, height: 768 },
    "2:3": { width: 832, height: 1216 },
    "3:4": { width: 896, height: 1152 },
    "1.91:1": { width: 1216, height: 640 },
  };
  return map[aspect] ?? { width: 1024, height: 1024 };
}

function buildTxt2ImgWorkflow(
  prompt: string,
  negative: string,
  width: number,
  height: number,
  checkpoint?: string,
) {
  const model = checkpoint || "v1-5-pruned-emaonly.safetensors";
  return {
    "3": {
      class_type: "KSampler",
      inputs: {
        seed: Math.floor(Math.random() * 1_000_000_000),
        steps: 22,
        cfg: 6.5,
        sampler_name: "euler",
        scheduler: "normal",
        denoise: 1,
        model: ["4", 0],
        positive: ["6", 0],
        negative: ["7", 0],
        latent_image: ["5", 0],
      },
    },
    "4": {
      class_type: "CheckpointLoaderSimple",
      inputs: { ckpt_name: model },
    },
    "5": {
      class_type: "EmptyLatentImage",
      inputs: { width, height, batch_size: 1 },
    },
    "6": {
      class_type: "CLIPTextEncode",
      inputs: { text: prompt, clip: ["4", 1] },
    },
    "7": {
      class_type: "CLIPTextEncode",
      inputs: { text: negative, clip: ["4", 1] },
    },
    "8": {
      class_type: "VAEDecode",
      inputs: { samples: ["3", 0], vae: ["4", 2] },
    },
    "9": {
      class_type: "SaveImage",
      inputs: { filename_prefix: "fluxfield", images: ["8", 0] },
    },
  };
}

function buildImg2ImgWorkflow(
  prompt: string,
  negative: string,
  width: number,
  height: number,
  imageName: string,
  checkpoint?: string,
) {
  const model = checkpoint || "v1-5-pruned-emaonly.safetensors";
  return {
    "1": {
      class_type: "LoadImage",
      inputs: { image: imageName },
    },
    "3": {
      class_type: "KSampler",
      inputs: {
        seed: Math.floor(Math.random() * 1_000_000_000),
        steps: 22,
        cfg: 6.5,
        sampler_name: "euler",
        scheduler: "normal",
        denoise: 0.65,
        model: ["4", 0],
        positive: ["6", 0],
        negative: ["7", 0],
        latent_image: ["10", 0],
      },
    },
    "4": {
      class_type: "CheckpointLoaderSimple",
      inputs: { ckpt_name: model },
    },
    "6": {
      class_type: "CLIPTextEncode",
      inputs: { text: prompt, clip: ["4", 1] },
    },
    "7": {
      class_type: "CLIPTextEncode",
      inputs: { text: negative, clip: ["4", 1] },
    },
    "8": {
      class_type: "VAEDecode",
      inputs: { samples: ["3", 0], vae: ["4", 2] },
    },
    "9": {
      class_type: "SaveImage",
      inputs: { filename_prefix: "fluxfield", images: ["8", 0] },
    },
    "10": {
      class_type: "VAEEncode",
      inputs: { pixels: ["11", 0], vae: ["4", 2] },
    },
    "11": {
      class_type: "ImageScale",
      inputs: {
        image: ["1", 0],
        width,
        height,
        upscale_method: "lanczos",
        crop: "center",
      },
    },
  };
}

async function uploadComfyImage(
  baseUrl: string,
  filePath: string,
): Promise<string> {
  const buf = await fs.readFile(filePath);
  const name = path.basename(filePath);
  const form = new FormData();
  form.append(
    "image",
    new Blob([new Uint8Array(buf)], {
      type: name.endsWith(".png") ? "image/png" : "image/jpeg",
    }),
    name,
  );
  form.append("overwrite", "true");
  const res = await fetch(`${baseUrl}/upload/image`, {
    method: "POST",
    body: form,
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) {
    throw new Error(`ComfyUI image upload failed (${res.status})`);
  }
  const data = (await res.json()) as { name?: string };
  return data.name || name;
}

export async function checkComfyHealth(baseUrl: string): Promise<boolean> {
  if (!allowsImageVideo(baseUrl)) return false;
  return (await probeComfy(baseUrl)).ok;
}

async function waitForHistory(
  baseUrl: string,
  promptId: string,
  timeoutMs = 180_000,
) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const res = await fetch(`${baseUrl}/history/${promptId}`, {
      signal: AbortSignal.timeout(5000),
    });
    if (res.ok) {
      const data = (await res.json()) as Record<
        string,
        {
          outputs?: Record<
            string,
            {
              images?: {
                filename: string;
                subfolder: string;
                type: string;
              }[];
            }
          >;
        }
      >;
      if (data[promptId]) return data[promptId];
    }
    await new Promise((r) => setTimeout(r, 1500));
  }
  throw new Error("ComfyUI timed out waiting for history");
}

async function downloadComfyImage(
  baseUrl: string,
  filename: string,
  subfolder: string,
  type: string,
  jobId: string,
): Promise<JobOutput> {
  const params = new URLSearchParams({ filename, subfolder, type });
  const res = await fetch(`${baseUrl}/view?${params.toString()}`);
  if (!res.ok) throw new Error(`Failed to download ComfyUI image ${filename}`);
  const buffer = Buffer.from(await res.arrayBuffer());
  const id = nanoid(8);
  const ext = path.extname(filename) || ".png";
  const outName = `${jobId}-${id}${ext}`;
  const outPath = path.join(process.cwd(), ".data", "outputs", outName);
  await fs.mkdir(path.dirname(outPath), { recursive: true });
  await fs.writeFile(outPath, buffer);
  return {
    id,
    kind: "image",
    label: filename,
    url: `/api/outputs/${outName}`,
  };
}

export async function runComfyAdapter(
  ctx: AdapterContext,
): Promise<AdapterResult> {
  const baseUrl = ctx.settings.comfyUrl.replace(/\/$/, "");
  refuseImageVideo(baseUrl, "ComfyUI");
  const { width, height } = aspectPixels(ctx.job.aspect);

  let workflow: Record<string, unknown>;
  if (ctx.referenceImagePath) {
    const uploaded = await uploadComfyImage(baseUrl, ctx.referenceImagePath);
    workflow = buildImg2ImgWorkflow(
      ctx.job.prompt,
      ctx.job.negativePrompt,
      width,
      height,
      uploaded,
      ctx.settings.comfyCheckpoint || undefined,
    );
  } else {
    workflow = buildTxt2ImgWorkflow(
      ctx.job.prompt,
      ctx.job.negativePrompt,
      width,
      height,
      ctx.settings.comfyCheckpoint || undefined,
    );
  }

  const queueRes = await fetch(`${baseUrl}/prompt`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt: workflow }),
  });

  if (!queueRes.ok) {
    const body = await queueRes.text();
    throw new Error(`ComfyUI queue failed: ${queueRes.status} ${body}`);
  }

  const queued = (await queueRes.json()) as { prompt_id: string };
  const history = await waitForHistory(baseUrl, queued.prompt_id);
  const outputs: JobOutput[] = [];

  for (const node of Object.values(history.outputs || {})) {
    for (const image of node.images || []) {
      outputs.push(
        await downloadComfyImage(
          baseUrl,
          image.filename,
          image.subfolder,
          image.type,
          ctx.job.id,
        ),
      );
    }
  }

  if (!outputs.length) {
    throw new Error("ComfyUI finished without image outputs");
  }

  return { outputs, remotePromptId: queued.prompt_id };
}
