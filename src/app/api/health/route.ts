import { NextResponse } from "next/server";
import { readSettings } from "@/lib/settings";
import { pickMode } from "@/lib/adapters/effective-mode";
import { checkFfmpeg } from "@/lib/adapters/ffmpeg";
import { discoverAndHeal } from "@/lib/adapters/discover";
import { peerRole } from "@/lib/mesh/factory";
import { netbirdHint } from "@/lib/netbird";

export async function GET(request: Request) {
  const force = new URL(request.url).searchParams.get("refresh") === "1";
  const current = await readSettings();
  const [discovered, ffmpeg] = await Promise.all([
    discoverAndHeal(current, { force }),
    current.ffmpegEnabled ? checkFfmpeg() : Promise.resolve(false),
  ]);

  const { settings, studio, comfy, ollama, tts, applied, found, mesh } =
    discovered;
  const studioReady = studio.ok && Boolean(settings.studioApiKey);
  const effectiveMode = pickMode(settings, {
    studioReady,
    comfy: comfy.ok,
  });

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
      comfy: comfy.ok,
      ollama: ollama.ok,
      tts: tts.ok,
      ffmpeg,
      studio: studio.ok,
      studioReady,
      effectiveMode,
      netbirdHint: netbirdHint(settings.studioUrl),
      probes: { studio, comfy, ollama, tts },
      applied,
      found: found.filter((f) => f.ok || f.reachable),
      factory: "dgx-spark",
      mesh: {
        provider: mesh.provider,
        selfName: mesh.selfName,
        connected: mesh.peers.filter((p) => p.connected && !p.self).length,
        total: mesh.peers.filter((p) => !p.self).length,
        peers: mesh.peers.map((peer) => ({
          ...peer,
          role: peerRole(peer),
        })),
      },
    },
  });
}
