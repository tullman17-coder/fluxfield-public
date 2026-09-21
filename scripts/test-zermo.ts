import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type { AdapterContext, StudioJob } from "../src/lib/adapters/types";

async function main() {
  const cwd = process.cwd();
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "fluxfield-zermo-"));
  process.chdir(tmp); // never read real settings, credentials, or data
  process.env.ZERMO_API_KEY = randomUUID();
  delete process.env.ZERMO_API_KEY_FILE;
  process.env.ZERMO_API_BASE = "http://127.0.0.1:1";
  const originalFetch = globalThis.fetch;
  try {
    const { imageRequest, runZermoAdapter, runZermoJob, zermoBase } = await import("../src/lib/adapters/zermo");
    const { saveJob, getJob, updateJob } = await import("../src/lib/jobs/store");
    const job: StudioJob = { id: "test-parent", tool: "dream", workflowSlug: "dream", workflowName: "Test", presetId: "test", presetLabel: "Test", status: "running", progress: 0, prompt: "teapot", negativePrompt: "", aspect: "16:9", inputs: {}, modeUsed: "zermo", outputs: [], createdAt: "2026-01-01T00:00:00Z", updatedAt: "2026-01-01T00:00:00Z" };
    const ctx = { job, settings: { generationMode: "zermo" } } as AdapterContext;
    await saveJob(job);
    const body = imageRequest(ctx);
    assert.deepEqual(body.settings, { width: 1024, height: 576, steps: 8 });
    assert.equal(body.inputs, undefined);
    const imageAsset = "asset_" + "b".repeat(32);
    assert.equal(imageRequest(ctx, imageAsset).inputs?.image, imageAsset);
    assert.throws(() => imageRequest({ ...ctx, job: { ...job, inputs: { sourceVideoPath: "clip.mp4" } } }), /source video/);
    assert.throws(() => zermoBase("https://user:pass@example.com"));
    assert.throws(() => zermoBase("http://example.com"));
    const id = "job_" + "a".repeat(32), asset = "asset_" + "b".repeat(32);
    const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aX1cAAAAASUVORK5CYII=", "base64");
    let submits = 0, polls = 0, downloads = 0, lostAck = true;
    let key = "", serialized = "";
    globalThis.fetch = async (url, init) => {
      assert.equal(init?.redirect, "error");
      assert.equal(new Headers(init?.headers).get("authorization"), `Bearer ${process.env.ZERMO_API_KEY}`);
      assert.ok(String(url).startsWith("http://127.0.0.1:1/v1/media/"));
      if (init?.method === "POST") {
        submits++;
        const saved = (await getJob(job.id))!.zermoJobs!["image:0"];
        assert.ok(saved.request); assert.ok(saved.key);
        const nextKey = new Headers(init.headers).get("idempotency-key")!;
        if (key) { assert.equal(nextKey, key); assert.equal(String(init.body), serialized); }
        key = nextKey; serialized = String(init.body);
        if (lostAck) { lostAck = false; throw new Error("connection lost after acceptance"); }
        return Response.json({ id, state: "submission_unknown", error: null, effective: { steps: 8 }, outputs: [] });
      }
      if (String(url).includes("/jobs/")) {
        polls++;
        assert.equal((await getJob(job.id))!.zermoJobs!["image:0"].remoteId, id);
        return Response.json({ id, state: "succeeded", effective: { steps: 8 }, outputs: [asset] });
      }
      downloads++;
      return new Response(png, { headers: { "content-type": "image/png" } });
    };
    await assert.rejects(runZermoAdapter(ctx), /transport interrupted/);
    const result = await runZermoAdapter(ctx);
    assert.equal(submits, 2); assert.equal(polls, 1);
    assert.equal(result.remotePromptId, id);
    await updateJob(job.id, { outputs: result.outputs, status: "completed" });
    assert.deepEqual(await fs.readFile(path.join(tmp, ".data/outputs", result.outputs[0].url!.split("/").pop()!)), png);
    assert.ok((await fs.readFile(path.join(tmp, ".data/indexes/library.json"), "utf8")).includes(asset));
    await runZermoAdapter(ctx);
    assert.equal(submits, 2); assert.equal(downloads, 2); // resume uses GET, no new render
    globalThis.fetch = async () => Response.json({ id, state: "submission_unknown", error: "uncertain", outputs: [], effective: {} });
    await assert.rejects(runZermoAdapter(ctx), /no replacement/);
    const audioJob = { ...job, id: "audio-parent", outputs: [] };
    await saveJob(audioJob);
    const flac = Buffer.from("fLaC-test-transport-bytes"); // transport fixture, not a claimed playable recording
    globalThis.fetch = async (url) => String(url).includes("/assets/") ? new Response(flac, { headers: { "content-type": "audio/flac" } }) : Response.json({ id, state: "succeeded", outputs: [asset], effective: { duration: 10 } });
    const music = await runZermoJob(audioJob, "music:track", { operation: "music.generate", model: "ace-step-1.5-turbo", prompt: "piano", settings: { duration: 10, lyrics: "Original saved words" } });
    assert.ok(music.outputs[0].url!.endsWith(".flac"));
    assert.equal(music.outputs[0].kind, "audio");
    const { boundedBytes } = await import("../src/lib/adapters/zermo");
    await assert.rejects(boundedBytes(new Response(new Uint8Array(10), { headers: { 'content-length': '10' } }), 8), /byte limit/);
    let cancelled = false;
    const stream = new ReadableStream<Uint8Array>({ start(c) { c.enqueue(new Uint8Array(5)); c.enqueue(new Uint8Array(5)); }, cancel() { cancelled = true; } });
    await assert.rejects(boundedBytes(new Response(stream), 8), /byte limit/); assert.ok(cancelled);
    assert.equal((await boundedBytes(new Response('small'), 8)).toString(), 'small');
    for (const inputs of [{ steps: '24' }, { cfg: '7' }, { size: '1920x1080' }] as Record<string, string>[]) assert.throws(() => imageRequest({ ...ctx, job: { ...job, inputs } }));
    assert.deepEqual(imageRequest({ ...ctx, job: { ...job, inputs: { size: '512x512', steps: '8', cfg: '1' } } }).settings, { width: 512, height: 512, steps: 8 });
    const savedAudio = (await getJob(audioJob.id))!;

    savedAudio.inputs = { seconds: '10', lyricMode: 'own', lyrics: 'Different unsubmitted words' };
    await saveJob(savedAudio);
    globalThis.fetch = async (url, init) => { assert.notEqual(init?.method, 'POST'); return String(url).includes('/assets/') ? new Response(flac, { headers: { 'content-type': 'audio/flac' } }) : Response.json({ id, state: 'succeeded', outputs: [asset], effective: { duration: 10 } }); };
    const { runMusicAdapter } = await import('../src/lib/adapters/music');
    const resumedMusic = await runMusicAdapter({ ...ctx, job: savedAudio });
    assert.equal(resumedMusic.outputs.find((o) => o.label === 'Lyrics requested')?.text, 'Original saved words');
    globalThis.fetch = async () => { throw new Error('Zermo TTS must make zero network calls'); };
    const { synthesizeSpeech } = await import('../src/lib/adapters/tts');
    assert.equal(await synthesizeSpeech({ settings: ctx.settings, text: 'test', jobId: job.id }), undefined);
    globalThis.fetch = async () => Response.json({ id, state: 'succeeded', effective: {}, outputs: [asset, asset] });
    await assert.rejects(runZermoAdapter(ctx), /asset count/);
    delete process.env.ZERMO_API_KEY;
    await assert.rejects(runZermoAdapter(ctx), /credential/);
    console.log("PASS: durable intent before submit, lost ACK replay identity, acknowledgement-before-poll, pending unknown, uncertainty fail-closed, resume without POST, authenticated asset bytes + library, FLAC extension, references/caps/base/missing-key validation");
  } finally {
    globalThis.fetch = originalFetch;
    process.chdir(cwd);
    await fs.rm(tmp, { recursive: true, force: true });
  }
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
