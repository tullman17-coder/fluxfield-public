import { promises as fs } from "fs";
import path from "path";
import type { ModeUsed } from "@/lib/adapters/types";
import { IMAGE2_WRAPPERS } from "@/lib/wrappers/catalog";
import {
  ENGINE_LABEL,
  type CardEngine,
  findShippedExample,
} from "@/lib/wrappers/shipped-examples";

export { ENGINE_LABEL, type CardEngine };

const CACHE_DIR = path.join(process.cwd(), ".data", "card-bg");

export async function recordCardEngine(slug: string, engine: ModeUsed) {
  await fs.mkdir(CACHE_DIR, { recursive: true });
  await fs.writeFile(
    path.join(CACHE_DIR, `${slug}.json`),
    JSON.stringify({ engine, madeAt: new Date().toISOString() }),
  );
}

/**
 * Which machine drew each example. Shipped samples fill gaps so the gallery
 * never looks empty of provenance on a fresh host. Runtime Studio/Comfy
 * caches override; mock never overrides a shipped sample badge.
 */
export async function readCardEngines(): Promise<Record<string, CardEngine>> {
  const out: Record<string, CardEngine> = {};

  for (const w of IMAGE2_WRAPPERS) {
    if (await findShippedExample(w.slug)) out[w.slug] = "shipped";
  }

  let names: string[];
  try {
    names = await fs.readdir(CACHE_DIR);
  } catch {
    return out;
  }
  for (const name of names) {
    if (!name.endsWith(".json")) continue;
    try {
      const raw = await fs.readFile(path.join(CACHE_DIR, name), "utf8");
      const { engine } = JSON.parse(raw) as { engine?: ModeUsed };
      const slug = name.replace(/\.json$/, "");
      if (engine && engine !== "mock") {
        out[slug] = engine;
      } else if (engine === "mock" && !out[slug]) {
        out[slug] = "mock";
      }
    } catch {
      // A half-written sidecar just means that card has no badge yet.
    }
  }
  return out;
}
