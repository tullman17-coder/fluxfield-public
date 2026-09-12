import { promises as fs } from "fs";
import path from "path";
import type { ModeUsed } from "@/lib/adapters/types";

const CACHE_DIR = path.join(process.cwd(), ".data", "card-bg");

/** What made a given example, so a card can say so rather than leave you guessing. */
export const ENGINE_LABEL: Record<ModeUsed, string> = {
  "local-studio": "Studio",
  comfyui: "Comfy",
  mock: "Preview art",
};

export async function recordCardEngine(slug: string, engine: ModeUsed) {
  await fs.mkdir(CACHE_DIR, { recursive: true });
  await fs.writeFile(
    path.join(CACHE_DIR, `${slug}.json`),
    JSON.stringify({ engine, madeAt: new Date().toISOString() }),
  );
}

/**
 * Which machine drew each example. Missing entries are normal — a card that has
 * not been asked for yet has nothing to report.
 */
export async function readCardEngines(): Promise<Record<string, ModeUsed>> {
  let names: string[];
  try {
    names = await fs.readdir(CACHE_DIR);
  } catch {
    return {};
  }
  const out: Record<string, ModeUsed> = {};
  for (const name of names) {
    if (!name.endsWith(".json")) continue;
    try {
      const raw = await fs.readFile(path.join(CACHE_DIR, name), "utf8");
      const { engine } = JSON.parse(raw) as { engine?: ModeUsed };
      if (engine) out[name.replace(/\.json$/, "")] = engine;
    } catch {
      // A half-written sidecar just means that card has no badge yet.
    }
  }
  return out;
}
