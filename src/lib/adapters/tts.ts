import { promises as fs } from "fs";
import path from "path";
import { nanoid } from "nanoid";
import type { StudioSettings, JobOutput } from "@/lib/adapters/types";
import { probeTts } from "@/lib/adapters/probe";

/** Piper / OpenAI-compatible TTS — 404 is a miss, not a connection. */
export async function checkTtsHealth(baseUrl: string): Promise<boolean> {
  return (await probeTts(baseUrl)).ok;
}

/**
 * Try OpenAI-compatible /v1/audio/speech first, then Piper-style /api/tts.
 * Returns undefined if TTS is unreachable so callers can soft-fail.
 */
export async function synthesizeSpeech(args: {
  settings: StudioSettings;
  text: string;
  jobId: string;
  label?: string;
}): Promise<JobOutput | undefined> {
  if (args.settings.generationMode === "mock") return undefined;
  const healthy = await checkTtsHealth(args.settings.ttsUrl);
  if (!healthy) return undefined;

  const root = args.settings.ttsUrl.replace(/\/$/, "");
  const outDir = path.join(process.cwd(), ".data", "outputs");
  await fs.mkdir(outDir, { recursive: true });
  const id = nanoid(8);
  const filename = `${args.jobId}-${id}.wav`;
  const outPath = path.join(outDir, filename);

  // OpenAI-compatible
  try {
    const res = await fetch(`${root}/v1/audio/speech`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "tts-1",
        voice: args.settings.ttsVoice || "alloy",
        input: args.text.slice(0, 4000),
        response_format: "wav",
      }),
      signal: AbortSignal.timeout(120_000),
    });
    if (res.ok) {
      await fs.writeFile(outPath, Buffer.from(await res.arrayBuffer()));
      return {
        id,
        kind: "audio",
        label: args.label || "Voiceover",
        url: `/api/outputs/${filename}`,
      };
    }
  } catch {
    /* fall through */
  }

  // Piper HTTP
  try {
    const res = await fetch(`${root}/api/tts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: args.text.slice(0, 4000),
        voice: args.settings.ttsVoice,
      }),
      signal: AbortSignal.timeout(120_000),
    });
    if (res.ok) {
      await fs.writeFile(outPath, Buffer.from(await res.arrayBuffer()));
      return {
        id,
        kind: "audio",
        label: args.label || "Voiceover",
        url: `/api/outputs/${filename}`,
      };
    }
  } catch {
    /* soft fail */
  }

  return undefined;
}
