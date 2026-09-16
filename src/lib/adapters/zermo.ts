// Server transport: never import into a client component. Credentials stay here.
import { promises as fs } from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import type { AdapterContext, AdapterResult, StudioJob } from "./types";
import { getJob, updateJob } from "../jobs/store";
import { fitZermoSize } from "./zermo-image-size";

export async function boundedBytes(response: Response, limit = 128 * 1024 * 1024): Promise<Buffer> {
  const length = response.headers.get("content-length");
  if (length !== null && (!/^\d+$/.test(length) || Number(length) > limit)) {
    await response.body?.cancel(); throw new Error("Zermo asset exceeds byte limit");
  }
  if (!response.body) throw new Error("Empty Zermo asset response");
  const reader = response.body.getReader(); const chunks: Uint8Array[] = []; let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read(); if (done) break;
      total += value.byteLength;
      if (total > limit) throw new Error("Zermo asset exceeds byte limit");
      chunks.push(value);
    }
    return Buffer.concat(chunks, total);
  } finally { await reader.cancel().catch(() => undefined); reader.releaseLock(); }
}

export type ZermoRequest = {
  operation: "image.generate" | "music.generate" | "video.image_to_video";
  model: "chroma-flash-q4" | "flux1-dev-q4" | "flux1-uncensored" | "ace-step-1.5-turbo" | "wan2.2-5b-fp8";
  prompt: string;
  negative_prompt?: string;
  seed?: number | string;
  inputs?: { image?: string };
  settings: { width?: number; height?: number; steps?: number; duration?: number; lyrics?: string; frames?: number };
};
export type ZermoIntent = {
  request: ZermoRequest;
  key: string;
  remoteId?: string;
  state?: string;
  effective?: Record<string, unknown>;
  outputs?: string[];
};
type RemoteJob = { id: string; state: string; error?: string | null; effective: Record<string, unknown>; outputs: string[] };

export function zermoBase(value = process.env.ZERMO_API_BASE || "https://api.zermo.org") {
  const u = new URL(value);
  if ((u.protocol !== "https:" && !(u.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(u.hostname))) || u.username || u.password || u.search || u.hash || !["/", "/v1", "/v1/"].includes(u.pathname)) throw new Error("Zermo requires an HTTPS origin (HTTP loopback allowed for tests)");
  return u.origin;
}
async function credential() {
  let key = process.env.ZERMO_API_KEY?.trim() || "";
  if (!key && process.env.ZERMO_API_KEY_FILE) {
    try { key = (await fs.readFile(process.env.ZERMO_API_KEY_FILE, "utf8")).trim(); }
    catch { throw new Error("Zermo server credential file is unreadable"); }
  }
  if (!key || key.length > 4096 || /[\s\x00-\x1f\x7f]/.test(key)) throw new Error("Zermo server credential is not configured");
  return key;
}
async function request(route: string, init: RequestInit = {}, media = true) {
  const key = await credential();
  let response: Response;
  try {
    response = await fetch(`${zermoBase()}/v1${media ? "/media" : ""}${route}`, {
      ...init, headers: { ...init.headers, Authorization: `Bearer ${key}` },
      redirect: "error", credentials: "omit", cache: "no-store",
      signal: init.signal ?? AbortSignal.timeout(30_000),
    });
  } catch { throw new Error("Zermo transport interrupted; resume the same job, do not regenerate"); }
  if (!response.ok) { await response.body?.cancel(); throw new Error(`Zermo API returned HTTP ${response.status}`); }
  return response;
}
export function exactSeed(value: unknown): number | string | undefined {
  if (value === undefined || value === "") return undefined;
  if (typeof value === "number" && Number.isSafeInteger(value) && value >= 0) return value;
  if (typeof value === "string" && /^(?:0|[1-9]\d{0,19})$/.test(value) && BigInt(value) <= BigInt("18446744073709551615")) return value;
  throw new Error("Zermo seed must be a safe integer or an exact unsigned 64-bit decimal string");
}
export async function generateZermoText(prompt: string) {
  if (!prompt.trim() || prompt.length > 32000) throw new Error("Writing request must be 1–32000 characters");
  const response = await request("/chat/completions", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: "local-auto", messages: [{ role: "user", content: prompt }], max_tokens: 2048, temperature: 0.7, chat_template_kwargs: { enable_thinking: false } }),
    signal: AbortSignal.timeout(120_000),
  }, false);
  let data;
  try { data = JSON.parse((await boundedBytes(response, 1024 * 1024)).toString()); }
  catch { throw new Error("Writing service returned an invalid response"); }
  if (data?.choices?.[0]?.finish_reason === "length") throw new Error("Writing response was truncated; no partial result was accepted");
  const text = data?.choices?.[0]?.message?.content;
  if (typeof text !== "string" || !text.trim()) throw new Error("Writing service returned empty content");
  const model = data.model;
  if (typeof model !== "string" || !model.trim()) throw new Error("Writing service omitted served model metadata");
  return { text: text.trim(), model, url: zermoBase() };
}
export async function checkZermoHealth() {
  const health = {
    configured: false, ready: false, apiReachable: false, workerConfigured: false,
    text: { ready: false, model: null as string | null },
    image: { ready: false, model: null as string | null },
    music: { ready: false, model: null as string | null },
    video: { ready: false, model: null as string | null },
    error: undefined as string | undefined,
  };
  try { await credential(); health.configured = true; }
  catch { health.error = "Zermo server credential is not configured"; return health; }
  const [media, writing] = await Promise.allSettled([
    request("/capabilities").then(async r => JSON.parse((await boundedBytes(r, 256 * 1024)).toString())),
    request("/models", {}, false).then(async r => JSON.parse((await boundedBytes(r, 256 * 1024)).toString())),
  ]);
  if (media.status === "fulfilled") {
    health.apiReachable = true;
    health.workerConfigured = ["configured", "configured; polled on work"].includes(media.value?.worker_availability);
    const models = Array.isArray(media.value?.models) ? media.value.models : [];
    for (const [lane, id, operation] of [["image", "flux1-dev-q4", "image.generate"], ["music", "ace-step-1.5-turbo", "music.generate"], ["video", "wan2.2-5b-fp8", "video.image_to_video"]] as const) {
      const allowed = models.some((m: { id?: string; operations?: string[] }) => m?.id === id && Array.isArray(m.operations) && m.operations.includes(operation));
      health[lane] = { ready: allowed && health.workerConfigured, model: allowed ? id : null };
    }
  }
  if (writing.status === "fulfilled") {
    health.apiReachable = true;
    const models = writing.value?.data;
    const model = Array.isArray(models) ? models.find((m: { id?: string }) => m?.id === "local-auto") : null;
    if (typeof model?.active_model === "string" && model.active_model.trim()) health.text = { ready: true, model: model.active_model };
  }
  health.ready = health.text.ready && health.image.ready && health.music.ready;
  if (!health.ready) health.error = health.apiReachable ? "Some managed operations are not configured or entitled; no fallback will be used" : "Zermo API is unreachable";
  return health;
}
function remoteId(value: string, prefix: "job" | "asset") {
  if (!new RegExp(`^${prefix}_[a-f0-9]{32}$`).test(value)) throw new Error(`Invalid Zermo ${prefix} ID`);
  return value;
}
export function imageRequest(ctx: AdapterContext): ZermoRequest {
  if (ctx.referenceImagePath || ctx.job.inputs.referenceImage || ctx.job.inputs.sourceVideoPath) throw new Error("Zermo reference editing is not supported in this slice; remove the reference or use another provider");
  const parts = ctx.job.aspect.split(":").map(Number);
  let { width, height } = fitZermoSize(parts[0], parts[1]);
  if (ctx.job.inputs.size) {
    const size = /^(\d+)x(\d+)$/.exec(ctx.job.inputs.size);
    if (!size) throw new Error("Zermo size must be WIDTHxHEIGHT");
    [width, height] = size.slice(1).map(Number);
    if (![width, height].every((n) => Number.isInteger(n) && n >= 256 && n <= 1024 && n % 8 === 0)) throw new Error("Zermo dimensions must be 256–1024 and divisible by 8");
  }
  const steps = Number(ctx.job.inputs.steps || 20);
  if (![8, 20].includes(steps) || (ctx.job.inputs.cfg && Number(ctx.job.inputs.cfg) !== 1)) throw new Error("Zermo Flux.1 supports steps=8 or 20, with CFG=1");
  const seed = exactSeed(ctx.job.inputs.seed);
  if (!ctx.job.prompt.trim() || ctx.job.prompt.length > 8000 || ctx.job.negativePrompt.length > 8000) throw new Error("Zermo prompts must be 1–8000 characters");
  const mature = ["boudoir", "figure", "pinup"].includes(ctx.job.presetId);
  const model = mature ? "flux1-uncensored" : "flux1-dev-q4";
  const fitted = { width: Math.min(width, 768), height: Math.min(height, 768) };
  fitted.width = Math.round(fitted.width / 8) * 8;
  fitted.height = Math.round(fitted.height / 8) * 8;
  return { operation: "image.generate", model, prompt: ctx.job.prompt, negative_prompt: ctx.job.negativePrompt, ...(seed === undefined ? {} : { seed }), settings: { width: fitted.width, height: fitted.height, steps } };
}
export async function runZermoJob(job: StudioJob, purpose: string, proposed: ZermoRequest): Promise<AdapterResult> {
  const live = await getJob(job.id);
  if (!live) throw new Error("Zermo requires a persisted parent job");
  const intents = { ...live.zermoJobs };
  // Saved intent is authoritative on resume, even if text planning changes.
  const intent = intents[purpose] ?? {
    request: proposed,
    key: `fluxfield:${job.id}:${createHash("sha256").update(purpose).digest("hex").slice(0, 24)}`,
  };
  intents[purpose] = intent;
  const persist = async () => {
    const current = await getJob(job.id);
    if (!current) throw new Error("Zermo parent disappeared");
    await updateJob(job.id, { zermoJobs: { ...current.zermoJobs, [purpose]: intent }, modeUsed: "zermo", remotePromptId: intent.remoteId });
  };
  await persist(); // durable intent BEFORE any submission
  let remote: RemoteJob;
  if (intent.remoteId) {
    remote = await (await request(`/jobs/${remoteId(intent.remoteId, "job")}`)).json();
  } else {
    remote = await (await request("/jobs", { method: "POST", headers: { "Content-Type": "application/json", "Idempotency-Key": intent.key }, body: JSON.stringify(intent.request) })).json();
  }
  const deadline = Date.now() + (intent.request.operation === "video.image_to_video" ? 15 : 10) * 60_000;
  for (;;) {
    remoteId(remote.id, "job");
    if (intent.remoteId && remote.id !== intent.remoteId) throw new Error("Zermo job identity changed");
    intent.remoteId = remote.id; intent.state = remote.state; intent.effective = remote.effective; intent.outputs = remote.outputs;
    await persist(); // retain acknowledgement BEFORE polling / downloading
    if (remote.state === "succeeded") break;
    if (["failed", "cancelled", "recovery_unknown"].includes(remote.state) || (remote.state === "submission_unknown" && remote.error)) throw new Error(`Zermo ${remote.state}; remote ID retained, no replacement render submitted`);
    if (!["queued", "preparing", "submission_unknown", "running", "recovering_outputs"].includes(remote.state)) throw new Error("Unknown Zermo job state");
    if (Date.now() >= deadline) throw new Error("Zermo is still pending; resume this job to reconnect");
    await new Promise((resolve) => setTimeout(resolve, remote.state === "queued" ? 1500 : 750));
    remote = await (await request(`/jobs/${remoteId(remote.id, "job")}`)).json();
  }
  if (!Array.isArray(remote.outputs) || remote.outputs.length !== 1) throw new Error("Zermo returned an unexpected asset count");
  const outputs: AdapterResult["outputs"] = [];
  const dir = path.join(process.cwd(), ".data", "outputs");
  await fs.mkdir(dir, { recursive: true });
  for (const asset of remote.outputs) {
    const id = remoteId(asset, "asset");
    const response = await request(`/assets/${id}`);
    const mime = response.headers.get("content-type")?.split(";")[0].trim();
    const music = intent.request.operation === "music.generate";
    const video = intent.request.operation === "video.image_to_video";
    const ext = music ? (mime === "audio/flac" || mime === "audio/x-flac" ? "flac" : null) : video ? (mime === "video/mp4" ? "mp4" : null) : mime === "image/png" ? "png" : mime === "image/jpeg" ? "jpg" : null;
    if (!ext) throw new Error("Unexpected Zermo asset content type");
    const bytes = await boundedBytes(response);
    const valid = ext === "flac" ? bytes.subarray(0, 4).toString() === "fLaC" : ext === "mp4" ? bytes.subarray(4, 8).toString() === "ftyp" : ext === "png" ? bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10])) : bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
    if (!valid) throw new Error("Invalid Zermo asset bytes");
    const name = `${job.id}-${id}.${ext}`;
    await fs.writeFile(path.join(dir, `${name}.tmp`), bytes);
    await fs.rename(path.join(dir, `${name}.tmp`), path.join(dir, name));
    const model = String(intent.request.model);
    outputs.push({ id, kind: music ? "audio" : video ? "video" : "image", label: music ? "Zermo ACE · FLAC" : video ? "Zermo WAN 5B · 17f" : `Zermo ${model} · ${intent.effective?.steps ?? intent.request.settings.steps} steps`, url: `/api/outputs/${name}` });
  }
  return { outputs, remotePromptId: intent.remoteId };
}
export async function runZermoAdapter(ctx: AdapterContext, count = 1, purpose = "image") {
  if (!Number.isInteger(count) || count < 1 || count > 12) throw new Error("Zermo image count must be 1–12");
  const body = imageRequest(ctx);
  const outputs: AdapterResult["outputs"] = [];
  let remotePromptId: string | undefined;
  for (let i = 0; i < count; i++) {
    const result = await runZermoJob(ctx.job, `${purpose}:${i}`, body);
    outputs.push(...result.outputs); remotePromptId = result.remotePromptId;
  }
  return { outputs, remotePromptId };
}

/** Fast I2V on Boop WAN 2.2 5B: 17 frames / 8 steps (~1s at 16fps). Not MiniMax-H3. */
export async function runZermoVideoAdapter(ctx: AdapterContext, imagePath: string, prompt: string, purpose = "video:wan") {
  const png = await fs.readFile(imagePath);
  const upload = await (await request("/assets", {
    method: "POST",
    headers: { "Content-Type": "image/png" },
    body: png,
    signal: AbortSignal.timeout(60_000),
  })).json() as { id?: string };
  if (!upload?.id) throw new Error("Zermo still upload failed");
  const body: ZermoRequest = {
    operation: "video.image_to_video",
    model: "wan2.2-5b-fp8",
    prompt,
    inputs: { image: upload.id },
    settings: { frames: 17, steps: 8 },
  };
  return runZermoJob(ctx.job, purpose, body);
}
