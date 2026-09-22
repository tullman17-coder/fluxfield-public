import { z } from "zod";
import { promises as fs } from "fs";
import os from "os";
import path from "path";
import type { StudioSettings } from "@/lib/adapters/types";
import { defaultStudioUrlFromEnv } from "@/lib/netbird";
import {
  defaultFactoryOllamaUrl,
  sanitizeGenerationUrl,
} from "@/lib/mesh/factory";

const DATA_DIR = path.join(process.cwd(), ".data");
const SETTINGS_PATH = path.join(DATA_DIR, "settings.json");

export const DEFAULT_SETTINGS: StudioSettings = {
  nvidiaFallback: false,
  nvidiaApiKey: "",
  comfyUrl: "",
  ollamaUrl: defaultFactoryOllamaUrl(),
  ollamaModel: "llama3.2",
  generationMode: "zermo",
  comfyCheckpoint: "",
  ttsUrl: "http://127.0.0.1:5500",
  ttsVoice: "en_US-lessac-medium",
  musicUrl: process.env.MUSIC_URL || "",
  musicModel: process.env.MUSIC_MODEL || "ace-step",
  ffmpegEnabled: true,
  studioUrl: defaultStudioUrlFromEnv(),
  studioApiKey: process.env.LOCAL_STUDIO_API_KEY || "",
  higgsfieldApiKey: process.env.HIGGSFIELD_API_KEY || "",
  improveProvider: "local",
  improveApiBase: process.env.IMPROVE_API_BASE || "https://api.openai.com/v1",
  improveApiKey: process.env.IMPROVE_API_KEY || "",
  improveApiModel: process.env.IMPROVE_API_MODEL || "gpt-4o-mini",
  unrestricted: process.env.FLUXFIELD_UNRESTRICTED === "1",
};

async function ensureDataDir() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.mkdir(path.join(DATA_DIR, "outputs"), { recursive: true });
  await fs.mkdir(path.join(DATA_DIR, "uploads"), { recursive: true });
  await fs.mkdir(path.join(DATA_DIR, "tmp"), { recursive: true });
}

async function studioKeyFromDisk(): Promise<string> {
  const file =
    process.env.LOCAL_STUDIO_API_KEY_FILE ||
    path.join(os.homedir(), ".hermes", "secrets", "local-studio-api-key");
  try {
    // Operator secret stays outside the build; read it only at runtime.
    const value = (await fs.readFile(/* turbopackIgnore: true */ file, "utf8")).trim();
    return value;
  } catch {
    return "";
  }
}

async function nvidiaKeyFromEnv(): Promise<string> {
  if (process.env.NVIDIA_NIM_API_KEY?.trim()) return process.env.NVIDIA_NIM_API_KEY.trim();
  const file = process.env.NVIDIA_NIM_API_KEY_FILE;
  if (!file) return "";
  try { return (await fs.readFile(/* turbopackIgnore: true */ file, "utf8")).trim(); }
  catch { return ""; }
}

export async function readSettings(): Promise<StudioSettings> {
  await ensureDataDir();
  try {
    const raw = await fs.readFile(SETTINGS_PATH, "utf8");
    const parsed = JSON.parse(raw) as Partial<StudioSettings>;
    return {
      ...DEFAULT_SETTINGS,
      ...parsed,
      nvidiaApiKey: parsed.nvidiaApiKey || await nvidiaKeyFromEnv(),
      comfyUrl: sanitizeGenerationUrl(
        parsed.comfyUrl ?? DEFAULT_SETTINGS.comfyUrl,
      ),
      studioUrl: sanitizeGenerationUrl(
        parsed.studioUrl ?? DEFAULT_SETTINGS.studioUrl,
      ) || DEFAULT_SETTINGS.studioUrl,
      // env / house secret file wins when the saved key is empty
      studioApiKey:
        parsed.studioApiKey ||
        process.env.LOCAL_STUDIO_API_KEY ||
        (await studioKeyFromDisk()) ||
        DEFAULT_SETTINGS.studioApiKey,
      improveApiKey:
        parsed.improveApiKey ||
        process.env.IMPROVE_API_KEY ||
        DEFAULT_SETTINGS.improveApiKey,
    };
  } catch {
    return {
      ...DEFAULT_SETTINGS,
      nvidiaApiKey: await nvidiaKeyFromEnv(),
      studioApiKey:
        process.env.LOCAL_STUDIO_API_KEY ||
        (await studioKeyFromDisk()) ||
        DEFAULT_SETTINGS.studioApiKey,
    };
  }
}

const settingText = z.string().max(4096);
const endpoint = settingText.refine((value) => {
  if (value === "") return true;
  try {
    const url = new URL(value);
    return /^https?:$/.test(url.protocol) && !url.username && !url.password && !url.search && !url.hash;
  } catch { return false; }
}, "Expected an HTTP(S) endpoint without embedded credentials or query parameters");

export const settingsPatchSchema = z.object({
  nvidiaFallback: z.boolean(),
  nvidiaApiKey: settingText.trim().refine(v => !/[\s\x00-\x1f\x7f]/.test(v), "Invalid key"),
  clearNvidiaApiKey: z.boolean(), hasNvidiaApiKey: z.boolean(),
  comfyUrl: endpoint, ollamaUrl: endpoint, studioUrl: endpoint, ttsUrl: endpoint,
  musicUrl: endpoint, improveApiBase: endpoint,
  ollamaModel: settingText, comfyCheckpoint: settingText, ttsVoice: settingText,
  musicModel: settingText, improveApiModel: settingText,
  generationMode: z.enum(["auto", "mock", "comfyui", "local-studio", "zermo", "higgsfield"]),
  improveProvider: z.enum(["local", "api"]),
  ffmpegEnabled: z.boolean(), unrestricted: z.boolean(),
  studioApiKey: settingText, improveApiKey: settingText, higgsfieldApiKey: settingText,
  clearStudioApiKey: z.boolean(), clearImproveApiKey: z.boolean(), clearHiggsfieldApiKey: z.boolean(),
  // The existing UI round-trips public presence flags; they are never persisted.
  hasStudioApiKey: z.boolean(), hasImproveApiKey: z.boolean(), hasHiggsfieldApiKey: z.boolean(),
}).partial().strict();

export async function writeSettings(
  patch: z.input<typeof settingsPatchSchema>,
): Promise<StudioSettings> {
  const next = settingsPatchSchema.parse(patch);
  await ensureDataDir();
  let persisted: Partial<StudioSettings> = {};
  try {
    persisted = JSON.parse(await fs.readFile(SETTINGS_PATH, "utf8")) as Partial<StudioSettings>;
  } catch {
    persisted = {};
  }
  if (!next.studioApiKey?.trim() && !next.clearStudioApiKey) delete next.studioApiKey;
  if (!next.improveApiKey?.trim() && !next.clearImproveApiKey) delete next.improveApiKey;
  if (!next.higgsfieldApiKey?.trim() && !next.clearHiggsfieldApiKey) delete next.higgsfieldApiKey;
  if (!next.nvidiaApiKey?.trim() && !next.clearNvidiaApiKey) delete next.nvidiaApiKey;
  if (next.clearNvidiaApiKey) { next.nvidiaApiKey = ""; next.nvidiaFallback = false; }
  delete next.clearNvidiaApiKey;
  delete next.hasNvidiaApiKey;
  if (next.clearStudioApiKey) next.studioApiKey = "";
  if (next.clearImproveApiKey) next.improveApiKey = "";
  if (next.clearHiggsfieldApiKey) next.higgsfieldApiKey = "";
  delete next.clearStudioApiKey;
  delete next.clearImproveApiKey;
  delete next.clearHiggsfieldApiKey;
  delete next.hasStudioApiKey;
  delete next.hasImproveApiKey;
  delete next.hasHiggsfieldApiKey;
  const merged: StudioSettings = {
    ...DEFAULT_SETTINGS,
    ...persisted,
    ...next,
  };
  if (next.comfyUrl !== undefined || persisted.comfyUrl) {
    merged.comfyUrl = sanitizeGenerationUrl(merged.comfyUrl);
  }
  if (next.studioUrl !== undefined || persisted.studioUrl) {
    merged.studioUrl =
      sanitizeGenerationUrl(merged.studioUrl) || DEFAULT_SETTINGS.studioUrl;
  }
  const tmp = `${SETTINGS_PATH}.${crypto.randomUUID()}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(merged, null, 2), { mode: 0o600 });
  await fs.rename(tmp, SETTINGS_PATH);
  return readSettings();
}

export function publicEndpoint(value: string) {
  if (!value) return value;
  try {
    const url = new URL(value);
    if (!/^https?:$/.test(url.protocol)) return "";
    if (!url.username && !url.password && !url.search && !url.hash) return value;
    url.username = ""; url.password = ""; url.search = ""; url.hash = "";
    return url.href;
  } catch { return ""; }
}

export function publicSettings(settings: StudioSettings) {
  // Allowlist rather than a rest spread: new/persisted secret fields stay private.
  return {
    nvidiaFallback: settings.nvidiaFallback === true,
    hasNvidiaApiKey: Boolean(settings.nvidiaApiKey),
    comfyUrl: publicEndpoint(settings.comfyUrl),
    ollamaUrl: publicEndpoint(settings.ollamaUrl),
    ollamaModel: settings.ollamaModel,
    generationMode: settings.generationMode,
    comfyCheckpoint: settings.comfyCheckpoint,
    ttsUrl: publicEndpoint(settings.ttsUrl),
    ttsVoice: settings.ttsVoice,
    musicUrl: publicEndpoint(settings.musicUrl),
    musicModel: settings.musicModel,
    ffmpegEnabled: settings.ffmpegEnabled,
    studioUrl: publicEndpoint(settings.studioUrl),
    improveProvider: settings.improveProvider,
    improveApiBase: publicEndpoint(settings.improveApiBase),
    improveApiModel: settings.improveApiModel,
    unrestricted: settings.unrestricted,
    hasStudioApiKey: Boolean(settings.studioApiKey),
    hasImproveApiKey: Boolean(settings.improveApiKey),
    hasHiggsfieldApiKey: Boolean(settings.higgsfieldApiKey),
  };
}
