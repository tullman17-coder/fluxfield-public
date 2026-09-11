import { NextResponse } from "next/server";
import { readSettings, writeSettings } from "@/lib/settings";
import type { GenerationMode } from "@/lib/adapters/types";

export async function GET() {
  const settings = await readSettings();
  return NextResponse.json({ settings });
}

export async function PUT(request: Request) {
  const body = (await request.json()) as Partial<{
    comfyUrl: string;
    ollamaUrl: string;
    ollamaModel: string;
    generationMode: GenerationMode;
    comfyCheckpoint: string;
    ttsUrl: string;
    ttsVoice: string;
    ffmpegEnabled: boolean;
    studioUrl: string;
    studioApiKey: string;
  }>;

  const settings = await writeSettings({
    ...(body.comfyUrl !== undefined ? { comfyUrl: body.comfyUrl.trim() } : {}),
    ...(body.ollamaUrl !== undefined
      ? { ollamaUrl: body.ollamaUrl.trim() }
      : {}),
    ...(body.ollamaModel !== undefined
      ? { ollamaModel: body.ollamaModel.trim() }
      : {}),
    ...(body.generationMode !== undefined
      ? { generationMode: body.generationMode }
      : {}),
    ...(body.comfyCheckpoint !== undefined
      ? { comfyCheckpoint: body.comfyCheckpoint.trim() }
      : {}),
    ...(body.ttsUrl !== undefined ? { ttsUrl: body.ttsUrl.trim() } : {}),
    ...(body.ttsVoice !== undefined ? { ttsVoice: body.ttsVoice.trim() } : {}),
    ...(body.ffmpegEnabled !== undefined
      ? { ffmpegEnabled: body.ffmpegEnabled }
      : {}),
    ...(body.studioUrl !== undefined
      ? { studioUrl: body.studioUrl.trim() }
      : {}),
    ...(body.studioApiKey !== undefined
      ? { studioApiKey: body.studioApiKey.trim() }
      : {}),
  });

  return NextResponse.json({ settings });
}
