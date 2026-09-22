// Server-only NVIDIA transport. No SDK, configurable origin, or automatic retries.
import { promises as fs } from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import sharp from "sharp";
import type { AdapterContext, AdapterResult, JobOutput } from "./types";
import { getJob, updateJob, resolveOutputFile } from "../jobs/store";
import { boundedBytes, type ZermoRequest } from "./zermo";

const ENDPOINT = "https://ai.api.nvidia.com/v1/genai/black-forest-labs/flux.2-klein-4b";
export type NvidiaImage = {
  state: "submitted" | "succeeded" | "failed";
  request: { prompt: string; width: number; height: number; steps: number; samples: number; seed: number };
  requestId?: string;
  seed?: number;
  output?: JobOutput;
};

export function nvidiaEligible(ctx: AdapterContext, request: ZermoRequest) {
  return ctx.settings.nvidiaFallback === true && Boolean(ctx.settings.nvidiaApiKey?.trim()) &&
    request.operation === "image.generate" && !ctx.referenceImagePath && !ctx.job.referenceImagePath &&
    !request.inputs?.image && !ctx.job.inputs.sourceVideoPath &&
    (request.seed === undefined || BigInt(request.seed) < BigInt("4294967296"));
}

export async function runNvidiaImage(ctx: AdapterContext, purpose: string, proposed: ZermoRequest): Promise<AdapterResult> {
  const job = await getJob(ctx.job.id);
  if (!job) throw new Error("NVIDIA requires a persisted parent job");
  const previous = job.nvidiaImages?.[purpose];
  if (previous) {
    if (previous.state === "succeeded" && previous.output) {
      if (!previous.output.url || !await resolveOutputFile(path.basename(previous.output.url), job)) throw new Error("NVIDIA output unavailable; no replacement submitted");
      return { outputs: [previous.output], modeUsed: "nvidia" };
    }
    throw new Error(`NVIDIA ${previous.state}; no automatic replacement. Start a new job to retry explicitly.`);
  }
  if (!nvidiaEligible(ctx, proposed)) throw new Error("NVIDIA fallback supports text-to-image only, with a 32-bit seed");
  const key = ctx.settings.nvidiaApiKey!.trim();
  if (key.length > 4096 || /[\s\x00-\x1f\x7f]/.test(key)) throw new Error("Invalid NVIDIA server credential");
  const prompt = proposed.prompt + (proposed.negative_prompt ? `\nAvoid: ${proposed.negative_prompt}` : "");
  if (!prompt.trim() || prompt.length > 10000) throw new Error("NVIDIA prompt exceeds the 10000-character limit");
  const width = proposed.settings.width!, height = proposed.settings.height!;
  if (![width, height].every(n => Number.isInteger(n) && n >= 256 && n <= 1024)) throw new Error("Invalid NVIDIA output dimensions");
  const sizes = [[1024,1024], [1344,768], [768,1344], [1152,896], [896,1152], [1216,832], [832,1216]];
  const [w,h] = sizes.sort((a,b) => Math.abs(a[0]/a[1]-width/height)-Math.abs(b[0]/b[1]-width/height))[0];
  const intent: NvidiaImage = { state: "submitted", request: { prompt, width: w, height: h, steps: 4, samples: 1, seed: Number(proposed.seed ?? 0) } };
  const id = `nvidia-${createHash("sha256").update(`${job.id}:${purpose}`).digest("hex").slice(0,24)}`;
  const dir = path.join(process.cwd(), ".data", "outputs");
  await fs.mkdir(dir, { recursive: true });
  // Atomic, durable claim: the hosted API has no documented idempotency/recovery API.
  await fs.writeFile(path.join(dir, `${id}.intent.json`), JSON.stringify(intent), { flag: "wx", mode: 0o600 });
  const persist = async () => {
    const current = await getJob(job.id);
    if (!current) throw new Error("NVIDIA parent disappeared");
    await updateJob(job.id, { nvidiaImages: { ...current.nvidiaImages, [purpose]: intent } });
  };
  await persist();
  let response: Response;
  try {
    response = await fetch(ENDPOINT, {
      method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(intent.request), redirect: "error", credentials: "omit", cache: "no-store", signal: AbortSignal.timeout(150_000),
    });
  } catch { throw new Error("NVIDIA outcome unknown; no automatic replacement. Start a new job to retry explicitly."); }
  intent.requestId = response.headers.get("nvcf-reqid") || undefined;
  if (!response.ok) {
    await response.body?.cancel(); intent.state = "failed"; await persist();
    throw new Error(`NVIDIA returned HTTP ${response.status}; no automatic retry`);
  }
  const data = JSON.parse((await boundedBytes(response, 24 * 1024 * 1024)).toString());
  const artifact = data?.artifacts?.[0];
  if (data?.artifacts?.length !== 1 || artifact?.finishReason !== "SUCCESS") {
    intent.state = "failed"; await persist();
    throw new Error("NVIDIA did not return a successful image (possibly content-filtered); no replacement submitted");
  }
  const encoded = artifact.base64;
  if (typeof encoded !== "string" || !encoded || encoded.length % 4 || !/^[A-Za-z0-9+/]+={0,2}$/.test(encoded)) throw new Error("Invalid NVIDIA image encoding");
  const bytes = Buffer.from(encoded, "base64");
  if (!bytes.subarray(0,3).equals(Buffer.from([255,216,255]))) throw new Error("Invalid NVIDIA JPEG");
  // Existing sharp dependency decodes fully and keeps the caller's canvas/aspect.
  const png = await sharp(bytes, { limitInputPixels: 4 * 1024 * 1024 }).resize(width, height, { fit: "cover" }).png().toBuffer();
  const name = `${id}.png`;
  await fs.writeFile(path.join(dir, `${name}.tmp`), png);
  await fs.rename(path.join(dir, `${name}.tmp`), path.join(dir, name));
  intent.state = "succeeded"; intent.seed = artifact.seed;
  intent.output = { id, kind: "image", label: "NVIDIA Cloud · FLUX.2 Klein 4B · 4 steps", url: `/api/outputs/${name}` };
  await persist();
  return { outputs: [intent.output], modeUsed: "nvidia" };
}
