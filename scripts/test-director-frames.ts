import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import type {
  AdapterContext,
  StudioJob,
} from "../src/lib/adapters/types";
import type { ZermoRequest } from "../src/lib/adapters/zermo";

const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aX1cAAAAASUVORK5CYII=",
  "base64",
);

function job(id: string, inputs: Record<string, string> = {}): StudioJob {
  return {
    id,
    tool: "director",
    workflowSlug: "director",
    workflowName: "Director",
    presetId: "noir",
    presetLabel: "Film Noir",
    status: "running",
    progress: 0,
    prompt: "Act I scene",
    negativePrompt: "",
    aspect: "1:1",
    inputs,
    modeUsed: "zermo",
    outputs: [],
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
  };
}

async function main() {
  const { interpretDirectorBrief } = await import("../src/lib/director/brief");
  const parsed = interpretDirectorBrief(
    "create a song in biggie smalls voice, but in the same beat and genre as slipknot, a song about calling out of work on a friday.",
  );
  assert.equal(parsed.genre, "metal");
  assert.equal(parsed.look, "street");
  assert.match(parsed.topic, /calling out of work on a friday/i);
  assert.match(parsed.acePrompt, /biggie smalls/i);
  assert.match(parsed.acePrompt, /nu-metal/i);

  const cwd = process.cwd();
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "fluxfield-director-"));
  const originalFetch = globalThis.fetch;
  process.chdir(tmp);
  process.env.ZERMO_API_KEY = randomUUID();
  process.env.ZERMO_API_BASE = "http://127.0.0.1:1";
  delete process.env.ZERMO_API_KEY_FILE;

  try {
    const { wanClipsForDuration } = await import("../src/lib/adapters/zermo");
    assert.equal(wanClipsForDuration(60), 22);
    assert.equal(wanClipsForDuration(30), 11);
    const { pacingFromCutSpeed } = await import("../src/lib/director/plan");
    assert.equal(pacingFromCutSpeed("-2"), "slow");
    assert.equal(pacingFromCutSpeed("2"), "frantic");

    const { generateDirectorFrames } = await import(
      "../src/lib/adapters/director-frames"
    );
    const { saveJob } = await import("../src/lib/jobs/store");
    const parent = job("director-shot-defaults");
    const ctx = {
      job: parent,
      settings: { generationMode: "zermo", ffmpegEnabled: true },
    } as AdapterContext;
    await saveJob(parent);

    let request: ZermoRequest | undefined;
    const remoteId = `job_${"a".repeat(32)}`;
    const assetId = `asset_${"b".repeat(32)}`;
    globalThis.fetch = async (url, init) => {
      if (init?.method === "POST") {
        request = JSON.parse(String(init.body)) as ZermoRequest;
        return Response.json({
          id: remoteId,
          state: "succeeded",
          effective: request.settings,
          outputs: [assetId],
        });
      }
      assert.match(String(url), /\/assets\//);
      return new Response(PNG, { headers: { "content-type": "image/png" } });
    };

    let ticks = 0;
    await generateDirectorFrames(
      ctx,
      [
        {
          label: "00:00 · Wide · Act I",
          prompt: "A lighthouse keeper repairs the brass lamp",
          style: "noir",
          seed: 42,
        },
      ],
      { w: 540, h: 960 },
      async () => {
        ticks += 1;
      },
    );
    assert.equal(ticks, 1);

    assert.ok(request);
    assert.match(request.prompt, /film noir, hard chiaroscuro/);
    assert.equal(request.seed, "42");
    assert.deepEqual(request.settings, {
      width: 576,
      height: 1024,
      steps: 8,
    });

    const brief =
      "A lighthouse keeper repairs a brass Fresnel lamp during a winter storm before the supply ship arrives.";
    const directorJob = {
      ...job("director-lighthouse"),
      aspect: "16:9",
      inputs: {
        mode: "tiktok",
        brief,
        runtime: "30",
        look: "noir",
        pacing: "steady",
        aspect: "9:16",
        template: "hook-payoff",
      },
    };
    await saveJob(directorJob);
    const { execFile } = await import("node:child_process");
    const { promisify } = await import("node:util");
    const execFileAsync = promisify(execFile);
    const mp4Path = path.join(tmp, "one.mp4");
    await execFileAsync("ffmpeg", [
      "-y",
      "-f",
      "lavfi",
      "-i",
      "color=c=black:s=96x160:r=16:d=3.0625",
      "-frames:v",
      "49",
      mp4Path,
    ]);
    const MP4 = await fs.readFile(mp4Path);
    const flacPath = path.join(tmp, "score.flac");
    await execFileAsync("ffmpeg", ["-v", "error", "-y", "-f", "lavfi", "-i", "sine=duration=30", flacPath]);
    const FLAC = await fs.readFile(flacPath);
    const directorRequests: ZermoRequest[] = [];
    let remoteSeq = 0;
    const remoteStates = new Map<string, { id: string; state: string; effective: unknown; outputs: string[] }>();
    const assetRequests = new Map<string, ZermoRequest>();
    globalThis.fetch = async (url, init) => {
      assert.equal(new URL(String(url)).origin, "http://127.0.0.1:1", "fixture transport only");
      if (init?.method === "POST") {
        const headers = (init.headers || {}) as Record<string, string>;
        const ct = headers["Content-Type"] || headers["content-type"] || "";
        if (String(ct).includes("image/png")) {
          return Response.json({ id: `asset_${"e".repeat(32)}` });
        }
        const submitted = JSON.parse(String(init.body)) as ZermoRequest;
        directorRequests.push(submitted);
        const suffix = (++remoteSeq).toString(16).padStart(32, "0");
        const state = {
          id: `job_${suffix}`,
          state: submitted.settings.duration === 300 ? "failed" : "succeeded",
          effective: submitted.settings,
          outputs: [`asset_${suffix}`],
        };
        remoteStates.set(state.id, state);
        assetRequests.set(state.outputs[0], submitted);
        return Response.json(state);
      }
      if (String(url).includes("/jobs/")) {
        const state = remoteStates.get(path.basename(String(url)));
        assert.ok(state, "resume must read the accepted remote ID");
        return Response.json(state);
      }
      const last = assetRequests.get(path.basename(String(url)));
      assert.ok(last, "only fixture-owned assets may be read");
      if (last?.operation === "music.generate") {
        return new Response(FLAC, { headers: { "content-type": "audio/flac" } });
      }
      if (last?.operation === "video.image_to_video") {
        return new Response(MP4, { headers: { "content-type": "video/mp4" } });
      }
      return new Response(PNG, { headers: { "content-type": "image/png" } });
    };
    // Exercise the real multipart route → durable runner → shared video executor.
    await fs.writeFile(path.join(tmp, ".data", "settings.json"), JSON.stringify({ generationMode: "zermo", ffmpegEnabled: true }));
    const { POST: create } = await import("../src/app/api/jobs/route");
    const { getJob: readJob } = await import("../src/lib/jobs/store");
    const { listLibrary } = await import("../src/lib/library/index");
    const done = async (id: string) => {
      for (let i = 0; i < 6000; i++) {
        const saved = await readJob(id);
        if (saved && ["completed", "failed"].includes(saved.status)) return saved;
        await new Promise(resolve => setTimeout(resolve, 10));
      }
      throw new Error("Isolated video job did not settle");
    };
    const form = new FormData();
    form.set("tool", "music"); form.set("workflowSlug", "music"); form.set("presetId", "street");
    form.set("inputs", JSON.stringify({ mode: "music-video", brief, runtime: "30", seconds: "30", look: "street", scoreSource: "upload", aspect: "16:9", visualQa: "off" }));
    form.set("soundtrack", new File([FLAC], "score.flac", { type: "audio/flac" }));
    form.set("referenceImage", new File([PNG], "opener.png", { type: "image/png" }));
    const response = await create(new Request("http://unit.test/api/jobs", { method: "POST", body: form }));
    const created = await response.json();
    assert.equal(response.status, 201, `Music video intake must accept visual presets and uploads: ${JSON.stringify(created)}`);
    const completed = await done(created.job.id);
    assert.equal(completed.status, "completed", completed.error);
    assert.equal(completed.tool, "music");
    assert.equal(completed.workflowSlug, "music");
    assert.equal(completed.workflowName, "Music video");
    assert.equal(completed.presetId, "street");
    assert.equal(completed.inputs.mode, "music-video");
    assert.deepEqual(await fs.readFile(completed.referenceImagePath!), PNG);
    assert.deepEqual(await fs.readFile(path.join(tmp, ".data/uploads", completed.inputs.soundtrack)), FLAC);
    assert.equal(directorRequests.filter(r => r.operation === "music.generate").length, 0, "Drop track skips ACE");
    assert.equal(directorRequests.filter(r => r.operation === "image.generate").length, 0, "Reference still skips Qwen");
    assert.equal(directorRequests.filter(r => r.operation === "video.image_to_video").length, wanClipsForDuration(30));
    const primary = completed.outputs.find(o => o.id === completed.primaryOutputId);
    assert.equal(primary?.kind, "video");
    assert.match(primary!.label, /Final cut/);
    const { stdout } = await execFileAsync("ffprobe", ["-v", "error", "-show_streams", "-of", "json", path.join(tmp, ".data/outputs", path.basename(primary!.url!))]);
    const streams = JSON.parse(stdout).streams;
    assert.equal(Number(streams.find((s: { codec_type: string }) => s.codec_type === "video").duration), 30);
    assert.ok(streams.some((s: { codec_type: string }) => s.codec_type === "audio"));
    const library = await listLibrary({ tool: "music", kind: "video" });
    assert.ok(library.entries.some(e => e.jobId === completed.id && e.fileName === path.basename(primary!.url!)), "Music video must publish under Music, not Director or Track-only");
    const { GET: reload } = await import("../src/app/api/jobs/[id]/route");
    const reloaded = await reload(new Request(`http://unit.test/api/jobs/${completed.id}`), { params: Promise.resolve({ id: completed.id }) });
    assert.deepEqual((await reloaded.json()).job, completed, "Job-watch reload preserves identity and primary video");
    console.log("PASS: Music multipart create → WAN → decoded 30s cut + audio → Music library + exact job reload");

    // Old create payloads are compatibility entry points, not new Director-owned videos.
    directorRequests.length = 0;
    form.set("tool", "director"); form.set("workflowSlug", "director");
    const legacyResponse = await create(new Request("http://unit.test/api/jobs", { method: "POST", body: form }));
    assert.equal(legacyResponse.status, 201);
    const legacyCreated = (await legacyResponse.json()).job;
    const legacyFinished = await done(legacyCreated.id);
    assert.equal(legacyFinished.status, "completed", legacyFinished.error);
    assert.equal(legacyCreated.tool, "music", "New legacy Director music-video submissions must be Music-owned");
    assert.equal(legacyCreated.workflowSlug, "music");
    assert.deepEqual(legacyCreated.requested, { tool: "director", workflowSlug: "director", presetId: "street" });
    console.log("PASS: legacy Director create payload → new Music identity; original request retained");

    // Simulate an old persisted Director video without running intake/migration.
    const oldJob: StudioJob = { ...legacyFinished, tool: "director", workflowSlug: "director", workflowName: "Music Video", status: "failed" };
    await saveJob(oldJob);
    const { POST: resume } = await import("../src/app/api/jobs/[id]/route");
    const postsBeforeResume = directorRequests.length;
    const resumedResponse = await resume(new Request(`http://unit.test/api/jobs/${oldJob.id}`, { method: "POST" }), { params: Promise.resolve({ id: oldJob.id }) });
    assert.equal(resumedResponse.status, 202);
    const resumedOld = await done(oldJob.id);
    assert.equal(resumedOld.status, "completed", resumedOld.error);
    for (const key of ["id", "tool", "workflowSlug", "workflowName", "presetId", "inputs", "requested", "originalInputs"] as const) assert.deepEqual(resumedOld[key], oldJob[key], `Legacy ${key} must not be migrated on resume`);
    for (const [purpose, intent] of Object.entries(oldJob.zermoJobs!)) {
      assert.equal(resumedOld.zermoJobs![purpose].remoteId, intent.remoteId);
      assert.deepEqual(resumedOld.zermoJobs![purpose].request, intent.request);
    }
    assert.equal(directorRequests.length, postsBeforeResume, "Legacy resume must poll retained worker IDs, not re-submit");
    console.log("PASS: old Director music-video ID resumes without ownership/request rewrite or new worker POSTs");

    directorRequests.length = 0;
    const writeResponse = await create(new Request("http://unit.test/api/jobs", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ tool: "music", workflowSlug: "music", presetId: "animated", inputs: { mode: "music-video", brief, runtime: "30", seconds: "30", look: "animated", genre: "pop", lyricMode: "instrumental", scoreSource: "write", visualQa: "off" } }) }));
    assert.equal(writeResponse.status, 201);
    const written = await done((await writeResponse.json()).job.id);
    assert.equal(written.status, "completed", written.error);
    assert.equal(written.outputs.find(o => o.id === written.primaryOutputId)?.kind, "video");
    assert.deepEqual(directorRequests.map(r => r.operation), ["music.generate", "image.generate", ...Array(wanClipsForDuration(30)).fill("video.image_to_video")]);
    assert.equal(directorRequests[0].settings.duration, 30);
    assert.equal(written.tool, "music");
    console.log("PASS: new Music Write ACE → Qwen opener → WAN → primary video");

    directorRequests.length = 0;
    const songResponse = await create(new Request("http://unit.test/api/jobs", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ tool: "music", workflowSlug: "music", presetId: "pop", inputs: { mode: "song", brief, genre: "pop", seconds: "300", lyricMode: "instrumental" } }) }));
    assert.equal(songResponse.status, 201);
    const song = await done((await songResponse.json()).job.id);
    assert.equal(song.status, "failed", "fixture deliberately stops after full-song worker POST");
    assert.deepEqual(directorRequests.map(r => [r.operation, r.settings.duration]), [["music.generate", 300]], "Song must remain one native 300s ACE request, with no visuals");
    console.log("PASS: Song create → one native 300s ACE request (fixture stops at worker)");

    await fs.writeFile(path.join(tmp, ".data/settings.json"), JSON.stringify({ generationMode: "zermo", ffmpegEnabled: false }));
    const defaultResponse = await create(new Request("http://unit.test/api/jobs", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ tool: "music", workflowSlug: "music", presetId: "auto", inputs: { mode: "music-video", brief, runtime: "30" } }) }));
    assert.equal(defaultResponse.status, 201);
    const defaultJob = (await defaultResponse.json()).job;
    await done(defaultJob.id); // disabled FFmpeg stops before any media work
    assert.equal(defaultJob.inputs.visualQa, "on", "Moving ownership must retain the video QA default");

    directorRequests.length = 0;
    const { runDirectorAdapter } = await import(
      "../src/lib/adapters/director"
    );
    await runDirectorAdapter({ ...ctx, job: directorJob });
    const { DIRECTOR_RENDER_STILLS } = await import(
      "../src/lib/adapters/director-frames"
    );
    const stills = directorRequests.filter((r) => r.operation === "image.generate");
    assert.equal(stills.length, DIRECTOR_RENDER_STILLS);
    assert.equal(
      directorRequests.filter((r) => r.operation === "music.generate").length,
      0,
    );
    for (const submitted of stills) {
      assert.ok(submitted.prompt.includes(brief));
      assert.match(submitted.prompt, /film noir, hard chiaroscuro/);
      assert.notEqual(submitted.seed, undefined);
      assert.deepEqual(submitted.settings, {
        width: 352,
        height: 640,
        steps: 8,
      });
    }
    const wan = directorRequests.filter((r) => r.operation === "video.image_to_video");
    assert.equal(wan.length, wanClipsForDuration(30));

    await fs.mkdir(path.join(tmp, ".data", "uploads"), { recursive: true });
    const scoreName = "drop.flac";
    await fs.writeFile(path.join(tmp, ".data", "uploads", scoreName), FLAC);
    directorRequests.length = 0;
    const uploadJob = {
      ...job("director-drop-score"),
      aspect: "16:9",
      inputs: {
        mode: "music-video",
        brief,
        runtime: "30",
        look: "noir",
        cutSpeed: "-2",
        scoreSource: "upload",
        soundtrack: scoreName,
        cast: "Maya in a black coat",
        aspect: "16:9",
      },
    };
    await saveJob(uploadJob);
    await runDirectorAdapter({ ...ctx, job: uploadJob });
    assert.equal(
      directorRequests.filter((r) => r.operation === "music.generate").length,
      0,
    );
    const dropStills = directorRequests.filter((r) => r.operation === "image.generate");
    assert.equal(dropStills.length, DIRECTOR_RENDER_STILLS);
    assert.match(dropStills[0]!.prompt, /Cast: Maya in a black coat/);
    assert.equal(
      directorRequests.filter((r) => r.operation === "video.image_to_video").length,
      wanClipsForDuration(30),
    );

    directorRequests.length = 0;
    const refName = "face.png";
    await fs.writeFile(path.join(tmp, ".data", "uploads", refName), PNG);
    const refJob = {
      ...job("director-ref-still"),
      aspect: "16:9",
      inputs: {
        mode: "music-video",
        brief,
        runtime: "30",
        look: "street",
        scoreSource: "upload",
        soundtrack: scoreName,
        referenceImage: refName,
        aspect: "16:9",
      },
    };
    await saveJob(refJob);
    const refResult = await runDirectorAdapter({
      ...ctx,
      job: refJob,
      referenceImagePath: path.join(tmp, ".data", "uploads", refName),
    });
    assert.equal(
      directorRequests.filter((r) => r.operation === "image.generate").length,
      0,
    );
    assert.equal(
      directorRequests.filter((r) => r.operation === "video.image_to_video").length,
      wanClipsForDuration(30),
    );
    assert.ok(refResult.outputs.some((o) => o.kind === "image" && o.label === "Reference still"));

    const { fetchReferenceImage } = await import("../src/lib/jobs/reference");
    await assert.rejects(() => fetchReferenceImage("file:///etc/passwd"), /http/);
    await assert.rejects(() => fetchReferenceImage("http://127.0.0.1/x.png"), /not allowed/);

    const explicitJob = job("director-explicit", {
      size: "512x512",
      seed: "18446744073709551615",
    });
    await saveJob(explicitJob);
    const explicitCtx = { ...ctx, job: explicitJob };
    const acceptedId = `job_${"c".repeat(32)}`;
    const acceptedAsset = `asset_${"d".repeat(32)}`;
    let explicitRequest: ZermoRequest | undefined;
    let explicitPosts = 0;
    let explicitGets = 0;
    globalThis.fetch = async (url, init) => {
      if (init?.method === "POST") {
        explicitPosts += 1;
        explicitRequest = JSON.parse(String(init.body)) as ZermoRequest;
        return Response.json({
          id: acceptedId,
          state: "succeeded",
          effective: explicitRequest.settings,
          outputs: [acceptedAsset],
        });
      }
      if (String(url).includes("/jobs/")) {
        explicitGets += 1;
        return Response.json({
          id: acceptedId,
          state: "succeeded",
          effective: explicitRequest?.settings,
          outputs: [acceptedAsset],
        });
      }
      return new Response(PNG, { headers: { "content-type": "image/png" } });
    };
    await generateDirectorFrames(
      explicitCtx,
      [
        {
          label: "Accepted frame",
          prompt: "The accepted lighthouse frame",
          style: "cinematic",
          seed: 7,
        },
      ],
      { w: 540, h: 960 },
    );
    assert.ok(explicitRequest);
    assert.equal(explicitRequest.seed, "18446744073709551615");
    assert.deepEqual(explicitRequest.settings, {
      width: 512,
      height: 512,
      steps: 8,
    });

    const { getJob } = await import("../src/lib/jobs/store");
    const acceptedIntent = (await getJob(explicitJob.id))?.zermoJobs?.[
      "frame:0:0"
    ];
    assert.equal(acceptedIntent?.remoteId, acceptedId);
    assert.deepEqual(acceptedIntent?.request, explicitRequest);

    await generateDirectorFrames(
      explicitCtx,
      [
        {
          label: "Replanned frame",
          prompt: "A replacement prompt that must not be submitted",
          style: "noir",
          seed: 999,
        },
      ],
      { w: 960, h: 540 },
    );
    const resumedIntent = (await getJob(explicitJob.id))?.zermoJobs?.[
      "frame:0:0"
    ];
    assert.equal(explicitPosts, 1);
    assert.equal(explicitGets, 1);
    assert.equal(resumedIntent?.remoteId, acceptedId);
    assert.deepEqual(resumedIntent?.request, acceptedIntent?.request);

    console.log(
      "PASS: Director contracts use real tiny FFmpeg media and hermetic transport; accepted frame resumes without POST",
    );
  } finally {
    globalThis.fetch = originalFetch;
    process.chdir(cwd);
    await fs.rm(tmp, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
