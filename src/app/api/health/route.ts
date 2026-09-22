import { NextResponse } from "next/server";
import { publicEndpoint, readSettings } from "@/lib/settings";
import { checkZermoHealth } from "@/lib/adapters/zermo";
import { pickMode } from "@/lib/adapters/effective-mode";
import { checkFfmpeg } from "@/lib/adapters/ffmpeg";
import { checkTtsHealth } from "@/lib/adapters/tts";
import { discoverAndHeal } from "@/lib/adapters/discover";
import type { ProbeResult } from "@/lib/adapters/probe";
import { peerRole } from "@/lib/mesh/factory";
import { netbirdHint } from "@/lib/netbird";

const publicProbe = (probe: ProbeResult) => ({ ...probe, url: publicEndpoint(probe.url) });

export async function GET(request: Request) {
  const force = new URL(request.url).searchParams.get("refresh") === "1";
  const current = await readSettings();
  if (current.generationMode === "zermo") {
    const [zermo, ffmpeg, tts] = await Promise.all([
      checkZermoHealth(), current.ffmpegEnabled ? checkFfmpeg() : Promise.resolve(false),
      current.ttsUrl ? checkTtsHealth(current.ttsUrl) : Promise.resolve(false),
    ]);
    return NextResponse.json({ settings: { generationMode: "zermo" }, health: { zermo, comfy: false, studio: false, ollama: false, tts, ffmpeg, effectiveMode: zermo.ready ? "zermo" : "zermo-unreachable", netbirdHint: null } });
  }
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
      comfyUrl: publicEndpoint(settings.comfyUrl),
      ollamaUrl: publicEndpoint(settings.ollamaUrl),
      ollamaModel: settings.ollamaModel,
      ttsUrl: publicEndpoint(settings.ttsUrl),
      ffmpegEnabled: settings.ffmpegEnabled,
      studioUrl: publicEndpoint(settings.studioUrl),
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
      probes: { studio: publicProbe(studio), comfy: publicProbe(comfy), ollama: publicProbe(ollama), tts: publicProbe(tts) },
      applied: applied.map((message) => message.replace(/https?:\/\/\S+/gi, publicEndpoint)),
      found: found.filter((f) => f.ok || f.reachable).map(publicProbe),
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
