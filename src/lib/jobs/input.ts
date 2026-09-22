import path from "node:path";
import { z } from "zod";
import { WORKFLOWS, type WorkflowField } from "@/lib/workflows";
import { IMAGE2_WRAPPERS } from "@/lib/wrappers/catalog";
import { DREAM_PRESETS, MATURE_PRESETS, DREAM_RATIOS, FRAMINGS } from "@/lib/dream/presets";
import { EXPLAINER_PRESETS, EXPLAINER_DURATIONS, EXPLAINER_VOICES } from "@/lib/explainer/presets";
import { VIDEO_WORKFLOWS } from "@/lib/video-workflows/catalog";
import { LOOKS, CUT_SPEEDS, TIKTOK_TEMPLATES } from "@/lib/director/plan";
import { GENRES, MOODS, NOTE_NAMES } from "@/lib/music/theory";
import { referenceUrl } from "./reference";
import { MAX_GENERATION_SECONDS } from "@/lib/generation-lengths";

export class JobInputError extends Error {}
export type UploadField = "referenceImage" | "soundtrack" | "voiceSample";
type ValidationOptions = {
  /** Server-validated multipart attachments, not a property accepted in JSON. */
  uploads?: readonly UploadField[];
  /** Runner only: accept server-created upload names and their matching absolute path. */
  trustedUploads?: boolean;
};
const ids = (items: readonly { id: string }[]) => items.map((item) => item.id);
const styles = [...ids(DREAM_PRESETS), ...ids(MATURE_PRESETS)];
// Existing getGenre aliases are valid source tokens, not normalization instructions.
const genres = [...ids(GENRES), "auto", "hip-hop", "rap", "r&b", "nu-metal", "heavy-metal"];
const uploadNames: Record<UploadField, RegExp> = {
  referenceImage: /^[A-Za-z0-9_-]{8}\.(?:png|jpg|jpeg|webp|gif)$/,
  soundtrack: /^[A-Za-z0-9_-]{8}\.(?:wav|flac|mp3)$/,
  voiceSample: /^[A-Za-z0-9_-]{8}\.(?:wav|flac)$/,
};
export const jobIdSchema = z.string().regex(/^[A-Za-z0-9_-]{10}$/);
const shape = z.object({
  tool: z.enum(["workflow", "image2", "explainer", "dream", "music", "director", "ugc", "ad-multiplier", "faceless"]).default("workflow"),
  workflowSlug: z.string().min(1).max(80).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  presetId: z.string().min(1).max(80).regex(/^[a-z0-9][a-z0-9&-]*$/),
  inputs: z.record(z.string().regex(/^[A-Za-z][A-Za-z0-9]*$/).max(80), z.string().max(20000)).default({}),
  referenceImagePath: z.string().max(4096).optional(),
}).strict();

function schema(options: ValidationOptions) {
  return shape.superRefine((job, ctx) => {
    const error = (key: string, message: string, top = false) => ctx.addIssue({ code: "custom", path: top ? [key] : ["inputs", key], message });
    const inputs = job.inputs;
    const required = (key: string) => { if (!inputs[key]?.trim()) error(key, "Required nonblank value"); };
    const choice = (key: string, allowed: readonly string[]) => {
      // Missing and the literal empty string mean unset. Whitespace is NOT an enum.
      const value = inputs[key];
      if (value !== undefined && value !== "" && !allowed.includes(value)) error(key, "Unknown option");
    };
    let presets: readonly string[] = [];
    let fields: WorkflowField[] = [];
    if (job.tool === "workflow" || job.tool === "image2") {
      const item = (job.tool === "workflow" ? WORKFLOWS : IMAGE2_WRAPPERS).find((entry) => entry.slug === job.workflowSlug);
      if (!item) error("workflowSlug", "Unknown workflow", true);
      else { presets = ids(item.presets); fields = item.inputs; }
    } else {
      if (job.workflowSlug !== job.tool) error("workflowSlug", "Workflow does not match tool", true);
      if (job.tool === "dream") { presets = styles; required("prompt"); }
      if (job.tool === "explainer") { presets = ids(EXPLAINER_PRESETS); required("topic"); }
      if (job.tool === "music") { presets = genres; required("brief"); }
      if (job.tool === "director") { presets = [...ids(LOOKS), ...styles]; required("brief"); choice("mode", ["music-video", "tiktok"]); }
      const video = VIDEO_WORKFLOWS.find((item) => item.id === job.tool);
      if (video) {
        presets = ids(video.modes);
        if (!inputs.brief?.trim() && !inputs.topic?.trim()) error("brief", "Required nonblank brief or topic");
        choice("mode", presets);
      }
    }
    if (!presets.includes(job.presetId)) error("presetId", "Unknown preset", true);
    for (const field of fields) {
      if (field.required) {
        if (field.type === "file") {
          if (!options.uploads?.includes(field.id as UploadField) && !inputs[field.id] && !(field.id === "referenceImage" && (inputs.referenceImageUrl || inputs.referenceJobId))) error(field.id, "Required upload");
        } else required(field.id);
      }
      if (field.type === "select") choice(field.id, (field.options || []).map((option) => option.value));
    }
    const choices: Record<string, readonly string[]> = {
      dreamStyle: styles, ratio: ids(DREAM_RATIOS), framing: ids(FRAMINGS),
      aspect: ["1:1", "4:5", "16:9", "9:16", "1.91:1", "2:3", "3:4", "4:3", "3:2", "21:9", "2.39:1"],
      assist: ["on", "off"], visualQa: ["on", "off"], subtitles: ["on", "off"], campaignWrap: ["on", "off"], campaignCopy: ["true", "false"],
      genre: genres, mood: Object.keys(MOODS), key: NOTE_NAMES, lyricMode: ["instrumental", "write", "own"],
      scoreSource: ["write", "upload"], look: [...ids(LOOKS), ...styles], pacing: ["slow", "steady", "fast", "frantic"],
      cutSpeed: ids(CUT_SPEEDS), template: ids(TIKTOK_TEMPLATES), duration: ids(EXPLAINER_DURATIONS),
      voice: [...ids(EXPLAINER_VOICES), "default", "warm", "urgent", "calm", "story", "kids"], videoLane: ["boop-5b"],
    };
    for (const [key, allowed] of Object.entries(choices)) choice(key, allowed);
    for (const [key, min, max, integer] of [
      ["count", 1, 4, true], ["steps", 1, 100, true], ["cfg", 0, 30, false],
      ["seconds", 1, 3600, true], ["runtime", 1, 3600, true], ["bpm", 30, 300, true],
      ["maxDim", 64, 4096, true], ["clipMax", 1, 30, true],
    ] as const) {
      const value = inputs[key];
      if (value !== undefined && value !== "" && (!/^\d+(?:\.\d+)?$/.test(value) || !Number.isFinite(Number(value)) || Number(value) < min || Number(value) > max || integer && !Number.isInteger(Number(value)))) error(key, "Invalid numeric control");
    }
    if (job.tool === "music" && inputs.seconds) {
      if (Number(inputs.seconds) < 10 || Number(inputs.seconds) > MAX_GENERATION_SECONDS) error("seconds", `Choose 10–${MAX_GENERATION_SECONDS} seconds`);
    }
    if (inputs.seed && (!/^\d{1,20}$/.test(inputs.seed) || BigInt(inputs.seed) > BigInt("18446744073709551615"))) error("seed", "Expected an exact uint64 seed string");
    if (inputs.size && (!/^\d{2,4}x\d{2,4}$/.test(inputs.size) || inputs.size.split("x").some((n) => Number(n) < 64 || Number(n) > 4096))) error("size", "Expected bounded WIDTHxHEIGHT");
    if (Object.keys(inputs).length > 100) error("inputs", "Too many input fields", true);
    for (const [key, value] of Object.entries(inputs)) {
      if (/path$/i.test(key) && value !== "") error(key, "Client file paths are not accepted");
    }
    for (const key of Object.keys(uploadNames) as UploadField[]) {
      if (inputs[key] && (!options.trustedUploads || !uploadNames[key].test(inputs[key]))) error(key, "Use an upload or referenceJobId, not a file path or name");
    }
    if (options.trustedUploads && (inputs.referenceImage || inputs.referenceImageUrl || inputs.referenceJobId) && !job.referenceImagePath) error("referenceImagePath", "Resolve the reference before starting a job", true);
    if (job.referenceImagePath !== undefined) {
      const name = inputs.referenceImage || "";
      if (!options.trustedUploads || !uploadNames.referenceImage.test(name) || job.referenceImagePath !== path.join(process.cwd(), ".data", "uploads", name)) error("referenceImagePath", "Only server-owned upload paths are accepted", true);
    }
    if (inputs.referenceImageUrl) {
      try { referenceUrl(inputs.referenceImageUrl); } catch { error("referenceImageUrl", "Invalid or nonpublic image URL"); }
    }
    if (inputs.referenceJobId) {
      if (!jobIdSchema.safeParse(inputs.referenceJobId).success) error("referenceJobId", "Invalid source job ID");
      if (job.tool !== "dream") error("referenceJobId", "Reference reuse is only supported by Create");
      if (inputs.referenceImageUrl || options.uploads?.includes("referenceImage")) error("referenceJobId", "Choose one reference source");
    }
    if (inputs.scoreSource === "upload" && !inputs.soundtrack && !options.uploads?.includes("soundtrack")) error("soundtrack", "Upload a soundtrack or choose write");
    if (inputs.lyricMode === "own" && !inputs.lyrics?.trim()) error("lyrics", "Supply your lyrics or choose another lyric mode");
  });
}

export const jobRequestSchema = schema({});
export type ValidatedJobInput = z.output<typeof jobRequestSchema>;
/** Call before settings, disk writes, or provider contact; never coerce caller literals. */
export function validateJobInput(value: unknown, options: ValidationOptions = {}): ValidatedJobInput {
  const result = schema(options).safeParse(value);
  if (!result.success) throw new JobInputError(result.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; "));
  return result.data;
}

/** Bound the transport before Next's multipart parser allocates File buffers. */
export async function readRequestPayload(request: Request, format: "json", maxBytes: number): Promise<unknown>;
export async function readRequestPayload(request: Request, format: "form", maxBytes: number): Promise<FormData>;
export async function readRequestPayload(request: Request, format: "json" | "form", maxBytes: number): Promise<unknown> {
  const contentType = request.headers.get("content-type") || "";
  if (format === "form" && (!/^multipart\/form-data\s*;/i.test(contentType) || !/;\s*boundary=(?:"[^"\r\n]{1,70}"|[^\s;]{1,70})(?:;|$)/i.test(contentType))) {
    void request.body?.cancel().catch(() => undefined);
    throw new JobInputError("Malformed multipart content type");
  }
  const length = request.headers.get("content-length");
  if (length && (!/^\d+$/.test(length) || Number(length) > maxBytes)) {
    void request.body?.cancel().catch(() => undefined);
    throw new JobInputError("Request body exceeds size limit");
  }
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout>;
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      const error = new JobInputError("Request body timed out");
      controller.abort(error);
      reject(error);
    }, 30000);
  });
  let read = 0;
  const bounded = request.body?.pipeThrough(new TransformStream<Uint8Array, Uint8Array>({
    transform(chunk, stream) {
      read += chunk.byteLength;
      if (read > maxBytes) throw new JobInputError("Request body exceeds size limit");
      stream.enqueue(chunk);
    },
  }), { signal: AbortSignal.any([request.signal, controller.signal]) });
  try {
    const response = new Response(bounded, { headers: request.headers });
    return await Promise.race([deadline, format === "form" ? response.formData() : response.json()]);
  } catch (error) {
    if (error instanceof JobInputError) throw error;
    throw new JobInputError("Malformed request body");
  } finally {
    clearTimeout(timer!);
    controller.abort();
  }
}
