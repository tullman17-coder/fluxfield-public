import { execFile } from "child_process";
import { promises as fs } from "fs";
import path from "path";
import { promisify } from "util";
import { nanoid } from "nanoid";
import type { JobOutput } from "@/lib/adapters/types";
// JobOutput alias kept for clarity in assemble return types

const execFileAsync = promisify(execFile);

async function burnSrt(videoPath: string, srtPath?: string) {
  if (!srtPath) return;
  try {
    await fs.access(srtPath);
    const tmp = `${videoPath}.sub.mp4`;
    const escaped = srtPath.replace(/\\/g, "/").replace(/'/g, "\\'").replace(/:/g, "\\:");
    await execFileAsync("ffmpeg", ["-y", "-i", videoPath, "-vf", `subtitles='${escaped}'`, "-c:a", "copy", "-c:v", "libx264", "-pix_fmt", "yuv420p", tmp], { timeout: 120_000 });
    await fs.rename(tmp, videoPath);
  } catch {
    // ponytail: no libass → cut without burned lyrics
  }
}

export async function audioDurationSec(file: string): Promise<number | undefined> {
  try {
    const { stdout } = await execFileAsync(
      "ffprobe",
      ["-v", "error", "-show_entries", "format=duration", "-of", "default=nw=1:nk=1", file],
      { timeout: 8000 },
    );
    const n = Number(String(stdout).trim());
    return Number.isFinite(n) && n > 0 ? n : undefined;
  } catch {
    return undefined;
  }
}

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

export async function extractLastFrame(videoPath: string, pngPath: string) {
  // -sseof -0.05 is shorter than one 16fps frame; ffmpeg exits 0 with no PNG.
  await execFileAsync("ffmpeg", ["-y", "-sseof", "-1", "-i", videoPath, "-update", "1", "-frames:v", "1", pngPath], { timeout: 30_000 });
  await fs.access(pngPath);
}

/** Concat WAN clips with a short xfade. Soft-fails if ffmpeg is missing. */
export async function concatClips(args: {
  jobId: string;
  videoUrls: string[];
  audioUrl?: string;
  clipSec?: number;
  xfade?: number;
  srtPath?: string;
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
  const id = nanoid(8);
  const filename = `${args.jobId}-${id}.mp4`;
  const outPath = path.join(outDir, filename);
  const fade = args.xfade ?? 0.25;
  const clipSec = args.clipSec ?? 49 / 16;
  const audioAbs = args.audioUrl
    ? path.join(outDir, args.audioUrl.split("/").pop() || "")
    : undefined;
  const audioArgs = audioAbs ? ["-i", audioAbs, "-shortest", "-c:a", "aac"] : [];
  if (files.length > 1 && fade > 0) {
    const norm = files.map((_, i) => `[${i}:v]fps=16,scale=640:352:force_original_aspect_ratio=decrease,pad=640:352:(ow-iw)/2:(oh-ih)/2,format=yuv420p[s${i}]`);
    const xf: string[] = [];
    let last = "s0";
    let outDur = clipSec;
    for (let i = 1; i < files.length; i++) {
      const name = i === files.length - 1 ? "vout" : `x${i}`;
      xf.push(`[${last}][s${i}]xfade=transition=fade:duration=${fade}:offset=${(outDur - fade).toFixed(3)}[${name}]`);
      last = name;
      outDur += clipSec - fade;
    }
    try {
      await execFileAsync("ffmpeg", [
        "-y",
        ...files.flatMap((f) => ["-i", f]),
        "-filter_complex",
        [...norm, ...xf].join(";"),
        "-map",
        "[vout]",
        ...audioArgs,
        "-c:v",
        "libx264",
        "-pix_fmt",
        "yuv420p",
        outPath,
      ], { timeout: 600_000 });
      await burnSrt(outPath, args.srtPath);
      return { id, kind: "video", label: "Director cut · WAN 49f xfade", url: `/api/outputs/${filename}` };
    } catch { /* hard concat */ }
  }
  const listPath = path.join(workDir, "clips.txt");
  await fs.writeFile(listPath, files.map((f) => `file '${f.replace(/'/g, "'\\''")}'`).join("\n"));
  const ffmpegArgs = ["-y", "-f", "concat", "-safe", "0", "-i", listPath, ...audioArgs, "-c:v", "libx264", "-pix_fmt", "yuv420p", outPath];
  try {
    await execFileAsync("ffmpeg", ffmpegArgs, { timeout: 600_000 });
    await burnSrt(outPath, args.srtPath);
    return { id, kind: "video", label: "Director cut · WAN clips", url: `/api/outputs/${filename}` };
  } catch {
    return undefined;
  }
}
