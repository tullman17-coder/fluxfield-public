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
      settings: { generationMode: "zermo" },
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
      "color=c=black:s=64x64:d=1",
      "-frames:v",
      "1",
      mp4Path,
    ]);
    const MP4 = await fs.readFile(mp4Path);
    const FLAC = Buffer.from("fLaC");
    const directorRequests: ZermoRequest[] = [];
    globalThis.fetch = async (_url, init) => {
      if (init?.method === "POST") {
        const headers = (init.headers || {}) as Record<string, string>;
        const ct = headers["Content-Type"] || headers["content-type"] || "";
        if (String(ct).includes("image/png")) {
          return Response.json({ id: `asset_${"e".repeat(32)}` });
        }
        const submitted = JSON.parse(String(init.body)) as ZermoRequest;
        directorRequests.push(submitted);
        const suffix = directorRequests.length.toString(16).padStart(32, "0");
        return Response.json({
          id: `job_${suffix}`,
          state: "succeeded",
          effective: submitted.settings,
          outputs: [`asset_${suffix}`],
        });
      }
      const last = directorRequests.at(-1);
      if (last?.operation === "music.generate") {
        return new Response(FLAC, { headers: { "content-type": "audio/flac" } });
      }
      if (last?.operation === "video.image_to_video") {
        return new Response(MP4, { headers: { "content-type": "video/mp4" } });
      }
      return new Response(PNG, { headers: { "content-type": "image/png" } });
    };
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
      "PASS: Director brief/look/defaults/explicit settings reach live requests; accepted frame resumes without POST",
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
