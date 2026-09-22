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
  const tmp = `${videoPath}.sub.mp4`;
  try {
    await fs.access(srtPath);
    const escaped = srtPath.replace(/\\/g, "/").replace(/'/g, "\\'").replace(/:/g, "\\:");
    await execFileAsync("ffmpeg", ["-y", "-i", videoPath, "-vf", `subtitles='${escaped}'`, "-c:a", "copy", "-c:v", "libx264", "-pix_fmt", "yuv420p", tmp], { timeout: 120_000 });
    await fs.rename(tmp, videoPath);
  } finally {
    await fs.unlink(tmp).catch(() => undefined);
  }
}

export async function audioDurationSec(file: string): Promise<number | undefined> {
  try {
    const info = await mediaInfo(file);
    const audio = info.streams.find(s => s.codec_type === "audio");
    if (!audio) return undefined;
    // A header or successful TTS HTTP response is not proof of playable narration.
    await execFileAsync("ffmpeg", ["-v", "error", "-xerror", "-i", file, "-map", "0:a:0", "-f", "null", "-"], { timeout: 120_000 });
    const n = Number(audio.duration ?? info.format.duration);
    return Number.isFinite(n) && n > 0 ? n : undefined;
  } catch {
    return undefined;
  }
}

export async function checkFfmpeg(requireSubtitles = false): Promise<boolean> {
  try {
    const { stdout } = await execFileAsync("ffmpeg", [requireSubtitles ? "-filters" : "-version"], { timeout: 3000 });
    return !requireSubtitles || /\bsubtitles\s+V->V/.test(stdout);
  } catch {
    return false;
  }
}

/** Pitch-shift in place so A4 is 432 Hz. Duration stays. */
export async function retuneTo432(file: string) {
  const ext = path.extname(file);
  const tmp = `${file}.432${ext}`;
  const ratio = 432 / 440;
  const filters = [
    `rubberband=pitch=${ratio}`,
    `aresample=48000,asetrate=48000*${ratio},aresample=48000,atempo=${1 / ratio}`,
  ];
  for (const af of filters) {
    try {
      await execFileAsync("ffmpeg", ["-y", "-i", file, "-af", af, tmp], { timeout: 120_000 });
      await fs.rename(tmp, file);
      return;
    } catch {
      await fs.unlink(tmp).catch(() => undefined);
    }
  }
}

/** Slideshow fallback: every image is required, with explicit aspect and duration. */
export async function assembleExplainerVideo(args: {
  jobId: string;
  imageUrls: string[];
  audioUrl?: string;
  secondsPerBeat?: number;
  aspect?: string;
  durationSec?: number;
}): Promise<JobOutput> {
  if (!(await checkFfmpeg())) throw new Error("FFmpeg is required for a final cut");
  if (!args.imageUrls.length) throw new Error("No images for slideshow");
  const files = args.imageUrls.map(outputFile);
  await Promise.all(files.map(f => fs.access(f)));
  const first = (await mediaInfo(files[0])).streams.find(s => s.codec_type === "video");
  if (!first?.width || !first.height) throw new Error("Invalid slideshow opener");
  const size = args.aspect ? videoSize(args.aspect) : { w: Math.ceil(first.width / 2) * 2, h: Math.ceil(first.height / 2) * 2 };
  const seconds = args.secondsPerBeat ?? 4;
  const duration = args.durationSec ?? seconds * files.length;
  if (!Number.isFinite(seconds) || seconds <= 0 || !Number.isFinite(duration) || duration <= 0 || duration > seconds * files.length) throw new Error("Invalid slideshow duration");
  const workDir = path.join(process.cwd(), ".data", "tmp", args.jobId);
  await fs.mkdir(workDir, { recursive: true });
  const listPath = path.join(workDir, "list.txt");
  const entries = files.map(f => `file '${f.replace(/'/g, "'\\''")}'`);
  await fs.writeFile(listPath, [...entries.map(f => `${f}\nduration ${seconds}`), entries.at(-1)].join("\n"));
  const id = nanoid(8);
  const filename = `${args.jobId}-${id}.mp4`;
  const outPath = outputFile(`/api/outputs/${filename}`);
  const audio = args.audioUrl ? outputFile(args.audioUrl) : undefined;
  try {
    await execFileAsync("ffmpeg", ["-v", "error", "-y", "-f", "concat", "-safe", "0", "-i", listPath,
      ...(audio ? ["-i", audio] : []), "-map", "0:v:0",
      ...(audio ? ["-map", "1:a:0", "-af", "apad", "-c:a", "aac"] : ["-an"]),
      "-vf", `fps=30,tpad=stop_mode=clone:stop_duration=${duration},scale=${size.w}:${size.h}:force_original_aspect_ratio=decrease,pad=${size.w}:${size.h}:(ow-iw)/2:(oh-ih)/2,setsar=1,format=yuv420p`,
      "-r", "30", "-t", String(duration), "-c:v", "libx264", "-pix_fmt", "yuv420p", "-movflags", "+faststart", outPath], { timeout: 600_000 });
    const final = await mediaInfo(outPath);
    const video = final.streams.find(s => s.codec_type === "video");
    const finalDuration = Number(video?.duration ?? final.format.duration);
    if (!video || !Number.isFinite(finalDuration) || Math.abs(finalDuration - duration) > 1 / 30 + 0.001 || video.width !== size.w || video.height !== size.h || (audio && !final.streams.some(s => s.codec_type === "audio"))) throw new Error("Slideshow failed duration, aspect, or audio verification");
    return { id, kind: "video", label: "Final cut · slideshow (FFmpeg)", url: `/api/outputs/${filename}` };
  } catch (error) {
    await fs.unlink(outPath).catch(() => undefined);
    throw error;
  }
}

export async function extractLastFrame(videoPath: string, pngPath: string) {
  // Decode to EOF, overwriting one PNG. Seeking then taking one frame backtracks motion.
  // ponytail: bounded memory; house WAN clips are only 49 frames, so no seek heuristic.
  const tmp = `${pngPath}.${nanoid(8)}.png`;
  try {
    await execFileAsync("ffmpeg", ["-v", "error", "-y", "-i", videoPath, "-map", "0:v:0", "-fps_mode", "passthrough", "-update", "1", tmp], { timeout: 30_000 });
    if (!(await fs.stat(tmp)).size) throw new Error("No decoded last frame");
    await fs.rename(tmp, pngPath);
  } finally {
    await fs.unlink(tmp).catch(() => undefined);
  }
}

/** Exact output aspect; Qwen's opener may round its dimensions to multiples of eight. */
export function videoSize(aspect: string): { w: number; h: number } {
  const sizes: Record<string, { w: number; h: number }> = {
    "16:9": { w: 640, h: 360 }, "9:16": { w: 360, h: 640 },
    "1:1": { w: 512, h: 512 }, "2.39:1": { w: 956, h: 400 },
  };
  if (!sizes[aspect]) throw new Error(`Unsupported video aspect: ${aspect}`);
  return sizes[aspect];
}

type MediaStream = { codec_type: string; width: number; height: number; duration?: string };
async function mediaInfo(file: string): Promise<{ streams: MediaStream[]; format: { duration?: string } }> {
  const { stdout } = await execFileAsync("ffprobe", ["-v", "error", "-show_streams", "-show_format", "-of", "json", file], { timeout: 30_000 });
  return JSON.parse(stdout);
}

function outputFile(url: string): string {
  const name = url.replace(/^\/api\/outputs\//, "");
  if (!url.startsWith("/api/outputs/") || !name || /[\\/\0?#]/.test(name) || name === "." || name === "..") throw new Error("Invalid media output URL");
  return path.join(process.cwd(), ".data", "outputs", name);
}

/** Assemble all clips or throw. A partial board is not a finished video. */
export async function concatClips(args: {
  jobId: string;
  videoUrls: string[];
  audioUrl?: string;
  clipSec?: number;
  xfade?: number;
  srtPath?: string;
  aspect?: string;
  durationSec?: number;
}): Promise<JobOutput> {
  if (!(await checkFfmpeg())) throw new Error("FFmpeg is required for a final cut");
  if (!args.videoUrls.length) throw new Error("No video clips for final cut");
  const outDir = path.join(process.cwd(), ".data", "outputs");
  const workDir = path.join(process.cwd(), ".data", "tmp", args.jobId);
  await fs.mkdir(workDir, { recursive: true });
  const files = args.videoUrls.map(outputFile);
  const info = await Promise.all(files.map(mediaInfo));
  const videos = info.map(m => m.streams.find(s => s.codec_type === "video"));
  if (videos.some(v => !v?.width || !v.height)) throw new Error("Missing video stream for final cut");
  const durations = info.map((m, i) => Number(videos[i]?.duration ?? m.format.duration));
  if (durations.some(d => !Number.isFinite(d) || d <= 0)) throw new Error("Unknown clip duration");
  const size = args.aspect ? videoSize(args.aspect) : { w: Math.ceil(videos[0]!.width / 2) * 2, h: Math.ceil(videos[0]!.height / 2) * 2 };
  const id = nanoid(8);
  const filename = `${args.jobId}-${id}.mp4`;
  const outPath = path.join(outDir, filename);
  const fade = args.xfade ?? 0.25;
  if (!Number.isFinite(fade) || fade < 0 || (files.length > 1 && durations.some(d => fade >= d))) throw new Error("Crossfade must be shorter than every clip");
  const available = durations.reduce((sum, d) => sum + d, 0) - (files.length - 1) * fade;
  const target = args.durationSec ?? available;
  if (!Number.isFinite(target) || target <= 0 || target > available + 0.001) throw new Error(`Clips cover ${available}s, not requested ${target}s`);
  const audioAbs = args.audioUrl ? outputFile(args.audioUrl) : undefined;
  if (audioAbs && !(await mediaInfo(audioAbs)).streams.some(s => s.codec_type === "audio")) throw new Error("Soundtrack has no audio stream");
  const normFilter = `fps=16,scale=${size.w}:${size.h}:force_original_aspect_ratio=decrease,pad=${size.w}:${size.h}:(ow-iw)/2:(oh-ih)/2,setsar=1,format=yuv420p,settb=AVTB,setpts=PTS-STARTPTS`;
  let label = "Final cut · WAN clips";
  let ffmpegArgs: string[];
  if (files.length > 1 && fade > 0) {
    const norm = files.map((_, i) => `[${i}:v:0]${normFilter}[s${i}]`);
    const xf: string[] = [];
    let last = "s0";
    let outDur = durations[0];
    for (let i = 1; i < files.length; i++) {
      const name = i === files.length - 1 ? "vout" : `x${i}`;
      xf.push(`[${last}][s${i}]xfade=transition=fade:duration=${fade}:offset=${(outDur - fade).toFixed(3)}[${name}]`);
      last = name;
      outDur += durations[i] - fade;
    }
    // All inputs precede output options; explicitly map the soundtrack, not source audio.
    ffmpegArgs = [...files.flatMap(f => ["-i", f]), ...(audioAbs ? ["-i", audioAbs] : []),
      "-filter_complex_threads", "1", "-filter_complex", [...norm, ...xf].join(";"), "-map", "[vout]",
      ...(audioAbs ? ["-map", `${files.length}:a:0`] : [])];
    label = "Final cut · WAN 49f xfade";
  } else {
    const listPath = path.join(workDir, "clips.txt");
    await fs.writeFile(listPath, files.map(f => `file '${f.replace(/'/g, "'\\''")}'`).join("\n"));
    ffmpegArgs = ["-f", "concat", "-safe", "0", "-i", listPath, ...(audioAbs ? ["-i", audioAbs] : []),
      "-map", "0:v:0", ...(audioAbs ? ["-map", "1:a:0"] : []), "-vf", normFilter];
  }
  try {
    await execFileAsync("ffmpeg", ["-v", "error", "-y", ...ffmpegArgs,
      ...(audioAbs ? ["-af", "apad", "-c:a", "aac"] : ["-an"]),
      "-t", String(target), "-c:v", "libx264", "-pix_fmt", "yuv420p", "-movflags", "+faststart", outPath], { timeout: 600_000 });
    await burnSrt(outPath, args.srtPath);
    const final = await mediaInfo(outPath);
    const video = final.streams.find(s => s.codec_type === "video");
    const finalDuration = Number(video?.duration ?? final.format.duration);
    if (!video || !Number.isFinite(finalDuration) || Math.abs(finalDuration - target) > 1 / 16 + 0.001 || video.width !== size.w || video.height !== size.h || (audioAbs && !final.streams.some(s => s.codec_type === "audio"))) throw new Error("Final cut failed duration, aspect, or audio verification");
    return { id, kind: "video", label, url: `/api/outputs/${filename}` };
  } catch (error) {
    await fs.unlink(outPath).catch(() => undefined);
    throw error;
  }
}
