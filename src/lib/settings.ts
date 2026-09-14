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
  comfyUrl: "",
  ollamaUrl: defaultFactoryOllamaUrl(),
  ollamaModel: "llama3.2",
  generationMode: "auto",
  comfyCheckpoint: "",
  ttsUrl: "http://127.0.0.1:5500",
  ttsVoice: "en_US-lessac-medium",
  musicUrl: process.env.MUSIC_URL || "",
  musicModel: process.env.MUSIC_MODEL || "ace-step",
  ffmpegEnabled: true,
  studioUrl: defaultStudioUrlFromEnv(),
  studioApiKey: process.env.LOCAL_STUDIO_API_KEY || "",
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

export async function readSettings(): Promise<StudioSettings> {
  await ensureDataDir();
  try {
    const raw = await fs.readFile(SETTINGS_PATH, "utf8");
    const parsed = JSON.parse(raw) as Partial<StudioSettings>;
    return {
      ...DEFAULT_SETTINGS,
      ...parsed,
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
      studioApiKey:
        process.env.LOCAL_STUDIO_API_KEY ||
        (await studioKeyFromDisk()) ||
        DEFAULT_SETTINGS.studioApiKey,
    };
  }
}

export async function writeSettings(
  next: Partial<StudioSettings> & { clearStudioApiKey?: boolean; clearImproveApiKey?: boolean },
): Promise<StudioSettings> {
  await ensureDataDir();
  let persisted: Partial<StudioSettings> = {};
  try {
    persisted = JSON.parse(await fs.readFile(SETTINGS_PATH, "utf8")) as Partial<StudioSettings>;
  } catch {
    persisted = {};
  }
  next = { ...next };
  if (!next.studioApiKey?.trim() && !next.clearStudioApiKey) delete next.studioApiKey;
  if (!next.improveApiKey?.trim() && !next.clearImproveApiKey) delete next.improveApiKey;
  if (next.clearStudioApiKey) next.studioApiKey = "";
  if (next.clearImproveApiKey) next.improveApiKey = "";
  delete next.clearStudioApiKey;
  delete next.clearImproveApiKey;
  delete next.hasStudioApiKey;
  delete next.hasImproveApiKey;
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
  await fs.writeFile(SETTINGS_PATH, JSON.stringify(merged, null, 2));
  return readSettings();
}

export function publicSettings(settings: StudioSettings) {
  const { studioApiKey, improveApiKey, ...safe } = settings;
  return { ...safe, hasStudioApiKey: Boolean(studioApiKey), hasImproveApiKey: Boolean(improveApiKey) };
}
