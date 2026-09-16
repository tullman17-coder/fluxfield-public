import { promises as fs } from "fs";
import path from "path";

/**
 * Finished campaign examples that ship with the app (under public/).
 * Used on first paint and on public hosts so the gallery never falls back
 * to procedural preview art when no GPU is connected.
 */
export const SHIPPED_EXAMPLES_DIR = path.join(
  process.cwd(),
  "public",
  "examples",
  "wrappers",
);

export const SHIPPED_EXTS = ["webp", "png", "jpg", "jpeg"] as const;

export type CardEngine =
  | "zermo"
  | "mock"
  | "comfyui"
  | "local-studio"
  | "shipped";

export const ENGINE_LABEL: Record<CardEngine, string> = {
  zermo: "Zermo",
  "local-studio": "Studio",
  comfyui: "Comfy",
  mock: "Preview art",
  shipped: "Sample",
};

export async function findShippedExample(slug: string) {
  for (const ext of SHIPPED_EXTS) {
    const file = path.join(SHIPPED_EXAMPLES_DIR, `${slug}.${ext}`);
    try {
      const data = await fs.readFile(file);
      return { data, ext: ext === "jpeg" ? "jpg" : ext };
    } catch {
      // try next
    }
  }
  return null;
}

export function shippedExamplePublicPath(slug: string, ext: string) {
  return `/examples/wrappers/${slug}.${ext}`;
}
