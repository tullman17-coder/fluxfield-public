import { execFile } from "child_process";
import { promises as fs } from "fs";
import path from "path";
import { promisify } from "util";
import { nanoid } from "nanoid";
import type { JobOutput } from "@/lib/adapters/types";
// JobOutput alias kept for clarity in assemble return types

const execFileAsync = promisify(execFile);

export async function checkFfmpeg(): Promise<boolean> {
  try {
    await execFileAsync("ffmpeg", ["-version"], { timeout: 3000 });
    return true;
  } catch {
    return false;
  }
}

/**
 * Assemble a simple slideshow MP4 from image URLs on disk + optional audio.
 * Soft-fails (returns undefined) if ffmpeg is missing.
 */
export async function assembleExplainerVideo(args: {
  jobId: string;
  imageUrls: string[];
  audioUrl?: string;
  secondsPerBeat?: number;
}): Promise<JobOutput | undefined> {
  if (!(await checkFfmpeg())) return undefined;
  if (!args.imageUrls.length) return undefined;

  const outDir = path.join(process.cwd(), ".data", "outputs");
  const workDir = path.join(process.cwd(), ".data", "tmp", args.jobId);
  await fs.mkdir(workDir, { recursive: true });
  await fs.mkdir(outDir, { recursive: true });

  const listPath = path.join(workDir, "list.txt");
  const seconds = args.secondsPerBeat ?? 4;
  const lines: string[] = [];

  for (const url of args.imageUrls) {
    const name = url.split("/").pop();
    if (!name) continue;
    const abs = path.join(outDir, name);
    try {
      await fs.access(abs);
      // concat demuxer needs absolute paths escaped
      lines.push(`file '${abs.replace(/'/g, "'\\''")}'`);
      lines.push(`duration ${seconds}`);
    } catch {
      /* skip missing */
    }
  }
  if (!lines.length) return undefined;
  // repeat last frame for concat demuxer quirk
  const lastFile = lines[lines.length - 2];
  if (lastFile) lines.push(lastFile);
  await fs.writeFile(listPath, lines.join("\n"));

  const id = nanoid(8);
  const filename = `${args.jobId}-${id}.mp4`;
  const outPath = path.join(outDir, filename);

  const ffmpegArgs = [
    "-y",
    "-f",
    "concat",
    "-safe",
    "0",
    "-i",
    listPath,
    "-vf",
    "scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2,format=yuv420p",
    "-r",
    "30",
  ];

  if (args.audioUrl) {
    const audioName = args.audioUrl.split("/").pop();
    if (audioName) {
      const audioAbs = path.join(outDir, audioName);
      ffmpegArgs.push("-i", audioAbs, "-shortest", "-c:a", "aac");
    }
  }

  ffmpegArgs.push("-c:v", "libx264", "-pix_fmt", "yuv420p", outPath);

  try {
    await execFileAsync("ffmpeg", ffmpegArgs, { timeout: 600_000 });
    return {
      id,
      kind: "video",
      label: "Local slideshow (FFmpeg)",
      url: `/api/outputs/${filename}`,
    };
  } catch {
    return undefined;
  }
}

/** Concat WAN clips + optional ACE bed. Soft-fails if ffmpeg is missing. */
export async function concatClips(args: {
  jobId: string;
  videoUrls: string[];
  audioUrl?: string;
}): Promise<JobOutput | undefined> {
  if (!(await checkFfmpeg()) || !args.videoUrls.length) return undefined;
  const outDir = path.join(process.cwd(), ".data", "outputs");
  const workDir = path.join(process.cwd(), ".data", "tmp", args.jobId);
  await fs.mkdir(workDir, { recursive: true });
  const files: string[] = [];
  for (const url of args.videoUrls) {
    const name = url.split("/").pop();
    if (!name) continue;
    const abs = path.join(outDir, name);
    try { await fs.access(abs); files.push(abs); } catch { /* skip */ }
  }
  if (!files.length) return undefined;
  const listPath = path.join(workDir, "clips.txt");
  await fs.writeFile(listPath, files.map((f) => `file '${f.replace(/'/g, "'\\''")}'`).join("\n"));
  const id = nanoid(8);
  const filename = `${args.jobId}-${id}.mp4`;
  const outPath = path.join(outDir, filename);
  const ffmpegArgs = ["-y", "-f", "concat", "-safe", "0", "-i", listPath];
  if (args.audioUrl) {
    const audioName = args.audioUrl.split("/").pop();
    if (audioName) ffmpegArgs.push("-i", path.join(outDir, audioName), "-shortest", "-c:a", "aac");
  }
  ffmpegArgs.push("-c:v", "libx264", "-pix_fmt", "yuv420p", outPath);
  try {
    await execFileAsync("ffmpeg", ffmpegArgs, { timeout: 600_000 });
    return { id, kind: "video", label: "Director cut · WAN clips", url: `/api/outputs/${filename}` };
  } catch {
    return undefined;
  }
}
