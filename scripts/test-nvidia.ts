import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";

async function main() {
  const cwd = process.cwd();
  const scratch = await fs.mkdtemp(path.join(os.tmpdir(), "fluxfield-nvidia-"));
  process.chdir(scratch);
  process.env.LOCAL_STUDIO_API_KEY_FILE = path.join(scratch, "absent");
  process.env.NVIDIA_NIM_API_KEY = "";
  process.env.NVIDIA_NIM_API_KEY_FILE = "";
  try {
    const { readSettings, publicSettings, writeSettings } = await import("../src/lib/settings");
    assert.equal((await readSettings()).nvidiaFallback, false, "Cloud fallback must be opt-in");
    const saved = await writeSettings({ nvidiaApiKey: "test-only-nvidia", nvidiaFallback: true });
    assert.equal(saved.nvidiaApiKey, "test-only-nvidia");
    assert.equal(publicSettings(saved).hasNvidiaApiKey, true);
    assert.ok(!JSON.stringify(publicSettings(saved)).includes("test-only-nvidia"));
    assert.equal((await fs.stat(".data/settings.json")).mode & 0o777, 0o600);
    assert.equal((await writeSettings({ nvidiaApiKey: "" })).nvidiaApiKey, "test-only-nvidia");
    assert.equal((await writeSettings({ clearNvidiaApiKey: true })).nvidiaApiKey, "");
    process.env.NVIDIA_NIM_API_KEY = "test-only-environment";
    assert.equal((await readSettings()).nvidiaApiKey, "test-only-environment");
    assert.ok(!(await fs.readFile(".data/settings.json", "utf8")).includes("test-only-environment"));
    process.env.NVIDIA_NIM_API_KEY = "";
    process.env.NVIDIA_NIM_API_KEY_FILE = path.join(scratch, "nvidia.key");
    await fs.writeFile(process.env.NVIDIA_NIM_API_KEY_FILE, "test-only-file\n", { mode: 0o600 });
    assert.equal((await readSettings()).nvidiaApiKey, "test-only-file");
    console.log("PASS NVIDIA settings: opt-in, masked presence, private disk, blank-preserves, clear, runtime env/file");

    const { runZermoAdapter } = await import("../src/lib/adapters/zermo");
    const { saveJob, getJob } = await import("../src/lib/jobs/store");
    const sharp = (await import("sharp")).default;
    const jpeg = await sharp({ create: { width: 1024, height: 1024, channels: 3, background: "orange" } }).jpeg().toBuffer();
    const job = { id: "nvidia-parent", tool: "dream", workflowSlug: "dream", workflowName: "Test", presetId: "test", presetLabel: "Test", status: "running", progress: 0, prompt: "cartoon fox", negativePrompt: "no text", aspect: "16:9", inputs: { seed: "42" }, modeUsed: "zermo", outputs: [], createdAt: "2026-09-22T00:00:00Z", updatedAt: "2026-09-22T00:00:00Z" } as import("../src/lib/adapters/types").StudioJob;
    const ctx = { job, settings: { ...await readSettings(), nvidiaFallback: true } };
    process.env.ZERMO_API_KEY = "test-only-primary";
    process.env.ZERMO_API_BASE = "http://127.0.0.1:1";
    const originalFetch = globalThis.fetch;
    let cloudCalls = 0;
    globalThis.fetch = async (url, init) => {
      if (String(url).startsWith("http://127.0.0.1:1/")) return new Response(null, { status: 503 });
      assert.equal(String(url), "https://ai.api.nvidia.com/v1/genai/black-forest-labs/flux.2-klein-4b");
      cloudCalls++;
      assert.equal(new Headers(init?.headers).get("authorization"), "Bearer test-only-file");
      assert.equal(init?.redirect, "error");
      assert.equal((await getJob(job.id))?.nvidiaImages?.["image:0"].state, "submitted", "Persist intent before cloud POST");
      const payload = JSON.parse(String(init?.body));
      assert.equal(payload.steps, 4); assert.equal(payload.samples, 1); assert.equal(payload.seed, 42);
      assert.ok(payload.prompt.includes("no text"));
      assert.equal(payload.mode, undefined); assert.equal(payload.cfg_scale, undefined);
      return Response.json({ artifacts: [{ base64: jpeg.toString("base64"), finishReason: "SUCCESS", seed: 42 }] });
    };
    try {
      await saveJob(job);
      const result = await runZermoAdapter(ctx).catch(() => ({ outputs: [] }));
      assert.match(result.outputs[0]?.label || "", /NVIDIA.*Klein/, "Unavailable primary must reach the opt-in Klein fallback");
      assert.equal(cloudCalls, 1);
      const bytes = await fs.readFile(path.join(".data/outputs", result.outputs[0].url!.split("/").pop()!));
      const size = await sharp(bytes).metadata();
      assert.equal(size.width, 1024); assert.equal(size.height, 576, "Preserve requested aspect after native generation");
      assert.deepEqual((await runZermoAdapter(ctx)).outputs, result.outputs);
      assert.equal(cloudCalls, 1, "Resume must collect, not submit again");
      const cloudFetch = globalThis.fetch;
      const fresh = async (id: string): Promise<import("../src/lib/adapters/types").AdapterContext> => { const next = { ...job, id }; await saveJob(next); return { ...ctx, job: next }; };
      for (const overrides of [{ nvidiaFallback: false }, { nvidiaApiKey: "" }]) {
        await assert.rejects(runZermoAdapter({ ...await fresh(`disabled-${cloudCalls}-${Object.keys(overrides)[0]}`), settings: { ...ctx.settings, ...overrides } }));
        assert.equal(cloudCalls, 1);
      }
      const reference = await fresh("reference-only");
      reference.referenceImagePath = path.join(scratch, "reference.jpg");
      await fs.writeFile(reference.referenceImagePath, jpeg);
      await assert.rejects(runZermoAdapter(reference)); assert.equal(cloudCalls, 1, "Never discard reference inputs to use cloud");
      const wideSeed = await fresh("wide-seed"); wideSeed.job.inputs = { seed: "18446744073709551615" };
      await assert.rejects(runZermoAdapter(wideSeed)); assert.equal(cloudCalls, 1, "Do not truncate a 64-bit seed");
      const remoteId = "job_" + "a".repeat(32), asset = "asset_" + "b".repeat(32);
      const png = await sharp(jpeg).png().toBuffer();
      let state = "succeeded", primarySubmits = 0;
      globalThis.fetch = async (url, init) => {
        if (!String(url).startsWith("http://127.0.0.1:1/")) return cloudFetch(url, init);
        if (String(url).endsWith("/capabilities")) return Response.json({ worker_availability: "configured", models: [{ id: "qwen-image-21", operations: ["image.generate"] }] });
        if (String(url).endsWith("/models")) return Response.json({ data: [{ id: "writer" }] });
        if (String(url).includes("/assets/")) return new Response(png, { headers: { "content-type": "image/png" } });
        if (init?.method === "POST") primarySubmits++;
        if (state === "transport-unknown") throw new Error("lost primary acknowledgement");
        return Response.json({ id: remoteId, state, outputs: state === "succeeded" ? [asset] : [], effective: {} });
      };
      assert.match((await runZermoAdapter(await fresh("primary-healthy"))).outputs[0].label, /Zermo/);
      assert.equal(cloudCalls, 1, "Primary remains primary");
      state = "transport-unknown";
      await assert.rejects(runZermoAdapter(await fresh("primary-unknown")), /transport interrupted/);
      assert.equal(cloudCalls, 1, "Uncertain primary must not duplicate into cloud");
      state = "cancelled";
      await assert.rejects(runZermoAdapter(await fresh("primary-cancelled")), /no replacement/); assert.equal(cloudCalls, 1);
      assert.equal(primarySubmits, 3);
      // The transport assertion above inspects the current parent ID.
      state = "failed";
      const failed = await fresh("primary-failed");
      const originalId = job.id; job.id = failed.job.id;
      assert.match((await runZermoAdapter(failed)).outputs[0].label, /NVIDIA/);
      job.id = originalId;
      assert.equal(cloudCalls, 2);
      assert.equal((await getJob(failed.job.id))?.zermoJobs?.["image:0"].remoteId, remoteId);
      const unknown = await fresh("cloud-unknown");
      globalThis.fetch = async url => {
        if (String(url).startsWith("http://127.0.0.1:1/")) return new Response(null, { status: 503 });
        cloudCalls++; throw new Error("lost hosted response");
      };
      await assert.rejects(runZermoAdapter(unknown), /outcome unknown/);
      await assert.rejects(runZermoAdapter(unknown), /no automatic replacement/);
      assert.equal(cloudCalls, 3);
      assert.equal((await getJob(unknown.job.id))?.nvidiaImages?.["image:0"].state, "submitted");
      await fs.unlink(path.join(".data/outputs", result.outputs[0].url!.split("/").pop()!));
      const { jobOutputsDir } = await import("../src/lib/data/paths");
      await fs.unlink(path.join(jobOutputsDir(job.id, job.createdAt), result.outputs[0].url!.split("/").pop()!));
      await assert.rejects(runZermoAdapter(ctx), /output unavailable/, "A missing saved image cannot be reported as success");
    } finally { globalThis.fetch = originalFetch; }
    console.log("PASS primary-first, opt-in gates, references, seeds, known failure, uncertain/cancelled work, cloud no-retry and missing-output safety");
    const ui = await fs.readFile(path.join(cwd, "src/app/settings/page.tsx"), "utf8");
    assert.ok(ui.includes('id="nvidia-key"') && ui.includes('htmlFor="nvidia-key"'), "Settings must offer a labeled masked NIM key field");
    assert.ok(ui.includes('id="nvidia-fallback"'), "Settings must offer an explicit fallback toggle");
  } finally {
    process.chdir(cwd);
    await fs.rm(scratch, { recursive: true, force: true });
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
