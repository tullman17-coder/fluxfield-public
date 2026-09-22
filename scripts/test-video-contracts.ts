import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import type { AdapterContext, StudioJob } from "../src/lib/adapters/types";
import type { ZermoRequest } from "../src/lib/adapters/zermo";

const exec = promisify(execFile);
const command = (name: string, args: string[]) => exec(name, args, { timeout: 120_000, maxBuffer: 16 * 1024 * 1024 });
const raw = async (file: string) => (await exec("ffmpeg", ["-v", "error", "-i", file, "-fps_mode", "passthrough", "-f", "rawvideo", "-pix_fmt", "rgb24", "-"], { encoding: "buffer", maxBuffer: 16 * 1024 * 1024 })).stdout;

async function main() {
  const cwd = process.cwd();
  const originalFetch = globalThis.fetch;
  const root = await fs.mkdtemp(path.join(os.homedir(), ".hermes/cache/scratch/fluxfield-audit/video-fix/fixtures-"));
  process.chdir(root); // Import data-root users only after isolation.
  process.env.ZERMO_API_KEY = "hermetic-video-contract";
  process.env.ZERMO_API_BASE = "http://127.0.0.1:1";
  delete process.env.ZERMO_API_KEY_FILE;
  globalThis.fetch = async () => { throw new Error("Unexpected network in hermetic test"); };
  const results: { name: string; ok: boolean; error?: string }[] = [];
  const check = async (name: string, fn: () => Promise<void>) => {
    try { await fn(); results.push({ name, ok: true }); console.log(`PASS: ${name}`); }
    catch (e) { const error = e instanceof Error ? e.message : String(e); results.push({ name, ok: false, error }); console.error(`FAIL: ${name}: ${error}`); }
  };
  try {
    const ff = await import("../src/lib/adapters/ffmpeg");
    const out = path.join(root, ".data", "outputs");
    await fs.mkdir(out, { recursive: true });
    const clip = path.join(out, "portrait.mp4");
    await command("ffmpeg", ["-v", "error", "-y", "-f", "lavfi", "-i", "testsrc2=size=96x160:rate=16", "-frames:v", "49", "-c:v", "libx264", "-pix_fmt", "yuv420p", clip]);
    await check("tail is decoded frame 48 of 49 at 16fps", async () => {
      const frames = await raw(clip);
      const frameBytes = 96 * 160 * 3;
      assert.equal(frames.length, 49 * frameBytes);
      const tail = path.join(out, "tail.png");
      await ff.extractLastFrame(clip, tail);
      const pixels = await raw(tail);
      const matching = Array.from({ length: 49 }, (_, i) => i).filter(i => pixels.equals(frames.subarray(i * frameBytes, (i + 1) * frameBytes)));
      assert.deepEqual(matching, [48], `tail matches decoded frame(s) ${matching}; expected only 48`);
    });
    await check("portrait xfade keeps selected aspect, audio, and requested length", async () => {
      await command("ffmpeg", ["-v", "error", "-y", "-f", "lavfi", "-i", "sine=frequency=440:duration=8", path.join(out, "score.wav")]);
      const args = { jobId: "portrait-cut", videoUrls: ["/api/outputs/portrait.mp4", "/api/outputs/portrait.mp4"], audioUrl: "/api/outputs/score.wav", aspect: "9:16", durationSec: 5 };
      const cut = await ff.concatClips(args);
      assert.ok(cut?.url, "final cut is required");
      assert.match(cut.label, /xfade/, "soundtrack must not force hard-concat fallback");
      const { stdout } = await command("ffprobe", ["-v", "error", "-show_streams", "-show_format", "-of", "json", path.join(out, path.basename(cut.url))]);
      const media = JSON.parse(stdout);
      const video = media.streams.find((s: { codec_type: string }) => s.codec_type === "video");
      assert.equal(video.width / video.height, 9 / 16);
      assert.ok(media.streams.some((s: { codec_type: string }) => s.codec_type === "audio"));
      assert.ok(Math.abs(Number(video.duration) - 5) <= 1 / 16, `duration ${video.duration} != 5`);
    });
    await check("slideshow keeps selected square aspect and pads short audio to duration", async () => {
      await command("ffmpeg", ["-v", "error", "-y", "-f", "lavfi", "-i", "sine=frequency=880:duration=1", path.join(out, "short.wav")]);
      const args = { jobId: "slides", imageUrls: ["/api/outputs/tail.png", "/api/outputs/tail.png"], audioUrl: "/api/outputs/short.wav", secondsPerBeat: 2, aspect: "1:1" };
      const cut = await ff.assembleExplainerVideo(args);
      assert.ok(cut?.url, "slideshow with audio must finish");
      const { stdout } = await command("ffprobe", ["-v", "error", "-show_streams", "-of", "json", path.join(out, path.basename(cut.url))]);
      const media = JSON.parse(stdout);
      const video = media.streams.find((s: { codec_type: string }) => s.codec_type === "video");
      assert.equal(video.width, video.height);
      assert.ok(Math.abs(Number(video.duration) - 4) <= 1 / 30, `slideshow duration ${video.duration}`);
      assert.ok(media.streams.some((s: { codec_type: string }) => s.codec_type === "audio"));
    });
    const { saveJob } = await import("../src/lib/jobs/store");
    const workflow = await import("../src/lib/adapters/video-workflow");
    const context = async (id: string, inputs: Record<string, string>, tool: StudioJob["tool"] = "ugc") => {
      const job: StudioJob = { id, tool, workflowSlug: tool, workflowName: tool, presetId: tool === "ugc" ? "review" : "explainer", presetLabel: "Test", status: "running", progress: 1, prompt: "Silly cartoon otter opens a purple umbrella", negativePrompt: "", aspect: inputs.aspect || "9:16", inputs, modeUsed: "zermo", outputs: [], createdAt: "2026-01-01T00:00:00Z", updatedAt: "2026-01-01T00:00:00Z" };
      await saveJob(job);
      return { job, settings: { generationMode: "zermo", ffmpegEnabled: true, ttsUrl: "", ttsVoice: "configured-voice" } } as AdapterContext;
    };
    const requests: ZermoRequest[] = [];
    const uploads: Buffer[] = [];
    const assets = new Map<string, ZermoRequest>();
    const speechRequests: { input: string; voice: string; mediaBefore: number }[] = [];
    let speechFile = path.join(out, "short.wav");
    globalThis.fetch = async (url, init) => {
      assert.equal(new URL(String(url)).origin, "http://127.0.0.1:1", "no live network allowed");
      if (String(url).endsWith("/v1/models")) return Response.json({ data: [{ id: "tts" }] });
      if (String(url).endsWith("/v1/audio/speech")) {
        speechRequests.push({ ...JSON.parse(String(init?.body)), mediaBefore: requests.length });
        return new Response(await fs.readFile(speechFile), { headers: { "content-type": "audio/wav" } });
      }
      if (init?.method === "POST") {
        const ct = new Headers(init.headers).get("content-type") || "";
        if (ct.startsWith("image/")) {
          uploads.push(Buffer.from(init.body as Uint8Array));
          return Response.json({ id: `asset_${uploads.length.toString(16).padStart(32, "f")}` });
        }
        const body = JSON.parse(String(init.body)) as ZermoRequest;
        requests.push(body);
        const suffix = requests.length.toString(16).padStart(32, "0");
        assets.set(`asset_${suffix}`, body);
        return Response.json({ id: `job_${suffix}`, state: "succeeded", effective: body.settings, outputs: [`asset_${suffix}`] });
      }
      const req = assets.get(path.basename(String(url)));
      assert.ok(req, `unexpected request ${url}`);
      const isVideo = req.operation === "video.image_to_video";
      return new Response(await fs.readFile(isVideo ? clip : path.join(out, "tail.png")), { headers: { "content-type": isVideo ? "video/mp4" : "image/png" } });
    };
    await check("managed workflow uses one opener and a duration-covering distinct WAN chain", async () => {
      const ctx = await context("managed-short", { duration: "10s", voice: "none", aspect: "9:16" });
      const result = await workflow.runVideoWorkflowAdapter(ctx);
      const stills = requests.filter(r => r.operation === "image.generate");
      assert.equal(stills.length, 1, "only the opener may cost a Qwen render");
      assert.equal(stills[0].settings.width! % 16, 0, "Qwen opener width uses native 16px grid");
      assert.equal(stills[0].settings.height! % 16, 0, "Qwen opener height uses native 16px grid");
      const wan = requests.filter(r => r.operation === "video.image_to_video");
      assert.equal(wan.length, 4);
      assert.ok(new Set(wan.map(r => r.prompt)).size > 1, "scene prompts must differ");
      const cut = result.outputs.find(o => o.kind === "video" && /Final cut/.test(o.label));
      assert.ok(cut?.url);
      const duration = await command("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "default=nw=1:nk=1", path.join(out, path.basename(cut.url))]);
      assert.equal(Number(duration.stdout), 10);
      for (const png of uploads.slice(1)) assert.ok(png.equals(await fs.readFile(path.join(out, "tail.png"))), "WAN n+1 must receive decoded tail, not another still");
    });
    await check("requested narration fails before GPU when TTS is unavailable", async () => {
      const before = requests.length;
      const ctx = await context("narration-unavailable", { duration: "10s", script: "Do not replace this exact narration.", voice: "default" }, "faceless");
      await assert.rejects(workflow.runVideoWorkflowAdapter(ctx), /narration|speech|TTS/i);
      assert.equal(requests.length, before, "unavailable narration must submit zero GPU work");
    });
    await check("unsupported durations reject before a child render", async () => {
      for (const duration of ["15m", "garbage", "9s", "91s", "NaN", "Infinity"]) {
        const before = requests.length;
        const ctx = await context(`bad-length-${duration}`, { duration, voice: "none" });
        await assert.rejects(workflow.runVideoWorkflowAdapter(ctx), /10–90 seconds/);
        assert.equal(requests.length, before);
      }
      assert.equal(workflow.parseVideoDuration("1m"), 60);
      assert.equal(workflow.parseVideoDuration("90s"), 90);
    });
    await check("Ads rejects multi-cut packs before generation", async () => {
      const before = requests.length;
      const ctx = await context("ad-hooks", { duration: "10s", voice: "none" }, "ad-multiplier");
      ctx.job.presetId = "hooks";
      await assert.rejects(workflow.runVideoWorkflowAdapter(ctx), /single|one cut|multiple/i);
      assert.equal(requests.length, before);
    });
    const { runDirectorAdapter } = await import("../src/lib/adapters/director");
    await check("Director respects square aspect and exact requested runtime", async () => {
      const ctx = await context("director-square", { runtime: "10", mode: "tiktok", aspect: "1:1", brief: "Silly cartoon otter opens a purple umbrella" }, "director");
      const result = await runDirectorAdapter(ctx);
      const cut = result.outputs.find(o => o.kind === "video" && /Final cut/.test(o.label));
      assert.ok(cut?.url);
      const { stdout } = await command("ffprobe", ["-v", "error", "-show_streams", "-of", "json", path.join(out, path.basename(cut.url))]);
      const video = JSON.parse(stdout).streams.find((s: { codec_type: string }) => s.codec_type === "video");
      assert.equal(video.width, video.height, "Director must respect chosen square aspect");
      assert.equal(Number(video.duration), 10);
    });
    await check("Director rejects unsupported runtime before score or stills", async () => {
      const before = requests.length;
      const ctx = await context("director-long", { runtime: "900", mode: "tiktok" }, "director");
      await assert.rejects(runDirectorAdapter(ctx), /10–90 seconds/);
      assert.equal(requests.length, before);
    });
    await check("narration script and selected voice reach TTS before GPU and survive mux", async () => {
      const script = "  The purple umbrella opens.\nThe otter says: wow!  ";
      const ctx = await context("voiced", { duration: "10s", script, voice: "voice-id-7" }, "faceless");
      ctx.settings.ttsUrl = "http://127.0.0.1:1";
      const before = requests.length;
      const result = await workflow.runVideoWorkflowAdapter(ctx);
      assert.equal(speechRequests.at(-1)?.input, script);
      assert.equal(speechRequests.at(-1)?.voice, "voice-id-7");
      assert.equal(speechRequests.at(-1)?.mediaBefore, before);
      const audio = result.outputs.find(o => o.kind === "audio");
      assert.ok(audio?.url);
      assert.ok((await fs.readFile(path.join(out, path.basename(audio.url)))).equals(await fs.readFile(speechFile)));
      const { stdout } = await command("ffprobe", ["-v", "error", "-show_streams", "-of", "json", path.join(out, path.basename(result.cut.url!))]);
      assert.ok(JSON.parse(stdout).streams.some((s: { codec_type: string }) => s.codec_type === "audio"));
    });
    await check("invalid narration media is rejected before GPU", async () => {
      const before = requests.length;
      speechFile = clip; // Deliberately return video bytes from the hermetic speech transport.
      const ctx = await context("invalid-tts", { duration: "10s", script: "Read me" }, "faceless");
      ctx.settings.ttsUrl = "http://127.0.0.1:1";
      try { await assert.rejects(workflow.runVideoWorkflowAdapter(ctx), /narration.*invalid/i); }
      finally { speechFile = path.join(out, "short.wav"); }
      assert.equal(requests.length, before);
    });
    await check("requested missing subtitles cannot silently disappear from final cut", async () => {
      await assert.rejects(ff.concatClips({ jobId: "missing-captions", videoUrls: ["/api/outputs/portrait.mp4"], srtPath: path.join(root, "missing.srt") }), /ENOENT|subtitles/i);
    });
    await check("dropped score duration is exact in Director plan and final cut", async () => {
      const uploadsDir = path.join(root, ".data", "uploads");
      await fs.mkdir(uploadsDir, { recursive: true });
      const score = path.join(uploadsDir, "score.flac");
      await command("ffmpeg", ["-v", "error", "-y", "-f", "lavfi", "-i", "sine=duration=10.125:sample_rate=48000", score]);
      const before = requests.length;
      const ctx = await context("dropped", { runtime: "60", mode: "music-video", scoreSource: "upload", soundtrack: "score.flac", aspect: "16:9", look: "noir" }, "director");
      const result = await runDirectorAdapter(ctx);
      assert.equal(requests.slice(before).filter(r => r.operation === "music.generate").length, 0);
      assert.equal(result.production.runtimeSec, 10.125);
      assert.equal(result.production.shots.at(-1)?.endSec, 10.125);
      const duration = await command("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "default=nw=1:nk=1", path.join(out, path.basename(result.cut.url!))]);
      assert.equal(Number(duration.stdout), 10.125);
      const dropped = result.outputs.find(o => o.label === "Dropped score");
      assert.ok((await fs.readFile(path.join(out, path.basename(dropped!.url!)))).equals(await fs.readFile(score)));
    });
    await check("selected still style also reaches every WAN scene prompt", async () => {
      const before = requests.length;
      const ctx = await context("styled", { duration: "10s", voice: "none", dreamStyle: "noir" });
      await workflow.runVideoWorkflowAdapter(ctx);
      for (const request of requests.slice(before)) assert.match(request.prompt, /film noir, hard chiaroscuro/);
    });
    await check("last-frame extraction also handles one-frame and variable-timestamp clips", async () => {
      for (const [name, filters] of [["one", ["-frames:v", "1"]], ["vfr", ["-vf", "setpts=N*N/(16*TB)", "-fps_mode", "vfr"]]] as const) {
        const file = path.join(out, `${name}.mp4`);
        await command("ffmpeg", ["-v", "error", "-y", "-i", clip, ...filters, file]);
        const frames = await raw(file);
        const tail = path.join(out, `${name}-tail.png`);
        await ff.extractLastFrame(file, tail);
        assert.ok((await raw(tail)).equals(frames.subarray(-96 * 160 * 3)));
      }
    });
    await check("missing clips, uncovered duration, and absent FFmpeg cannot return a final cut", async () => {
      await assert.rejects(ff.concatClips({ jobId: "missing", videoUrls: ["/api/outputs/no.mp4"] }));
      await assert.rejects(ff.concatClips({ jobId: "short", videoUrls: ["/api/outputs/portrait.mp4"], durationSec: 10 }), /cover/);
      const before = requests.length;
      const ctx = await context("ffmpeg-off", { duration: "10s", voice: "none" });
      ctx.settings.ffmpegEnabled = false;
      await assert.rejects(workflow.runVideoWorkflowAdapter(ctx), /FFmpeg/);
      assert.equal(requests.length, before);
    });
    await check("failed final assembly rejects the whole managed executor", async () => {
      const ctx = await context("final-fails", { duration: "10s", voice: "none" });
      await assert.rejects(workflow.runManagedSceneVideo(ctx, { durationSec: 10, shots: [{ label: "Opener", prompt: ctx.job.prompt }],
        onProgress: async (progress, _label, outputs) => {
          if (progress === 92) {
            const url = outputs.find(o => o.kind === "video")!.url!;
            await fs.unlink(path.join(out, path.basename(url)));
          }
        },
      }), /No such file|not found/i);
    });
    await check("unsupported source paths and overlong narration submit no GPU work", async () => {
      const before = requests.length;
      const cases: Record<string, string>[] = [{ sourceVideoPath: "/any/master.mp4" }, { script: "x".repeat(4001) }];
      for (const inputs of cases) {
        const ctx = await context(`unsupported-${Object.keys(inputs)[0]}`, { duration: "10s", ...inputs });
        await assert.rejects(workflow.runVideoWorkflowAdapter(ctx), /unsupported|4000/);
      }
      const long = path.join(out, "long-voice.wav");
      await command("ffmpeg", ["-v", "error", "-y", "-f", "lavfi", "-i", "sine=duration=11", long]);
      const ctx = await context("too-long-voice", { duration: "10s", script: "Do not crop the end of this narration" });
      ctx.settings.ttsUrl = "http://127.0.0.1:1";
      speechFile = long;
      try { await assert.rejects(workflow.runVideoWorkflowAdapter(ctx), /exceeds/); }
      finally { speechFile = path.join(out, "short.wav"); }
      assert.equal(requests.length, before);
    });
    await check("required opener QA gates WAN and retains its evidence", async () => {
      const before = requests.length;
      const ctx = await context("qa-unavailable", { duration: "10s", voice: "none", visualQa: "on" });
      await assert.rejects(workflow.runVideoWorkflowAdapter(ctx), /Adherence review failed/);
      assert.equal(requests.slice(before).filter(r => r.operation === "image.generate").length, 1);
      assert.equal(requests.slice(before).filter(r => r.operation === "video.image_to_video").length, 0);
      const { getJob } = await import("../src/lib/jobs/store");
      const saved = await getJob(ctx.job.id);
      assert.ok(saved?.outputs.some(o => o.label === "Visual QA"));
      assert.ok(saved?.outputs.some(o => o.kind === "image"));
    });
  } finally {
    globalThis.fetch = originalFetch;
    await fs.writeFile(path.join(root, "results.json"), JSON.stringify(results, null, 2));
    process.chdir(cwd);
    console.log(`RESULT: ${results.filter(r => r.ok).length}/${results.length} passed; fixtures ${root}`);
    if (results.some(r => !r.ok)) process.exitCode = 1;
  }
}
main().catch(e => { console.error(e); process.exitCode = 1; });
