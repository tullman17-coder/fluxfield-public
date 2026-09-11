import { NextResponse } from "next/server";
import { readSettings } from "@/lib/settings";
import { checkComfyHealth } from "@/lib/adapters/comfyui";
import { checkOllamaHealth } from "@/lib/adapters/ollama";
import { checkTtsHealth } from "@/lib/adapters/tts";
import { checkFfmpeg } from "@/lib/adapters/ffmpeg";

export async function GET() {
  const settings = await readSettings();
  const [comfy, ollama, tts, ffmpeg] = await Promise.all([
    checkComfyHealth(settings.comfyUrl),
    checkOllamaHealth(settings.ollamaUrl),
    checkTtsHealth(settings.ttsUrl),
    settings.ffmpegEnabled ? checkFfmpeg() : Promise.resolve(false),
  ]);

  const effectiveMode =
    settings.generationMode === "mock"
      ? "mock"
      : settings.generationMode === "comfyui"
        ? comfy
          ? "comfyui"
          : "comfyui-unreachable"
        : comfy
          ? "comfyui"
          : "mock";

  return NextResponse.json({
    settings: {
      generationMode: settings.generationMode,
      comfyUrl: settings.comfyUrl,
      ollamaUrl: settings.ollamaUrl,
      ollamaModel: settings.ollamaModel,
      ttsUrl: settings.ttsUrl,
      ffmpegEnabled: settings.ffmpegEnabled,
    },
    health: { comfy, ollama, tts, ffmpeg, effectiveMode },
  });
}
