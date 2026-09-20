import { checkComfyHealth } from "@/lib/adapters/comfyui";
import { checkZermoHealth } from "./zermo";
import { checkLocalStudioHealth } from "@/lib/adapters/local-studio";
import { checkHiggsfieldHealth } from "./higgsfield";
import type { ModeUsed, StudioSettings } from "@/lib/adapters/types";

/**
 * Which factory machine would draw an image right now.
 *
 * The `-unreachable` results only happen when a specific machine has been
 * chosen and it is not answering; on the automatic setting the chain falls
 * through to preview art instead of failing.
 */
export function pickMode(
  settings: StudioSettings,
  reach: { studioReady: boolean; comfy: boolean; zermoReady?: boolean; higgsfield?: boolean },
): ModeUsed | "local-studio-unreachable" | "comfyui-unreachable" | "zermo-unreachable" | "higgsfield-unreachable" {
  if (settings.generationMode === "higgsfield") return reach.higgsfield ? "higgsfield" : "higgsfield-unreachable";
  if (settings.generationMode === "zermo") return reach.zermoReady ? "zermo" : "zermo-unreachable";
  if (settings.generationMode === "mock") return "mock";
  if (settings.generationMode === "local-studio") {
    return reach.studioReady ? "local-studio" : "local-studio-unreachable";
  }
  if (settings.generationMode === "comfyui") {
    return reach.comfy ? "comfyui" : "comfyui-unreachable";
  }
  if (reach.studioReady) return "local-studio";
  if (reach.comfy) return "comfyui";
  if (reach.higgsfield) return "higgsfield";
  return "mock";
}

/** Probes the configured machines and reports which one would be used. */
export async function currentMode(settings: StudioSettings) {
  if (settings.generationMode === "higgsfield") {
    const higgsfield = await checkHiggsfieldHealth(settings.higgsfieldApiKey);
    return { comfy: false, studio: false, studioReady: false, higgsfield, mode: pickMode(settings, { comfy: false, studioReady: false, higgsfield }) };
  }
  if (settings.generationMode === "zermo") {
    const zermo = await checkZermoHealth();
    return { comfy: false, studio: false, studioReady: false, zermo, mode: pickMode(settings, { comfy: false, studioReady: false, zermoReady: zermo.ready }) };
  }
  const [comfy, studio] = await Promise.all([
    checkComfyHealth(settings.comfyUrl),
    checkLocalStudioHealth(settings),
  ]);
  const studioReady = studio && Boolean(settings.studioApiKey);
  const higgsfield = settings.generationMode === "auto" && !studioReady && !comfy
    ? await checkHiggsfieldHealth(settings.higgsfieldApiKey)
    : false;
  return {
    comfy,
    studio,
    studioReady,
    higgsfield,
    mode: pickMode(settings, { studioReady, comfy, higgsfield }),
  };
}
