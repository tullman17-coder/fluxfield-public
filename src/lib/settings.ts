import { promises as fs } from "fs";
import path from "path";
import type { StudioSettings } from "@/lib/adapters/types";

const DATA_DIR = path.join(process.cwd(), ".data");
const SETTINGS_PATH = path.join(DATA_DIR, "settings.json");

export const DEFAULT_SETTINGS: StudioSettings = {
  comfyUrl: "http://127.0.0.1:8188",
  ollamaUrl: "http://127.0.0.1:11434",
  ollamaModel: "llama3.2",
  generationMode: "auto",
  comfyCheckpoint: "",
  ttsUrl: "http://127.0.0.1:5500",
  ttsVoice: "en_US-lessac-medium",
  ffmpegEnabled: true,
};

async function ensureDataDir() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.mkdir(path.join(DATA_DIR, "outputs"), { recursive: true });
  await fs.mkdir(path.join(DATA_DIR, "uploads"), { recursive: true });
  await fs.mkdir(path.join(DATA_DIR, "tmp"), { recursive: true });
}

export async function readSettings(): Promise<StudioSettings> {
  await ensureDataDir();
  try {
    const raw = await fs.readFile(SETTINGS_PATH, "utf8");
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export async function writeSettings(
  next: Partial<StudioSettings>,
): Promise<StudioSettings> {
  await ensureDataDir();
  const current = await readSettings();
  const merged = { ...current, ...next };
  await fs.writeFile(SETTINGS_PATH, JSON.stringify(merged, null, 2));
  return merged;
}
