import { NextResponse } from "next/server";
import { readSettings } from "@/lib/settings";
import { checkComfyHealth } from "@/lib/adapters/comfyui";
import { checkLocalStudioHealth } from "@/lib/adapters/local-studio";
import { pickMode } from "@/lib/adapters/effective-mode";
import { checkOllamaHealth } from "@/lib/adapters/ollama";
import { checkTtsHealth } from "@/lib/adapters/tts";
import { checkFfmpeg } from "@/lib/adapters/ffmpeg";
import { netbirdHint } from "@/lib/netbird";

export async function GET() {
  const settings = await readSettings();
  const [comfy, ollama, tts, ffmpeg, studio] = await Promise.all([
    checkComfyHealth(settings.comfyUrl),
    checkOllamaHealth(settings.ollamaUrl),
    checkTtsHealth(settings.ttsUrl),
    settings.ffmpegEnabled ? checkFfmpeg() : Promise.resolve(false),
    checkLocalStudioHealth(settings),
  ]);

  const studioReady = studio && Boolean(settings.studioApiKey);
  const effectiveMode = pickMode(settings, { studioReady, comfy });

  return NextResponse.json({
    settings: {
      generationMode: settings.generationMode,
      comfyUrl: settings.comfyUrl,
      ollamaUrl: settings.ollamaUrl,
      ollamaModel: settings.ollamaModel,
      ttsUrl: settings.ttsUrl,
      ffmpegEnabled: settings.ffmpegEnabled,
      studioUrl: settings.studioUrl,
      hasStudioApiKey: Boolean(settings.studioApiKey),
    },
    health: {
      comfy,
      ollama,
      tts,
      ffmpeg,
      studio,
      effectiveMode,
      netbirdHint: netbirdHint(settings.studioUrl),
    },
  });
}
